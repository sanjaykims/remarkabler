import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// top_entities aggregates entry_entities by name_norm so "Sermorizer" and
// "sermorizer" coalesce, ignores the discipline notebook when the toggle is
// off, and respects kind/limit. Same throwaway-SQLite posture used by the
// chat-memory dedup test.

type DbMod = typeof import("@/lib/db");
type ChatToolsMod = typeof import("@/lib/chatTools");
type MindMod = typeof import("@/lib/mind");
type NotesMod = typeof import("@/lib/notes");

let dbMod: DbMod;
let chatToolsMod: ChatToolsMod;
let mindMod: MindMod;
let notesMod: NotesMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "top-entities-"));
  dbMod = await import("@/lib/db");
  chatToolsMod = await import("@/lib/chatTools");
  mindMod = await import("@/lib/mind");
  notesMod = await import("@/lib/notes");
  dbMod.db();
});

beforeEach(() => {
  dbMod.db().prepare(`DELETE FROM entry_entities`).run();
  dbMod.db().prepare(`DELETE FROM pages`).run();
  dbMod.db().prepare(`DELETE FROM notebooks`).run();
});

function insertNotebook(id: string, name: string) {
  dbMod
    .db()
    .prepare(`INSERT INTO notebooks(id, name, synced_at) VALUES(?, ?, ?)`)
    .run(id, name, "2026-06-01T00:00:00Z");
}

function insertPage(pageId: string, notebookId: string, index: number) {
  dbMod
    .db()
    .prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text) VALUES(?, ?, ?, ?)`
    )
    .run(pageId, notebookId, index, `page ${index} text`);
}

function insertEntity(pageId: string, kind: string, name: string) {
  dbMod
    .db()
    .prepare(
      `INSERT INTO entry_entities(page_id, kind, name, name_norm) VALUES(?, ?, ?, ?)`
    )
    .run(pageId, kind, name, mindMod.normaliseEntityName(name));
}

async function runTool(
  kind: string,
  limit?: number
): Promise<{
  kind?: string;
  items: Array<{ name: string; pages: number }>;
  note?: string;
}> {
  const raw = await chatToolsMod.executeTool("top_entities", { kind, limit });
  return JSON.parse(raw);
}

describe("top_entities", () => {
  it("aggregates by name_norm — 'Sermorizer' and 'sermorizer' coalesce", async () => {
    insertNotebook("nb-1", "My Diary");
    insertPage("p1", "nb-1", 0);
    insertPage("p2", "nb-1", 1);
    insertPage("p3", "nb-1", 2);
    insertEntity("p1", "project", "Sermorizer");
    insertEntity("p2", "project", "sermorizer");
    insertEntity("p3", "project", "SERMORIZER");

    const r = await runTool("project");
    expect(r.items.length).toBe(1);
    expect(r.items[0].pages).toBe(3);
    // MIN(name) picks the alphabetically-first casing; we don't care which
    // it is, only that the count is right and the name isn't empty.
    expect(r.items[0].name.toLowerCase()).toBe("sermorizer");
  });

  it("returns top-N ordered by page count descending", async () => {
    insertNotebook("nb-1", "My Diary");
    for (let i = 0; i < 5; i++) insertPage(`pa${i}`, "nb-1", i);
    for (let i = 0; i < 2; i++) insertPage(`pb${i}`, "nb-1", 10 + i);
    insertPage("pc0", "nb-1", 20);

    for (let i = 0; i < 5; i++) insertEntity(`pa${i}`, "person", "Alice");
    for (let i = 0; i < 2; i++) insertEntity(`pb${i}`, "person", "Bob");
    insertEntity("pc0", "person", "Carol");

    const r = await runTool("person");
    expect(r.items.map((x) => x.name)).toEqual(["Alice", "Bob", "Carol"]);
    expect(r.items.map((x) => x.pages)).toEqual([5, 2, 1]);
  });

  it("filters by kind — places don't bleed into people", async () => {
    insertNotebook("nb-1", "My Diary");
    insertPage("p1", "nb-1", 0);
    insertEntity("p1", "person", "Alice");
    insertEntity("p1", "place", "Seoul");
    insertEntity("p1", "project", "Sermorizer");

    expect((await runTool("person")).items.map((x) => x.name)).toEqual(["Alice"]);
    expect((await runTool("place")).items.map((x) => x.name)).toEqual(["Seoul"]);
    expect((await runTool("project")).items.map((x) => x.name)).toEqual([
      "Sermorizer",
    ]);
  });

  it("respects the limit parameter", async () => {
    insertNotebook("nb-1", "My Diary");
    for (let i = 0; i < 15; i++) {
      insertPage(`p${i}`, "nb-1", i);
      insertEntity(`p${i}`, "person", `Person${i}`);
    }
    const r = await runTool("person", 5);
    expect(r.items.length).toBe(5);
  });

  it("clamps limit to 1..50", async () => {
    insertNotebook("nb-1", "My Diary");
    insertPage("p1", "nb-1", 0);
    insertEntity("p1", "person", "OnePerson");

    const zero = await runTool("person", 0); // clamps to 1
    expect(zero.items.length).toBe(1);

    // Negative limit clamps to 1
    const neg = await runTool("person", -3);
    expect(neg.items.length).toBe(1);
  });

  it("respects the discipline-enabled toggle", async () => {
    insertNotebook("nb-1", "My Diary");
    insertNotebook(notesMod.DISCIPLINE_ID, "Discipline");

    insertPage("p1", "nb-1", 0);
    insertEntity("p1", "person", "Diary Person");

    insertPage("d1", notesMod.DISCIPLINE_ID, 0);
    insertEntity("d1", "person", "Discipline Person");

    // Default (enabled): discipline content is INCLUDED in chat-tool results.
    // (Matches the existing countEntriesMentioning posture.)
    const included = await runTool("person");
    expect(included.items.map((x) => x.name).sort()).toEqual([
      "Diary Person",
      "Discipline Person",
    ]);

    // Toggle off: discipline content is EXCLUDED.
    notesMod.setDisciplineEnabled(false);
    const excluded = await runTool("person");
    expect(excluded.items.map((x) => x.name)).toEqual(["Diary Person"]);
    notesMod.setDisciplineEnabled(true); // restore default
  });

  it("rejects an invalid kind with a helpful note", async () => {
    const r = await runTool("animal");
    expect(r.items).toEqual([]);
    expect(r.note || "").toMatch(/kind/i);
  });

  it("returns an empty list when nothing matches", async () => {
    insertNotebook("nb-1", "My Diary");
    insertPage("p1", "nb-1", 0);
    insertEntity("p1", "place", "Seoul");

    const r = await runTool("person");
    expect(r.items).toEqual([]);
  });
});

describe("normaliseEntityName", () => {
  it("lowercases and collapses whitespace", () => {
    expect(mindMod.normaliseEntityName("  Pastor   Kim  ")).toBe("pastor kim");
  });
  it("returns empty for empty input", () => {
    expect(mindMod.normaliseEntityName("")).toBe("");
  });
  it("preserves single internal space", () => {
    expect(mindMod.normaliseEntityName("Seoul Iris Garden")).toBe(
      "seoul iris garden"
    );
  });
});
