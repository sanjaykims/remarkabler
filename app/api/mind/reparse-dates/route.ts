import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { reparseAllEntryDates } from "@/lib/notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mind/reparse-dates
// Re-runs the diary-header date extraction over every page, carrying the
// most recent timestamp forward within each notebook so pages without their
// own header inherit the session's date. Cheap (no Claude / no Voyage) —
// just a single SQL pass with one regex per page.
export async function POST() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  try {
    const result = reparseAllEntryDates();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: `Reparse failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
