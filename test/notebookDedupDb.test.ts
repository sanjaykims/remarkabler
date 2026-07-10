import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// DB-backed integration test for findDuplicateCandidates (lib/notebookDedupDb).
// Mirrors test/diaryExportDb.test.ts's throwaway-SQLite setup.

type DbMod = typeof import("@/lib/db");
type DedupMod = typeof import("@/lib/notebookDedupDb");
type NotesMod = typeof import("@/lib/notes");

let dbMod: DbMod;
let dedupMod: DedupMod;
let notesMod: NotesMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "notebook-dedup-"));
  delete process.env.VOYAGE_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";
  dbMod = await import("@/lib/db");
  dedupMod = await import("@/lib/notebookDedupDb");
  notesMod = await import("@/lib/notes");
  dbMod.db();
});

beforeEach(() => {
  const d = dbMod.db();
  d.prepare(`DELETE FROM pages`).run();
  d.prepare(`DELETE FROM notebooks`).run();
});

function addNotebook(
  id: string,
  name: string,
  opts: { dropboxFileId?: string; remarkableDocId?: string; status?: string } = {}
) {
  dbMod
    .db()
    .prepare(
      `INSERT INTO notebooks(id, name, synced_at, status, dropbox_file_id, remarkable_doc_id)
       VALUES(?,?,?,?,?,?)`
    )
    .run(
      id,
      name,
      "2026-06-19 00:00:00",
      opts.status ?? "done",
      opts.dropboxFileId ?? null,
      opts.remarkableDocId ?? null
    );
}

function addPage(
  notebookId: string,
  pageIndex: number,
  text: string | null,
  entryDate: string | null
) {
  dbMod
    .db()
    .prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text, entry_date)
       VALUES(?,?,?,?,?)`
    )
    .run(`${notebookId}:${pageIndex}`, notebookId, pageIndex, text, entryDate);
}

describe("findDuplicateCandidates", () => {
  it("excludes the github-discipline notebook from both sides", () => {
    addNotebook("cloud1", "Cloud Diary", { remarkableDocId: "doc1" });
    addPage("cloud1", 0, "cloud entry", "2026-06-19");
    addNotebook(notesMod.DISCIPLINE_ID, "Discipline");
    addPage(notesMod.DISCIPLINE_ID, 0, "repo notes", "2026-06-19");

    const candidates = dedupMod.findDuplicateCandidates();
    expect(candidates).toEqual([]);
  });

  it("sets hasUndated when a transcribed page precedes the first dated page", () => {
    addNotebook("old1", "Old Diary", { dropboxFileId: "f1" });
    addPage("old1", 0, "undated musings", "none"); // before any dated header
    addPage("old1", 1, "dated entry", "2026-06-19");
    addNotebook("cloud1", "Cloud Diary", { remarkableDocId: "doc1" });
    addPage("cloud1", 0, "cloud entry", "2026-06-19");

    const candidates = dedupMod.findDuplicateCandidates();
    expect(candidates).toHaveLength(1);
    // All DATED content is covered, but the leading undated page's content
    // is not verifiable — the flag must reach the UI so delete can warn.
    expect(candidates[0].classification).toBe("full");
    expect(candidates[0].hasUndated).toBe(true);
  });

  it("ignores blank/NULL ocr_text pages on either side", () => {
    addNotebook("old1", "Old Diary", { dropboxFileId: "f1" });
    addPage("old1", 0, "real old entry", "2026-06-19");
    addPage("old1", 1, null, "2026-06-20"); // blank, must not count
    addNotebook("cloud1", "Cloud Diary", { remarkableDocId: "doc1" });
    addPage("cloud1", 0, "real cloud entry", "2026-06-19");
    addPage("cloud1", 1, "", "2026-06-20"); // empty string, must not count

    const candidates = dedupMod.findDuplicateCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].dates).toEqual(["2026-06-19"]);
    expect(candidates[0].classification).toBe("full");
  });

  it("flags a Dropbox-tagged old notebook fully covered by a cloud notebook", () => {
    addNotebook("old1", "Old Diary", { dropboxFileId: "f1" });
    addPage("old1", 0, "june entry", "2026-06-19");
    addNotebook("cloud1", "Cloud Diary", { remarkableDocId: "doc1" });
    addPage("cloud1", 0, "same day, cloud", "2026-06-19");

    const candidates = dedupMod.findDuplicateCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe("old1");
    expect(candidates[0].classification).toBe("full");
    expect(candidates[0].coveringNotebooks).toEqual([
      { id: "cloud1", name: "Cloud Diary" },
    ]);
  });

  it("flags a manually-uploaded old notebook (no dropbox_file_id, no remarkable_doc_id)", () => {
    addNotebook("old1", "Manual Upload");
    addPage("old1", 0, "manual entry", "2026-06-19");
    addNotebook("cloud1", "Cloud Diary", { remarkableDocId: "doc1" });
    addPage("cloud1", 0, "same day, cloud", "2026-06-19");

    const candidates = dedupMod.findDuplicateCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe("old1");
    expect(candidates[0].classification).toBe("full");
  });

  it("classifies partial overlap with the correct uncoveredDates", () => {
    addNotebook("old1", "Old Diary", { dropboxFileId: "f1" });
    addPage("old1", 0, "day 19", "2026-06-19");
    addPage("old1", 1, "day 20", "2026-06-20");
    addPage("old1", 2, "day 21", "2026-06-21");
    addNotebook("cloud1", "Cloud Diary", { remarkableDocId: "doc1" });
    addPage("cloud1", 0, "day 19 cloud", "2026-06-19");
    addPage("cloud1", 1, "day 20 cloud", "2026-06-20");

    const candidates = dedupMod.findDuplicateCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].classification).toBe("partial");
    expect(candidates[0].uncoveredDates).toEqual(["2026-06-21"]);
  });

  it("omits an old notebook entirely when there is zero overlap", () => {
    addNotebook("old1", "Old Diary", { dropboxFileId: "f1" });
    addPage("old1", 0, "day 19", "2026-06-19");
    addNotebook("cloud1", "Cloud Diary", { remarkableDocId: "doc1" });
    addPage("cloud1", 0, "unrelated day", "2026-07-01");

    const candidates = dedupMod.findDuplicateCandidates();
    expect(candidates).toEqual([]);
  });

  it("classifies as full when the union of two cloud notebooks covers the old notebook", () => {
    addNotebook("old1", "Old Diary", { dropboxFileId: "f1" });
    addPage("old1", 0, "day 19", "2026-06-19");
    addPage("old1", 1, "day 20", "2026-06-20");
    addNotebook("cloud1", "Cloud A", { remarkableDocId: "docA" });
    addPage("cloud1", 0, "day 19 cloud", "2026-06-19");
    addNotebook("cloud2", "Cloud B", { remarkableDocId: "docB" });
    addPage("cloud2", 0, "day 20 cloud", "2026-06-20");

    const candidates = dedupMod.findDuplicateCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].classification).toBe("full");
    expect(candidates[0].coveringNotebooks.map((n) => n.id).sort()).toEqual([
      "cloud1",
      "cloud2",
    ]);
  });

  it("still counts a cloud notebook's already-synced pages while it's mid-resync (status='processing')", () => {
    addNotebook("old1", "Old Diary", { dropboxFileId: "f1" });
    addPage("old1", 0, "day 19", "2026-06-19");
    addNotebook("cloud1", "Cloud Diary", {
      remarkableDocId: "doc1",
      status: "processing",
    });
    addPage("cloud1", 0, "day 19 cloud, already synced", "2026-06-19");

    const candidates = dedupMod.findDuplicateCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].classification).toBe("full");
  });

  it("compares on the carried-forward date, not the literal 'none' sentinel", () => {
    addNotebook("old1", "Old Diary", { dropboxFileId: "f1" });
    addPage("old1", 0, "start", "2026-06-19");
    addPage("old1", 1, "continuation", "none"); // carries forward to 06-19
    addNotebook("cloud1", "Cloud Diary", { remarkableDocId: "doc1" });
    addPage("cloud1", 0, "day 19 cloud", "2026-06-19");

    const candidates = dedupMod.findDuplicateCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].dates).toEqual(["2026-06-19"]);
    expect(candidates[0].classification).toBe("full");
  });

  it("does not throw for a notebook with zero transcribed pages", () => {
    addNotebook("old1", "Failed Upload", {
      dropboxFileId: "f1",
      status: "error",
    });
    addPage("old1", 0, null, null);
    addNotebook("cloud1", "Cloud Diary", { remarkableDocId: "doc1" });
    addPage("cloud1", 0, "day 19 cloud", "2026-06-19");

    expect(() => dedupMod.findDuplicateCandidates()).not.toThrow();
    expect(dedupMod.findDuplicateCandidates()).toEqual([]);
  });
});
