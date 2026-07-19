import { NextResponse } from "next/server";
import { registerClient, corsHeaders } from "@/lib/mcpOauth";
import {
  clientIp,
  isThrottled,
  recordAuthFailure,
  recordMcpAudit,
  REGISTER_THROTTLE_BUCKET,
} from "@/lib/mcp";

// RFC 7591 Dynamic Client Registration. claude.ai POSTs its client metadata
// (redirect_uris etc.) and gets a client_id back. Public clients only — we
// return no client_secret and require PKCE at the token endpoint, so an
// unauthenticated registration grants nothing on its own: the /authorize
// consent step still gates on the MCP_AUTH_TOKEN secret. Registration itself
// is intentionally open (no auth) per RFC 7591, but still per-IP rate
// limited — in its own throttle bucket (see REGISTER_THROTTLE_BUCKET) so
// registration spam can't share a budget with, or be capped by, real
// auth-failure throttling on /authorize and /api/mcp — and registerClient()
// caps mcp_oauth_clients so spam can't grow the table unboundedly either.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  if (isThrottled(ip, Date.now(), REGISTER_THROTTLE_BUCKET)) {
    recordMcpAudit("throttled", { ip, tool: "oauth_register", ok: false });
    return NextResponse.json(
      { error: "Too many registration attempts. Try again later." },
      { status: 429, headers: { ...corsHeaders(), "retry-after": "600" } }
    );
  }
  recordAuthFailure(ip, Date.now(), REGISTER_THROTTLE_BUCKET);

  let body: { redirect_uris?: unknown; client_name?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "Body must be JSON." },
      { status: 400, headers: corsHeaders() }
    );
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((u): u is string => typeof u === "string" && u.length > 0)
    : [];
  if (redirectUris.length === 0) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "At least one redirect_uri is required." },
      { status: 400, headers: corsHeaders() }
    );
  }

  const clientName = typeof body.client_name === "string" ? body.client_name : undefined;
  const client = registerClient(redirectUris, clientName);

  return NextResponse.json(
    {
      client_id: client.client_id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: client.redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201, headers: corsHeaders() }
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
