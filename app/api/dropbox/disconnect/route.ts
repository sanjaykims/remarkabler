import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { disconnectDropbox } from "@/lib/dropbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/dropbox/disconnect
// Clears the stored refresh_token (and last-sync bookkeeping) so the watcher
// goes dormant. The notebooks already ingested stay put — disconnect just
// stops the polling loop. The user can re-connect later without losing data.
//
// Does NOT call Dropbox to revoke the token: that would require the access
// token, which we may not have cached, and is unnecessary for stopping the
// flow. If the user wants the app's permission fully revoked they can do it
// from dropbox.com/account/connected_apps.
export async function POST() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  disconnectDropbox();
  return NextResponse.json({ ok: true });
}
