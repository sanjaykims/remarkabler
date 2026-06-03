import crypto from "crypto";
import { cookies } from "next/headers";
import { getSetting, setSetting } from "@/lib/db";

export const SESSION_COOKIE = "fc_session";
export const CHALLENGE_COOKIE = "fc_challenge";

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

/** Constant-time comparison of a submitted passcode against APP_PASSCODE. */
export function checkPasscode(input: string): boolean {
  const expected = process.env.APP_PASSCODE || "";
  if (!expected || !input) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
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
