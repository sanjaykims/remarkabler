import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { setSyncFolder, remarkableSyncStatus, maybeSyncRemarkable } from "@/lib/remarkableSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// POST { parent, enabled } — toggle zero-tap auto-sync for a folder (parent
// is the reMarkable folder id; notebooks in it are imported automatically and
// kept fresh by the maintenance sweep). Enabling kicks a FORCED sync attempt
// so the user sees results without waiting for the next sweep.
// POST { syncNow: true } — just kick a forced sync (the "Sync now" button):
// bypasses the interval, backoff, and fast-path cursor.
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
  const body = (await req.json().catch(() => ({}))) as {
    parent?: string;
    enabled?: boolean;
    syncNow?: boolean;
  };
  if (body.syncNow === true) {
    void maybeSyncRemarkable({ force: true }).catch(() => {});
    return NextResponse.json({ ok: true, sync: remarkableSyncStatus() });
  }
  const parent = (body.parent || "").trim();
  if (!parent) {
    return NextResponse.json(
      { ok: false, error: "Missing folder." },
      { status: 400 }
    );
  }
  const folders = setSyncFolder(parent, body.enabled === true);
  if (body.enabled === true) {
    void maybeSyncRemarkable({ force: true }).catch(() => {});
  }
  return NextResponse.json({ ok: true, folders, sync: remarkableSyncStatus() });
}
