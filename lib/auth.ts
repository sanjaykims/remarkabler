import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db, getSetting, setSetting, clearSetting } from "@/lib/db";

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
// Refresh each session at most this often, so isAuthenticated() is not
// writing on every request inside one render.
const ACTIVITY_REFRESH_THROTTLE_MS = 60 * 1000;

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

/**
 * Invalidates every currently issued app session without changing the
 * configured passcode or registered passkeys. Ordinary per-device logout must
 * not call this: rotating the HMAC secret is deliberately the "lock all
 * devices" operation.
 */
export function revokeAllSessions(): void {
  db().transaction(() => {
    db().prepare(`DELETE FROM app_sessions`).run();
    setSetting("session_secret", crypto.randomBytes(32).toString("hex"));
  })();
}

export function createSessionToken(): string {
  const now = Date.now();
  const sessionId = crypto.randomBytes(16).toString("hex");
  const expiresAt = now + SESSION_MAX_AGE * 1000;
  const payload = `v1.${sessionId}.${expiresAt}`;
  const sig = crypto
    .createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("hex");
  db().transaction(() => {
    db()
      .prepare(
        `INSERT INTO app_sessions(id, last_activity_at, expires_at)
         VALUES(?,?,?)`
      )
      .run(sessionId, now, expiresAt);
    db().prepare(`DELETE FROM app_sessions WHERE expires_at <= ?`).run(now);
  })();
  return `${payload}.${sig}`;
}

type VerifiedSession = { id: string; expiresAt: number };

function verifySessionToken(token: string): VerifiedSession | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const parts = payload.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !/^[a-f0-9]{32}$/.test(parts[1])) {
    return null;
  }
  const expected = crypto
    .createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("hex");
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  const expiresAt = Number(parts[2]);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return { id: parts[1], expiresAt };
}

export function revokeSessionToken(token: string | undefined): void {
  if (!token) return;
  const verified = verifySessionToken(token);
  if (verified) db().prepare(`DELETE FROM app_sessions WHERE id = ?`).run(verified.id);
}

/**
 * True if the current request carries a valid session, or the lock is off.
 *
 * Also enforces the per-session sliding inactivity timeout: a request whose session
 * hasn't been touched in INACTIVITY_TIMEOUT_MS is rejected here, even if
 * the cookie's own HMAC is still intact. Active session records are refreshed
 * at most once per minute.
 */
export async function isAuthenticated(): Promise<boolean> {
  if (!isLockEnabled()) return true;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const verified = token ? verifySessionToken(token) : null;
  if (!verified) return false;

  const now = Date.now();
  const row = db()
    .prepare(
      `SELECT last_activity_at, expires_at FROM app_sessions WHERE id = ?`
    )
    .get(verified.id) as
    | { last_activity_at: number; expires_at: number }
    | undefined;
  if (!row || row.expires_at !== verified.expiresAt) return false;
  if (now - row.last_activity_at > INACTIVITY_TIMEOUT_MS) {
    db().prepare(`DELETE FROM app_sessions WHERE id = ?`).run(verified.id);
    return false;
  }
  if (now - row.last_activity_at > ACTIVITY_REFRESH_THROTTLE_MS) {
    db()
      .prepare(`UPDATE app_sessions SET last_activity_at = ? WHERE id = ?`)
      .run(now, verified.id);
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
export async function requireAuth(): Promise<NextResponse | null> {
  if (await isAuthenticated()) return null;
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
// TWO limiters, deliberately. Route callers pass a per-request source
// (lib/clientIp.ts) so one noisy source cannot lock the owner out — but that
// source is derived from a proxy header, and the X-Forwarded-For convention is
// APPEND, so its leftmost value is only trustworthy while a sanitizing edge
// sits in front of us. If that assumption is ever wrong, an attacker rotating
// the header would get an unlimited number of fresh 8-attempt buckets.
//
// So the per-source bucket is the FAST limiter (fairness), and a much higher
// GLOBAL bucket is the FLOOR (a hard ceiling on total guesses). The floor is
// set far above what one legitimate person fumbling their passcode produces,
// so it cannot be tripped as a cheap owner-DoS, while still bounding a
// distributed attacker: 60/hour against a 6-digit passcode is ~2 years.
// Getting the source derivation wrong therefore degrades the limiter to
// "slow", never to "unlimited".
//
// A valid passkey bypasses BOTH and clears them — that is proof of ownership,
// and it is the owner's escape hatch if an attacker has filled the floor.
// A single window serves both roles per bucket: up to MAX attempts are allowed
// inside it, and once tripped the lock lasts until that same window (measured
// from the FIRST failure in it) elapses.
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_FAIL_MAX = 8;
const AUTH_FAIL_KEY = "auth_fail_state";

const GLOBAL_WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_FAIL_MAX = 60;
const GLOBAL_FAIL_KEY = "auth_fail_global";

type AuthFailState = { count: number; windowStart: number };

function authFailKey(source?: string): string {
  if (!source) return AUTH_FAIL_KEY; // compatibility for internal callers
  const digest = crypto.createHash("sha256").update(source).digest("hex");
  return `${AUTH_FAIL_KEY}:${digest}`;
}

function getAuthFailState(source?: string): AuthFailState {
  return getRawAuthFailState(authFailKey(source));
}

function getRawAuthFailState(key: string): AuthFailState {
  const raw = getSetting(key);
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

function remainingFor(
  state: AuthFailState,
  max: number,
  windowMs: number
): number | null {
  if (state.count < max) return null;
  const elapsed = Date.now() - state.windowStart;
  if (elapsed >= windowMs) return null; // window has expired
  return windowMs - elapsed;
}

/**
 * Milliseconds remaining before another passcode attempt is allowed, or null
 * if not locked. Locked when EITHER the caller's own bucket or the global
 * floor is tripped; the longer remaining time wins.
 */
export function passcodeLockRemainingMs(source?: string): number | null {
  const perSource = remainingFor(
    getAuthFailState(source),
    AUTH_FAIL_MAX,
    AUTH_WINDOW_MS
  );
  const global = remainingFor(
    getRawAuthFailState(GLOBAL_FAIL_KEY),
    GLOBAL_FAIL_MAX,
    GLOBAL_WINDOW_MS
  );
  if (perSource === null && global === null) return null;
  return Math.max(perSource ?? 0, global ?? 0);
}

function bumpBucket(key: string, windowMs: number, now: number): void {
  const { count, windowStart } = getRawAuthFailState(key);
  const expired = windowStart === 0 || now - windowStart > windowMs;
  const next: AuthFailState = expired
    ? { count: 1, windowStart: now }
    : { count: count + 1, windowStart };
  setSetting(key, JSON.stringify(next));
}

export function recordFailedPasscodeAttempt(source?: string): void {
  const now = Date.now();
  bumpBucket(authFailKey(source), AUTH_WINDOW_MS, now);
  bumpBucket(GLOBAL_FAIL_KEY, GLOBAL_WINDOW_MS, now);
  pruneExpiredAuthFailBuckets(now);
}

/**
 * Drop per-source buckets whose window has long elapsed.
 *
 * Without this every distinct source that ever failed leaves a permanent
 * `settings` row on the /data volume, which an attacker rotating the source
 * value can grow without bound — and those rows also ship in the weekly
 * off-site backup. Pruned opportunistically on write, mirroring how
 * lib/pendingShares.ts prunes share_rate_events.
 */
function pruneExpiredAuthFailBuckets(now: number): void {
  try {
    db()
      .prepare(
        `DELETE FROM settings
          WHERE key LIKE 'auth_fail_state:%'
            AND CAST(json_extract(value, '$.windowStart') AS INTEGER) < ?`
      )
      .run(now - AUTH_WINDOW_MS);
  } catch {
    // best-effort; a malformed row simply isn't pruned this pass
  }
}

export function recordSuccessfulAuth(source?: string): void {
  clearSetting(authFailKey(source));
  // Proof of ownership clears the global floor too — otherwise an attacker who
  // filled it could keep the owner locked out even after a valid passkey.
  clearSetting(GLOBAL_FAIL_KEY);
  if (source) clearSetting(AUTH_FAIL_KEY); // legacy no-source bucket
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
