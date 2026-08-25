import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSetting, setSetting, clearSetting } from "@/lib/db";

export const SESSION_COOKIE = "fc_session";
// The two WebAuthn ceremonies get SEPARATE challenge cookies on purpose.
//
// `login-options` has to stay ungated — an unauthenticated visitor must be
// able to start a passkey login. If both ceremonies shared one cookie, that
// ungated endpoint would hand out the only thing enrollment needs, and the
// passcode gate on `register-options` would protect nothing: call
// `login-options`, build a self-attested credential against the challenge it
// returns, POST it to `register-verify`, and you get a session AND a
// permanently registered passkey that survives passcode rotation.
//
// Registration uses `attestationType: "none"` (lib/webauthn.ts), so no
// cryptography stands in the way — only this boundary does. Keep them apart.
export const REG_CHALLENGE_COOKIE = "fc_reg_challenge";
export const AUTH_CHALLENGE_COOKIE = "fc_auth_challenge";

// How long a successful unlock keeps the app open on a device.
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // seconds

// Sliding inactivity timeout (server-side defence in depth). Even if the
// client-side AutoLock fails or is bypassed, the server itself refuses to
// honour a session that hasn't seen any activity for this long, forcing a
// fresh fingerprint / passcode unlock. Tune with INACTIVITY_HOURS env var
// (default 24).
const INACTIVITY_TIMEOUT_MS =
  (Number(process.env.INACTIVITY_HOURS) || 24) * 60 * 60 * 1000;
// Refresh the activity stamp at most this often, so isAuthenticated() —
// which is called many times per page render — isn't writing to the
// settings table on every single call.
const ACTIVITY_REFRESH_THROTTLE_MS = 60 * 1000;

function markActivityNow(now: number): void {
  setSetting("last_activity_at", String(now));
}

function getLastActivityMs(): number | null {
  const v = getSetting("last_activity_at");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * The lock is active only once the owner sets APP_PASSCODE in the environment.
 * Before that, the app behaves exactly as before — so deploying this code
 * cannot lock anyone out; the lock "turns on" when the passcode is set.
 */
export function isLockEnabled(): boolean {
  return !!process.env.APP_PASSCODE;
}

// A signing secret for session tokens, generated once and kept in the DB so
// no extra environment variable is needed.
function sessionSecret(): string {
  let s = getSetting("session_secret");
  if (!s) {
    s = crypto.randomBytes(32).toString("hex");
    setSetting("session_secret", s);
  }
  return s;
}

export function createSessionToken(): string {
  // Any new session is a fresh authentication event — reset the activity
  // clock so the inactivity timeout starts from now.
  markActivityNow(Date.now());
  const payload = String(Date.now() + SESSION_MAX_AGE * 1000);
  const sig = crypto
    .createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("hex");
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string): boolean {
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto
    .createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("hex");
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return false;
  }
  const exp = Number(payload);
  return Number.isFinite(exp) && exp > Date.now();
}

/**
 * True if the current request carries a valid session, or the lock is off.
 *
 * Also enforces the sliding inactivity timeout: a request whose session
 * hasn't been touched in INACTIVITY_TIMEOUT_MS is rejected here, even if
 * the cookie's own HMAC is still intact. Active sessions get their
 * `last_activity_at` refreshed (throttled so we're not writing on every
 * single call inside a single render).
 */
export function isAuthenticated(): boolean {
  if (!isLockEnabled()) return true;
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token || !verifySessionToken(token)) return false;

  const now = Date.now();
  const last = getLastActivityMs();
  if (last !== null && now - last > INACTIVITY_TIMEOUT_MS) {
    return false; // session expired due to inactivity
  }
  if (last === null || now - last > ACTIVITY_REFRESH_THROTTLE_MS) {
    markActivityNow(now);
  }
  return true;
}

/**
 * Route guard: returns a 401 response to send when the request isn't
 * authenticated, or `null` when it is (so the handler proceeds). Use as:
 *
 *   const denied = requireAuth();
 *   if (denied) return denied;
 *
 * A single shared guard so a new API route can't silently ship without the
 * lock — `test/authGuard.test.ts` enforces that every non-public route file
 * references a guard. Equivalent to the hand-rolled
 * `if (!isAuthenticated()) return NextResponse.json({error:"Locked"},{status:401})`
 * that most routes already use.
 */
export function requireAuth(): NextResponse | null {
  if (isAuthenticated()) return null;
  return NextResponse.json({ error: "Locked" }, { status: 401 });
}

/** Constant-time comparison of a submitted passcode against APP_PASSCODE. */
export function checkPasscode(input: string): boolean {
  const expected = process.env.APP_PASSCODE || "";
  if (!expected || !input) return false;
  // Hash both sides first so the timing-safe compare always runs on
  // fixed-length digests — comparing raw buffer lengths first would leak
  // the expected passcode's length via response timing.
  const a = crypto.createHash("sha256").update(input).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// ── Brute-force lockout on the guessable secret (the passcode) ─────────────
//
// The passcode is the one credential in this app that's actually guessable
// (unlike a WebAuthn assertion, which isn't practically forgeable, so it
// isn't gated here). Without a limiter an internet-facing instance could be
// brute-forced by automated attempts. Persisted in `settings` (not just
// in-memory) so it survives a Railway cold restart mid-attack, mirroring the
// failure-backoff pattern already used for the Dropbox/reMarkable watchers.
// A single 15-minute window serves both roles: up to AUTH_FAIL_MAX attempts
// are allowed inside it, and once tripped the lock lasts until that same
// window (measured from the FIRST failure in it) elapses — at which point
// the very next attempt starts a fresh window. One constant, one meaning.
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_FAIL_MAX = 8;
const AUTH_FAIL_KEY = "auth_fail_state";

type AuthFailState = { count: number; windowStart: number };

function getAuthFailState(): AuthFailState {
  const raw = getSetting(AUTH_FAIL_KEY);
  if (!raw) return { count: 0, windowStart: 0 };
  try {
    const v = JSON.parse(raw);
    return {
      count: Number(v.count) || 0,
      windowStart: Number(v.windowStart) || 0,
    };
  } catch {
    return { count: 0, windowStart: 0 };
  }
}

/** Milliseconds remaining before another passcode attempt is allowed, or null if not locked. */
export function passcodeLockRemainingMs(): number | null {
  const { count, windowStart } = getAuthFailState();
  if (count < AUTH_FAIL_MAX) return null;
  const elapsed = Date.now() - windowStart;
  if (elapsed >= AUTH_WINDOW_MS) return null; // window has expired
  return AUTH_WINDOW_MS - elapsed;
}

export function recordFailedPasscodeAttempt(): void {
  const now = Date.now();
  const { count, windowStart } = getAuthFailState();
  const expired = windowStart === 0 || now - windowStart > AUTH_WINDOW_MS;
  const next: AuthFailState = expired
    ? { count: 1, windowStart: now }
    : { count: count + 1, windowStart };
  setSetting(AUTH_FAIL_KEY, JSON.stringify(next));
}

export function recordSuccessfulAuth(): void {
  clearSetting(AUTH_FAIL_KEY);
}

const secureCookie = process.env.NODE_ENV === "production";

export const sessionCookieOptions = {
  httpOnly: true,
  secure: secureCookie,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

export const challengeCookieOptions = {
  httpOnly: true,
  secure: secureCookie,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 300,
};
