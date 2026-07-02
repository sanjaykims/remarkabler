import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { pairRemarkable, remarkableStatus } from "@/lib/remarkableCloud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// POST { code } — pair with the reMarkable cloud using a one-time code from
// https://my.remarkable.com/device/browser/connect, then list notebooks to
// confirm it works. Phase 0: read-only, no ingestion.
export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return LOCKED();
  const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code : "";
  const result = await pairRemarkable(code);
  return NextResponse.json({ ...result, status: remarkableStatus() });
}
