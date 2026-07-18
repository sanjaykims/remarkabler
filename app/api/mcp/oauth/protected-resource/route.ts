import { NextResponse } from "next/server";
import { publicOrigin, protectedResourceMetadata, corsHeaders } from "@/lib/mcpOauth";

// RFC 9728 Protected Resource Metadata. claude.ai fetches this (from the
// resource_metadata pointer in /api/mcp's 401) to discover the authorization
// server. Public + CORS — no auth. Also served at the /api/mcp-suffixed path
// via next.config rewrites.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const origin = publicOrigin(req);
  return NextResponse.json(protectedResourceMetadata(origin), {
    headers: corsHeaders(),
  });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
