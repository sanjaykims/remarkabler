import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { librarianStatus } from "@/lib/conversationEntities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// GET only — unlike backup/dropbox export, there's no "run now" here: the
// librarian is a separate, subscription-billed Claude Code agent (a cron
// Routine), not something this app's own server process runs. This route
// just surfaces its last-heartbeat status so /memory can show it.
export async function GET() {
  if (!isAuthenticated()) return LOCKED();
  return NextResponse.json(librarianStatus());
}
