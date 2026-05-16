import crypto from "crypto";
import { cookies } from "next/headers";
import { getSetting, setSetting } from "@/lib/db";

export const SESSION_COOKIE = "fc_session";
export const CHALLENGE_COOKIE = "fc_challenge";

// How long a successful unlock keeps the app open on a device.
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // seconds

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

/** True if the current request carries a valid session, or the lock is off. */
export function isAuthenticated(): boolean {
  if (!isLockEnabled()) return true;
  const token = cookies().get(SESSION_COOKIE)?.value;
  return !!token && verifySessionToken(token);
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
