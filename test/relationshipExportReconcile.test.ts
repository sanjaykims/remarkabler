import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// The one-time relationship-export reconciliation (lib/notes.ts) repairs
// entity stubs that were exported BEFORE their typed relationships were
// written (the original export race). It is one-shot, guarded by the
// `relationship_export_race_reconciled_at` setting.
//
// The load-bearing invariant pinned here: it must only mark itself reconciled
// when an export ACTUALLY RAN. A `skipped: "in-flight"` result means our
// export never ran — another writer held the shared lock. lib/dropbox.ts's
// coalesced follow-up will fire one, but that follow-up's failures are only
// logged and never propagate back here, so treating "in-flight" as done would
// burn the one-shot repair on a run that may have written nothing, leaving
// the stale stubs stale forever. That is the same "treated didn't-happen as
// done" mistake that caused the original race.

type DbMod = typeof import("@/lib/db");
type NotesMod = typeof import("@/lib/notes");
type DropboxMod = typeof import("@/lib/dropbox");

let dbMod: DbMod;
let notes: NotesMod;
let dropbox: DropboxMod;

const RECONCILED_KEY = "relationship_export_race_reconciled_at";
const ATTEMPT_KEY = "relationship_export_race_reconcile_attempt_at";

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "rel-export-reconcile-"));
  dbMod = await import("@/lib/db");
  notes = await import("@/lib/notes");
  dropbox = await import("@/lib/dropbox");
});

afterEach(() => {
  vi.restoreAllMocks();
  dbMod.db().exec(`
    DELETE FROM entity_relationships;
    DELETE FROM settings;
  `);
});

// One relationship row, so the reconciliation has something to repair (it
// short-circuits to "done" when the table is empty).
function seedRelationship(): void {
  dbMod
    .db()
    .prepare(
      `INSERT INTO entity_relationships
         (subject_kind, subject_norm, subject_name, predicate,
          object_kind, object_norm, object_name, source_kind, source_key, updated_at)
       VALUES ('person','jin','Jin','lives_in','place','suwon','Suwon',
               'librarian_conversation','conv1', datetime('now'))`
    )
    .run();
}

async function settle(): Promise<void> {
  // The reconciliation fires its export un-awaited; let the microtask chain
  // (dynamic import + two .then hops) drain before asserting.
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 5));
}

describe("relationship export reconciliation", () => {
  it("does NOT mark itself reconciled when the export was skipped as in-flight", async () => {
    seedRelationship();
    const exportSpy = vi
      .spyOn(dropbox, "maybeExportDiaryToDropbox")
      .mockResolvedValue({ ok: false, skipped: "in-flight" });

    notes.runMaintenanceSweep();
    await settle();

    expect(exportSpy).toHaveBeenCalled();
    // The repair did NOT happen, so the one-shot must stay armed for a retry
    // after the backoff — otherwise stale stubs are stranded permanently.
    expect(dbMod.getSetting(RECONCILED_KEY)).toBeNull();
    // ...but the attempt IS recorded, so it backs off instead of spinning.
    expect(dbMod.getSetting(ATTEMPT_KEY)).not.toBeNull();
  });

  it("marks itself reconciled once an export actually succeeds", async () => {
    seedRelationship();
    vi.spyOn(dropbox, "maybeExportDiaryToDropbox").mockResolvedValue({
      ok: true,
      written: 3,
      failed: 0,
    });

    notes.runMaintenanceSweep();
    await settle();

    expect(dbMod.getSetting(RECONCILED_KEY)).not.toBeNull();
  });

  it("marks itself reconciled when there was genuinely nothing to upload", async () => {
    seedRelationship();
    vi.spyOn(dropbox, "maybeExportDiaryToDropbox").mockResolvedValue({
      ok: true,
      written: 0,
      skipped: "nothing",
    });

    notes.runMaintenanceSweep();
    await settle();

    expect(dbMod.getSetting(RECONCILED_KEY)).not.toBeNull();
  });

  it("does NOT mark itself reconciled when the export failed outright", async () => {
    seedRelationship();
    vi.spyOn(dropbox, "maybeExportDiaryToDropbox").mockResolvedValue({
      ok: false,
      written: 2,
      failed: 1,
      error: "partial upload failure",
    });

    notes.runMaintenanceSweep();
    await settle();

    expect(dbMod.getSetting(RECONCILED_KEY)).toBeNull();
  });

  it("short-circuits to done (no export) when there are no relationships at all", async () => {
    const exportSpy = vi.spyOn(dropbox, "maybeExportDiaryToDropbox");

    notes.runMaintenanceSweep();
    await settle();

    expect(exportSpy).not.toHaveBeenCalled();
    expect(dbMod.getSetting(RECONCILED_KEY)).not.toBeNull();
  });

  it("never runs again once reconciled", async () => {
    seedRelationship();
    dbMod.setSetting(RECONCILED_KEY, new Date().toISOString());
    const exportSpy = vi.spyOn(dropbox, "maybeExportDiaryToDropbox");

    notes.runMaintenanceSweep();
    await settle();

    expect(exportSpy).not.toHaveBeenCalled();
  });
});
