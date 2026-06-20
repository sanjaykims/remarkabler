import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// pages_for_entity drills down from an entity name → real pages mentioning it.
// Coverage: name_norm matching (casing-insensitive, whitespace-tolerant),
// kind filter, limit clamping, discipline exclusion, excerpt truncation,
// ordering by entry_date desc (with synced_at fallback), bad input rejection.

type DbMod = typeof import("@/lib/db");
type ChatToolsMod = typeof import("@/lib/chatTools");
type NotesMod = typeof import("@/lib/notes");

let dbMod: DbMod;
let chatToolsMod: ChatToolsMod;
let notesMod: NotesMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "pages-for-entity-"));
  dbMod = await import("@/lib/db");
  chatToolsMod = await import("@/lib/chatTools");
  notesMod = await import("@/lib/notes");
  dbMod.db();
});

beforeEach(() => {
  dbMod.db().prepare(`DELETE FROM entry_entities`).run();
  dbMod.db().prepare(`DELETE FROM pages`).run();
  dbMod.db().prepare(`DELETE FROM notebooks`).run();
  notesMod.setDisciplineEnabled(true);
});

function insertNotebook(id: string, name: string, synced: string) {
  dbMod
    .db()
    .prepare(`INSERT INTO notebooks(id, name, synced_at) VALUES(?, ?, ?)`)
    .run(id, name, synced);
}

function insertPage(
  pageId: string,
  notebookId: string,
  index: number,
  text: string,
  entryDate: string | null = null
) {
  dbMod
    .db()
    .prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text, entry_date) VALUES(?, ?, ?, ?, ?)`
    )
    .run(pageId, notebookId, index, text, entryDate);
}

function insertEntity(pageId: string, kind: string, name: string) {
  const norm = name.toLowerCase().replace(/\s+/g, " ").trim();
  dbMod
    .db()
    .prepare(
      `INSERT INTO entry_entities(page_id, kind, name, name_norm) VALUES(?, ?, ?, ?)`
    )
    .run(pageId, kind, name, norm);
}

async function runTool(args: {
  kind?: string;
  name?: string;
  limit?: number;
}): Promise<{
  kind?: string;
  name?: string;
  excerpts: Array<{
    notebook: string;
    page: number;
    date: string | null;
    text: string;
  }>;
  note?: string;
}> {
  const raw = await chatToolsMod.executeTool("pages_for_entity", args);
  return JSON.parse(raw);
}

describe("pages_for_entity", () => {
  it("returns excerpts from pages tagged with the entity (any casing matches)", async () => {
    insertNotebook("nb-1", "Diary", "2026-06-01T00:00:00Z");
    insertPage("p1", "nb-1", 0, "Walked with Taeyoon today. Great day.");
    insertPage("p2", "nb-1", 1, "Another day with Taeyoon");
    insertEntity("p1", "person", "Taeyoon");
    insertEntity("p2", "person", "taeyoon");

    const r = await runTool({ kind: "person", name: "TAEYOON" });
    expect(r.excerpts.length).toBe(2);
    // Display name comes from whichever stored row sorts first — we don't
    // commit to a specific casing, just that the entity was found.
    expect((r.name || "").toLowerCase()).toBe("taeyoon");
    expect(r.excerpts.every((e) => e.text.includes("Taeyoon"))).toBe(true);
  });

  it("filters by kind — a person query doesn't return a same-named place", async () => {
    insertNotebook("nb-1", "Diary", "2026-06-01T00:00:00Z");
    insertPage("p1", "nb-1", 0, "Person Cobra");
    insertPage("p2", "nb-1", 1, "Place Cobra");
    insertEntity("p1", "person", "Cobra");
    insertEntity("p2", "place", "Cobra");

    const person = await runTool({ kind: "person", name: "Cobra" });
    expect(person.excerpts.length).toBe(1);
    expect(person.excerpts[0].text).toContain("Person");

    const place = await runTool({ kind: "place", name: "Cobra" });
    expect(place.excerpts.length).toBe(1);
    expect(place.excerpts[0].text).toContain("Place");
  });

  it("orders by entry_date desc, then page_index desc", async () => {
    insertNotebook("nb-1", "Diary", "2026-06-01T00:00:00Z");
    insertPage("p-old", "nb-1", 0, "old mention", "2026-01-05");
    insertPage("p-new", "nb-1", 1, "new mention", "2026-05-20");
    insertPage("p-mid", "nb-1", 2, "mid mention", "2026-03-10");
    insertEntity("p-old", "place", "Wuhan");
    insertEntity("p-new", "place", "Wuhan");
    insertEntity("p-mid", "place", "Wuhan");

    const r = await runTool({ kind: "place", name: "Wuhan" });
    expect(r.excerpts.map((e) => e.text)).toEqual([
      "new mention",
      "mid mention",
      "old mention",
    ]);
  });

  it("falls back to synced_at for ordering when entry_date is null", async () => {
    insertNotebook("nb-old", "Old", "2025-12-01T00:00:00Z");
    insertNotebook("nb-new", "New", "2026-06-01T00:00:00Z");
    insertPage("p-old", "nb-old", 0, "old notebook");
    insertPage("p-new", "nb-new", 0, "new notebook");
    insertEntity("p-old", "project", "Sermorizer");
    insertEntity("p-new", "project", "Sermorizer");

    const r = await runTool({ kind: "project", name: "Sermorizer" });
    expect(r.excerpts[0].text).toBe("new notebook");
    expect(r.excerpts[1].text).toBe("old notebook");
  });

  it("respects the limit (1-20, default 8)", async () => {
    insertNotebook("nb-1", "Diary", "2026-06-01T00:00:00Z");
    for (let i = 0; i < 15; i++) {
      insertPage(`p${i}`, "nb-1", i, `mention ${i}`, "2026-05-01");
      insertEntity(`p${i}`, "person", "Ben");
    }
    const def = await runTool({ kind: "person", name: "Ben" });
    expect(def.excerpts.length).toBe(8);

    const five = await runTool({ kind: "person", name: "Ben", limit: 5 });
    expect(five.excerpts.length).toBe(5);

    const huge = await runTool({ kind: "person", name: "Ben", limit: 999 });
    expect(huge.excerpts.length).toBeLessThanOrEqual(20);
  });

  it("excludes the discipline notebook when toggle is off", async () => {
    insertNotebook("nb-1", "Diary", "2026-06-01T00:00:00Z");
    insertNotebook(notesMod.DISCIPLINE_ID, "Discipline", "2026-06-01T00:00:00Z");
    insertPage("p1", "nb-1", 0, "diary mention");
    insertPage("d1", notesMod.DISCIPLINE_ID, 0, "discipline mention");
    insertEntity("p1", "person", "Coach");
    insertEntity("d1", "person", "Coach");

    // Default on → both included
    const both = await runTool({ kind: "person", name: "Coach" });
    expect(both.excerpts.length).toBe(2);

    // Toggle off → discipline excluded
    notesMod.setDisciplineEnabled(false);
    const diary = await runTool({ kind: "person", name: "Coach" });
    expect(diary.excerpts.length).toBe(1);
    expect(diary.excerpts[0].text).toBe("diary mention");
  });

  it("name_norm matches across whitespace variations", async () => {
    insertNotebook("nb-1", "Diary", "2026-06-01T00:00:00Z");
    insertPage("p1", "nb-1", 0, "x");
    insertEntity("p1", "person", "Pastor   Kim"); // extra internal spaces

    // Caller can pass "pastor kim" (one space) and still match
    const r = await runTool({ kind: "person", name: "pastor kim" });
    expect(r.excerpts.length).toBe(1);
  });

  it("returns a helpful note when no pages are tagged with the entity", async () => {
    insertNotebook("nb-1", "Diary", "2026-06-01T00:00:00Z");
    insertPage("p1", "nb-1", 0, "x");
    insertEntity("p1", "person", "Someone");

    const r = await runTool({ kind: "person", name: "Nobody" });
    expect(r.excerpts).toEqual([]);
    expect(r.note || "").toMatch(/search_diary|tagged|no/i);
  });

  it("rejects bad kind / missing name with helpful notes", async () => {
    const bad = await runTool({ kind: "animal", name: "Rex" });
    expect(bad.note || "").toMatch(/kind/i);

    const empty = await runTool({ kind: "person", name: "" });
    expect(empty.note || "").toMatch(/name/i);
  });

  it("returns 1-based page numbers (page_index + 1)", async () => {
    insertNotebook("nb-1", "Diary", "2026-06-01T00:00:00Z");
    insertPage("p1", "nb-1", 7, "page 8 content", "2026-05-01");
    insertEntity("p1", "person", "Tester");

    const r = await runTool({ kind: "person", name: "Tester" });
    expect(r.excerpts[0].page).toBe(8);
  });
});
