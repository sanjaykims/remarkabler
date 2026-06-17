import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { dropboxStatus } from "@/lib/dropbox";
import { runMaintenanceSweep } from "@/lib/notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  // Fire-and-forget the background sweep — gated internally to ≤ once per
  // 5 min. The Memory page loads this endpoint, so opening Memory is now a
  // natural place to trigger a Dropbox poll. The status returned still
  // reflects the previous sweep; the new one (if eligible) populates by
  // the next refresh, which is fine — this is just removing the
  // "must-send-a-chat-to-poll" requirement.
  runMaintenanceSweep();
  return NextResponse.json(dropboxStatus());
}
