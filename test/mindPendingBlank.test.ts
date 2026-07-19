import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Regression test: a page whose ocr_text is whitespace-only (e.g. a nearly
// blank page) used to pass /mind's "pending" SQL filter (`ocr_text != ''`)
// but then always fail analyzeEntryContent's `.trim()` check (lib/claude.ts),
// which returns null for empty-after-trim text — before ever calling Claude.
// That page could never be analyzed no matter how many times "Analyse next
// N" was tapped: it stayed "pending" and "failed" forever. Fixed by making
// the SQL filter trim-aware too, so it agrees with what the analyzer
// actually considers analyzable.

type DbMod = typeof import("@/lib/db");
type MindMod = typeof import("@/lib/mind");

let dbMod: DbMod;
let mindMod: MindMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "mind-pending-blank-"));
  dbMod = await import("@/lib/db");
  mindMod = await import("@/lib/mind");
  dbMod.db();
});

beforeEach(() => {
  dbMod.db().prepare(`DELETE FROM entry_analysis`).run();
  dbMod.db().prepare(`DELETE FROM pages`).run();
  dbMod.db().prepare(`DELETE FROM notebooks`).run();
  dbMod
    .db()
    .prepare(
      `INSERT INTO notebooks(id, name, synced_at) VALUES('nb-1', 'Diary', '2026-06-01T00:00:00Z')`
    )
    .run();
});

function addPage(id: string, ocrText: string) {
  dbMod
    .db()
    .prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text) VALUES(?, 'nb-1', 0, ?)`
    )
    .run(id, ocrText);
}

describe("countPending excludes whitespace-only OCR text", () => {
  it("a whitespace-only page is never counted as pending", () => {
    addPage("p-blank", "   \n\t \n  ");
    expect(mindMod.countPending()).toBe(0);
  });

  it("a page with real trimmable content IS still counted as pending", () => {
    addPage("p-real", "  Went for a walk today.  ");
    expect(mindMod.countPending()).toBe(1);
  });

  it("a whitespace-only page never becomes analyzed and never blocks other pending pages", () => {
    addPage("p-blank", "\n\n  \n");
    addPage("p-real", "A real diary entry.");
    // Only the real page is pending; the blank one is excluded outright
    // rather than sitting there as permanently-failing pending work.
    expect(mindMod.countPending()).toBe(1);
  });
});
