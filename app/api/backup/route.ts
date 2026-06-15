import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  backupConfigured,
  backupStatus,
  runBackup,
} from "@/lib/backup";
import { setSetting, clearSetting } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Manual backup runs synchronously through the API call. Give it room.
export const maxDuration = 600;

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

export async function GET() {
  if (!isAuthenticated()) return LOCKED();
  return NextResponse.json(backupStatus());
}

export async function POST() {
  if (!isAuthenticated()) return LOCKED();
  if (!backupConfigured()) {
    return NextResponse.json(
      {
        error:
          "Backup is not configured yet. Set BACKUP_REPO and BACKUP_GITHUB_TOKEN in Railway.",
      },
      { status: 400 }
    );
  }
  // Manual backup runs immediately (no backoff gate), but still records the
  // attempt time so the automatic sweep's backoff window stays in sync — a
  // manual run that just failed shouldn't be instantly re-attempted by the
  // next sweep either.
  setSetting("backup_last_attempt_at", new Date().toISOString());
  try {
    const size = await runBackup();
    setSetting("backup_last_at", new Date().toISOString());
    setSetting("backup_last_size_bytes", String(size));
    clearSetting("backup_last_error");
    return NextResponse.json({ ok: true, sizeBytes: size });
  } catch (err) {
    const msg = (err as Error).message;
    setSetting("backup_last_error", msg.slice(0, 500));
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
