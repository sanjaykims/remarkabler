import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// correctPageText mirrors the ingest/re-OCR derived state so a manual OCR fix
// propagates to search (pages_fts), semantic recall (embedding), analysis,
// dates, and day summaries — not just pages.ocr_text (review #124).

type DbMod = typeof import("@/lib/db");
type NotesMod = typeof import("@/lib/notes");

let dbMod: DbMod;
let notesMod: NotesMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "correct-page-"));
  process.env.ANTHROPIC_API_KEY = "test-key";
  dbMod = await import("@/lib/db");
  notesMod = await import("@/lib/notes");
  dbMod.db();
});

beforeEach(() => {
  const d = dbMod.db();
  d.prepare(`DELETE FROM pages_fts`).run();
  d.prepare(`DELETE FROM entry_analysis`).run();
  d.prepare(`DELETE FROM daily_summaries`).run();
  d.prepare(`DELETE FROM pages`).run();
  d.prepare(`DELETE FROM notebooks`).run();
});

function seed(text: string, entryDate: string) {
  const d = dbMod.db();
  d.prepare(
    `INSERT INTO notebooks(id, name, synced_at, status) VALUES('nb1','Diary','2026-07-07 00:00:00','done')`
  ).run();
  d.prepare(
    `INSERT INTO pages(id, notebook_id, page_index, ocr_text, entry_date, embedding)
     VALUES('nb1:0','nb1',0,?,?,?)`
  ).run(text, entryDate, Buffer.from([1, 2, 3, 4]));
  d.prepare(
    `INSERT INTO pages_fts(ocr_text, notebook_name, page_id, notebook_id)
     VALUES(?,'Diary','nb1:0','nb1')`
  ).run(text);
  d.prepare(
    `INSERT INTO entry_analysis(page_id, themes, sentiment, summary)
     VALUES('nb1:0','["x"]',0,'old summary')`
  ).run();
}

function ftsFinds(word: string): boolean {
  const rows = dbMod
    .db()
    .prepare(`SELECT page_id FROM pages_fts WHERE pages_fts MATCH ?`)
    .all(word) as Array<{ page_id: string }>;
  return rows.length > 0;
}

describe("correctPageText", () => {
  it("refreshes FTS, embedding, and analysis on a word fix (no header change)", () => {
    seed("스크린 골프를 절충하게 거절한다", "2026-07-07");
    dbMod
      .db()
      .prepare(`INSERT INTO daily_summaries(date, summary) VALUES('2026-07-07','stale')`)
      .run();

    const ok = notesMod.correctPageText(
      "nb1",
      "nb1:0",
      "스크린 골프를 정중하게 거절한다"
    );
    expect(ok).toBe(true);

    const page = dbMod
      .db()
      .prepare(`SELECT ocr_text, entry_date, embedding FROM pages WHERE id='nb1:0'`)
      .get() as { ocr_text: string; entry_date: string; embedding: unknown };
    expect(page.ocr_text).toContain("정중하게");
    expect(page.embedding).toBeNull(); // cleared → re-embed
    expect(page.entry_date).toBe("2026-07-07"); // preserved (no header)

    expect(ftsFinds("정중하게")).toBe(true); // new word searchable
    expect(ftsFinds("절충하게")).toBe(false); // old word gone

    // analysis dropped (→ re-derive) and the day's cached summary invalidated
    expect(
      dbMod.db().prepare(`SELECT COUNT(*) c FROM entry_analysis`).get()
    ).toMatchObject({ c: 0 });
    expect(
      dbMod.db().prepare(`SELECT COUNT(*) c FROM daily_summaries`).get()
    ).toMatchObject({ c: 0 });
  });

  it("reparses entry_date when the corrected text has a header", () => {
    seed("2026-07-07-08-02-KST\n일기", "none");
    const ok = notesMod.correctPageText(
      "nb1",
      "nb1:0",
      "2026-07-08-09-00-KST\n일기 고침"
    );
    expect(ok).toBe(true);
    const page = dbMod
      .db()
      .prepare(`SELECT entry_date FROM pages WHERE id='nb1:0'`)
      .get() as { entry_date: string };
    expect(page.entry_date).toBe("2026-07-08"); // header reparsed
  });

  it("does not clobber a carried-forward date when the fix has no header", () => {
    seed("continuation text", "2026-07-07"); // carried-forward, no header
    notesMod.correctPageText("nb1", "nb1:0", "continuation text, fixed");
    const page = dbMod
      .db()
      .prepare(`SELECT entry_date FROM pages WHERE id='nb1:0'`)
      .get() as { entry_date: string };
    expect(page.entry_date).toBe("2026-07-07"); // preserved
  });

  it("returns false when the page isn't in that notebook", () => {
    seed("text", "2026-07-07");
    expect(notesMod.correctPageText("nbX", "nb1:0", "hi")).toBe(false);
    expect(notesMod.correctPageText("nb1", "nb1:999", "hi")).toBe(false);
  });
});
