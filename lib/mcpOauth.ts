import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

// Minimal OAuth 2.1 authorization server that lets Claude on the user's
// subscription (claude.ai custom connector) connect to the diary MCP endpoint.
// The claude.ai web connector UI has no "static bearer header" field, so it
// insists on the OAuth discovery → DCR → authorize → token dance; this module
// implements exactly that, kept single-user simple:
//
//   - The SINGLE secret is the existing MCP_AUTH_TOKEN. The /authorize consent
//     screen asks for it; only someone who knows it can complete the flow.
//   - Public clients only (PKCE S256 required; no client secret).
//   - Access tokens are opaque, stored HASHED, and also accepted by the MCP
//     endpoint's checkMcpAuth (alongside the raw MCP_AUTH_TOKEN, which keeps
//     the Claude Code / direct path working).
//
// Everything here fails safe: if MCP_AUTH_TOKEN is unset the MCP endpoint is
// disabled anyway, so no token can ever be issued.

// --- Public origin --------------------------------------------------------
// OAuth metadata + redirects must use the PUBLIC https origin. Behind
// Railway's proxy `req.url` is the internal localhost:8080 (see CLAUDE.md), so
// prefer APP_BASE_URL, then the X-Forwarded-* headers, and only fall back to
// req.url as a last resort.
export function publicOrigin(req: Request): string {
  const configured = (process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  const h = req.headers;
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const host =
    h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host") || "";
  if (host) return `${proto}://${host}`;
  try {
    return new URL(req.url).origin;
  } catch {
    return "";
  }
}

export const MCP_PATH = "/api/mcp";
export const RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource";
const AUTHORIZE_PATH = "/api/mcp/oauth/authorize";
const TOKEN_PATH = "/api/mcp/oauth/token";
const REGISTER_PATH = "/api/mcp/oauth/register";

const ACCESS_TTL_SEC = 30 * 24 * 60 * 60; // 30 days
const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// --- Metadata documents ---------------------------------------------------
export function protectedResourceMetadata(origin: string): unknown {
  return {
    resource: `${origin}${MCP_PATH}`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
  };
}

export function authorizationServerMetadata(origin: string): unknown {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}${AUTHORIZE_PATH}`,
    token_endpoint: `${origin}${TOKEN_PATH}`,
    registration_endpoint: `${origin}${REGISTER_PATH}`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp"],
  };
}

// --- CORS (claude.ai fetches metadata cross-origin from the browser) ------
export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-protocol-version",
    "Access-Control-Max-Age": "86400",
  };
}

// --- Consent secret (reuses MCP_AUTH_TOKEN) -------------------------------
// Accepts any of the comma-separated MCP_AUTH_TOKEN values, timing-safe.
function consentSecretValid(presented: string): boolean {
  const tokens = (process.env.MCP_AUTH_TOKEN || "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length >= 16);
  if (tokens.length === 0) return false;
  const p = createHash("sha256").update(presented).digest();
  let ok = false;
  for (const t of tokens) {
    const e = createHash("sha256").update(t).digest();
    if (timingSafeEqual(p, e)) ok = true;
  }
  return ok;
}
export { consentSecretValid };

// --- Clients (Dynamic Client Registration) --------------------------------
export type RegisteredClient = { client_id: string; redirect_uris: string[] };

export function registerClient(redirectUris: string[], clientName?: string): RegisteredClient {
  const clientId = `mcpc_${randomBytes(16).toString("hex")}`;
  db()
    .prepare(
      `INSERT INTO mcp_oauth_clients(client_id, redirect_uris, client_name) VALUES(?,?,?)`
    )
    .run(clientId, JSON.stringify(redirectUris), clientName ?? null);
  return { client_id: clientId, redirect_uris: redirectUris };
}

export function getClient(clientId: string): RegisteredClient | null {
  const row = db()
    .prepare(`SELECT client_id, redirect_uris FROM mcp_oauth_clients WHERE client_id = ?`)
    .get(clientId) as { client_id: string; redirect_uris: string } | undefined;
  if (!row) return null;
  let uris: string[] = [];
  try {
    uris = JSON.parse(row.redirect_uris);
  } catch {
    uris = [];
  }
  return { client_id: row.client_id, redirect_uris: uris };
}

// --- Authorization codes (short-lived, in-memory) -------------------------
// Kept in memory because they live seconds between /authorize and /token; a
// server restart in that window just means the user re-taps "connect".
type AuthCode = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: number;
};
const authCodes = new Map<string, AuthCode>();

export function issueAuthCode(
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
  now = Date.now()
): string {
  const code = randomBytes(32).toString("base64url");
  authCodes.set(code, {
    clientId,
    redirectUri,
    codeChallenge,
    expiresAt: now + CODE_TTL_MS,
  });
  return code;
}

// Redeem a code exactly once, enforcing PKCE, client, redirect, and expiry.
export function redeemAuthCode(
  code: string,
  clientId: string,
  redirectUri: string,
  codeVerifier: string,
  now = Date.now()
): { ok: true } | { ok: false; error: string } {
  const entry = authCodes.get(code);
  if (!entry) return { ok: false, error: "invalid_grant" };
  authCodes.delete(code); // single-use, even on failure
  if (entry.expiresAt < now) return { ok: false, error: "invalid_grant" };
  if (entry.clientId !== clientId) return { ok: false, error: "invalid_grant" };
  if (entry.redirectUri !== redirectUri) return { ok: false, error: "invalid_grant" };
  if (!verifyPkce(codeVerifier, entry.codeChallenge))
    return { ok: false, error: "invalid_grant" };
  return { ok: true };
}

export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  if (!codeVerifier || !codeChallenge) return false;
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  // Constant-time compare of equal-length base64url digests.
  const a = Buffer.from(computed);
  const b = Buffer.from(codeChallenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function clearAuthCodes(): void {
  authCodes.clear();
}

// --- Tokens ---------------------------------------------------------------
function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type IssuedTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export function issueTokens(clientId: string, now = Date.now()): IssuedTokens {
  const access = randomBytes(32).toString("base64url");
  const refresh = randomBytes(32).toString("base64url");
  const nowSec = Math.floor(now / 1000);
  const ins = db().prepare(
    `INSERT INTO mcp_oauth_tokens(token_hash, kind, client_id, expires_at) VALUES(?,?,?,?)`
  );
  ins.run(hash(access), "access", clientId, nowSec + ACCESS_TTL_SEC);
  ins.run(hash(refresh), "refresh", clientId, null);
  return { access_token: access, refresh_token: refresh, expires_in: ACCESS_TTL_SEC };
}

// Rotate a refresh token into a fresh access token (refresh_token grant).
export function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  now = Date.now()
): IssuedTokens | null {
  const row = db()
    .prepare(
      `SELECT client_id FROM mcp_oauth_tokens WHERE token_hash = ? AND kind = 'refresh'`
    )
    .get(hash(refreshToken)) as { client_id: string | null } | undefined;
  if (!row) return null;
  if (row.client_id && clientId && row.client_id !== clientId) return null;
  // Issue a new access token; keep the same refresh token valid.
  const access = randomBytes(32).toString("base64url");
  const nowSec = Math.floor(now / 1000);
  db()
    .prepare(
      `INSERT INTO mcp_oauth_tokens(token_hash, kind, client_id, expires_at) VALUES(?,?,?,?)`
    )
    .run(hash(access), "access", row.client_id, nowSec + ACCESS_TTL_SEC);
  return { access_token: access, refresh_token: refreshToken, expires_in: ACCESS_TTL_SEC };
}

// True if the presented bearer is a live (unexpired) OAuth access token.
// better-sqlite3 is synchronous, so this stays a sync check.
export function isValidAccessToken(token: string, now = Date.now()): boolean {
  const row = db()
    .prepare(
      `SELECT expires_at FROM mcp_oauth_tokens WHERE token_hash = ? AND kind = 'access'`
    )
    .get(hash(token)) as { expires_at: number | null } | undefined;
  if (!row) return false;
  const nowSec = Math.floor(now / 1000);
  if (row.expires_at !== null && row.expires_at < nowSec) return false;
  return true;
}

// Best-effort GC of expired access tokens (called opportunistically).
export function pruneExpiredTokens(now = Date.now()): void {
  try {
    db()
      .prepare(
        `DELETE FROM mcp_oauth_tokens WHERE kind = 'access' AND expires_at IS NOT NULL AND expires_at < ?`
      )
      .run(Math.floor(now / 1000));
  } catch {
    // best-effort
  }
}
