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
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  try {
    const result = reparseAllEntryDates();
    // Re-parsing can move entries out of "undated" into real dates (e.g.
    // after the parser learns a new header spacing), which changes the
    // per-day Dropbox export. Refresh it in the background (best-effort,
    // no-op unless the export is enabled + connected) so the user doesn't
    // have to also hop to /memory and tap "Export now".
    if (result.updated > 0) {
      try {
        const { maybeExportDiaryToDropbox } = (await import(
          "@/lib/dropbox"
        )) as { maybeExportDiaryToDropbox: () => Promise<unknown> };
        // The outer try/catch only guards the synchronous dynamic import —
        // .catch() below is what guards the returned promise, so an async
        // failure here can't become an unhandled rejection.
        void maybeExportDiaryToDropbox().catch((e) =>
          console.warn("[mind/reparse-dates] dropbox export failed:", (e as Error).message)
        );
      } catch {
        // best-effort — never fail the reparse because of the export
      }
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: `Reparse failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
