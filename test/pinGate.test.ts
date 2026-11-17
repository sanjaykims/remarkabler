import { beforeAll, describe, expect, it } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";

let g: typeof import("../lib/pinGate");

beforeAll(async () => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "pingate-"));
  g = await import("../lib/pinGate");
});

const cfg = (n: string) => ({
  hashKey: `${n}_hash`, failKey: `${n}_fail`, tokenDomain: n, cookieName: `c_${n}`, cookiePath: "/",
});

describe("pinGate pure helpers", () => {
  it("accepts only exactly 4 digits", () => {
    for (const ok of ["0000", "1234"]) expect(g.isValidPin(ok)).toBe(true);
    for (const bad of ["123", "12345", "12a4", "", " 123", 1234, null, undefined])
      expect(g.isValidPin(bad)).toBe(false);
  });

  it("escalates lockouts 15m, 1h, 4h, then 24h", () => {
    const m = 60e3;
    expect([0, 1, 2, 3, 9].map(g.lockDurationMs)).toEqual([15 * m, 60 * m, 240 * m, 1440 * m, 1440 * m]);
  });

  it("locks on the 5th wrong try and counts the lockout", () => {
    let s = { fails: 0, lockouts: 0, lockedUntil: 0 };
    for (let i = 0; i < 4; i++) s = g.afterFailure(s, 1000);
    expect(s).toEqual({ fails: 4, lockouts: 0, lockedUntil: 0 });
    s = g.afterFailure(s, 1000);
    expect(s).toEqual({ fails: 0, lockouts: 1, lockedUntil: 1000 + 15 * 60e3 });
  });
});

describe("pinGate with a real settings table", () => {
  it("a lockout blocks even the correct PIN until it expires", () => {
    const gate = g.createPinGate(cfg("a"));
    gate.setPin("1357");
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) gate.tryUnlock("0000", t0);
    const blocked = gate.tryUnlock("1357", t0 + 1000);
    expect(blocked.ok).toBe(false);
    expect(gate.tryUnlock("1357", t0 + 15 * 60e3 + 1).ok).toBe(true);
    expect(gate.attemptsLeft()).toBe(5); // success clears the counter
  });

  it("changing the PIN invalidates old unlock tokens", () => {
    const gate = g.createPinGate(cfg("b"));
    gate.setPin("1111");
    const tok = gate.makeUnlockToken();
    expect(gate.verifyUnlockToken(tok)).toBe(true);
    gate.setPin("2222");
    expect(gate.verifyUnlockToken(tok)).toBe(false);
  });

  it("a token from one gate never opens another", () => {
    const x = g.createPinGate(cfg("x"));
    const y = g.createPinGate(cfg("y"));
    x.setPin("1234");
    y.setPin("1234"); // same PIN on purpose
    expect(y.verifyUnlockToken(x.makeUnlockToken())).toBe(false);
  });

  it("rejects tampered, expired and missing tokens", () => {
    const gate = g.createPinGate(cfg("c"));
    gate.setPin("9999");
    const [exp, sig] = gate.makeUnlockToken().split(".");
    expect(gate.verifyUnlockToken(`${Number(exp) + 1}.${sig}`)).toBe(false);
    expect(gate.verifyUnlockToken(gate.makeUnlockToken(Date.now() - 11 * 60e3))).toBe(false);
    expect(gate.verifyUnlockToken(undefined)).toBe(false);
    expect(gate.verifyUnlockToken("garbage")).toBe(false);
  });
});
