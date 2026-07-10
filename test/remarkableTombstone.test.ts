import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Deleting a reMarkable-cloud-synced notebook must tombstone its doc id so
// the Phase-2 zero-tap sweep doesn't silently re-import (and re-bill OCR
// for) it on the next pass — the same "delete doesn't stick" bug class the
// Dropbox tombstone fixed in the other ingest channel. An explicit user
// Import clears the tombstone (deliberate re-add overrides a past delete).

type DbMod = typeof import("@/lib/db");
type NotesMod = typeof import("@/lib/notes");
type SyncMod = typeof import("@/lib/remarkableSync");

let dbMod: DbMod;
let notesMod: NotesMod;
let syncMod: SyncMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "rm-tombstone-"));
  process.env.ANTHROPIC_API_KEY = "test-key";
  dbMod = await import("@/lib/db");
  notesMod = await import("@/lib/notes");
  syncMod = await import("@/lib/remarkableSync");
  dbMod.db();
});

beforeEach(() => {
  const d = dbMod.db();
  d.prepare(`DELETE FROM notebooks`).run();
  d.prepare(`DELETE FROM remarkable_ingest_tombstones`).run();
  d.prepare(`DELETE FROM dropbox_ingest_tombstones`).run();
});

function insertNotebook(id: string, remarkableDocId: string | null) {
  dbMod
    .db()
    .prepare(
      `INSERT INTO notebooks(id, name, synced_at, status, remarkable_doc_id)
       VALUES(?, ?, '2026-07-09 00:00:00', 'done', ?)`
    )
    .run(id, id, remarkableDocId);
}

describe("deleteNotebook tombstones reMarkable-synced notebooks", () => {
  it("records a tombstone the sweep's skip-set picks up", () => {
    insertNotebook("nb-rm", "doc-uuid-1");
    expect(syncMod.remarkableTombstonedDocIds().has("doc-uuid-1")).toBe(false);

    notesMod.deleteNotebook("nb-rm");

    expect(syncMod.remarkableTombstonedDocIds().has("doc-uuid-1")).toBe(true);
  });

  it("does not tombstone a notebook without a remarkable_doc_id", () => {
    insertNotebook("nb-manual", null);
    notesMod.deleteNotebook("nb-manual");
    expect(syncMod.remarkableTombstonedDocIds().size).toBe(0);
  });

  it("tombstones BOTH channels for a notebook carrying both markers", () => {
    dbMod
      .db()
      .prepare(
        `INSERT INTO notebooks(id, name, synced_at, status, dropbox_file_id, remarkable_doc_id)
         VALUES('nb-both','nb-both','2026-07-09 00:00:00','done','id:dbx','doc-both')`
      )
      .run();
    notesMod.deleteNotebook("nb-both");
    expect(syncMod.remarkableTombstonedDocIds().has("doc-both")).toBe(true);
    const dbx = dbMod
      .db()
      .prepare(`SELECT COUNT(*) c FROM dropbox_ingest_tombstones WHERE file_id='id:dbx'`)
      .get() as { c: number };
    expect(dbx.c).toBe(1);
  });

  it("is idempotent across repeated delete/re-create cycles", () => {
    insertNotebook("nb-rm", "doc-dup");
    notesMod.deleteNotebook("nb-rm");
    insertNotebook("nb-rm-2", "doc-dup");
    notesMod.deleteNotebook("nb-rm-2");
    const count = dbMod
      .db()
      .prepare(`SELECT COUNT(*) c FROM remarkable_ingest_tombstones WHERE doc_id='doc-dup'`)
      .get() as { c: number };
    expect(count.c).toBe(1);
  });
});
