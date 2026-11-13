import { describe, expect, it } from "vitest";
import { afterFailure, lockDurationMs, isValidPin, MAX_ATTEMPTS } from "../lib/mapPin";

describe("map PIN", () => {
  it("accepts exactly 4 digits", () => {
    expect(isValidPin("0123")).toBe(true);
    for (const bad of ["123", "12345", "12a4", "", " 123", 1234, null]) {
      expect(isValidPin(bad)).toBe(false);
    }
  });
  it("locks after MAX_ATTEMPTS and escalates", () => {
    let s = { fails: 0, lockouts: 0, lockedUntil: 0 };
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) s = afterFailure(s, 1000);
    expect(s.lockedUntil).toBe(0);
    s = afterFailure(s, 1000);
    expect(s.lockedUntil).toBe(1000 + lockDurationMs(0));
    expect(s.lockouts).toBe(1);
    expect(lockDurationMs(0)).toBe(15 * 60e3);
    expect(lockDurationMs(1)).toBe(60 * 60e3);
    expect(lockDurationMs(2)).toBe(4 * 60 * 60e3);
    expect(lockDurationMs(3)).toBe(24 * 60 * 60e3);
    expect(lockDurationMs(50)).toBe(24 * 60 * 60e3);
  });
});
