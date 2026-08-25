import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Boot-time recovery of notebooks stuck at status='processing'.
//
// Two different jobs use that status, and misclassifying between them destroys
// diary data:
//
//   - Whole-PDF OCR rebuilds every page from the notebook's PDF. Idempotent,
//     so an interrupted one is safe to re-queue.
//   - Incremental reMarkable sync maintains PER-TABLET-PAGE rows carrying
//     remarkable_page_id / remarkable_page_hash / blank_ocr_hash. Whole-PDF
//     OCR does `DELETE FROM pages` and replaces them from the last-rendered
//     PDF. For pages the user has since deleted on the tablet, those rows are
//     the ONLY surviving copy — CLAUDE.md's append-only invariant — so the
//     delete is unrecoverable, and `foreign_keys` being ON cascades it into
//     entry_analysis and entry_entities too.
//
// The original discriminator was "does a notebook.pdf exist on disk". That is
// not a discriminator at all: lib/remarkableSync.ts writes notebook.pdf after
// every content change so the notebook stays viewable, so a synced notebook
// has one permanently. Every interrupted sync was therefore resumed as a
// whole-PDF job and had its pages wiped — and the trigger is ordinary
// operation, since Railway restarts on every push to main.

type DbMod = typeof import("@/lib/db");
let dbMod: DbMod;
let DATA_DIR: string;

beforeAll(async () => {
  DATA_DIR = mkdtempSync(path.join(tmpdir(), "interrupted-recovery-"));
  process.env.DATA_DIR = DATA_DIR;
  dbMod = await import("@/lib/db");
  dbMod.db(); // build the schema
});

beforeEach(() => {
  dbMod.db().exec(`DELETE FROM pages; DELETE FROM notebooks;`);
});

function addNotebook(id: string, remarkableDocId: string | null): void {
  dbMod
    .db()
    .prepare(
      `INSERT INTO notebooks(id, name, synced_at, status, remarkable_doc_id)
       VALUES(?,?,datetime('now'),'processing',?)`
    )
    .run(id, `Notebook ${id}`, remarkableDocId);
}

/** A per-tablet-page row, as incremental sync maintains them. */
function addSyncedPage(notebookId: string, index: number, pageUuid: string) {
  dbMod
    .db()
    .prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text,
                         remarkable_page_id, remarkable_page_hash)
       VALUES(?,?,?,?,?,?)`
    )
    .run(
      `${notebookId}:${index}`,
      notebookId,
      index,
      `page ${index} text`,
      pageUuid,
      `hash-${index}`
    );
}

/** A whole-PDF page row: no tablet identity. */
function addPlainPage(notebookId: string, index: number) {
  dbMod
    .db()
    .prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text)
       VALUES(?,?,?,?)`
    )
    .run(`${notebookId}:${index}`, notebookId, index, `page ${index} text`);
}

/** Give the notebook the durable PDF that sync also leaves behind. */
function writePdf(notebookId: string): void {
  const dir = path.join(DATA_DIR, "files", notebookId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "notebook.pdf"), "%PDF-1.4 fake");
}

function statusOf(id: string): string {
  return (
    dbMod.db().prepare(`SELECT status FROM notebooks WHERE id = ?`).get(id) as {
      status: string;
    }
  ).status;
}

function pageCount(id: string): number {
  return (
    dbMod
      .db()
      .prepare(`SELECT COUNT(*) AS c FROM pages WHERE notebook_id = ?`)
      .get(id) as { c: number }
  ).c;
}

describe("interrupted notebook recovery", () => {
  it("does NOT re-queue an interrupted reMarkable sync that holds per-page rows", () => {
    // The exact production shape: a synced notebook, interrupted mid-sync,
    // WITH the notebook.pdf that sync itself wrote.
    addNotebook("nb-sync", "remarkable-doc-1");
    addSyncedPage("nb-sync", 0, "page-uuid-a");
    addSyncedPage("nb-sync", 1, "page-uuid-b");
    writePdf("nb-sync");

    dbMod.recoverInterruptedNotebooks(dbMod.db(), DATA_DIR);

    // Re-queueing it would hand it to whole-PDF OCR, whose first act is
    // DELETE FROM pages — destroying both rows, including any page the user
    // has since deleted on the tablet.
    expect(statusOf("nb-sync")).not.toBe("queued");
    expect(statusOf("nb-sync")).toBe("error");
    expect(pageCount("nb-sync")).toBe(2);
  });

  it("DOES re-queue an interrupted whole-PDF job with a durable PDF", () => {
    // Manual upload / Dropbox ingest crashed before its transaction committed,
    // so it has no pages. Re-running OCR is idempotent and is the whole point
    // of the durable queue.
    addNotebook("nb-pdf", null);
    writePdf("nb-pdf");

    dbMod.recoverInterruptedNotebooks(dbMod.db(), DATA_DIR);

    expect(statusOf("nb-pdf")).toBe("queued");
  });

  it("re-queues a whole-PDF re-process that still holds its previous pages", () => {
    // A re-import replacing existing content: pages exist but carry no tablet
    // identity, so rebuilding them from the same PDF loses nothing.
    addNotebook("nb-reimport", null);
    addPlainPage("nb-reimport", 0);
    writePdf("nb-reimport");

    dbMod.recoverInterruptedNotebooks(dbMod.db(), DATA_DIR);

    expect(statusOf("nb-reimport")).toBe("queued");
  });

  it("fails a notebook with no durable PDF to recover from", () => {
    addNotebook("nb-nopdf", "remarkable-doc-2");

    dbMod.recoverInterruptedNotebooks(dbMod.db(), DATA_DIR);

    expect(statusOf("nb-nopdf")).toBe("error");
  });

  it("leaves notebooks that were not processing alone", () => {
    addNotebook("nb-done", null);
    dbMod
      .db()
      .prepare(`UPDATE notebooks SET status='done' WHERE id = ?`)
      .run("nb-done");
    writePdf("nb-done");

    dbMod.recoverInterruptedNotebooks(dbMod.db(), DATA_DIR);

    expect(statusOf("nb-done")).toBe("done");
  });

  it("reports what it did", () => {
    addNotebook("nb-a", null);
    writePdf("nb-a");
    addNotebook("nb-b", "doc-b");
    addSyncedPage("nb-b", 0, "page-uuid-c");
    writePdf("nb-b");

    const result = dbMod.recoverInterruptedNotebooks(dbMod.db(), DATA_DIR);

    expect(result).toEqual({ resumed: 1, failed: 1 });
  });
});
