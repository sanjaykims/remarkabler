import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// getTopEntities powers the /mind UI's "Who, where, what" section. It returns
// the top-N people/places/projects in one shot. Unlike the top_entities chat
// tool, it ALWAYS excludes the discipline notebook (same posture as the
// themes / sentiment surfaces, which never show discipline data).

type DbMod = typeof import("@/lib/db");
type MindMod = typeof import("@/lib/mind");
type NotesMod = typeof import("@/lib/notes");

let dbMod: DbMod;
let mindMod: MindMod;
let notesMod: NotesMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "get-top-entities-"));
  dbMod = await import("@/lib/db");
  mindMod = await import("@/lib/mind");
  notesMod = await import("@/lib/notes");
  dbMod.db();
});

beforeEach(() => {
  dbMod.db().prepare(`DELETE FROM entry_entities`).run();
  dbMod.db().prepare(`DELETE FROM pages`).run();
  dbMod.db().prepare(`DELETE FROM notebooks`).run();
});

function nb(id: string, name = id) {
  dbMod
    .db()
    .prepare(`INSERT INTO notebooks(id, name, synced_at) VALUES(?, ?, ?)`)
    .run(id, name, "2026-06-01T00:00:00Z");
}
function pg(id: string, notebookId: string, idx: number) {
  dbMod
    .db()
    .prepare(`INSERT INTO pages(id, notebook_id, page_index) VALUES(?, ?, ?)`)
    .run(id, notebookId, idx);
}
function ent(pageId: string, kind: string, name: string) {
  dbMod
    .db()
    .prepare(
      `INSERT INTO entry_entities(page_id, kind, name, name_norm) VALUES(?, ?, ?, ?)`
    )
    .run(pageId, kind, name, mindMod.normaliseEntityName(name));
}

describe("getTopEntities", () => {
  it("returns top-N for each kind, ranked by page count", () => {
    nb("nb-1");
    for (let i = 0; i < 7; i++) pg(`pp${i}`, "nb-1", i);
    for (let i = 0; i < 5; i++) ent(`pp${i}`, "person", "Alice");
    for (let i = 0; i < 2; i++) ent(`pp${5 + i}`, "person", "Bob");
    ent("pp0", "place", "Seoul");
    ent("pp1", "place", "Seoul");
    ent("pp2", "place", "Busan");
    ent("pp0", "project", "App");

    const r = mindMod.getTopEntities(10);
    expect(r.people.map((e) => e.name)).toEqual(["Alice", "Bob"]);
    expect(r.people.map((e) => e.pages)).toEqual([5, 2]);
    expect(r.places.map((e) => e.name)).toEqual(["Seoul", "Busan"]);
    expect(r.places.map((e) => e.pages)).toEqual([2, 1]);
    expect(r.projects.map((e) => e.name)).toEqual(["App"]);
  });

  it("always excludes the discipline notebook (even when toggle is ON)", () => {
    // Unlike chat tools, /mind never shows discipline content.
    // toggle ON means "share with Remarkabler in chat" — has no effect here.
    nb("nb-1");
    nb(notesMod.DISCIPLINE_ID, "Discipline");
    pg("p1", "nb-1", 0);
    pg("d1", notesMod.DISCIPLINE_ID, 0);
    ent("p1", "person", "Diary Person");
    ent("d1", "person", "Discipline Person");

    notesMod.setDisciplineEnabled(true); // ON — chat tools would include it
    const r = mindMod.getTopEntities(10);
    expect(r.people.map((e) => e.name)).toEqual(["Diary Person"]);
  });

  it("respects limit", () => {
    nb("nb-1");
    for (let i = 0; i < 12; i++) {
      pg(`p${i}`, "nb-1", i);
      ent(`p${i}`, "person", `Person${i}`);
    }
    const r = mindMod.getTopEntities(5);
    expect(r.people.length).toBe(5);
  });

  it("clamps limit to 1..50", () => {
    nb("nb-1");
    pg("p1", "nb-1", 0);
    ent("p1", "person", "Only");

    expect(mindMod.getTopEntities(0).people.length).toBe(1); // 0 clamps to 1
    expect(mindMod.getTopEntities(-5).people.length).toBe(1);
  });

  it("groups by name_norm — different casings coalesce", () => {
    nb("nb-1");
    for (let i = 0; i < 3; i++) pg(`p${i}`, "nb-1", i);
    ent("p0", "project", "Sermorizer");
    ent("p1", "project", "sermorizer");
    ent("p2", "project", "SERMORIZER");

    const r = mindMod.getTopEntities(10);
    expect(r.projects.length).toBe(1);
    expect(r.projects[0].pages).toBe(3);
  });

  it("returns empty arrays when no entities exist", () => {
    const r = mindMod.getTopEntities(10);
    expect(r.people).toEqual([]);
    expect(r.places).toEqual([]);
    expect(r.projects).toEqual([]);
  });
});
