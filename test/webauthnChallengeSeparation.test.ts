import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// The WebAuthn ceremonies must not share one challenge cookie.
//
// `login-options` is deliberately UNGATED — an unauthenticated visitor has to
// be able to start a passkey login. If `register-verify` accepts whatever sits
// in the same cookie, that ungated endpoint becomes a free source of the only
// thing enrollment needs, and the passcode gate on `register-options` protects
// nothing: an attacker calls `login-options`, creates a self-attested
// credential against the challenge it hands out, and POSTs it to
// `register-verify` to get BOTH a session and a permanently registered passkey
// that survives passcode rotation.
//
// Credentials are registered with `attestationType: "none"` (lib/webauthn.ts),
// so nothing in the response is signed by a trusted party — no cryptography
// has to be broken for this, only the ceremony boundary.
//
// The invariant pinned here: a challenge minted by `login-options` must never
// be accepted by `register-verify`.

type AuthRouteMod = typeof import("@/app/api/auth/route");
type WebauthnMod = typeof import("@/lib/webauthn");

let route: AuthRouteMod;
let webauthn: WebauthnMod;

const PASSCODE = "correct-horse-battery-staple";

// Minimal NextRequest stand-in: the route only reads json(), cookies, headers.
function post(
  body: Record<string, unknown>,
  cookies: Record<string, string> = {}
): any {
  return {
    json: async () => body,
    cookies: {
      get: (name: string) =>
        name in cookies ? { name, value: cookies[name] } : undefined,
    },
    headers: new Headers({ host: "diary.example.com" }),
  };
}

// Pull a Set-Cookie value back off a NextResponse.
function cookieFrom(res: any, name: string): string | undefined {
  return res.cookies.get(name)?.value;
}

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "webauthn-sep-"));
  process.env.APP_PASSCODE = PASSCODE;
  webauthn = await import("@/lib/webauthn");
  route = await import("@/app/api/auth/route");
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("WebAuthn ceremony separation", () => {
  it("does NOT accept a login-issued challenge at register-verify", async () => {
    // 1. Unauthenticated attacker starts a LOGIN ceremony. No passcode needed —
    //    this endpoint is ungated on purpose.
    const loginOptions = await route.POST(post({ action: "login-options" }));
    expect(loginOptions.status).toBe(200);

    // Whatever cookie(s) that set, replay ALL of them into register-verify.
    // Using the raw Set-Cookie jar means this test stays honest regardless of
    // what the cookies end up being named.
    const jar: Record<string, string> = {};
    for (const c of (loginOptions.cookies as any).getAll?.() ?? []) {
      if (c.value) jar[c.name] = c.value;
    }
    expect(Object.keys(jar).length).toBeGreaterThan(0);

    // 2. Registration verification is stubbed to SUCCEED. This isolates the
    //    ceremony boundary as the only thing under test: if the route still
    //    registers a credential, the boundary — not the crypto — is what failed.
    //    (Real attestation is "none", so a genuine attacker gets this for free
    //    with a browser virtual authenticator.)
    const verifySpy = vi
      .spyOn(webauthn, "verifyRegistration")
      .mockResolvedValue(true as never);

    const res = await route.POST(
      post({ action: "register-verify", response: {} }, jar)
    );

    // 3. The attacker must NOT come away with a session.
    expect(cookieFrom(res, "fc_session")).toBeFalsy();
    expect(res.status).not.toBe(200);

    // And enrollment must not even have been attempted with a login challenge.
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it("still completes a legitimate registration end to end", async () => {
    // The fix must not break real enrollment: passcode -> register-options ->
    // register-verify has to keep working.
    const opts = await route.POST(
      post({ action: "register-options", passcode: PASSCODE })
    );
    expect(opts.status).toBe(200);

    const jar: Record<string, string> = {};
    for (const c of (opts.cookies as any).getAll?.() ?? []) {
      if (c.value) jar[c.name] = c.value;
    }

    vi.spyOn(webauthn, "verifyRegistration").mockResolvedValue(true as never);

    const res = await route.POST(
      post({ action: "register-verify", response: {} }, jar)
    );
    expect(res.status).toBe(200);
    expect(cookieFrom(res, "fc_session")).toBeTruthy();
  });

  it("still completes a legitimate login end to end", async () => {
    const opts = await route.POST(post({ action: "login-options" }));
    const jar: Record<string, string> = {};
    for (const c of (opts.cookies as any).getAll?.() ?? []) {
      if (c.value) jar[c.name] = c.value;
    }

    vi.spyOn(webauthn, "verifyAuthentication").mockResolvedValue(true as never);

    const res = await route.POST(
      post({ action: "login-verify", response: {} }, jar)
    );
    expect(res.status).toBe(200);
    expect(cookieFrom(res, "fc_session")).toBeTruthy();
  });

  it("does NOT accept a registration challenge at login-verify", async () => {
    // The mirror direction. Less severe (login-verify needs a credential that
    // already exists) but the boundary should hold both ways.
    const opts = await route.POST(
      post({ action: "register-options", passcode: PASSCODE })
    );
    const jar: Record<string, string> = {};
    for (const c of (opts.cookies as any).getAll?.() ?? []) {
      if (c.value) jar[c.name] = c.value;
    }

    const verifySpy = vi
      .spyOn(webauthn, "verifyAuthentication")
      .mockResolvedValue(true as never);

    const res = await route.POST(
      post({ action: "login-verify", response: {} }, jar)
    );

    expect(cookieFrom(res, "fc_session")).toBeFalsy();
    expect(verifySpy).not.toHaveBeenCalled();
  });
});
