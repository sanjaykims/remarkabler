import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// The passcode limiter has TWO buckets, and the pairing is the point.
//
// Per-source buckets keep one noisy source from locking the owner out. But the
// source comes from a proxy header, and the X-Forwarded-For convention is
// APPEND — its leftmost value is only trustworthy while a sanitizing edge sits
// in front of the app. If that assumption is ever wrong (a CDN added, a
// different host, direct reach), an attacker rotating the header would get an
// unlimited supply of fresh 8-attempt buckets and the passcode would be
// effectively unthrottled.
//
// The global floor is what makes that assumption non-load-bearing: getting the
// source derivation wrong degrades the limiter to "slow", never "unlimited".

type AuthMod = typeof import("@/lib/auth");
type DbMod = typeof import("@/lib/db");

let auth: AuthMod;
let dbMod: DbMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "auth-floor-"));
  process.env.APP_PASSCODE = "test-passcode";
  dbMod = await import("@/lib/db");
  auth = await import("@/lib/auth");
});

beforeEach(() => {
  dbMod.db().exec(`DELETE FROM settings`);
});

describe("passcode lockout floor", () => {
  it("still isolates one source from another below the floor", () => {
    for (let i = 0; i < 8; i++) auth.recordFailedPasscodeAttempt("198.51.100.1");
    expect(auth.passcodeLockRemainingMs("198.51.100.1")).not.toBeNull();
    // Fairness: a different source is unaffected.
    expect(auth.passcodeLockRemainingMs("203.0.113.8")).toBeNull();
  });

  it("locks EVERY source once the global floor is reached", () => {
    // The spoofing / distributed case: each source stays under its own limit,
    // so the per-source bucket never trips. Only the floor stops this.
    for (let i = 0; i < 60; i++) {
      auth.recordFailedPasscodeAttempt(`10.0.0.${i}`);
    }

    // A brand-new source — its own bucket is empty — is still refused.
    expect(auth.passcodeLockRemainingMs("192.0.2.77")).not.toBeNull();
    // And so is the no-source path.
    expect(auth.passcodeLockRemainingMs()).not.toBeNull();
  });

  it("does not trip the floor from one person fumbling their passcode", () => {
    // The floor must not become a cheap owner-DoS or a self-lockout: a single
    // source hits its own 8-attempt limit long before the floor at 60.
    for (let i = 0; i < 8; i++) auth.recordFailedPasscodeAttempt("198.51.100.1");
    expect(auth.passcodeLockRemainingMs("203.0.113.8")).toBeNull();
  });

  it("clears BOTH buckets on a successful auth", () => {
    for (let i = 0; i < 60; i++) auth.recordFailedPasscodeAttempt(`10.0.1.${i}`);
    expect(auth.passcodeLockRemainingMs("192.0.2.77")).not.toBeNull();

    // Proof of ownership (a passkey, or the correct passcode) is the owner's
    // escape hatch from a floor an attacker filled.
    auth.recordSuccessfulAuth("192.0.2.77");

    expect(auth.passcodeLockRemainingMs("192.0.2.77")).toBeNull();
    expect(auth.passcodeLockRemainingMs()).toBeNull();
  });

  it("prunes expired per-source buckets instead of accumulating rows forever", () => {
    const count = () =>
      (
        dbMod
          .db()
          .prepare(
            `SELECT COUNT(*) AS c FROM settings WHERE key LIKE 'auth_fail_state:%'`
          )
          .get() as { c: number }
      ).c;

    // Simulate buckets whose windows elapsed long ago.
    const stale = JSON.stringify({ count: 3, windowStart: Date.now() - 86_400_000 });
    for (let i = 0; i < 5; i++) {
      dbMod.setSetting(`auth_fail_state:stale${i}`, stale);
    }
    expect(count()).toBe(5);

    // Any write prunes opportunistically.
    auth.recordFailedPasscodeAttempt("198.51.100.9");

    // Only the fresh bucket survives; the five stale rows are gone.
    expect(count()).toBe(1);
  });
});
