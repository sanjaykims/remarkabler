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
function configuredSecrets(): string[] {
  return (process.env.MCP_AUTH_TOKEN || "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length >= 16);
}

function sha256hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// Hashes of the CURRENTLY configured secrets. A rotation (dropping the old
// value from MCP_AUTH_TOKEN) removes its hash here, which is what makes tokens
// minted under it stop validating — see isValidAccessToken / refreshAccessToken.
export function currentSecretHashes(): Set<string> {
  return new Set(configuredSecrets().map(sha256hex));
}

// Validates the presented consent secret against any configured token
// (timing-safe) and returns THAT token's hash so the issued OAuth tokens can
// be bound to it. Returns null when no configured secret matches.
export function matchConsentSecret(presented: string): string | null {
  const p = createHash("sha256").update(presented).digest();
  let matched: string | null = null;
  for (const t of configuredSecrets()) {
    const e = createHash("sha256").update(t).digest();
    if (timingSafeEqual(p, e)) matched = sha256hex(t);
  }
  return matched;
}

// Back-compat boolean form.
export function consentSecretValid(presented: string): boolean {
  return matchConsentSecret(presented) !== null;
}

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
  secretHash: string; // the MCP_AUTH_TOKEN hash that authorized this grant
  expiresAt: number;
};
const authCodes = new Map<string, AuthCode>();

export function issueAuthCode(
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
  secretHash: string,
  now = Date.now()
): string {
  const code = randomBytes(32).toString("base64url");
  authCodes.set(code, {
    clientId,
    redirectUri,
    codeChallenge,
    secretHash,
    expiresAt: now + CODE_TTL_MS,
  });
  return code;
}

// Redeem a code exactly once, enforcing PKCE, client, redirect, and expiry.
// On success returns the secretHash so the issued tokens can be bound to it.
export function redeemAuthCode(
  code: string,
  clientId: string,
  redirectUri: string,
  codeVerifier: string,
  now = Date.now()
): { ok: true; secretHash: string } | { ok: false; error: string } {
  const entry = authCodes.get(code);
  if (!entry) return { ok: false, error: "invalid_grant" };
  authCodes.delete(code); // single-use, even on failure
  if (entry.expiresAt < now) return { ok: false, error: "invalid_grant" };
  if (entry.clientId !== clientId) return { ok: false, error: "invalid_grant" };
  if (entry.redirectUri !== redirectUri) return { ok: false, error: "invalid_grant" };
  if (!verifyPkce(codeVerifier, entry.codeChallenge))
    return { ok: false, error: "invalid_grant" };
  return { ok: true, secretHash: entry.secretHash };
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

export function issueTokens(
  clientId: string,
  secretHash: string,
  now = Date.now()
): IssuedTokens {
  const access = randomBytes(32).toString("base64url");
  const refresh = randomBytes(32).toString("base64url");
  const nowSec = Math.floor(now / 1000);
  const ins = db().prepare(
    `INSERT INTO mcp_oauth_tokens(token_hash, kind, client_id, secret_hash, expires_at) VALUES(?,?,?,?,?)`
  );
  ins.run(hash(access), "access", clientId, secretHash, nowSec + ACCESS_TTL_SEC);
  ins.run(hash(refresh), "refresh", clientId, secretHash, null);
  return { access_token: access, refresh_token: refresh, expires_in: ACCESS_TTL_SEC };
}

// Rotate a refresh token into a fresh access token (refresh_token grant).
// Refuses if the secret that minted the refresh token has since been rotated
// out of MCP_AUTH_TOKEN — so rotation revokes the whole grant, not just the
// access token.
export function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  now = Date.now()
): IssuedTokens | null {
  backfillLegacyTokenSecrets();
  const row = db()
    .prepare(
      `SELECT client_id, secret_hash FROM mcp_oauth_tokens WHERE token_hash = ? AND kind = 'refresh'`
    )
    .get(hash(refreshToken)) as
    | { client_id: string | null; secret_hash: string | null }
    | undefined;
  if (!row) return null;
  if (row.client_id && clientId && row.client_id !== clientId) return null;
  // Revoked if the authorizing secret is no longer configured.
  if (!row.secret_hash || !currentSecretHashes().has(row.secret_hash)) return null;
  // Issue a new access token bound to the same secret; keep the refresh token.
  const access = randomBytes(32).toString("base64url");
  const nowSec = Math.floor(now / 1000);
  db()
    .prepare(
      `INSERT INTO mcp_oauth_tokens(token_hash, kind, client_id, secret_hash, expires_at) VALUES(?,?,?,?,?)`
    )
    .run(hash(access), "access", row.client_id, row.secret_hash, nowSec + ACCESS_TTL_SEC);
  return { access_token: access, refresh_token: refreshToken, expires_in: ACCESS_TTL_SEC };
}

// Legacy adoption: tokens issued before the secret_hash column existed have a
// NULL secret_hash after the migration's ALTER. A plain deploy would then
// reject them (isValidAccessToken/refreshAccessToken require the secret to be
// currently configured), silently logging the user's existing connector out.
// Instead, adopt those NULL rows into the CURRENTLY configured secret once, at
// first use after the migration — at which point the current secret IS the one
// that authorized them (the user hasn't rotated between issuing and this
// deploy). They then behave like any other token: valid on a same-secret
// deploy, revoked on a later rotation. Idempotent + guarded so it runs once.
let legacyAdopted = false;
export function backfillLegacyTokenSecrets(): void {
  if (legacyAdopted) return;
  const primary = [...currentSecretHashes()][0];
  if (!primary) return; // no secret configured → endpoint disabled; retry later
  try {
    db()
      .prepare(`UPDATE mcp_oauth_tokens SET secret_hash = ? WHERE secret_hash IS NULL`)
      .run(primary);
    legacyAdopted = true;
  } catch {
    // best-effort; a failure just means we retry on the next call
  }
}

// Test-only: reset the once-per-process adoption guard.
export function resetLegacyAdoption(): void {
  legacyAdopted = false;
}

// True if the presented bearer is a live (unexpired) OAuth access token whose
// authorizing secret is STILL configured. Rotating MCP_AUTH_TOKEN away from
// the value that minted a token invalidates it here — this is what makes the
// documented "change the token to revoke" actually revoke. better-sqlite3 is
// synchronous, so this stays a sync check.
export function isValidAccessToken(token: string, now = Date.now()): boolean {
  backfillLegacyTokenSecrets();
  const row = db()
    .prepare(
      `SELECT secret_hash, expires_at FROM mcp_oauth_tokens WHERE token_hash = ? AND kind = 'access'`
    )
    .get(hash(token)) as
    | { secret_hash: string | null; expires_at: number | null }
    | undefined;
  if (!row) return false;
  const nowSec = Math.floor(now / 1000);
  if (row.expires_at !== null && row.expires_at < nowSec) return false;
  // A token minted under a now-rotated-out secret is dead (revocation).
  if (!row.secret_hash || !currentSecretHashes().has(row.secret_hash)) return false;
  return true;
}

// Best-effort GC: expired access tokens AND any token (access or refresh)
// whose authorizing secret is no longer configured — the latter clears the
// dead rows left behind by a rotation, so revocation is also a real delete.
export function pruneExpiredTokens(now = Date.now()): void {
  try {
    db()
      .prepare(
        `DELETE FROM mcp_oauth_tokens WHERE kind = 'access' AND expires_at IS NOT NULL AND expires_at < ?`
      )
      .run(Math.floor(now / 1000));
    const live = [...currentSecretHashes()];
    if (live.length > 0) {
      const placeholders = live.map(() => "?").join(",");
      db()
        .prepare(
          `DELETE FROM mcp_oauth_tokens WHERE secret_hash IS NULL OR secret_hash NOT IN (${placeholders})`
        )
        .run(...live);
    }
    // When no secret is configured the endpoint is disabled anyway; leave rows
    // (they can't validate) rather than wipe on a transient empty config.
  } catch {
    // best-effort
  }
}
