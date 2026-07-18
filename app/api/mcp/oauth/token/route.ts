import { NextResponse } from "next/server";
import {
  getClient,
  redeemAuthCode,
  issueTokens,
  refreshAccessToken,
  pruneExpiredTokens,
  corsHeaders,
} from "@/lib/mcpOauth";

// OAuth token endpoint. Exchanges an authorization code (with PKCE) for an
// access token, or rotates a refresh token into a fresh access token. No
// client secret (public client) — PKCE is the proof, and the code was only
// issued after the /authorize consent gate accepted the MCP_AUTH_TOKEN.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function err(code: string, description: string, status = 400): NextResponse {
  return NextResponse.json(
    { error: code, error_description: description },
    { status, headers: corsHeaders() }
  );
}

async function readForm(req: Request): Promise<URLSearchParams> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const sp = new URLSearchParams();
    try {
      const j = (await req.json()) as Record<string, unknown>;
      for (const [k, v] of Object.entries(j)) if (v != null) sp.set(k, String(v));
    } catch {
      // leave empty
    }
    return sp;
  }
  const form = await req.formData();
  const sp = new URLSearchParams();
  for (const [k, v] of form.entries()) if (typeof v === "string") sp.set(k, v);
  return sp;
}

export async function POST(req: Request) {
  pruneExpiredTokens();
  const p = await readForm(req);
  const grantType = p.get("grant_type") || "";

  if (grantType === "authorization_code") {
    const code = p.get("code") || "";
    const clientId = p.get("client_id") || "";
    const redirectUri = p.get("redirect_uri") || "";
    const codeVerifier = p.get("code_verifier") || "";
    if (!code || !clientId || !redirectUri || !codeVerifier)
      return err("invalid_request", "Missing required parameter.");
    if (!getClient(clientId)) return err("invalid_client", "Unknown client_id.");

    const res = redeemAuthCode(code, clientId, redirectUri, codeVerifier);
    if (!res.ok) return err("invalid_grant", "Code invalid, expired, reused, or PKCE mismatch.");

    const t = issueTokens(clientId, res.secretHash);
    return NextResponse.json(
      {
        access_token: t.access_token,
        token_type: "Bearer",
        expires_in: t.expires_in,
        refresh_token: t.refresh_token,
        scope: "mcp",
      },
      { headers: { ...corsHeaders(), "cache-control": "no-store" } }
    );
  }

  if (grantType === "refresh_token") {
    const refreshToken = p.get("refresh_token") || "";
    const clientId = p.get("client_id") || "";
    if (!refreshToken) return err("invalid_request", "Missing refresh_token.");
    const t = refreshAccessToken(refreshToken, clientId);
    if (!t) return err("invalid_grant", "Unknown or revoked refresh_token.");
    return NextResponse.json(
      {
        access_token: t.access_token,
        token_type: "Bearer",
        expires_in: t.expires_in,
        refresh_token: t.refresh_token,
        scope: "mcp",
      },
      { headers: { ...corsHeaders(), "cache-control": "no-store" } }
    );
  }

  return err("unsupported_grant_type", `Unsupported grant_type: ${grantType}`);
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
