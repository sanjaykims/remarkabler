import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { compareImportedNotebook } from "@/lib/remarkableCompare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// POST { id } — id is the reMarkable cloud doc id of an already-imported
// notebook. Compares its transcription per entry-date against existing
// (non-cloud) diary pages and returns Claude's quality verdict. This is the
// Phase 1b quality-gate report.
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  const id = (body.id || "").trim();
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Missing notebook id." },
      { status: 400 }
    );
  }
  return NextResponse.json(await compareImportedNotebook(id));
}
