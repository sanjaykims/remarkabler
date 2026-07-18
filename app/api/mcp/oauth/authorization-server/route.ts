import { NextResponse } from "next/server";
import { publicOrigin, authorizationServerMetadata, corsHeaders } from "@/lib/mcpOauth";

// RFC 8414 Authorization Server Metadata — advertises the authorize / token /
// registration endpoints so claude.ai can run the OAuth handshake. Public +
// CORS. Also served at the /api/mcp-suffixed path via next.config rewrites.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const origin = publicOrigin(req);
  return NextResponse.json(authorizationServerMetadata(origin), {
    headers: corsHeaders(),
  });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
