import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { refreshEntityWiki } from "@/lib/entityWiki";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/mind/build-wiki
// Generate/refresh Claude-written profile pages for the diary's entities (the
// "life wiki"). Processes a bounded batch of stale entities per call and
// reports how many remain, so a big first build is a few taps. Also opts the
// diary into ongoing auto-refresh in the maintenance sweep. Refreshes the
// Dropbox export afterward so the new profiles land in Obsidian.
export async function POST() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  try {
    const result = await refreshEntityWiki({ limit: 20 });
    if (result.entities.length > 0) {
      try {
        const { maybeExportDiaryToDropbox } = await import("@/lib/dropbox");
        const { entityStubRelPathForName } = await import("@/lib/diaryExportDb");
        // Upload only the regenerated profile stubs, not the whole vault.
        const stubPaths = result.entities.map((e) =>
          entityStubRelPathForName(e.kind, e.name)
        );
        void maybeExportDiaryToDropbox({ onlyEntityStubs: stubPaths });
      } catch {
        // best-effort — never fail the build because of the export
      }
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: `Wiki build failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
