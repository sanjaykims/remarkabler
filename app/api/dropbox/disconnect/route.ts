import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { disconnectDropbox } from "@/lib/dropbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/dropbox/disconnect
// Best-effort revoke at Dropbox, then ALWAYS clear local state. This order
// matters: clearing local state is the user's hard escape hatch — they must
// be able to stop this app from polling even if Dropbox is down or the
// cached access token is already invalid. Revoke failure is surfaced as a
// warning, not a blocker.
export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  const result = await disconnectDropbox();
  return NextResponse.json({ ok: true, ...result });
}
