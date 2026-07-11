import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// The passcode is the one guessable credential in the app (unlike a WebAuthn
// assertion, which isn't practically forgeable). Without a limiter an
// internet-facing instance could be brute-forced. These tests pin the
// lockout math: N failures within the window locks further attempts for the
// remainder of that window; a success clears it; the window then resets.

type DbMod = typeof import("@/lib/db");
type AuthMod = typeof import("@/lib/auth");

let dbMod: DbMod;
let authMod: AuthMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "auth-lockout-"));
  process.env.ANTHROPIC_API_KEY = "test-key";
  dbMod = await import("@/lib/db");
  authMod = await import("@/lib/auth");
  dbMod.db();
});

beforeEach(() => {
  dbMod.clearSetting("auth_fail_state");
});

describe("passcode lockout", () => {
  it("is unlocked with no failures recorded", () => {
    expect(authMod.passcodeLockRemainingMs()).toBeNull();
  });

  it("stays unlocked below the failure threshold", () => {
    for (let i = 0; i < 7; i++) authMod.recordFailedPasscodeAttempt();
    expect(authMod.passcodeLockRemainingMs()).toBeNull();
  });

  it("locks once the threshold is reached, with a positive remaining time", () => {
    for (let i = 0; i < 8; i++) authMod.recordFailedPasscodeAttempt();
    const remaining = authMod.passcodeLockRemainingMs();
    expect(remaining).not.toBeNull();
    expect(remaining as number).toBeGreaterThan(0);
    expect(remaining as number).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  it("a successful auth clears the lock immediately", () => {
    for (let i = 0; i < 8; i++) authMod.recordFailedPasscodeAttempt();
    expect(authMod.passcodeLockRemainingMs()).not.toBeNull();
    authMod.recordSuccessfulAuth();
    expect(authMod.passcodeLockRemainingMs()).toBeNull();
  });

  it("unlocks once the window has elapsed, and the next failure starts a fresh window", () => {
    for (let i = 0; i < 8; i++) authMod.recordFailedPasscodeAttempt();
    expect(authMod.passcodeLockRemainingMs()).not.toBeNull();

    // Simulate the window having elapsed by backdating the stored state —
    // same white-box approach used elsewhere for time-gated logic, since
    // this module can't take an injected clock without changing its API.
    const state = JSON.parse(dbMod.getSetting("auth_fail_state") as string);
    dbMod.setSetting(
      "auth_fail_state",
      JSON.stringify({ ...state, windowStart: Date.now() - 16 * 60 * 1000 })
    );
    expect(authMod.passcodeLockRemainingMs()).toBeNull();

    // One more failure after the stale window must start counting from 1
    // again, not resume from the old (already-expired) count of 8.
    authMod.recordFailedPasscodeAttempt();
    expect(authMod.passcodeLockRemainingMs()).toBeNull();
    const fresh = JSON.parse(dbMod.getSetting("auth_fail_state") as string);
    expect(fresh.count).toBe(1);
  });
});
