import crypto from "crypto";
import { getSetting, setSetting } from "./db";

// Generic 4-digit PIN gate (on top of the app lock). One factory, one set of
// security properties, used by the Map tab (lib/mapPin.ts) and the Notebooks
// tab (lib/notebooksPin.ts). Each gate gets its OWN settings keys, cookie name
// and token domain, so unlocking one never unlocks the other.
//
//  - Enforced SERVER-side: guarded routes refuse without a valid unlock
//    cookie; the page's PIN screen is only the UI for obtaining one.
//  - 4 digits is only 10,000 guesses, so the lockout escalates hard.
//  - Stored as a salted scrypt hash, never plaintext. Hash + fail state are
//    redacted from off-site backups (lib/backup.ts).
//  - The unlock cookie is short-lived, HMAC-signed, and bound to the current
//    PIN hash + session secret, so changing the PIN or "Lock all" invalidates it.

export const MAX_ATTEMPTS = 5;
export const UNLOCK_TTL_MS = 10 * 60 * 1000;

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}

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

export type UnlockResult =
  | { ok: true }
  | { ok: false; lockedMs: number; attemptsLeft: number };

export type PinGateConfig = {
  /** settings key for the salted scrypt hash */
  hashKey: string;
  /** settings key for the escalating-lockout state */
  failKey: string;
  /** HMAC domain separator, so tokens never validate across gates */
  tokenDomain: string;
  cookieName: string;
  /** cookie Path scope */
  cookiePath: string;
};

export function createPinGate(cfg: PinGateConfig) {
  function configured(): boolean {
    return !!getSetting(cfg.hashKey);
  }

  function setPin(pin: string): void {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(pin, salt, 32).toString("hex");
    setSetting(cfg.hashKey, `${salt}:${hash}`);
    setSetting(cfg.failKey, "");
  }

  function pinMatches(pin: string): boolean {
    const stored = getSetting(cfg.hashKey);
    if (!stored) return false;
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const got = crypto.scryptSync(pin, salt, 32);
    const want = Buffer.from(hash, "hex");
    return want.length === got.length && crypto.timingSafeEqual(got, want);
  }

  function readFail(): FailState {
    try {
      const raw = getSetting(cfg.failKey);
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

  function lockRemainingMs(now = Date.now()): number {
    return Math.max(0, readFail().lockedUntil - now);
  }

  function attemptsLeft(): number {
    return MAX_ATTEMPTS - readFail().fails;
  }

  function tryUnlock(pin: string, now = Date.now()): UnlockResult {
    const lockedMs = lockRemainingMs(now);
    if (lockedMs > 0) return { ok: false, lockedMs, attemptsLeft: 0 };
    if (isValidPin(pin) && pinMatches(pin)) {
      setSetting(cfg.failKey, "");
      return { ok: true };
    }
    const next = afterFailure(readFail(), now);
    setSetting(cfg.failKey, JSON.stringify(next));
    return {
      ok: false,
      lockedMs: Math.max(0, next.lockedUntil - now),
      attemptsLeft: MAX_ATTEMPTS - next.fails,
    };
  }

  function cookieKey(): Buffer {
    const base = `${getSetting("session_secret") || ""}|${getSetting(cfg.hashKey) || ""}`;
    return crypto.createHash("sha256").update(cfg.tokenDomain + base).digest();
  }

  function makeUnlockToken(now = Date.now()): string {
    const exp = now + UNLOCK_TTL_MS;
    const sig = crypto.createHmac("sha256", cookieKey()).update(String(exp)).digest("hex");
    return `${exp}.${sig}`;
  }

  function verifyUnlockToken(token: string | undefined, now = Date.now()): boolean {
    if (!token || !configured()) return false;
    const [expStr, sig] = token.split(".");
    const exp = Number(expStr);
    if (!sig || !Number.isFinite(exp) || exp <= now) return false;
    const want = crypto.createHmac("sha256", cookieKey()).update(String(exp)).digest("hex");
    return (
      sig.length === want.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))
    );
  }

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: cfg.cookiePath,
    maxAge: UNLOCK_TTL_MS / 1000,
  };

  return {
    cookieName: cfg.cookieName,
    configured,
    setPin,
    lockRemainingMs,
    attemptsLeft,
    tryUnlock,
    makeUnlockToken,
    verifyUnlockToken,
    cookieOptions,
  };
}
