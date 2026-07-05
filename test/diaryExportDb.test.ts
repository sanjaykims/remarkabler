import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// DB-backed integration test for renderDiaryMarkdown (lib/diaryExportDb).
// Pins the two behaviours the review flagged on PR #69 at the query level:
//   1. the github-discipline notebook is excluded from the diary export
//   2. entry-date carry-forward keeps multi-page sessions together
// plus entity/theme rendering through the real SQL path.

type DbMod = typeof import("@/lib/db");
type ExportMod = typeof import("@/lib/diaryExportDb");
type NotesMod = typeof import("@/lib/notes");

let dbMod: DbMod;
let exportMod: ExportMod;
let notesMod: NotesMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "diary-export-"));
  delete process.env.VOYAGE_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";
  dbMod = await import("@/lib/db");
  exportMod = await import("@/lib/diaryExportDb");
  notesMod = await import("@/lib/notes");
  dbMod.db();
});

beforeEach(() => {
  const d = dbMod.db();
  d.prepare(`DELETE FROM entry_entities`).run();
  d.prepare(`DELETE FROM entry_analysis`).run();
  d.prepare(`DELETE FROM entity_wiki`).run();
  d.prepare(`DELETE FROM pages`).run();
  d.prepare(`DELETE FROM notebooks`).run();
});

function addNotebook(id: string, name: string, syncedAt: string) {
  dbMod
    .db()
    .prepare(
      `INSERT INTO notebooks(id, name, synced_at, status) VALUES(?,?,?,'done')`
    )
    .run(id, name, syncedAt);
}

function addPage(
  notebookId: string,
  pageIndex: number,
  text: string,
  entryDate: string | null
) {
  const id = `${notebookId}:${pageIndex}`;
  dbMod
    .db()
    .prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text, entry_date)
       VALUES(?,?,?,?,?)`
    )
    .run(id, notebookId, pageIndex, text, entryDate);
  return id;
}

describe("renderDiaryMarkdown", () => {
  it("excludes the github-discipline notebook", () => {
    addNotebook("nb1", "Diary 2026", "2026-06-19 00:00:00");
    addPage("nb1", 0, "real diary entry", "2026-06-19");
    addNotebook(notesMod.DISCIPLINE_ID, "Discipline", "2026-06-20 00:00:00");
    addPage(notesMod.DISCIPLINE_ID, 0, "SECRET REPO CODE FILE", null);

    const md = exportMod.renderDiaryMarkdown();
    expect(md).toContain("real diary entry");
    expect(md).not.toContain("SECRET REPO CODE FILE");
    expect(md).not.toContain("Discipline");
    // Only the one real diary page counts.
    expect(md).toContain("pages: 1");
  });

  it("carries the entry date forward across continuation pages", () => {
    addNotebook("nb1", "Diary 2026", "2026-06-19 00:00:00");
    addPage("nb1", 0, "morning session start", "2026-06-19");
    addPage("nb1", 1, "still the same day", "none");
    addPage("nb1", 2, "also same day", null);

    const md = exportMod.renderDiaryMarkdown();
    // One day header, all three pages under it, nothing in Undated.
    expect(md.match(/^## 2026-06-19$/gm)?.length).toBe(1);
    expect(md).toContain("still the same day");
    expect(md).toContain("also same day");
    expect(md).not.toContain("## Undated entries");
  });

  it("renders themes, sentiment, and entities from the analysis tables", () => {
    addNotebook("nb1", "Diary 2026", "2026-06-19 00:00:00");
    const pageId = addPage("nb1", 0, "entry text", "2026-06-19");
    dbMod
      .db()
      .prepare(
        `INSERT INTO entry_analysis(page_id, themes, sentiment, summary)
         VALUES(?,?,?,?)`
      )
      .run(pageId, '["sleep","work"]', -0.2, "a summary");
    const addEntity = dbMod
      .db()
      .prepare(
        `INSERT INTO entry_entities(page_id, kind, name, name_norm) VALUES(?,?,?,?)`
      );
    addEntity.run(pageId, "person", "Jin", "jin");
    addEntity.run(pageId, "place", "Seoul", "seoul");

    const md = exportMod.renderDiaryMarkdown();
    expect(md).toContain("themes: sleep, work");
    expect(md).toContain("sentiment: -0.20");
    expect(md).toContain("people: [[Jin]]");
    expect(md).toContain("places: [[Seoul]]");
  });

  it("never resolves a canonical name from the excluded discipline notebook's entities", () => {
    addNotebook("nb1", "Diary 2026", "2026-06-19 00:00:00");
    const diaryPage = addPage("nb1", 0, "real diary entry", "2026-06-19");
    addNotebook(notesMod.DISCIPLINE_ID, "Discipline", "2026-06-20 00:00:00");
    const disciplinePage = addPage(notesMod.DISCIPLINE_ID, 0, "repo notes", null);
    const addEntity = dbMod
      .db()
      .prepare(
        `INSERT INTO entry_entities(page_id, kind, name, name_norm) VALUES(?,?,?,?)`
      );
    // Same name_norm, but the discipline notebook's spelling would win
    // MIN(name) if the canonical-name query weren't scoped to exported
    // (non-discipline) pages — "AAA" < "Kim" lexicographically.
    addEntity.run(diaryPage, "person", "Kim", "kim");
    addEntity.run(disciplinePage, "person", "AAA", "kim");

    const md = exportMod.renderDiaryMarkdown();
    expect(md).toContain("[[Kim]]");
    expect(md).not.toContain("[[AAA]]");
  });

  it("canonicalizes an entity's casing across pages so all mentions link to one wikilink target", () => {
    addNotebook("nb1", "Diary 2026", "2026-06-19 00:00:00");
    const pageA = addPage("nb1", 0, "entry one", "2026-06-19");
    const pageB = addPage("nb1", 1, "entry two", "2026-06-20");
    const addEntity = dbMod
      .db()
      .prepare(
        `INSERT INTO entry_entities(page_id, kind, name, name_norm) VALUES(?,?,?,?)`
      );
    // Same real person, different casing per page — same name_norm.
    addEntity.run(pageA, "person", "Kim", "kim");
    addEntity.run(pageB, "person", "kim", "kim");

    const md = exportMod.renderDiaryMarkdown();
    // MIN("Kim", "kim") = "Kim" (uppercase sorts first) — both pages must
    // render that SAME casing, or Obsidian's graph would split one person
    // into two nodes.
    expect(md.match(/people: \[\[Kim\]\]/g)?.length).toBe(2);
    expect(md).not.toContain("[[kim]]");
  });

  it("handles an empty diary without throwing", () => {
    const md = exportMod.renderDiaryMarkdown();
    expect(md).toContain("pages: 0");
    expect(md).toContain("_No transcribed diary pages yet._");
  });
});

describe("renderDiaryDayFiles", () => {
  it("produces one file per day and excludes the discipline notebook", () => {
    addNotebook("nb1", "Diary 2026", "2026-06-19 00:00:00");
    addPage("nb1", 0, "june 19 entry", "2026-06-19");
    addPage("nb1", 1, "still june 19", "none"); // carries forward
    addNotebook("nb2", "Diary 2026", "2026-06-20 00:00:00");
    addPage("nb2", 0, "june 20 entry", "2026-06-20");
    addNotebook(notesMod.DISCIPLINE_ID, "Discipline", "2026-06-21 00:00:00");
    addPage(notesMod.DISCIPLINE_ID, 0, "REPO FILE", null);

    const files = exportMod.renderDiaryDayFiles();
    expect([...files.keys()].sort()).toEqual([
      "2026-06-19.md",
      "2026-06-20.md",
    ]);
    expect(files.get("2026-06-19.md")).toContain("still june 19");
    // Discipline content never appears in any file.
    for (const md of files.values()) expect(md).not.toContain("REPO FILE");
  });
});

describe("affectedDayFileNames", () => {
  it("returns the day files a notebook's pages touch (with carry-forward)", () => {
    addNotebook("nb1", "Diary 2026", "2026-06-19 00:00:00");
    addPage("nb1", 0, "start", "2026-06-19");
    addPage("nb1", 1, "cont", "none"); // still 06-19
    addPage("nb1", 2, "next day", "2026-06-20");

    expect(exportMod.affectedDayFileNames("nb1").sort()).toEqual([
      "2026-06-19.md",
      "2026-06-20.md",
    ]);
  });

  it("includes undated.md when a notebook has pages before its first date", () => {
    addNotebook("nb1", "Diary 2026", "2026-06-19 00:00:00");
    addPage("nb1", 0, "floating", "none");
    addPage("nb1", 1, "dated", "2026-06-19");

    expect(exportMod.affectedDayFileNames("nb1").sort()).toEqual([
      "2026-06-19.md",
      "undated.md",
    ]);
  });

  it("returns [] for the discipline notebook", () => {
    addNotebook(notesMod.DISCIPLINE_ID, "Discipline", "2026-06-21 00:00:00");
    addPage(notesMod.DISCIPLINE_ID, 0, "repo", "none");
    expect(exportMod.affectedDayFileNames(notesMod.DISCIPLINE_ID)).toEqual([]);
  });
});

describe("renderEntityStubFiles", () => {
  function addEntity(pageId: string, kind: string, name: string, norm: string) {
    dbMod
      .db()
      .prepare(
        `INSERT INTO entry_entities(page_id, kind, name, name_norm) VALUES(?,?,?,?)`
      )
      .run(pageId, kind, name, norm);
  }

  it("writes one stub per entity listing the days it appears", () => {
    addNotebook("nb1", "Diary 2026", "2026-06-19 00:00:00");
    const p0 = addPage("nb1", 0, "day 19", "2026-06-19");
    const p1 = addPage("nb1", 1, "day 20", "2026-06-20");
    addEntity(p0, "person", "Jin", "jin");
    addEntity(p1, "person", "Jin", "jin");
    addEntity(p0, "place", "Seoul", "seoul");

    const files = exportMod.renderEntityStubFiles();
    expect([...files.keys()].sort()).toEqual(["People/Jin.md", "Places/Seoul.md"]);
    const jin = files.get("People/Jin.md") as string;
    expect(jin).toContain("- [[2026-06-19]]");
    expect(jin).toContain("- [[2026-06-20]]");
    const seoul = files.get("Places/Seoul.md") as string;
    expect(seoul).toContain("- [[2026-06-19]]");
    expect(seoul).not.toContain("2026-06-20");
  });

  it("excludes discipline-notebook entities", () => {
    addNotebook("nb1", "Diary 2026", "2026-06-19 00:00:00");
    const p0 = addPage("nb1", 0, "real", "2026-06-19");
    addEntity(p0, "person", "Jin", "jin");
    addNotebook(notesMod.DISCIPLINE_ID, "Discipline", "2026-06-20 00:00:00");
    const dp = addPage(notesMod.DISCIPLINE_ID, 0, "repo", "2026-06-20");
    addEntity(dp, "person", "Secret", "secret");

    const files = exportMod.renderEntityStubFiles();
    expect([...files.keys()]).toEqual(["People/Jin.md"]);
    expect(files.has("People/Secret.md")).toBe(false);
  });

  it("uses the canonical casing and the carried-forward date", () => {
    addNotebook("nb1", "Diary 2026", "2026-06-19 00:00:00");
    const p0 = addPage("nb1", 0, "start", "2026-06-19");
    const p1 = addPage("nb1", 1, "continuation", "none"); // carries to 06-19
    addEntity(p0, "person", "Kim", "kim");
    addEntity(p1, "person", "kim", "kim"); // lowercase on the continuation page

    const files = exportMod.renderEntityStubFiles();
    // MIN("Kim","kim") = "Kim" — one stub, one canonical casing.
    expect(files.has("People/Kim.md")).toBe(true);
    expect(files.has("People/kim.md")).toBe(false);
    const kim = files.get("People/Kim.md") as string;
    // The continuation page's mention carries forward to 06-19, not "none".
    expect(kim).toContain("- [[2026-06-19]]");
    expect(kim.match(/\[\[2026-06-19\]\]/g)?.length).toBe(1); // deduped to one day
    expect(kim).not.toContain("[[none]]");
  });

  it("links undated mentions to [[undated]]", () => {
    addNotebook("nb1", "Diary 2026", "2026-06-19 00:00:00");
    const p0 = addPage("nb1", 0, "floating", "none");
    addEntity(p0, "person", "Ghost", "ghost");

    const files = exportMod.renderEntityStubFiles();
    const ghost = files.get("People/Ghost.md") as string;
    expect(ghost).toContain("- [[undated]]");
  });

  it("embeds a stored life-wiki profile into the entity's stub", () => {
    addNotebook("nb1", "Diary 2026", "2026-06-19 00:00:00");
    const p0 = addPage("nb1", 0, "entry", "2026-06-19");
    addEntity(p0, "person", "Kim", "kim");
    // A profile was generated for this entity (keyed by kind + name_norm).
    dbMod
      .db()
      .prepare(
        `INSERT INTO entity_wiki(kind, name_norm, name, summary, source_hash)
         VALUES('person','kim','Kim','Kim is the author''s mentor.','h1')`
      )
      .run();

    const files = exportMod.renderEntityStubFiles();
    const kim = files.get("People/Kim.md") as string;
    expect(kim).toContain("Kim is the author's mentor.");
    expect(kim.indexOf("mentor")).toBeLessThan(kim.indexOf("## Mentions"));
  });

  it("computes the stub path for a merged-away name so it can be deleted (PR #108)", () => {
    // The path must match how the stub was written (People/<sanitized>.md),
    // including non-ASCII names, so the merge cleanup deletes the right file.
    expect(exportMod.entityStubRelPathForName("person", "야오팡")).toBe(
      "People/야오팡.md"
    );
    expect(exportMod.entityStubRelPathForName("place", "Suzhou W hotel")).toBe(
      "Places/Suzhou W hotel.md"
    );
    expect(exportMod.entityStubRelPathForName("person", "Dr/Kim")).toBe(
      "People/Dr Kim.md"
    );
  });

  it("keeps the day-file wikilink text and the stub basename aligned for a path-char name (PR #104)", () => {
    addNotebook("nb1", "Diary 2026", "2026-06-19 00:00:00");
    const p0 = addPage("nb1", 0, "entry", "2026-06-19");
    // A name with a slash + colon — both must normalize identically in the
    // day file's [[wikilink]] and the stub's filename, or Obsidian can't
    // resolve the link.
    addEntity(p0, "person", "Dr/Kim: MD", "dr/kim: md");

    const dayFiles = exportMod.renderDiaryDayFiles();
    const stubFiles = exportMod.renderEntityStubFiles();
    const day = dayFiles.get("2026-06-19.md") as string;
    // Wikilink text is the sanitized name...
    expect(day).toContain("[[Dr Kim MD]]");
    // ...and the stub's basename matches it exactly, so the link resolves.
    expect(stubFiles.has("People/Dr Kim MD.md")).toBe(true);
  });
});

describe("affectedEntityStubFileNames", () => {
  function addEntity(pageId: string, kind: string, name: string, norm: string) {
    dbMod
      .db()
      .prepare(
        `INSERT INTO entry_entities(page_id, kind, name, name_norm) VALUES(?,?,?,?)`
      )
      .run(pageId, kind, name, norm);
  }

  it("returns the stub files a notebook's entities touch (canonical, deduped)", () => {
    addNotebook("nb1", "Diary 2026", "2026-06-19 00:00:00");
    const p0 = addPage("nb1", 0, "a", "2026-06-19");
    const p1 = addPage("nb1", 1, "b", "2026-06-20");
    addEntity(p0, "person", "Jin", "jin");
    addEntity(p1, "person", "jin", "jin"); // same entity, different casing
    addEntity(p0, "place", "Seoul", "seoul");

    expect(exportMod.affectedEntityStubFileNames("nb1").sort()).toEqual([
      "People/Jin.md",
      "Places/Seoul.md",
    ]);
  });

  it("returns [] for the discipline notebook", () => {
    addNotebook(notesMod.DISCIPLINE_ID, "Discipline", "2026-06-21 00:00:00");
    const dp = addPage(notesMod.DISCIPLINE_ID, 0, "repo", "none");
    addEntity(dp, "person", "Secret", "secret");
    expect(exportMod.affectedEntityStubFileNames(notesMod.DISCIPLINE_ID)).toEqual(
      []
    );
  });
});
