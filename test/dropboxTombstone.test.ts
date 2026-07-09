import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Deleting a Dropbox-ingested notebook must tombstone its source file id so
// the watcher doesn't re-ingest the same PDF on the next poll (a deleted
// Dropbox notebook kept reappearing because the DELETE dropped its
// dropbox_file_id dedup marker).

type DbMod = typeof import("@/lib/db");
type NotesMod = typeof import("@/lib/notes");
type DropboxMod = typeof import("@/lib/dropbox");

let dbMod: DbMod;
let notesMod: NotesMod;
let dropboxMod: DropboxMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "dbx-tombstone-"));
  process.env.ANTHROPIC_API_KEY = "test-key";
  dbMod = await import("@/lib/db");
  notesMod = await import("@/lib/notes");
  dropboxMod = await import("@/lib/dropbox");
  dbMod.db();
});

beforeEach(() => {
  const d = dbMod.db();
  d.prepare(`DELETE FROM notebooks`).run();
  d.prepare(`DELETE FROM dropbox_ingest_tombstones`).run();
});

function insertNotebook(id: string, dropboxFileId: string | null) {
  dbMod
    .db()
    .prepare(
      `INSERT INTO notebooks(id, name, synced_at, status, dropbox_file_id)
       VALUES(?, ?, '2026-07-02 00:00:00', 'done', ?)`
    )
    .run(id, id, dropboxFileId);
}

describe("deleteNotebook tombstones Dropbox-ingested notebooks", () => {
  it("records a tombstone and skips the file on the next poll", () => {
    insertNotebook("nb-dbx", "id:abc123");
    expect(dropboxMod.ingestSkipFileIds().has("id:abc123")).toBe(true);

    notesMod.deleteNotebook("nb-dbx");

    // The notebook row is gone, but the tombstone remembers the file id...
    const row = dbMod
      .db()
      .prepare(`SELECT file_id, name FROM dropbox_ingest_tombstones WHERE file_id = 'id:abc123'`)
      .get() as { file_id: string; name: string } | undefined;
    expect(row?.file_id).toBe("id:abc123");

    // ...so the watcher still treats it as "seen" and won't re-ingest it.
    expect(dropboxMod.ingestSkipFileIds().has("id:abc123")).toBe(true);
  });

  it("does not tombstone a manually-uploaded notebook (no dropbox_file_id)", () => {
    insertNotebook("nb-manual", null);
    notesMod.deleteNotebook("nb-manual");
    const count = dbMod
      .db()
      .prepare(`SELECT COUNT(*) AS c FROM dropbox_ingest_tombstones`)
      .get() as { c: number };
    expect(count.c).toBe(0);
  });

  it("is idempotent across repeated deletes of the same file id", () => {
    insertNotebook("nb-dbx", "id:dup");
    notesMod.deleteNotebook("nb-dbx");
    // Re-ingest would create a fresh row; delete it again → still one tombstone.
    insertNotebook("nb-dbx-2", "id:dup");
    notesMod.deleteNotebook("nb-dbx-2");
    const count = dbMod
      .db()
      .prepare(`SELECT COUNT(*) AS c FROM dropbox_ingest_tombstones WHERE file_id = 'id:dup'`)
      .get() as { c: number };
    expect(count.c).toBe(1);
  });
});
