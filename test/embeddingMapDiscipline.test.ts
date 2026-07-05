import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Integration test for the bug the review found: getEmbeddingMap did NOT exclude
// the discipline notebook, while generateAxisLabels did — so the 3D map could
// be shaped by synced GitHub content the axis labels never saw. This test
// inserts a normal notebook + a discipline notebook into a throwaway SQLite
// DB and asserts the map returns only the diary pages.
//
// All app imports are dynamic + happen after DATA_DIR is pointed at a temp
// dir, because lib/db captures DATA_DIR at module-eval time. Static imports
// would bind the real ./data directory before the env override lands.

// Type-only imports are erased at compile time, so they do NOT import lib/db
// at runtime (which would capture DATA_DIR before the env override). The
// values are loaded via dynamic import inside beforeAll.
type DbMod = typeof import("@/lib/db");
type MindMod = typeof import("@/lib/mind");
type EmbMod = typeof import("@/lib/embeddings");
type NotesMod = typeof import("@/lib/notes");

let dbMod: DbMod;
let mindMod: MindMod;
let embMod: EmbMod;
let notesMod: NotesMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "mind-disc-"));
  dbMod = await import("@/lib/db");
  mindMod = await import("@/lib/mind");
  embMod = await import("@/lib/embeddings");
  notesMod = await import("@/lib/notes");

  const conn = dbMod.db();
  const DISCIPLINE_ID = notesMod.DISCIPLINE_ID as string;

  conn
    .prepare(`INSERT INTO notebooks (id, name, synced_at) VALUES (?, ?, ?)`)
    .run("nb-diary", "My Diary", "2026-06-01T00:00:00Z");
  conn
    .prepare(`INSERT INTO notebooks (id, name, synced_at) VALUES (?, ?, ?)`)
    .run(DISCIPLINE_ID, "Discipline (owner/repo)", "2026-06-01T00:00:00Z");

  const insertPage = conn.prepare(
    `INSERT INTO pages (id, notebook_id, page_index, ocr_text, embedding, entry_date)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  // Distinct 4-dim embeddings so PCA has real variance to work with.
  const vecs = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [1, 1, 0, 0],
    [0, 1, 1, 0],
    [1, 0, 1, 0],
  ];
  // 4 diary pages…
  for (let i = 0; i < 4; i++) {
    insertPage.run(
      `nb-diary:${i}`,
      "nb-diary",
      i,
      `diary entry ${i}`,
      embMod.encodeEmbedding(new Float32Array(vecs[i])),
      "2026-06-01"
    );
  }
  // …and 2 discipline pages that must NOT appear on the map.
  for (let i = 0; i < 2; i++) {
    insertPage.run(
      `${DISCIPLINE_ID}:${i}`,
      DISCIPLINE_ID,
      i,
      `discipline rule ${i}`,
      embMod.encodeEmbedding(new Float32Array(vecs[4 + i])),
      "2026-06-01"
    );
  }
});

describe("getEmbeddingMap discipline exclusion", () => {
  it("returns only diary pages, never discipline pages", () => {
    const points = mindMod.getEmbeddingMap();
    expect(points.length).toBe(4);
    for (const p of points) {
      expect(p.notebook_name).toBe("My Diary");
      expect(p.page_id.startsWith(notesMod.DISCIPLINE_ID)).toBe(false);
    }
  });

  it("the map's point set matches what axis labelling would consider", () => {
    // generateAxisLabels selects the same diary-only set (embedding present,
    // discipline excluded). We can't call it here without a live Claude key,
    // but we assert the map honours the identical filter, which is the
    // invariant that was broken: map points ⊆ label-eligible points.
    const points = mindMod.getEmbeddingMap();
    const ids = points.map((p) => p.page_id).sort();
    expect(ids).toEqual([
      "nb-diary:0",
      "nb-diary:1",
      "nb-diary:2",
      "nb-diary:3",
    ]);
  });
});
