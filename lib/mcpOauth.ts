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
export const MAX_DCR_BODY_BYTES = 32 * 1024;
const MAX_REDIRECT_URIS = 10;
const MAX_REDIRECT_URI_LENGTH = 2048;
const MAX_CLIENT_NAME_LENGTH = 128;

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
export type RegisteredClient = {
  client_id: string;
  redirect_uris: string[];
  client_name?: string;
  created_at?: string;
};

export type ClientRegistrationMetadata = {
  redirect_uris: string[];
  client_name?: string;
};

export type ClientMetadataResult =
  | { ok: true; metadata: ClientRegistrationMetadata }
  | { ok: false; error: "invalid_client_metadata" | "invalid_redirect_uri"; description: string };

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * OAuth redirect policy: public HTTPS endpoints are allowed, while plaintext
 * HTTP is restricted to loopback development clients. Custom schemes,
 * credentials, and fragments are rejected. This intentionally validates the
 * URI shape rather than hard-coding any one connector vendor's hostname.
 */
export function parseSafeRedirectUri(value: string): URL | null {
  if (!value || value.length > MAX_REDIRECT_URI_LENGTH) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.username || parsed.password || parsed.hash) return null;
  if (parsed.protocol === "https:" && parsed.hostname) return parsed;
  if (parsed.protocol === "http:" && LOOPBACK_HOSTS.has(parsed.hostname)) return parsed;
  return null;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return null;
  return value as string[];
}

/** Parse and bound the DCR fields this public-client server supports. */
export function parseClientRegistrationMetadata(value: unknown): ClientMetadataResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      error: "invalid_client_metadata",
      description: "Client metadata must be a JSON object.",
    };
  }
  const body = value as Record<string, unknown>;
  const redirectUris = stringArray(body.redirect_uris);
  if (!redirectUris || redirectUris.length === 0 || redirectUris.length > MAX_REDIRECT_URIS) {
    return {
      ok: false,
      error: "invalid_redirect_uri",
      description: `redirect_uris must contain 1-${MAX_REDIRECT_URIS} URI strings.`,
    };
  }
  if (redirectUris.some((uri) => !parseSafeRedirectUri(uri))) {
    return {
      ok: false,
      error: "invalid_redirect_uri",
      description: "Redirect URIs must use HTTPS, or HTTP on an exact loopback host, without credentials or fragments.",
    };
  }

  const grantTypes = body.grant_types === undefined ? undefined : stringArray(body.grant_types);
  if (
    grantTypes === null ||
    (grantTypes &&
      (!grantTypes.includes("authorization_code") ||
        grantTypes.some((grant) => grant !== "authorization_code" && grant !== "refresh_token")))
  ) {
    return {
      ok: false,
      error: "invalid_client_metadata",
      description: "Only authorization_code and refresh_token grants are supported.",
    };
  }

  const responseTypes =
    body.response_types === undefined ? undefined : stringArray(body.response_types);
  if (
    responseTypes === null ||
    (responseTypes &&
      (responseTypes.length === 0 || responseTypes.some((response) => response !== "code")))
  ) {
    return {
      ok: false,
      error: "invalid_client_metadata",
      description: "Only the code response type is supported.",
    };
  }
  if (
    body.token_endpoint_auth_method !== undefined &&
    body.token_endpoint_auth_method !== "none"
  ) {
    return {
      ok: false,
      error: "invalid_client_metadata",
      description: "Only public clients using token_endpoint_auth_method 'none' are supported.",
    };
  }

  let clientName: string | undefined;
  if (body.client_name !== undefined) {
    if (typeof body.client_name !== "string") {
      return {
        ok: false,
        error: "invalid_client_metadata",
        description: "client_name must be a string.",
      };
    }
    clientName = body.client_name.trim();
    if (
      !clientName ||
      clientName.length > MAX_CLIENT_NAME_LENGTH ||
      /[\u0000-\u001f\u007f]/.test(clientName)
    ) {
      return {
        ok: false,
        error: "invalid_client_metadata",
        description: `client_name must be 1-${MAX_CLIENT_NAME_LENGTH} printable characters.`,
      };
    }
  }

  return {
    ok: true,
    metadata: { redirect_uris: [...new Set(redirectUris)], client_name: clientName },
  };
}

// Cap on client rows that never completed the OAuth dance (no row in
// mcp_oauth_tokens). Unlike mcp_audit's pure log, a client row can be
// *live-referenced* — /authorize and /token's refresh-token grant both look
// it up, and refresh tokens never expire — so evicting by age alone risks
// breaking a real, still-active connector. The eviction below therefore
// never touches a client that ever issued a token; it only bounds pure
// registration spam (registered, then abandoned before finishing consent).
const CLIENT_KEEP_ROWS = 2000;

export function registerClient(redirectUris: string[], clientName?: string): RegisteredClient {
  const clientId = `mcpc_${randomBytes(16).toString("hex")}`;
  db()
    .prepare(
      `INSERT INTO mcp_oauth_clients(client_id, redirect_uris, client_name) VALUES(?,?,?)`
    )
    .run(clientId, JSON.stringify(redirectUris), clientName ?? null);
  try {
    const total = db()
      .prepare(`SELECT COUNT(*) AS n FROM mcp_oauth_clients`)
      .get() as { n: number };
    // Avoid an O(n^2) spam-defense path: the eviction query is unnecessary
    // while the table is below its bound and only becomes expensive near it.
    if (total.n > CLIENT_KEEP_ROWS) {
      db()
        .prepare(
          `DELETE FROM mcp_oauth_clients
           WHERE client_id NOT IN (SELECT DISTINCT client_id FROM mcp_oauth_tokens WHERE client_id IS NOT NULL)
             AND client_id NOT IN (
               SELECT client_id FROM mcp_oauth_clients
               WHERE client_id NOT IN (SELECT DISTINCT client_id FROM mcp_oauth_tokens WHERE client_id IS NOT NULL)
               ORDER BY created_at DESC, rowid DESC
               LIMIT ?
             )`
        )
        .run(CLIENT_KEEP_ROWS);
    }
  } catch (e) {
    console.warn("[mcp] client-table eviction failed:", (e as Error).message);
  }
  return { client_id: clientId, redirect_uris: redirectUris, client_name: clientName };
}

export function getClient(clientId: string): RegisteredClient | null {
  const row = db()
    .prepare(
      `SELECT client_id, redirect_uris, client_name, created_at
       FROM mcp_oauth_clients WHERE client_id = ?`
    )
    .get(clientId) as
    | { client_id: string; redirect_uris: string; client_name: string | null; created_at: string }
    | undefined;
  if (!row) return null;
  let uris: string[] = [];
  try {
    uris = JSON.parse(row.redirect_uris);
  } catch {
    uris = [];
  }
  return {
    client_id: row.client_id,
    redirect_uris: uris,
    client_name: row.client_name ?? undefined,
    created_at: row.created_at,
  };
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
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)) return false;
  if (!/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) return false;
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
  const row = db()
    .prepare(
      `SELECT client_id, secret_hash FROM mcp_oauth_tokens WHERE token_hash = ? AND kind = 'refresh'`
    )
    .get(hash(refreshToken)) as
    | { client_id: string | null; secret_hash: string | null }
    | undefined;
  if (!row || !row.client_id || row.client_id !== clientId) return null;
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

// True if the presented bearer is a live (unexpired) OAuth access token whose
// authorizing secret is STILL configured. Rotating MCP_AUTH_TOKEN away from
// the value that minted a token invalidates it here — this is what makes the
// documented "change the token to revoke" actually revoke. better-sqlite3 is
// synchronous, so this stays a sync check.
export function isValidAccessToken(token: string, now = Date.now()): boolean {
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

// --- Owner grant management -----------------------------------------------
export type OAuthGrant = {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  registered_at: string;
  last_issued_at: string;
  active_access_tokens: number;
  has_active_refresh_token: boolean;
  active: boolean;
};

export type OAuthAuditEntry = {
  id: number;
  ts: string;
  ip: string;
  event: string;
  tool: string | null;
  ok: boolean;
};

/** Lists grants without ever returning bearer values or token hashes. */
export function listOAuthGrants(now = Date.now()): OAuthGrant[] {
  pruneExpiredTokens(now);
  const rows = db()
    .prepare(
      `SELECT c.client_id, c.client_name, c.redirect_uris, c.created_at AS registered_at,
              t.kind, t.secret_hash, t.expires_at, t.created_at AS issued_at
       FROM mcp_oauth_clients c
       JOIN mcp_oauth_tokens t ON t.client_id = c.client_id
       ORDER BY t.created_at DESC`
    )
    .all() as Array<{
    client_id: string;
    client_name: string | null;
    redirect_uris: string;
    registered_at: string;
    kind: string;
    secret_hash: string | null;
    expires_at: number | null;
    issued_at: string;
  }>;

  const nowSec = Math.floor(now / 1000);
  const liveSecrets = currentSecretHashes();
  const grants = new Map<string, OAuthGrant>();
  for (const row of rows) {
    let grant = grants.get(row.client_id);
    if (!grant) {
      let redirectUris: string[] = [];
      try {
        const parsed = JSON.parse(row.redirect_uris);
        if (Array.isArray(parsed)) {
          redirectUris = parsed.filter((uri): uri is string => typeof uri === "string");
        }
      } catch {
        // A legacy malformed row remains revocable but exposes no unsafe data.
      }
      grant = {
        client_id: row.client_id,
        client_name: row.client_name,
        redirect_uris: redirectUris,
        registered_at: row.registered_at,
        last_issued_at: row.issued_at,
        active_access_tokens: 0,
        has_active_refresh_token: false,
        active: false,
      };
      grants.set(row.client_id, grant);
    }
    const secretActive = !!row.secret_hash && liveSecrets.has(row.secret_hash);
    if (
      row.kind === "access" &&
      secretActive &&
      (row.expires_at === null || row.expires_at >= nowSec)
    ) {
      grant.active_access_tokens += 1;
    }
    if (row.kind === "refresh" && secretActive) grant.has_active_refresh_token = true;
    grant.active = grant.active_access_tokens > 0 || grant.has_active_refresh_token;
  }
  return [...grants.values()];
}

/** Revokes every access and refresh token issued to one registered client. */
export function revokeOAuthGrant(clientId: string, ip = "unknown"): number {
  const result = db()
    .prepare(`DELETE FROM mcp_oauth_tokens WHERE client_id = ?`)
    .run(clientId);
  if (result.changes > 0) {
    try {
      db()
        .prepare(`INSERT INTO mcp_audit(ip, event, tool, ok) VALUES(?,?,?,1)`)
        .run(ip, "oauth_revoke", "oauth_grant");
      db()
        .prepare(
          `DELETE FROM mcp_audit
           WHERE id <= (SELECT MAX(id) FROM mcp_audit) - 2000`
        )
        .run();
    } catch (e) {
      console.warn("[mcp] OAuth revocation audit failed:", (e as Error).message);
    }
  }
  return result.changes;
}

export function listOAuthAudit(limit = 50): OAuthAuditEntry[] {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit) || 50));
  const rows = db()
    .prepare(
      `SELECT id, ts, ip, event, tool, ok
       FROM mcp_audit
       WHERE tool LIKE 'oauth_%' OR event = 'oauth_revoke'
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(safeLimit) as Array<Omit<OAuthAuditEntry, "ok"> & { ok: number }>;
  return rows.map((row) => ({ ...row, ok: row.ok === 1 }));
}
