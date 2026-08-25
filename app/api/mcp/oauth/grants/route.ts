import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { clientIp } from "@/lib/mcp";
import {
  listOAuthAudit,
  listOAuthGrants,
  revokeOAuthGrant,
} from "@/lib/mcpOauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLIENT_ID_RE = /^mcpc_[a-f0-9]{32}$/;

/** Owner-only inventory of OAuth grants and recent OAuth security events. */
export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  return NextResponse.json(
    { grants: listOAuthGrants(), audit: listOAuthAudit() },
    { headers: { "cache-control": "no-store" } }
  );
}

/** Owner-only revocation. The registered client may reconnect through consent. */
export async function DELETE(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const clientId = new URL(req.url).searchParams.get("client_id") || "";
  if (!CLIENT_ID_RE.test(clientId)) {
    return NextResponse.json({ error: "Invalid client_id" }, { status: 400 });
  }
  const revokedTokens = revokeOAuthGrant(clientId, clientIp(req.headers));
  if (revokedTokens === 0) {
    return NextResponse.json({ error: "OAuth grant not found" }, { status: 404 });
  }
  return NextResponse.json(
    { ok: true, client_id: clientId, revoked_tokens: revokedTokens },
    { headers: { "cache-control": "no-store" } }
  );
}
