import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

type Db = typeof import("@/lib/db");
type Store = typeof import("@/lib/ocrFlagStore");
type Review = typeof import("@/lib/ocrReview");
let dbMod: Db;
let store: Store;
let review: Review;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "ocr-review-"));
  process.env.ANTHROPIC_API_KEY = "test-key";
  dbMod = await import("@/lib/db");
  store = await import("@/lib/ocrFlagStore");
  review = await import("@/lib/ocrReview");
  dbMod.db();
});

beforeEach(() => {
  const d = dbMod.db();
  d.prepare(`DELETE FROM ocr_flags`).run();
  d.prepare(`DELETE FROM pages_fts`).run();
  d.prepare(`DELETE FROM daily_summaries`).run();
  d.prepare(`DELETE FROM pages`).run();
  d.prepare(`DELETE FROM notebooks`).run();
  d.prepare(
    `INSERT INTO notebooks(id, name, synced_at, status) VALUES('nb1','Diary','2026-11-17 00:00:00','done')`
  ).run();
});

const TEXT = "2026-11-16\nMet Elim today and Taylr came too.";
function seedPage(text = TEXT) {
  dbMod
    .db()
    .prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text, entry_date) VALUES('nb1:0','nb1',0,?,?)`
    )
    .run(text, "2026-11-16");
}
const save = (flags: Array<{ phrase: string; alternatives: string[]; reason: string }>) =>
  store.saveOcrFlags({ notebookId: "nb1", pageRowId: "nb1:0", pageIndex: 0, text: TEXT, flags });

describe("proofreading flags", () => {
  it("drops flags whose phrase isn't in the text and dedupes", () => {
    seedPage();
    expect(
      save([
        { phrase: "Elim", alternatives: ["Elin"], reason: "r" },
        { phrase: "Elim", alternatives: ["Ellen"], reason: "dup" },
        { phrase: "ghost", alternatives: ["x"], reason: "absent" },
      ])
    ).toBe(1);
    expect(review.pendingFlagCount()).toBe(1);
  });

  it("choosing an option edits the page and shifts later flags", () => {
    seedPage();
    save([
      { phrase: "Elim", alternatives: ["Elin"], reason: "" },
      { phrase: "Taylr", alternatives: ["Taylor", "Tyler"], reason: "" },
    ]);
    const cards = review.listReviewCards();
    expect(cards.map((c) => c.phrase)).toEqual(["Elim", "Taylr"]);
    expect(cards[0].context.match).toBe("Elim");

    // Lengthening fix on the FIRST flag must not break the second one.
    const r1 = review.resolveFlag(cards[0].id, { kind: "custom", text: "Elinore" });
    expect(r1).toMatchObject({ ok: true, changed: true });
    const r2 = review.resolveFlag(cards[1].id, { kind: "choose", index: 0 });
    expect(r2).toMatchObject({ ok: true, changed: true });

    const row = dbMod.db().prepare(`SELECT ocr_text FROM pages WHERE id='nb1:0'`).get() as {
      ocr_text: string;
    };
    expect(row.ocr_text).toBe("2026-11-16\nMet Elinore today and Taylor came too.");
    // Search index follows the correction.
    const hit = dbMod
      .db()
      .prepare(`SELECT page_id FROM pages_fts WHERE pages_fts MATCH 'Elinore'`)
      .all();
    expect(hit).toHaveLength(1);
    expect(review.pendingFlagCount()).toBe(0);
  });

  it("keep leaves the text alone; handled flags can't be re-applied", () => {
    seedPage();
    save([{ phrase: "Elim", alternatives: ["Elin"], reason: "" }]);
    const [c] = review.listReviewCards();
    expect(review.resolveFlag(c.id, { kind: "keep" })).toMatchObject({ ok: true, changed: false });
    const row = dbMod.db().prepare(`SELECT ocr_text FROM pages WHERE id='nb1:0'`).get() as {
      ocr_text: string;
    };
    expect(row.ocr_text).toBe(TEXT);
    expect(review.resolveFlag(c.id, { kind: "keep" })).toMatchObject({ ok: false, status: 409 });
  });

  it("validates input and goes stale if the page changed underneath", () => {
    seedPage();
    save([{ phrase: "Elim", alternatives: ["Elin"], reason: "" }]);
    const [c] = review.listReviewCards();
    expect(review.resolveFlag(c.id, { kind: "choose", index: 9 })).toMatchObject({ ok: false, status: 400 });
    expect(review.resolveFlag(c.id, { kind: "custom", text: "   " })).toMatchObject({ ok: false, status: 400 });
    expect(review.resolveFlag(c.id, { kind: "custom", text: "x".repeat(500) })).toMatchObject({ ok: false, status: 400 });
    expect(review.resolveFlag("missing", { kind: "keep" })).toMatchObject({ ok: false, status: 404 });

    // The owner rewrote the page by hand: the question no longer applies.
    dbMod.db().prepare(`UPDATE pages SET ocr_text = 'totally different' WHERE id='nb1:0'`).run();
    expect(review.listReviewCards()).toHaveLength(0);
    const st = dbMod.db().prepare(`SELECT status FROM ocr_flags WHERE id = ?`).get(c.id) as { status: string };
    expect(st.status).toBe("stale");
  });

  it("re-transcription supersedes pending flags, and deleting the notebook cascades", () => {
    seedPage();
    save([{ phrase: "Elim", alternatives: ["Elin"], reason: "" }]);
    save([{ phrase: "Taylr", alternatives: ["Taylor"], reason: "" }]);
    expect(review.listReviewCards().map((c) => c.phrase)).toEqual(["Taylr"]);
    dbMod.db().prepare(`DELETE FROM notebooks WHERE id='nb1'`).run();
    expect(review.pendingFlagCount()).toBe(0);
  });
});
