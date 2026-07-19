import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  dropboxStatus,
  setDropboxExportEnabled,
  setDropboxExportFolder,
  maybeExportDiaryToDropbox,
  dropboxConnected,
} from "@/lib/dropbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// Toggle the per-day diary auto-export and/or kick a sync now.
//   { enabled: boolean } → persist the toggle
//   { runNow: true }     → probe write access (one file, awaited) then, if
//                          that succeeds, kick a FULL every-day sync in the
//                          background so a big diary can't time out the
//                          request. The awaited probe gives instant
//                          feedback on whether the write scope is granted.
export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return LOCKED();

  const body = (await req.json().catch(() => null)) as
    | { enabled?: unknown; runNow?: unknown; folder?: unknown }
    | null;

  if (body && typeof body.enabled === "boolean") {
    setDropboxExportEnabled(body.enabled);
  }

  // Change the destination folder (e.g. to a sync tool's app folder). Set
  // BEFORE any runNow probe so the probe writes to the new location.
  if (body && typeof body.folder === "string") {
    setDropboxExportFolder(body.folder);
  }

  let ran: Awaited<ReturnType<typeof maybeExportDiaryToDropbox>> | null = null;
  let fullSyncStarted = false;
  if (body && body.runNow === true) {
    if (!dropboxConnected()) {
      return NextResponse.json({ error: "Connect Dropbox first." }, { status: 400 });
    }
    // Fast, awaited probe: writes a single day file to confirm the write
    // scope works before committing to a full sync.
    ran = await maybeExportDiaryToDropbox({ onlyNewest: true });
    if (ran.ok) {
      // Background the full every-day sync (Railway is a long-running
      // process, so fire-and-forget survives the response). Not awaited so
      // a multi-year diary can't blow the 60s route budget.
      fullSyncStarted = true;
      void maybeExportDiaryToDropbox().catch((e) =>
        console.warn("[dropbox/export] full sync failed:", (e as Error).message)
      );
    }
  }

  return NextResponse.json({
    ok: true,
    ran,
    fullSyncStarted,
    status: dropboxStatus(),
  });
}
