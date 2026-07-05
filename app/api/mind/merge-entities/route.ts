import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { dedupeAllEntities } from "@/lib/entityMerge";
import { entityStubRelPathForName } from "@/lib/diaryExportDb";

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
    // A merge changes the entity graph. Two Dropbox follow-ups (best-effort,
    // no-op unless export is enabled + connected):
    //   1. DELETE the merged-away entities' stub notes (People/<old>.md) —
    //      the full export overwrites but never deletes, so without this the
    //      stale stub survives as an orphaned Obsidian node (Codex, #108).
    //   2. Refresh the export so day-file wikilinks + the canonical stubs
    //      reflect the merge.
    if (result.merged > 0) {
      try {
        const dropbox = (await import("@/lib/dropbox")) as {
          deleteDiaryExportFiles: (n: string[]) => Promise<unknown>;
          maybeExportDiaryToDropbox: () => Promise<unknown>;
        };
        const stalePaths: string[] = [];
        for (const g of result.groups) {
          for (const alias of g.aliases) {
            stalePaths.push(entityStubRelPathForName(g.kind, alias));
          }
        }
        await dropbox.deleteDiaryExportFiles(stalePaths);
        void dropbox.maybeExportDiaryToDropbox();
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
