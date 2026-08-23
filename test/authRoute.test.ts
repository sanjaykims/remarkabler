import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { NextRequest } from "next/server";

const requestCookies = vi.hoisted(() => ({ session: undefined as string | undefined }));
const AUTH_SOURCE = "198.51.100.7";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) =>
      name === "fc_session" && requestCookies.session
        ? { value: requestCookies.session }
        : undefined,
  }),
}));

const webauthn = vi.hoisted(() => ({
  hasCredentials: vi.fn(() => true),
  buildRegistrationOptions: vi.fn(),
  verifyRegistration: vi.fn(async () => true),
  buildAuthenticationOptions: vi.fn(),
  verifyAuthentication: vi.fn(async () => true),
}));

vi.mock("@/lib/webauthn", () => webauthn);

type AuthMod = typeof import("@/lib/auth");
type DbMod = typeof import("@/lib/db");
type RouteMod = typeof import("@/app/api/auth/route");

let auth: AuthMod;
let db: DbMod;
let route: RouteMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "auth-route-"));
  process.env.APP_PASSCODE = "correct horse battery staple";
  process.env.ANTHROPIC_API_KEY = "test-key";
  db = await import("@/lib/db");
  auth = await import("@/lib/auth");
  route = await import("@/app/api/auth/route");
  db.db();
});

beforeEach(() => {
  db.db().prepare(`DELETE FROM settings WHERE key LIKE 'auth_fail_state%'`).run();
  db.db().prepare(`DELETE FROM app_sessions`).run();
  requestCookies.session = undefined;
  webauthn.verifyAuthentication.mockResolvedValue(true);
});

function post(action: string, extra: Record<string, unknown> = {}, cookie?: string) {
  return route.POST(
    new NextRequest("https://remarkabler.example/api/auth", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "remarkabler.example",
        "x-forwarded-for": AUTH_SOURCE,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({ action, ...extra }),
    })
  );
}

async function sessionIsAuthenticated(token: string): Promise<boolean> {
  requestCookies.session = token;
  return auth.isAuthenticated();
}

describe("app authentication route", () => {
  it("clears passcode failures after a successful WebAuthn login", async () => {
    for (let i = 0; i < 8; i++) auth.recordFailedPasscodeAttempt(AUTH_SOURCE);
    expect(auth.passcodeLockRemainingMs(AUTH_SOURCE)).not.toBeNull();

    const res = await post("login-verify", { response: {} }, "fc_challenge=challenge");

    expect(res.status).toBe(200);
    expect(auth.passcodeLockRemainingMs(AUTH_SOURCE)).toBeNull();
    expect(res.headers.get("set-cookie")).toContain("fc_session=");
  });

  it("does not clear passcode failures after a rejected WebAuthn login", async () => {
    for (let i = 0; i < 8; i++) auth.recordFailedPasscodeAttempt(AUTH_SOURCE);
    webauthn.verifyAuthentication.mockResolvedValue(false);

    const res = await post("login-verify", { response: {} }, "fc_challenge=challenge");

    expect(res.status).toBe(401);
    expect(auth.passcodeLockRemainingMs(AUTH_SOURCE)).not.toBeNull();
  });

  it("does not let one source lock out a different source", () => {
    for (let i = 0; i < 8; i++) auth.recordFailedPasscodeAttempt(AUTH_SOURCE);
    expect(auth.passcodeLockRemainingMs(AUTH_SOURCE)).not.toBeNull();
    expect(auth.passcodeLockRemainingMs("203.0.113.8")).toBeNull();
  });

  it("revokes all existing sessions when requested by an authenticated session", async () => {
    const first = auth.createSessionToken();
    const second = auth.createSessionToken();
    requestCookies.session = first;

    const res = await post("logout-all");

    expect(res.status).toBe(200);
    expect(await sessionIsAuthenticated(first)).toBe(false);
    expect(await sessionIsAuthenticated(second)).toBe(false);
    expect(await sessionIsAuthenticated(auth.createSessionToken())).toBe(true);
    expect(res.headers.get("set-cookie")).toContain("fc_session=;");
  });

  it("refuses logout-all without a valid current session", async () => {
    const existing = auth.createSessionToken();
    requestCookies.session = "not-a-valid-session";

    const res = await post("logout-all");

    expect(res.status).toBe(401);
    expect(await sessionIsAuthenticated(existing)).toBe(true);
  });

  it("keeps ordinary logout local to the current device", async () => {
    const current = auth.createSessionToken();
    const otherDevice = auth.createSessionToken();

    const res = await post("logout", {}, `fc_session=${current}`);

    expect(res.status).toBe(200);
    expect(await sessionIsAuthenticated(current)).toBe(false);
    expect(await sessionIsAuthenticated(otherDevice)).toBe(true);
    expect(res.headers.get("set-cookie")).toContain("fc_session=;");
  });

  it("expires inactivity per session instead of globally", async () => {
    const stale = auth.createSessionToken();
    const active = auth.createSessionToken();
    db.db()
      .prepare(`UPDATE app_sessions SET last_activity_at = 0 WHERE id = ?`)
      .run(stale.split(".")[1]);

    expect(await sessionIsAuthenticated(stale)).toBe(false);
    expect(await sessionIsAuthenticated(active)).toBe(true);
  });
});
