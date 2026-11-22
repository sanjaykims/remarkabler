import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// In production with no APP_PASSCODE the app must FAIL CLOSED, not open.
// "Unset = wide open" once meant a new user who skipped one variable published
// their private diary at a public URL. These tests pin the matrix so nobody
// quietly turns that back into fail-open.

type AuthMod = typeof import("@/lib/auth");
let auth: AuthMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "failclosed-"));
  auth = await import("@/lib/auth");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function env(opts: { node: string; passcode?: string; open?: string }) {
  vi.stubEnv("NODE_ENV", opts.node);
  vi.stubEnv("APP_PASSCODE", opts.passcode ?? "");
  vi.stubEnv("ALLOW_OPEN_APP", opts.open ?? "");
}

describe("fail-closed lock", () => {
  it("production + no passcode is fail-closed and refuses everyone", async () => {
    env({ node: "production" });
    expect(auth.isLockEnabled()).toBe(false);
    expect(auth.appIsFailClosed()).toBe(true);
    expect(await auth.isAuthenticated()).toBe(false);
    const denied = await auth.requireAuth();
    expect(denied?.status).toBe(401);
  });

  it("ALLOW_OPEN_APP=true is the explicit opt-out", async () => {
    env({ node: "production", open: "true" });
    expect(auth.appIsFailClosed()).toBe(false);
    expect(await auth.isAuthenticated()).toBe(true);
  });

  it("only the exact string 'true' opts out", async () => {
    env({ node: "production", open: "1" });
    expect(auth.appIsFailClosed()).toBe(true);
    expect(await auth.isAuthenticated()).toBe(false);
  });

  it("with a passcode set it is not fail-closed (the normal lock applies)", () => {
    env({ node: "production", passcode: "a real passcode" });
    expect(auth.isLockEnabled()).toBe(true);
    expect(auth.appIsFailClosed()).toBe(false);
  });

  it("dev and test are unchanged: no passcode still means open", async () => {
    env({ node: "development" });
    expect(auth.appIsFailClosed()).toBe(false);
    expect(await auth.isAuthenticated()).toBe(true);
    env({ node: "test" });
    expect(auth.appIsFailClosed()).toBe(false);
    expect(await auth.isAuthenticated()).toBe(true);
  });
});
