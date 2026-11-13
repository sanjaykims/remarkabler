import { beforeAll, describe, expect, it } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";

let m: typeof import("../lib/mapPin");

beforeAll(async () => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "mappin-"));
  m = await import("../lib/mapPin");
});

describe("map PIN with a real settings table", () => {
  it("unlock flow, cookie binding and lockout", () => {
    expect(m.mapPinConfigured()).toBe(false);
    expect(m.verifyUnlockToken(m.makeUnlockToken())).toBe(false); // no PIN yet
    m.setMapPin("4821");
    expect(m.mapPinConfigured()).toBe(true);

    const tok = m.makeUnlockToken();
    expect(m.verifyUnlockToken(tok)).toBe(true);
    expect(m.verifyUnlockToken(tok + "0")).toBe(false);
    expect(m.verifyUnlockToken(undefined)).toBe(false);
    expect(m.verifyUnlockToken(m.makeUnlockToken(Date.now() - 11 * 60e3))).toBe(false); // expired

    expect(m.tryUnlock("4821").ok).toBe(true);
    for (let i = 0; i < m.MAX_ATTEMPTS; i++) expect(m.tryUnlock("0000").ok).toBe(false);
    expect(m.mapPinLockRemainingMs()).toBeGreaterThan(0);
    // Even the right PIN is refused while locked.
    expect(m.tryUnlock("4821").ok).toBe(false);

    // Changing the PIN invalidates outstanding unlock cookies and clears the lock.
    m.setMapPin("1357");
    expect(m.verifyUnlockToken(tok)).toBe(false);
    expect(m.mapPinLockRemainingMs()).toBe(0);
    expect(m.tryUnlock("1357").ok).toBe(true);
  });
});
