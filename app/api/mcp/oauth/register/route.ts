import { NextResponse } from "next/server";
import { registerClient, corsHeaders } from "@/lib/mcpOauth";

// RFC 7591 Dynamic Client Registration. claude.ai POSTs its client metadata
// (redirect_uris etc.) and gets a client_id back. Public clients only — we
// return no client_secret and require PKCE at the token endpoint, so an
// unauthenticated registration grants nothing on its own: the /authorize
// consent step still gates on the MCP_AUTH_TOKEN secret.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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
