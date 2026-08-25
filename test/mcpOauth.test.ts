import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createHash, randomBytes } from "crypto";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// End-to-end coverage of the MCP OAuth authorization server (lib/mcpOauth.ts +
// app/api/mcp/oauth/*). Drives the full claude.ai-style handshake against the
// real route handlers: discover metadata → register (DCR) → authorize (consent
// with the MCP_AUTH_TOKEN) → exchange the code with PKCE → use the issued
// access token on /api/mcp. Also pins the security-critical failure modes
// (wrong consent token, PKCE mismatch, redirect_uri tampering, code reuse).

type Mod<T> = T;
let registerRoute: Mod<typeof import("@/app/api/mcp/oauth/register/route")>;
let authorizeRoute: Mod<typeof import("@/app/api/mcp/oauth/authorize/route")>;
let tokenRoute: Mod<typeof import("@/app/api/mcp/oauth/token/route")>;
let grantsRoute: Mod<typeof import("@/app/api/mcp/oauth/grants/route")>;
let prMeta: Mod<typeof import("@/app/api/mcp/oauth/protected-resource/route")>;
let asMeta: Mod<typeof import("@/app/api/mcp/oauth/authorization-server/route")>;
let mcpRoute: Mod<typeof import("@/app/api/mcp/route")>;
let oauth: Mod<typeof import("@/lib/mcpOauth")>;
let mcp: Mod<typeof import("@/lib/mcp")>;
let dbMod: Mod<typeof import("@/lib/db")>;

const TOKEN = "oauth-consent-secret-0123456789";
const ORIGIN = "https://diary.example.test";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "mcp-oauth-"));
  process.env.MCP_AUTH_TOKEN = TOKEN;
  registerRoute = await import("@/app/api/mcp/oauth/register/route");
  authorizeRoute = await import("@/app/api/mcp/oauth/authorize/route");
  tokenRoute = await import("@/app/api/mcp/oauth/token/route");
  grantsRoute = await import("@/app/api/mcp/oauth/grants/route");
  prMeta = await import("@/app/api/mcp/oauth/protected-resource/route");
  asMeta = await import("@/app/api/mcp/oauth/authorization-server/route");
  mcpRoute = await import("@/app/api/mcp/route");
  oauth = await import("@/lib/mcpOauth");
  mcp = await import("@/lib/mcp");
  dbMod = await import("@/lib/db");
});

beforeEach(() => {
  process.env.MCP_AUTH_TOKEN = TOKEN; // canonical, even if a rotation test left it changed
  delete process.env.APP_PASSCODE;
  oauth.clearAuthCodes();
  mcp.resetMcpThrottle();
  dbMod.db().prepare("DELETE FROM mcp_oauth_clients").run();
  dbMod.db().prepare("DELETE FROM mcp_oauth_tokens").run();
  dbMod.db().prepare("DELETE FROM mcp_audit").run();
});

const sha256hex = (s: string) => createHash("sha256").update(s).digest("hex");

// --- helpers --------------------------------------------------------------
function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function metaReq(url: string) {
  return new Request(url, {
    headers: { "x-forwarded-host": "diary.example.test", "x-forwarded-proto": "https" },
  });
}

async function register(): Promise<string> {
  const res = await registerRoute.POST(
    new Request(`${ORIGIN}/api/mcp/oauth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirect_uris: [REDIRECT], client_name: "Claude" }),
    })
  );
  expect(res.status).toBe(201);
  return (await res.json()).client_id as string;
}

function authorizeUrl(clientId: string, challenge: string, state = "xyz") {
  const u = new URL(`${ORIGIN}/api/mcp/oauth/authorize`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", REDIRECT);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("state", state);
  u.searchParams.set("scope", "mcp");
  return u.toString();
}

async function consent(
  clientId: string,
  challenge: string,
  token: string,
  state = "xyz"
): Promise<Response> {
  const body = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    scope: "mcp",
    mcp_token: token,
  });
  return authorizeRoute.POST(
    new Request(`${ORIGIN}/api/mcp/oauth/authorize`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })
  );
}

async function exchange(
  clientId: string,
  code: string,
  verifier: string,
  redirect = REDIRECT
): Promise<Response> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    redirect_uri: redirect,
    code_verifier: verifier,
  });
  return tokenRoute.POST(
    new Request(`${ORIGIN}/api/mcp/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })
  );
}

function codeFrom(res: Response): string {
  expect(res.status).toBe(302);
  const loc = res.headers.get("location")!;
  const u = new URL(loc);
  expect(u.searchParams.get("state")).toBe("xyz");
  return u.searchParams.get("code")!;
}

// --- metadata -------------------------------------------------------------
describe("OAuth metadata", () => {
  it("protected-resource points at the MCP resource + this origin as the auth server", async () => {
    const res = await prMeta.GET(metaReq(`${ORIGIN}/.well-known/oauth-protected-resource`));
    const j = await res.json();
    expect(j.resource).toBe(`${ORIGIN}/api/mcp`);
    expect(j.authorization_servers).toContain(ORIGIN);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("authorization-server advertises the endpoints, PKCE S256, public client", async () => {
    const res = await asMeta.GET(metaReq(`${ORIGIN}/.well-known/oauth-authorization-server`));
    const j = await res.json();
    expect(j.issuer).toBe(ORIGIN);
    expect(j.authorization_endpoint).toBe(`${ORIGIN}/api/mcp/oauth/authorize`);
    expect(j.token_endpoint).toBe(`${ORIGIN}/api/mcp/oauth/token`);
    expect(j.registration_endpoint).toBe(`${ORIGIN}/api/mcp/oauth/register`);
    expect(j.code_challenge_methods_supported).toContain("S256");
    expect(j.token_endpoint_auth_methods_supported).toContain("none");
  });
});

// --- happy path ------------------------------------------------------------
describe("full OAuth handshake", () => {
  it("register → consent → PKCE exchange → token usable on /api/mcp", async () => {
    const clientId = await register();
    const { verifier, challenge } = pkce();

    // Consent screen renders for a valid authorize request.
    const formRes = await authorizeRoute.GET(new Request(authorizeUrl(clientId, challenge)));
    expect(formRes.status).toBe(200);
    expect((await formRes.text())).toContain("MCP 토큰");

    // Correct token → 302 back to Claude with a code.
    const code = codeFrom(await consent(clientId, challenge, TOKEN));

    // Exchange with the matching verifier → access + refresh token.
    const tokRes = await exchange(clientId, code, verifier);
    expect(tokRes.status).toBe(200);
    const tok = await tokRes.json();
    expect(tok.token_type).toBe("Bearer");
    expect(tok.access_token).toBeTruthy();
    expect(tok.refresh_token).toBeTruthy();
    expect(tok.expires_in).toBeGreaterThan(0);

    // The access token is accepted by the MCP endpoint's auth.
    expect(mcp.checkMcpAuth(`Bearer ${tok.access_token}`)).toBe("ok");

    // ...and drives a real tools/list end-to-end.
    const listRes = await mcpRoute.POST(
      new Request(`${ORIGIN}/api/mcp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          authorization: `Bearer ${tok.access_token}`,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      })
    );
    expect(listRes.status).toBe(200);

    // Refresh grant issues a fresh, working access token.
    const refRes = await tokenRoute.POST(
      new Request(`${ORIGIN}/api/mcp/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: tok.refresh_token,
          client_id: clientId,
        }).toString(),
      })
    );
    expect(refRes.status).toBe(200);
    const refreshed = await refRes.json();
    expect(mcp.checkMcpAuth(`Bearer ${refreshed.access_token}`)).toBe("ok");
  });
});

// --- security-critical failure modes --------------------------------------
describe("OAuth security", () => {
  it("wrong consent token issues NO code (re-renders form)", async () => {
    const clientId = await register();
    const { challenge } = pkce();
    const res = await consent(clientId, challenge, "wrong-token-wrong-token");
    expect(res.status).toBe(401);
    expect(res.headers.get("location")).toBeNull();
    expect(await res.text()).toContain("토큰이 올바르지 않습니다");
  });

  it("PKCE mismatch is rejected at the token endpoint", async () => {
    const clientId = await register();
    const { challenge } = pkce();
    const code = codeFrom(await consent(clientId, challenge, TOKEN));
    // Exchange with a DIFFERENT verifier than the challenge was built from.
    const bad = randomBytes(32).toString("base64url");
    const res = await exchange(clientId, code, bad);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
  });

  it("rejects a refresh grant without its bound public client_id", async () => {
    const clientId = await register();
    const { verifier, challenge } = pkce();
    const code = codeFrom(await consent(clientId, challenge, TOKEN));
    const tok = await (await exchange(clientId, code, verifier)).json();
    const res = await tokenRoute.POST(
      new Request(`${ORIGIN}/api/mcp/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: tok.refresh_token,
        }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_request");
  });

  it("an auth code is single-use", async () => {
    const clientId = await register();
    const { verifier, challenge } = pkce();
    const code = codeFrom(await consent(clientId, challenge, TOKEN));
    expect((await exchange(clientId, code, verifier)).status).toBe(200);
    // Reuse of the same code fails.
    expect((await exchange(clientId, code, verifier)).status).toBe(400);
  });

  it("redirect_uri must match the code's binding at exchange", async () => {
    const clientId = await register();
    const { verifier, challenge } = pkce();
    const code = codeFrom(await consent(clientId, challenge, TOKEN));
    const res = await exchange(clientId, code, verifier, "https://evil.example/callback");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
  });

  it("authorize refuses an unregistered redirect_uri", async () => {
    const clientId = await register();
    const { challenge } = pkce();
    const u = new URL(authorizeUrl(clientId, challenge));
    u.searchParams.set("redirect_uri", "https://evil.example/callback");
    const res = await authorizeRoute.GET(new Request(u.toString()));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("연결할 수 없음");
  });

  it("a made-up (non-issued) bearer is not accepted by the MCP endpoint", () => {
    expect(mcp.checkMcpAuth("Bearer not-a-real-access-token-xxxxxxxx")).toBe("unauthorized");
  });
});

describe("dynamic client registration hardening", () => {
  async function registerMetadata(metadata: unknown, headers?: Record<string, string>) {
    return registerRoute.POST(
      new Request(`${ORIGIN}/api/mcp/oauth/register`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(metadata),
      })
    );
  }

  it.each([
    "http://attacker.example/callback",
    "javascript:alert(1)",
    "https://user:password@example.test/callback",
    "https://example.test/callback#fragment",
    "not a URI",
  ])("rejects unsafe redirect URI %s", async (redirectUri) => {
    const res = await registerMetadata({ redirect_uris: [redirectUri] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_redirect_uri");
  });

  it.each([
    "https://connector.example/callback",
    "http://localhost:4312/callback",
    "http://127.0.0.1:4312/callback",
    "http://[::1]:4312/callback",
  ])("accepts HTTPS or exact loopback redirect URI %s", async (redirectUri) => {
    const res = await registerMetadata({ redirect_uris: [redirectUri] });
    expect(res.status).toBe(201);
  });

  it("rejects unsupported metadata and bounds metadata size", async () => {
    const confidential = await registerMetadata({
      redirect_uris: [REDIRECT],
      token_endpoint_auth_method: "client_secret_basic",
    });
    expect(confidential.status).toBe(400);
    expect((await confidential.json()).error).toBe("invalid_client_metadata");

    const tooMany = oauth.parseClientRegistrationMetadata({
      redirect_uris: Array.from({ length: 11 }, (_, i) => `https://c${i}.example/cb`),
    });
    expect(tooMany.ok).toBe(false);

    const oversized = await registerMetadata(
      { redirect_uris: [REDIRECT] },
      { "content-length": String(oauth.MAX_DCR_BODY_BYTES + 1) }
    );
    expect(oversized.status).toBe(413);
  });

  it("shows the asserted name and exact redirect as escaped, explicitly unverified data", async () => {
    const redirect = "https://connector.example/callback?return=a&mode=b";
    const name = '<img src=x onerror="alert(1)">';
    const registration = await registerMetadata({ redirect_uris: [redirect], client_name: name });
    expect(registration.status).toBe(201);
    const clientId = (await registration.json()).client_id as string;
    const { challenge } = pkce();
    const u = new URL(`${ORIGIN}/api/mcp/oauth/authorize`);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("redirect_uri", redirect);
    u.searchParams.set("code_challenge", challenge);
    u.searchParams.set("code_challenge_method", "S256");
    u.searchParams.set("scope", "mcp");

    const res = await authorizeRoute.GET(new Request(u));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Unverified client");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).not.toContain(name);
    expect(html).toContain("https://connector.example/callback?return=a&amp;mode=b");
  });

  it("returns 400 instead of throwing for a malformed URI in a legacy client row", async () => {
    const clientId = "mcpc_00000000000000000000000000000000";
    const malformed = "not-a-valid-redirect";
    dbMod
      .db()
      .prepare(`INSERT INTO mcp_oauth_clients(client_id, redirect_uris) VALUES(?,?)`)
      .run(clientId, JSON.stringify([malformed]));
    const { challenge } = pkce();
    const u = new URL(`${ORIGIN}/api/mcp/oauth/authorize`);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("redirect_uri", malformed);
    u.searchParams.set("code_challenge", challenge);
    u.searchParams.set("code_challenge_method", "S256");

    const getRes = authorizeRoute.GET(new Request(u));
    expect(getRes.status).toBe(400);

    const postRes = await authorizeRoute.POST(
      new Request(`${ORIGIN}/api/mcp/oauth/authorize`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          response_type: "code",
          client_id: clientId,
          redirect_uri: malformed,
          code_challenge: challenge,
          code_challenge_method: "S256",
          mcp_token: TOKEN,
        }),
      })
    );
    expect(postRes.status).toBe(400);
  });
});

describe("owner OAuth grant management", () => {
  it("lists safe grant metadata and revokes every token for a client", async () => {
    const client = oauth.registerClient([REDIRECT], "Claude connector");
    const tokens = oauth.issueTokens(client.client_id, sha256hex(TOKEN));
    dbMod
      .db()
      .prepare(`INSERT INTO mcp_audit(ip, event, tool, ok) VALUES(?,?,?,?)`)
      .run("203.0.113.5", "auth_fail", "oauth_authorize", 0);

    const listRes = await grantsRoute.GET();
    expect(listRes.status).toBe(200);
    const listed = await listRes.json();
    expect(listed.grants).toHaveLength(1);
    expect(listed.grants[0]).toMatchObject({
      client_id: client.client_id,
      client_name: "Claude connector",
      redirect_uris: [REDIRECT],
      active: true,
      has_active_refresh_token: true,
      active_access_tokens: 1,
    });
    expect(JSON.stringify(listed)).not.toContain(tokens.access_token);
    expect(JSON.stringify(listed)).not.toContain(tokens.refresh_token);
    expect(JSON.stringify(listed)).not.toContain(sha256hex(tokens.access_token));
    expect(listed.audit[0]).toMatchObject({ tool: "oauth_authorize", ok: false });

    const revokeRes = await grantsRoute.DELETE(
      new Request(
        `${ORIGIN}/api/mcp/oauth/grants?client_id=${encodeURIComponent(client.client_id)}`,
        { method: "DELETE", headers: { "x-forwarded-for": "203.0.113.8" } }
      )
    );
    expect(revokeRes.status).toBe(200);
    expect(mcp.checkMcpAuth(`Bearer ${tokens.access_token}`)).toBe("unauthorized");
    expect(oauth.refreshAccessToken(tokens.refresh_token, client.client_id)).toBeNull();
    expect(oauth.listOAuthAudit()[0]).toMatchObject({
      ip: "203.0.113.8",
      event: "oauth_revoke",
      tool: "oauth_grant",
      ok: true,
    });
  });

  it("rejects malformed and unknown client ids", async () => {
    const malformed = await grantsRoute.DELETE(
      new Request(`${ORIGIN}/api/mcp/oauth/grants?client_id=bad`, { method: "DELETE" })
    );
    expect(malformed.status).toBe(400);

    const missing = await grantsRoute.DELETE(
      new Request(
        `${ORIGIN}/api/mcp/oauth/grants?client_id=mcpc_ffffffffffffffffffffffffffffffff`,
        { method: "DELETE" }
      )
    );
    expect(missing.status).toBe(404);
  });
});

// Codex P1: rotating (not just unsetting) MCP_AUTH_TOKEN must actually revoke
// tokens minted under the old secret — the documented "change the token to
// revoke a compromised connector" path.
describe("secret rotation revokes issued OAuth tokens", () => {
  async function issueAccessToken(): Promise<{ access: string; refresh: string; clientId: string }> {
    const clientId = await register();
    const { verifier, challenge } = pkce();
    const code = codeFrom(await consent(clientId, challenge, TOKEN));
    const tok = await (await exchange(clientId, code, verifier)).json();
    return { access: tok.access_token, refresh: tok.refresh_token, clientId };
  }

  function refreshReq(refresh: string, clientId: string): Request {
    return new Request(`${ORIGIN}/api/mcp/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refresh,
        client_id: clientId,
      }).toString(),
    });
  }

  it("rotating the secret away invalidates old access AND refresh tokens", async () => {
    const { access, refresh, clientId } = await issueAccessToken();
    expect(mcp.checkMcpAuth(`Bearer ${access}`)).toBe("ok");

    // Rotate: the old value is no longer configured.
    process.env.MCP_AUTH_TOKEN = "rotated-fresh-secret-9876543210";

    // Old access token is dead...
    expect(mcp.checkMcpAuth(`Bearer ${access}`)).toBe("unauthorized");
    // ...and the refresh token can no longer mint a new one.
    const ref = await tokenRoute.POST(refreshReq(refresh, clientId));
    expect(ref.status).toBe(400);
  });

  it("keeps old tokens valid during a comma-separated overlap, dead once the old value is dropped", async () => {
    const { access } = await issueAccessToken();

    // Overlap window: both old + new configured → old-minted token still works.
    process.env.MCP_AUTH_TOKEN = `${TOKEN},new-overlap-secret-1234567890`;
    expect(mcp.checkMcpAuth(`Bearer ${access}`)).toBe("ok");

    // Drop the old value → the old-minted token is revoked.
    process.env.MCP_AUTH_TOKEN = "new-overlap-secret-1234567890";
    expect(mcp.checkMcpAuth(`Bearer ${access}`)).toBe("unauthorized");
  });

  it("unsetting the token entirely disables the endpoint (tokens can't validate)", async () => {
    const { access } = await issueAccessToken();
    delete process.env.MCP_AUTH_TOKEN;
    // Endpoint is disabled; a previously-valid access token gets no free pass.
    expect(mcp.checkMcpAuth(`Bearer ${access}`)).toBe("disabled");
  });

  it("rejects a legacy NULL-secret token rather than binding it to a rotated secret", () => {
    // A pre-secret_hash token cannot be safely associated with the current
    // MCP_AUTH_TOKEN. Treat it as revoked; reconnecting is required.
    const legacy = "legacy-access-token-preexisting-0001";
    const legacyRefresh = "legacy-refresh-token-preexisting-0001";
    const nowSec = Math.floor(Date.now() / 1000);
    dbMod
      .db()
      .prepare(
        `INSERT INTO mcp_oauth_tokens(token_hash, kind, client_id, secret_hash, expires_at) VALUES(?,?,?,?,?)`
      )
      .run(sha256hex(legacy), "access", "mcpc_legacy", null, nowSec + 99999);
    dbMod
      .db()
      .prepare(
        `INSERT INTO mcp_oauth_tokens(token_hash, kind, client_id, secret_hash, expires_at) VALUES(?,?,?,?,?)`
      )
      .run(sha256hex(legacyRefresh), "refresh", "mcpc_legacy", null, null);

    expect(mcp.checkMcpAuth(`Bearer ${legacy}`)).toBe("unauthorized");
    expect(oauth.refreshAccessToken(legacyRefresh, "mcpc_legacy")).toBeNull();

    // A later secret rotation must not make this token valid either.
    process.env.MCP_AUTH_TOKEN = "different-rotated-secret-000000000";
    expect(mcp.checkMcpAuth(`Bearer ${legacy}`)).toBe("unauthorized");
  });
});

describe("registration rate limit + client-table cap", () => {
  it("throttles repeated registration attempts from the same IP, in its own bucket", async () => {
    const req = () =>
      registerRoute.POST(
        new Request(`${ORIGIN}/api/mcp/oauth/register`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.9" },
          body: JSON.stringify({ redirect_uris: [REDIRECT] }),
        })
      );
    for (let i = 0; i < mcp.THROTTLE_MAX_FAILURES; i++) {
      const res = await req();
      expect(res.status).toBe(201);
    }
    const throttled = await req();
    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("retry-after")).toBeTruthy();

    // The register throttle is its own bucket — a real auth failure on
    // /api/mcp from the SAME ip must not be affected by registration spam,
    // and vice versa (that's the whole point of bucketing).
    expect(mcp.isThrottled("198.51.100.9")).toBe(false);
  });

  it(
    "caps spam client rows (never issued a token) but never evicts a client with a live token",
    () => {
      // Seed one client that completed the OAuth dance (has a live token).
      const protectedId = oauth.registerClient([REDIRECT], "protected").client_id;
      oauth.issueTokens(protectedId, sha256hex(TOKEN));

      // Flood pure DCR spam — registered, never used — well past the cap.
      // Calling registerClient() directly (not the route) so this exercises
      // only the row-cap logic, not the separate HTTP rate limit above.
      const spamCap = 2000; // mirrors CLIENT_KEEP_ROWS in lib/mcpOauth.ts
      for (let i = 0; i < spamCap + 10; i++) {
        oauth.registerClient([REDIRECT], `spam-${i}`);
      }

      const rows = dbMod
        .db()
        .prepare(`SELECT COUNT(*) AS n FROM mcp_oauth_clients`)
        .get() as { n: number };
      // Capped: the protected client + at most spamCap surviving spam rows.
      expect(rows.n).toBeLessThanOrEqual(spamCap + 1);
      // The token-bearing client survives eviction regardless of age.
      expect(oauth.getClient(protectedId)).not.toBeNull();
    },
    30_000
  );
});

describe("OAuth low-severity fixes", () => {
  it("drops pending authorization codes when a grant is revoked", () => {
    const verifier = "a".repeat(43);
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const client = oauth.registerClient([REDIRECT], "Test connector");
    const secretHash = createHash("sha256").update(TOKEN).digest("hex");
    const code = oauth.issueAuthCode(
      client.client_id,
      REDIRECT,
      challenge,
      secretHash
    );

    // Owner revokes the grant while that code is still unredeemed. Revocation
    // used to delete token rows only, so the holder could still exchange the
    // code for a FRESH pair for the client just revoked — revocation reported
    // success and did not hold.
    oauth.revokeOAuthGrant(client.client_id);

    const redeemed = oauth.redeemAuthCode(
      code,
      client.client_id,
      REDIRECT,
      verifier
    );
    expect(redeemed).toMatchObject({ ok: false });
  });

  it("leads the consent screen with the destination host, not the claimed name", async () => {
    // The registrant chooses client_name, so an attacker simply calls itself
    // "Claude". The host is the one field they cannot forge without owning it.
    const client = oauth.registerClient(["https://evil.tld/callback"], "Claude");
    const url =
      `${ORIGIN}/api/mcp/oauth/authorize?response_type=code` +
      `&client_id=${client.client_id}` +
      `&redirect_uri=${encodeURIComponent("https://evil.tld/callback")}` +
      `&code_challenge=${"b".repeat(43)}&code_challenge_method=S256`;

    const res = await authorizeRoute.GET(new Request(url));
    const html = await res.text();

    expect(html).toContain("<strong>evil.tld</strong>");
    expect(html).not.toContain("<strong>Claude</strong>");
    // The full URI stays visible for anyone who wants to read it.
    expect(html).toContain("https://evil.tld/callback");
  });
});
