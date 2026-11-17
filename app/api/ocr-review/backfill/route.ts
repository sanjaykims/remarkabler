import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { notebooksPinDenied } from "@/lib/notebooksPin";
import { estimateBackfill, runBackfill, resetForRecheck } from "@/lib/ocrBackfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// GET: how many old notebooks are left to proofread + a cost estimate.
export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
  const pinDenied = notebooksPinDenied(req);
  if (pinDenied) return pinDenied;
  return NextResponse.json(estimateBackfill());
}

// POST {limit?: 1-3}: proofread the next notebooks (newest first). Adds review cards only;
// never edits page text.
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
  const pinDenied = notebooksPinDenied(req);
  if (pinDenied) return pinDenied;
  const body = (await req.json().catch(() => null)) as { limit?: unknown; recheck?: unknown } | null;
  if (body?.recheck === true) return NextResponse.json(resetForRecheck());
  const limit = typeof body?.limit === "number" ? body.limit : 1;
  const r = await runBackfill(limit);
  if (r.busy) return NextResponse.json({ error: "A proofreading run is already going." }, { status: 409 });
  return NextResponse.json(r);
}
