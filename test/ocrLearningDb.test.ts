import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

type Db = typeof import("@/lib/db");
type L = typeof import("@/lib/ocrLearning");
type Store = typeof import("@/lib/ocrFlagStore");
type Review = typeof import("@/lib/ocrReview");
let dbMod: Db;
let L: L;
let store: Store;
let review: Review;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "ocr-learn-"));
  process.env.ANTHROPIC_API_KEY = "test-key";
  dbMod = await import("@/lib/db");
  L = await import("@/lib/ocrLearning");
  store = await import("@/lib/ocrFlagStore");
  review = await import("@/lib/ocrReview");
  dbMod.db();
});

beforeEach(() => {
  const d = dbMod.db();
  for (const t of ["ocr_learned", "ocr_flags", "pages_fts", "entry_entities", "daily_summaries", "pages", "notebooks"]) {
    d.prepare(`DELETE FROM ${t}`).run();
  }
});

describe("learned cases", () => {
  it("counts repeats and tells confirmed from corrected", () => {
    L.recordLearned({ wrong: "Elim", right: "Elin", source: "review" });
    L.recordLearned({ wrong: "Elim", right: "Elin", source: "manual_edit" });
    L.recordLearned({ wrong: "reMarkablER", right: "reMarkablER", source: "review" });
    const rows = dbMod.db().prepare(`SELECT wrong, right, kind, count FROM ocr_learned ORDER BY wrong`).all();
    expect(rows).toEqual([
      { wrong: "Elim", right: "Elin", kind: "corrected", count: 2 },
      { wrong: "reMarkablER", right: "reMarkablER", kind: "confirmed", count: 1 },
    ]);
    expect(L.isConfirmedTerm("reMarkablER")).toBe(true);
    expect(L.isConfirmedTerm("Elim")).toBe(false);
  });

  it("a confirmed spelling stops counting once it is corrected at least as often", () => {
    L.recordLearned({ wrong: "Taylr", right: "Taylr", source: "review" });
    expect(L.isConfirmedTerm("Taylr")).toBe(true);
    L.recordLearned({ wrong: "Taylr", right: "Taylor", source: "review" });
    expect(L.isConfirmedTerm("Taylr")).toBe(false);
  });

  it("rejects empty or oversized input", () => {
    L.recordLearned({ wrong: "", right: "x", source: "review" });
    L.recordLearned({ wrong: "x".repeat(500), right: "y", source: "review" });
    expect(dbMod.db().prepare(`SELECT COUNT(*) AS n FROM ocr_learned`).get()).toEqual({ n: 0 });
  });

  it("learnFromEdit records small word fixes only", () => {
    expect(L.learnFromEdit("hi Elim there", "hi Elin there")).toBe(1);
    expect(L.learnFromEdit("a b c", "a b c d")).toBe(0);
  });
});

describe("hints and candidate ranking", () => {
  it("formats vocabulary, corrections and names; stays empty when there is nothing", () => {
    expect(L.formatHints({ terms: [], pairs: [], names: [] })).toBe("");
    const h = L.formatHints({
      terms: ["reMarkablER"],
      pairs: [{ wrong: "Elim", right: "Elin" }],
      names: ["Taylor", "remarkabler"],
    });
    expect(h).toContain("do NOT flag these: reMarkablER");
    expect(h).toContain('"Elim" -> "Elin"');
    expect(h).toContain("Taylor");
    // a name already in confirmed vocabulary isn't repeated
    expect(h.match(/remarkabler/gi)).toHaveLength(1);
  });

  it("trims to the size cap", () => {
    const names = Array.from({ length: 200 }, (_, i) => `Name${i}-xxxxxxxxxxxx`);
    expect(L.formatHints({ terms: [], pairs: [], names, cap: 400 }).length).toBeLessThanOrEqual(400);
  });

  it("buildOcrHints reads the database (learned terms + frequent diary names, not discipline)", () => {
    const d = dbMod.db();
    d.prepare(`INSERT INTO notebooks(id,name,synced_at,status) VALUES('nb1','Diary','2026-11-17 00:00:00','done')`).run();
    d.prepare(`INSERT INTO notebooks(id,name,synced_at,status) VALUES('github-discipline','D','2026-11-17 00:00:00','done')`).run();
    d.prepare(`INSERT INTO pages(id,notebook_id,page_index,ocr_text) VALUES('nb1:0','nb1',0,'x')`).run();
    d.prepare(`INSERT INTO pages(id,notebook_id,page_index,ocr_text) VALUES('github-discipline:0','github-discipline',0,'x')`).run();
    d.prepare(`INSERT INTO entry_entities(page_id,kind,name,name_norm) VALUES('nb1:0','person','Taylor','taylor')`).run();
    d.prepare(`INSERT INTO entry_entities(page_id,kind,name,name_norm) VALUES('github-discipline:0','person','SecretGym','secretgym')`).run();
    L.recordLearned({ wrong: "reMarkablER", right: "reMarkablER", source: "review" });
    const h = L.buildOcrHints();
    expect(h).toContain("reMarkablER");
    expect(h).toContain("Taylor");
    expect(h).not.toContain("SecretGym");
  });

  it("ranks learned fixes before Claude's alternatives, deduped and capped at 3", () => {
    L.recordLearned({ wrong: "Elim", right: "Elin", source: "review" });
    expect(L.rankCandidates("Elim", ["Ellen", "Elin", "Eli", "Elan"])).toEqual(["Elin", "Ellen", "Eli"]);
    expect(L.rankCandidates("unseen", ["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("the loop end to end", () => {
  it("card answers teach, later flags use it, stats reflect it", () => {
    const d = dbMod.db();
    d.prepare(`INSERT INTO notebooks(id,name,synced_at,status) VALUES('nb1','Diary','2026-11-17 00:00:00','done')`).run();
    const text = "Met Elim today. Then reMarkablER crashed.";
    d.prepare(`INSERT INTO pages(id,notebook_id,page_index,ocr_text,entry_date) VALUES('nb1:0','nb1',0,?,?)`).run(text, "2026-11-17");
    store.saveOcrFlags({
      notebookId: "nb1", pageRowId: "nb1:0", pageIndex: 0, text,
      flags: [
        { phrase: "Elim", alternatives: ["Ellen"], reason: "" },
        { phrase: "reMarkablER", alternatives: ["reMarkableR"], reason: "" },
      ],
    });
    const cards = review.listReviewCards();
    review.resolveFlag(cards[0].id, { kind: "custom", text: "Elin" });
    review.resolveFlag(cards[1].id, { kind: "keep" });

    expect(L.isConfirmedTerm("reMarkablER")).toBe(true);
    // The next time "Elim" is flagged, the learned fix leads.
    expect(L.rankCandidates("Elim", ["Ellen"])[0]).toBe("Elin");

    const s = L.proofreadingStats();
    expect(s.totals).toMatchObject({ flagged: 2, corrected: 1, kept: 1, pending: 0 });
    expect(s.learnedTerms).toBe(1);
    expect(s.learnedFixes).toBe(1);
    expect(s.weeks[0]).toMatchObject({ flagged: 2, corrected: 1, kept: 1 });
  });
});
