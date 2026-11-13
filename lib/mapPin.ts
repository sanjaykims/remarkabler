import crypto from "crypto";
import { getSetting, setSetting } from "./db";

// A second, 4-digit PIN in front of the /map tab (on top of the app lock).
// Why it is built this way:
//  - Enforced SERVER-side: /api/map refuses without a valid unlock cookie; the
//    page's PIN screen is only the UI for obtaining one.
//  - 4 digits is only 10,000 guesses, so the lockout escalates hard (see
//    lockDurationMs). Persisted in `settings`, redacted from backups.
//  - Stored as a salted scrypt hash, never plaintext. The hash is redacted
//    from off-site backups (a 4-digit hash is trivially brute-forced offline).
//  - The unlock cookie is short-lived, HMAC-signed, and bound to the current
//    PIN hash, so changing the PIN or "Lock all" (session secret rotation)
//    invalidates it.

export const MAP_UNLOCK_COOKIE = "fc_map_unlock";
export const MAP_UNLOCK_TTL_MS = 10 * 60 * 1000;
const PIN_HASH_KEY = "map_pin_hash";
const FAIL_KEY = "map_pin_fail";
export const MAX_ATTEMPTS = 5;

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}

export function mapPinConfigured(): boolean {
  return !!getSetting(PIN_HASH_KEY);
}

export function setMapPin(pin: string): void {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 32).toString("hex");
  setSetting(PIN_HASH_KEY, `${salt}:${hash}`);
  setSetting(FAIL_KEY, "");
}

function pinMatches(pin: string): boolean {
  const stored = getSetting(PIN_HASH_KEY);
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const got = crypto.scryptSync(pin, salt, 32);
  const want = Buffer.from(hash, "hex");
  return want.length === got.length && crypto.timingSafeEqual(got, want);
}

// ── escalating lockout ─────────────────────────────────────────────────────
export type FailState = { fails: number; lockouts: number; lockedUntil: number };

/** 15 min, 1 h, 4 h, then 24 h for every lockout after that. */
export function lockDurationMs(lockouts: number): number {
  const steps = [15 * 60e3, 60 * 60e3, 4 * 60 * 60e3];
  return steps[Math.min(lockouts, steps.length)] ?? 24 * 60 * 60e3;
}

/** Pure: state after one more wrong PIN. */
export function afterFailure(s: FailState, now: number): FailState {
  const fails = s.fails + 1;
  if (fails < MAX_ATTEMPTS) return { ...s, fails };
  return {
    fails: 0,
    lockouts: s.lockouts + 1,
    lockedUntil: now + lockDurationMs(s.lockouts),
  };
}

function readFail(): FailState {
  try {
    const raw = getSetting(FAIL_KEY);
    if (raw) {
      const j = JSON.parse(raw);
      return {
        fails: Number(j.fails) || 0,
        lockouts: Number(j.lockouts) || 0,
        lockedUntil: Number(j.lockedUntil) || 0,
      };
    }
  } catch {
    /* fall through */
  }
  return { fails: 0, lockouts: 0, lockedUntil: 0 };
}

export function mapPinLockRemainingMs(now = Date.now()): number {
  return Math.max(0, readFail().lockedUntil - now);
}

export function attemptsLeft(): number {
  return MAX_ATTEMPTS - readFail().fails;
}

export type UnlockResult =
  | { ok: true }
  | { ok: false; lockedMs: number; attemptsLeft: number };

export function tryUnlock(pin: string, now = Date.now()): UnlockResult {
  const lockedMs = mapPinLockRemainingMs(now);
  if (lockedMs > 0) return { ok: false, lockedMs, attemptsLeft: 0 };
  if (isValidPin(pin) && pinMatches(pin)) {
    setSetting(FAIL_KEY, "");
    return { ok: true };
  }
  const next = afterFailure(readFail(), now);
  setSetting(FAIL_KEY, JSON.stringify(next));
  return {
    ok: false,
    lockedMs: Math.max(0, next.lockedUntil - now),
    attemptsLeft: MAX_ATTEMPTS - next.fails,
  };
}

// ── unlock cookie ──────────────────────────────────────────────────────────
function cookieKey(): Buffer {
  // Derived from the session secret (rotating it = "Lock all") and the PIN
  // hash (changing the PIN invalidates outstanding unlocks).
  const base = `${getSetting("session_secret") || ""}|${getSetting(PIN_HASH_KEY) || ""}`;
  return crypto.createHash("sha256").update("map-unlock|" + base).digest();
}

export function makeUnlockToken(now = Date.now()): string {
  const exp = now + MAP_UNLOCK_TTL_MS;
  const sig = crypto.createHmac("sha256", cookieKey()).update(String(exp)).digest("hex");
  return `${exp}.${sig}`;
}

export function verifyUnlockToken(token: string | undefined, now = Date.now()): boolean {
  if (!token || !mapPinConfigured()) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!sig || !Number.isFinite(exp) || exp <= now) return false;
  const want = crypto.createHmac("sha256", cookieKey()).update(String(exp)).digest("hex");
  return (
    sig.length === want.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))
  );
}

export const mapUnlockCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/map",
  maxAge: MAP_UNLOCK_TTL_MS / 1000,
};
