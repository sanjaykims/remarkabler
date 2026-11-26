import {
  MAX_ATTEMPTS,
  afterFailure,
  createPinGate,
  isValidPin,
  lockDurationMs,
  type FailState,
  type UnlockResult,
} from "./pinGate";

// The Map tab's 4-digit PIN (on top of the app lock). All the mechanics live
// in lib/pinGate.ts; this file only fixes the Map gate's keys and cookie.
// The "map-unlock|" domain string and key names are unchanged, so existing
// PINs and unlock cookies keep working across this refactor.

export const MAP_UNLOCK_COOKIE = "fc_map_unlock";

const gate = createPinGate({
  hashKey: "map_pin_hash",
  failKey: "map_pin_fail",
  tokenDomain: "map-unlock|",
  cookieName: MAP_UNLOCK_COOKIE,
  cookiePath: "/api/map",
});

export { MAX_ATTEMPTS, isValidPin, lockDurationMs, afterFailure };
export type { FailState, UnlockResult };

export const mapPinConfigured = gate.configured;
export const setMapPin = gate.setPin;
export const mapPinLockRemainingMs = gate.lockRemainingMs;
export const attemptsLeft = gate.attemptsLeft;
export const tryUnlock = gate.tryUnlock;
export const makeUnlockToken = gate.makeUnlockToken;
export const verifyUnlockToken = gate.verifyUnlockToken;
export const mapUnlockCookieOptions = gate.cookieOptions;
