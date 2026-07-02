import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  dropboxStatus,
  setDropboxExportEnabled,
  maybeExportDiaryToDropbox,
  dropboxConnected,
} from "@/lib/dropbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// Toggle the "auto-save diary Markdown back to Dropbox" feature and/or run
// an export right now.
//   { enabled: boolean }  → persist the toggle
//   { runNow: true }      → attempt an export immediately (used to verify
//                           write access works after enabling the scope)
// Both can be sent together: enable + test in one call.
export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return LOCKED();

  const body = (await req.json().catch(() => null)) as
    | { enabled?: unknown; runNow?: unknown }
    | null;

  if (body && typeof body.enabled === "boolean") {
    setDropboxExportEnabled(body.enabled);
  }

  let ran: Awaited<ReturnType<typeof maybeExportDiaryToDropbox>> | null = null;
  if (body && body.runNow === true) {
    if (!dropboxConnected()) {
      return NextResponse.json(
        { error: "Connect Dropbox first." },
        { status: 400 }
      );
    }
    ran = await maybeExportDiaryToDropbox();
  }

  return NextResponse.json({ ok: true, ran, status: dropboxStatus() });
}
