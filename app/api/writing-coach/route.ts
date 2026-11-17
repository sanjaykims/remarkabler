import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { listCoachSessions } from "@/lib/writingCoach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: the writing-coach sessions, newest first. They quote the diary, so this sits behind
// the app lock like Insights. Not exposed on MCP.
export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  return NextResponse.json({ sessions: listCoachSessions() });
}
