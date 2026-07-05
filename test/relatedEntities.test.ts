import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// related_entities: the graph-edge chat tool. Two entities are connected when
// they share an effective diary day. Covers casing match, kind isolation,
// carry-forward days, undated exclusion, discipline exclusion, ranking.

type DbMod = typeof import("@/lib/db");
type ChatToolsMod = typeof import("@/lib/chatTools");
type NotesMod = typeof import("@/lib/notes");

let dbMod: DbMod;
let chatToolsMod: ChatToolsMod;
let notesMod: NotesMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "related-entities-"));
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

function nb(id: string, synced: string) {
  dbMod
    .db()
    .prepare(`INSERT INTO notebooks(id, name, synced_at) VALUES(?, 'Diary', ?)`)
    .run(id, synced);
}

function page(
  id: string,
  notebookId: string,
  index: number,
  entryDate: string | null
) {
  dbMod
    .db()
    .prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text, entry_date) VALUES(?, ?, ?, 'text', ?)`
    )
    .run(id, notebookId, index, entryDate);
}

function entity(pageId: string, kind: string, name: string) {
  const norm = name.toLowerCase().replace(/\s+/g, " ").trim();
  dbMod
    .db()
    .prepare(
      `INSERT INTO entry_entities(page_id, kind, name, name_norm) VALUES(?, ?, ?, ?)`
    )
    .run(pageId, kind, name, norm);
}

type Result = {
  kind?: string;
  name?: string;
  related: Array<{
    name: string;
    kind: string;
    shared_days: number;
    example_days: string[];
  }>;
  note?: string;
};

async function runTool(args: {
  kind?: string;
  name?: string;
  limit?: number;
}): Promise<Result> {
  return JSON.parse(await chatToolsMod.executeTool("related_entities", args));
}

describe("related_entities", () => {
  it("returns entities that share a day with the target (any casing)", async () => {
    nb("nb1", "2026-06-01T00:00:00Z");
    page("p1", "nb1", 0, "2026-06-19");
    entity("p1", "person", "Kim");
    entity("p1", "person", "Jin");
    entity("p1", "place", "Seoul");

    const r = await runTool({ kind: "person", name: "KIM" });
    expect((r.name || "").toLowerCase()).toBe("kim");
    const names = r.related.map((x) => x.name).sort();
    expect(names).toEqual(["Jin", "Seoul"]);
    expect(r.related.every((x) => x.shared_days === 1)).toBe(true);
  });

  it("does not connect entities that only appear on different days", async () => {
    nb("nb1", "2026-06-01T00:00:00Z");
    page("p1", "nb1", 0, "2026-06-19");
    page("p2", "nb1", 1, "2026-06-20");
    entity("p1", "person", "Kim");
    entity("p2", "person", "Jin");

    const r = await runTool({ kind: "person", name: "Kim" });
    expect(r.related).toEqual([]);
    expect(r.note).toMatch(/share a dated day/);
  });

  it("connects entities across a carried-forward continuation page", async () => {
    nb("nb1", "2026-06-01T00:00:00Z");
    page("p1", "nb1", 0, "2026-06-19");
    page("p2", "nb1", 1, "none"); // carries forward to 06-19
    entity("p1", "person", "Kim");
    entity("p2", "person", "Jin"); // different page, same effective day

    const r = await runTool({ kind: "person", name: "Kim" });
    expect(r.related.map((x) => x.name)).toEqual(["Jin"]);
    expect(r.related[0].example_days).toEqual(["2026-06-19"]);
  });

  it("excludes undated pages so they don't link everything", async () => {
    nb("nb1", "2026-06-01T00:00:00Z");
    page("p1", "nb1", 0, "none"); // undated
    entity("p1", "person", "Kim");
    entity("p1", "person", "Jin");

    const r = await runTool({ kind: "person", name: "Kim" });
    // Kim exists but only on an undated page → no dated co-occurrence.
    expect(r.related).toEqual([]);
    expect(r.note).toMatch(/No person named/);
  });

  it("ranks by shared_days descending", async () => {
    nb("nb1", "2026-06-01T00:00:00Z");
    page("p1", "nb1", 0, "2026-06-19");
    page("p2", "nb1", 1, "2026-06-20");
    page("p3", "nb1", 2, "2026-06-21");
    entity("p1", "person", "Kim");
    entity("p1", "person", "Jin");
    entity("p2", "person", "Kim");
    entity("p2", "person", "Jin");
    entity("p3", "person", "Kim");
    entity("p3", "person", "Ben");

    const r = await runTool({ kind: "person", name: "Kim" });
    expect(r.related[0]).toMatchObject({ name: "Jin", shared_days: 2 });
    expect(r.related[1]).toMatchObject({ name: "Ben", shared_days: 1 });
  });

  it("excludes the discipline notebook from co-occurrence when sharing is off", async () => {
    notesMod.setDisciplineEnabled(false); // don't share discipline notes with chat
    nb("nb1", "2026-06-01T00:00:00Z");
    page("p1", "nb1", 0, "2026-06-19");
    entity("p1", "person", "Kim");
    // Discipline notebook, same day, would-be co-occurrence:
    dbMod
      .db()
      .prepare(
        `INSERT INTO notebooks(id, name, synced_at) VALUES(?, 'Discipline', ?)`
      )
      .run(notesMod.DISCIPLINE_ID, "2026-06-02T00:00:00Z");
    page("d1", notesMod.DISCIPLINE_ID, 0, "2026-06-19");
    entity("d1", "person", "Kim");
    entity("d1", "person", "SecretPerson");

    const r = await runTool({ kind: "person", name: "Kim" });
    expect(r.related.map((x) => x.name)).not.toContain("SecretPerson");
  });

  it("rejects a bad kind", async () => {
    const r = await runTool({ kind: "animal", name: "Kim" });
    expect(r.related).toEqual([]);
    expect(r.note).toMatch(/Bad kind/);
  });
});
