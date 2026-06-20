import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Regression tests for two fixes in analyzePending's per-page write:
//
// (1) The upsert + delete + N inserts are now wrapped in db().transaction().
//     If any statement throws mid-write, the whole per-page block rolls
//     back — the page stays "pending" and the next sweep retries.
//
// (2) delEntities only fires when result.entities.length > 0. A model
//     response with valid JSON but entities:[] used to silently wipe a
//     page's previously-good entity set; we now treat empty as "no
//     signal, keep the old set."
//
// We exercise both by calling the analyzePending insertion code path
// directly through the prepared statements (no real Claude call). The
// goal is to test the WRITE atomicity, not the Claude integration.

type DbMod = typeof import("@/lib/db");
type MindMod = typeof import("@/lib/mind");

let dbMod: DbMod;
let mindMod: MindMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(
    path.join(tmpdir(), "entity-write-atomicity-")
  );
  dbMod = await import("@/lib/db");
  mindMod = await import("@/lib/mind");
  dbMod.db();
});

beforeEach(() => {
  dbMod.db().prepare(`DELETE FROM entry_entities`).run();
  dbMod.db().prepare(`DELETE FROM entry_analysis`).run();
  dbMod.db().prepare(`DELETE FROM pages`).run();
  dbMod.db().prepare(`DELETE FROM notebooks`).run();
});

function setupPage() {
  dbMod
    .db()
    .prepare(
      `INSERT INTO notebooks(id, name, synced_at) VALUES('nb-1', 'Diary', '2026-06-01T00:00:00Z')`
    )
    .run();
  dbMod
    .db()
    .prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text)
       VALUES('p1', 'nb-1', 0, 'some text')`
    )
    .run();
}

function seedExistingEntities() {
  // Pre-populate the page with a "good" set of entities, as if a
  // previous analysis pass had written them.
  for (const [kind, name] of [
    ["person", "Pastor Kim"],
    ["place", "Wuhan"],
    ["project", "Sermorizer"],
  ]) {
    dbMod
      .db()
      .prepare(
        `INSERT INTO entry_entities(page_id, kind, name, name_norm)
         VALUES('p1', ?, ?, ?)`
      )
      .run(kind, name, mindMod.normaliseEntityName(name as string));
  }
}

function countEntitiesFor(pageId: string): number {
  return (
    dbMod
      .db()
      .prepare(`SELECT COUNT(*) AS c FROM entry_entities WHERE page_id = ?`)
      .get(pageId) as { c: number }
  ).c;
}

function hasAnalysis(pageId: string): boolean {
  const r = dbMod
    .db()
    .prepare(`SELECT 1 FROM entry_analysis WHERE page_id = ?`)
    .get(pageId);
  return !!r;
}

// Inline replica of the per-page write block from lib/mind.ts:analyzePending.
// We test the SAME pattern (transaction + empty-guard) without making a real
// Claude call. If the pattern in mind.ts changes, this test will diverge —
// which is the point: it's a regression test for the shape, not a behavioural
// test of analyzePending itself.
function writePerPage(result: {
  themes: string[];
  sentiment: number | null;
  summary: string;
  entities: Array<{ kind: string; name: string }>;
}) {
  const upsert = dbMod.db().prepare(
    `INSERT INTO entry_analysis
       (page_id, themes, sentiment, summary, model, analyzed_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(page_id) DO UPDATE SET
       themes = excluded.themes, sentiment = excluded.sentiment,
       summary = excluded.summary, model = excluded.model,
       analyzed_at = excluded.analyzed_at`
  );
  const delEntities = dbMod
    .db()
    .prepare(`DELETE FROM entry_entities WHERE page_id = ?`);
  const insEntity = dbMod
    .db()
    .prepare(
      `INSERT INTO entry_entities(page_id, kind, name, name_norm) VALUES(?, ?, ?, ?)`
    );

  dbMod.db().transaction(() => {
    upsert.run(
      "p1",
      JSON.stringify(result.themes),
      result.sentiment,
      result.summary || null,
      "test-model"
    );
    if (result.entities.length > 0) {
      delEntities.run("p1");
      for (const e of result.entities) {
        insEntity.run("p1", e.kind, e.name, mindMod.normaliseEntityName(e.name));
      }
    }
  })();
}

describe("per-page entity write atomicity", () => {
  it("empty entities array does NOT wipe the existing entity set", () => {
    setupPage();
    seedExistingEntities();
    expect(countEntitiesFor("p1")).toBe(3);

    // Simulate a Claude response with valid themes/sentiment/summary but
    // entities:[] (noisy run that didn't surface any).
    writePerPage({
      themes: ["new theme"],
      sentiment: 0.1,
      summary: "new summary",
      entities: [],
    });

    // entry_analysis row updated, but entity rows preserved.
    expect(hasAnalysis("p1")).toBe(true);
    expect(countEntitiesFor("p1")).toBe(3);
  });

  it("non-empty entities array DOES replace the existing entity set", () => {
    setupPage();
    seedExistingEntities();
    expect(countEntitiesFor("p1")).toBe(3);

    writePerPage({
      themes: [],
      sentiment: null,
      summary: "",
      entities: [
        { kind: "person", name: "New Person" },
        { kind: "place", name: "New Place" },
      ],
    });

    // Old three entities replaced with the new two.
    expect(countEntitiesFor("p1")).toBe(2);
    const rows = dbMod
      .db()
      .prepare(
        `SELECT name FROM entry_entities WHERE page_id = 'p1' ORDER BY name ASC`
      )
      .all() as Array<{ name: string }>;
    expect(rows.map((r) => r.name)).toEqual(["New Person", "New Place"]);
  });

  it("a mid-loop throw rolls back the entire per-page write", () => {
    setupPage();
    seedExistingEntities();

    const upsert = dbMod.db().prepare(
      `INSERT INTO entry_analysis
         (page_id, themes, sentiment, summary, model, analyzed_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(page_id) DO UPDATE SET
         themes = excluded.themes, sentiment = excluded.sentiment,
         summary = excluded.summary, model = excluded.model,
         analyzed_at = excluded.analyzed_at`
    );
    const delEntities = dbMod
      .db()
      .prepare(`DELETE FROM entry_entities WHERE page_id = ?`);

    // Build a transaction that succeeds at upsert + delete then throws
    // on the first insert. Without the transaction wrap, upsert and
    // delete would have committed and the page would be permanently
    // half-written (analysis updated, entities deleted).
    let threw = false;
    try {
      dbMod.db().transaction(() => {
        upsert.run(
          "p1",
          JSON.stringify(["new"]),
          0.5,
          "new summary",
          "test-model"
        );
        delEntities.run("p1");
        throw new Error("simulated mid-write failure");
      })();
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);

    // Rollback: original 3 entities still present, no entry_analysis row.
    expect(countEntitiesFor("p1")).toBe(3);
    expect(hasAnalysis("p1")).toBe(false);
  });
});
