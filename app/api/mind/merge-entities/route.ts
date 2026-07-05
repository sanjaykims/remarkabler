import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { dedupeAllEntities, listAliases } from "@/lib/entityMerge";
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
    // Dropbox follow-ups (best-effort, no-op unless export is enabled +
    // connected):
    //   1. DELETE the stub notes (People/<old>.md) of EVERY recorded alias,
    //      not just the ones merged this run — the full export overwrites but
    //      never deletes, so a stale stub (incl. one merged on an earlier
    //      deploy, when result.merged is now 0) survives as an orphaned
    //      Obsidian node otherwise (Codex, #108/#109).
    //   2. When something actually merged, refresh the export so day-file
    //      wikilinks + the canonical stubs reflect it.
    try {
      const dropbox = (await import("@/lib/dropbox")) as {
        deleteDiaryExportFiles: (n: string[]) => Promise<unknown>;
        maybeExportDiaryToDropbox: () => Promise<unknown>;
      };
      const stalePaths = listAliases().map((a) =>
        entityStubRelPathForName(a.kind, a.alias_name)
      );
      if (stalePaths.length > 0) await dropbox.deleteDiaryExportFiles(stalePaths);
      if (result.merged > 0) void dropbox.maybeExportDiaryToDropbox();
    } catch {
      // best-effort — never fail the merge because of the export
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: `Merge failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
