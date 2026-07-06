import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// DB-backed test for the entity merge primitives (lib/entityMerge). Covers
// the name_norm rewrite, alias recording, page-collision cleanup, chain
// repointing, and apply-on-insert resolution. The Claude-driven
// dedupeAllEntities driver is not exercised here (no network).

type DbMod = typeof import("@/lib/db");
type MergeMod = typeof import("@/lib/entityMerge");

let dbMod: DbMod;
let mergeMod: MergeMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "entity-merge-"));
  process.env.ANTHROPIC_API_KEY = "test-key";
  dbMod = await import("@/lib/db");
  mergeMod = await import("@/lib/entityMerge");
  dbMod.db();
});

beforeEach(() => {
  const d = dbMod.db();
  d.prepare(`DELETE FROM entry_entities`).run();
  d.prepare(`DELETE FROM entity_aliases`).run();
  d.prepare(`DELETE FROM pages`).run();
  d.prepare(`DELETE FROM notebooks`).run();
});

function nb(id: string) {
  dbMod
    .db()
    .prepare(`INSERT INTO notebooks(id, name, synced_at) VALUES(?, 'Diary', ?)`)
    .run(id, "2026-06-01T00:00:00Z");
}
function page(id: string, notebookId: string, index: number) {
  dbMod
    .db()
    .prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text) VALUES(?, ?, ?, 'text')`
    )
    .run(id, notebookId, index);
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
function norms(kind: string): string[] {
  return (
    dbMod
      .db()
      .prepare(
        `SELECT DISTINCT name_norm FROM entry_entities WHERE kind = ? ORDER BY name_norm`
      )
      .all(kind) as Array<{ name_norm: string }>
  ).map((r) => r.name_norm);
}

describe("mergeEntity", () => {
  it("rewrites the alias rows to the canonical norm + name", () => {
    nb("nb1");
    page("p1", "nb1", 0);
    page("p2", "nb1", 1);
    entity("p1", "person", "야오팡");
    entity("p2", "person", "Yaofang");

    const n = mergeMod.mergeEntity("person", "야오팡", "야오팡", "yaofang", "Yaofang");
    expect(n).toBe(1);
    expect(norms("person")).toEqual(["yaofang"]);
    const names = (
      dbMod
        .db()
        .prepare(`SELECT DISTINCT name FROM entry_entities WHERE kind='person'`)
        .all() as Array<{ name: string }>
    ).map((r) => r.name);
    expect(names).toEqual(["Yaofang"]);
  });

  it("records the alias so future lookups resolve", () => {
    nb("nb1");
    page("p1", "nb1", 0);
    entity("p1", "person", "야오팡");
    mergeMod.mergeEntity("person", "야오팡", "야오팡", "yaofang", "Yaofang");

    expect(mergeMod.applyEntityAlias("person", "야오팡", "야오팡")).toEqual({
      norm: "yaofang",
      name: "Yaofang",
    });
    // A non-aliased name passes through unchanged.
    expect(mergeMod.applyEntityAlias("person", "kim", "Kim")).toEqual({
      norm: "kim",
      name: "Kim",
    });
  });

  it("drops an alias row that collides with the canonical on the same page", () => {
    nb("nb1");
    page("p1", "nb1", 0);
    entity("p1", "person", "야오팡"); // same page carries BOTH spellings
    entity("p1", "person", "Yaofang");

    mergeMod.mergeEntity("person", "야오팡", "야오팡", "yaofang", "Yaofang");
    // One row survives on the page (UNIQUE(page_id, kind, name_norm)).
    const count = (
      dbMod
        .db()
        .prepare(
          `SELECT COUNT(*) AS c FROM entry_entities WHERE page_id='p1' AND kind='person'`
        )
        .get() as { c: number }
    ).c;
    expect(count).toBe(1);
    expect(norms("person")).toEqual(["yaofang"]);
  });

  it("repoints an existing chain so X→alias→canonical collapses to X→canonical", () => {
    nb("nb1");
    page("p1", "nb1", 0);
    entity("p1", "person", "야오팡");
    // First merge: 야오팡 → Yaofang
    mergeMod.mergeEntity("person", "야오팡", "야오팡", "yaofang", "Yaofang");
    // Then the canonical itself gets merged onward: Yaofang → Yao Fang
    mergeMod.mergeEntity("person", "yaofang", "Yaofang", "yao fang", "Yao Fang");

    // The original alias must now resolve straight to the final canonical.
    expect(mergeMod.applyEntityAlias("person", "야오팡", "야오팡")).toEqual({
      norm: "yao fang",
      name: "Yao Fang",
    });
  });

  it("is a no-op when alias and canonical are the same", () => {
    nb("nb1");
    page("p1", "nb1", 0);
    entity("p1", "person", "Kim");
    expect(mergeMod.mergeEntity("person", "kim", "Kim", "kim", "Kim")).toBe(0);
    expect(norms("person")).toEqual(["kim"]);
  });

  it("manually folds explicit variants into one canonical (incl. ones not yet extracted)", () => {
    nb("nb1");
    page("p1", "nb1", 0);
    page("p2", "nb1", 1);
    entity("p1", "person", "마오핑"); // an OCR variant that exists
    entity("p2", "person", "야오팡"); // the intended canonical exists too

    const res = mergeMod.mergeEntitiesManually("person", "야오팡", [
      "마오핑",
      "미오팡", // does NOT exist as an entity — still recorded as an alias
      "야오팡", // equals canonical — skipped
      "", // empty — skipped
    ]);
    expect(res.merged).toBe(2); // 마오핑 + 미오팡 applied
    expect(res.rewritten).toBe(1); // only 마오핑 had a row to rewrite
    expect(norms("person")).toEqual(["야오팡"]);
    // Both variants now resolve to the canonical on a future ingest.
    expect(mergeMod.applyEntityAlias("person", "마오핑", "마오핑").norm).toBe("야오팡");
    expect(mergeMod.applyEntityAlias("person", "미오팡", "미오팡").norm).toBe("야오팡");
  });

  it("folds into the REAL canonical when the typed name is already an alias (Codex #120)", () => {
    nb("nb1");
    page("p1", "nb1", 0);
    page("p2", "nb1", 1);
    page("p3", "nb1", 2);
    entity("p1", "person", "야오팡");
    entity("p2", "person", "Yaofang");
    entity("p3", "person", "마오핑");
    // Earlier run made Yaofang the canonical (야오팡 → yaofang).
    mergeMod.mergeEntity("person", "야오팡", "야오팡", "yaofang", "Yaofang");

    // Manually merging 마오핑 → 야오팡 (default, no override) must NOT resurrect
    // 야오팡 — it folds into the real canonical, yaofang.
    const res = mergeMod.mergeEntitiesManually("person", "야오팡", ["마오핑"]);
    expect(res.canonical).toBe("Yaofang");
    expect(norms("person")).toEqual(["yaofang"]);
    expect(mergeMod.applyEntityAlias("person", "마오핑", "마오핑").norm).toBe("yaofang");
  });

  it("promotes the typed name to canonical when makeCanonical is set", () => {
    nb("nb1");
    page("p1", "nb1", 0);
    page("p2", "nb1", 1);
    entity("p1", "person", "야오팡");
    entity("p2", "person", "Yaofang");
    mergeMod.mergeEntity("person", "야오팡", "야오팡", "yaofang", "Yaofang");

    // Override: make 야오팡 the winning spelling.
    const res = mergeMod.mergeEntitiesManually("person", "야오팡", [], {
      makeCanonical: true,
    });
    expect(res.canonical).toBe("야오팡");
    expect(norms("person")).toEqual(["야오팡"]);
    // Yaofang is now an alias of 야오팡; 야오팡 itself is canonical.
    expect(mergeMod.applyEntityAlias("person", "yaofang", "Yaofang").norm).toBe("야오팡");
    expect(mergeMod.applyEntityAlias("person", "야오팡", "야오팡").norm).toBe("야오팡");
  });

  it("records the alias display name so its stub can be found later (PR #109)", () => {
    nb("nb1");
    page("p1", "nb1", 0);
    entity("p1", "person", "야오팡");
    mergeMod.mergeEntity("person", "야오팡", "야오팡", "yaofang", "Yaofang");

    // listAliases surfaces the merged-away display name even though its
    // entry_entities rows are gone — that's how the export cleanup finds the
    // stale People/야오팡.md to delete on a LATER run (when merged=0).
    expect(mergeMod.listAliases()).toContainEqual({
      kind: "person",
      alias_norm: "야오팡",
      alias_name: "야오팡",
    });
  });
});
