import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { dedupeAllEntities } from "@/lib/entityMerge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/mind/merge-entities
// Claude scans the diary's people/places/projects for duplicate spellings of
// the same real entity (e.g. a Korean name + its romanization) and merges
// each group into one canonical name across the whole app. Records aliases so
// future ingests auto-fold too. Costs a few Claude calls (one per kind).
export async function POST() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  try {
    const result = await dedupeAllEntities();
    // A merge changes the entity graph, so refresh the Dropbox diary export
    // (day files' wikilinks + entity stub notes) in the background — no-op
    // unless the export is enabled + connected.
    if (result.merged > 0) {
      try {
        const { maybeExportDiaryToDropbox } = (await import(
          "@/lib/dropbox"
        )) as { maybeExportDiaryToDropbox: () => Promise<unknown> };
        void maybeExportDiaryToDropbox();
      } catch {
        // best-effort — never fail the merge because of the export
      }
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: `Merge failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
