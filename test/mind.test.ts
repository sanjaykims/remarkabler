import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Phase C: the mcp-conversations synthetic notebook (lib/conversationEntities.ts)
// carries a real, non-empty ocr_text and entry_date — unlike the discipline
// notebook, which never has either. These pins lock the notebook-exclusion
// fixes this required:
//   - it must NEVER get "analyzed" by the entry_analysis backfill (that would
//     both waste a Claude call on a placeholder AND transitively leak into
//     getThemes/getSentimentSeries/getEmbeddingMap);
//   - it must NEVER show up on the diary heatmap;
//   - it MUST still show up in getTopEntities (deliberately inclusive, per
//     the decision that /mind's entity rankings reflect conversations too).

type DbMod = typeof import("@/lib/db");
type MindMod = typeof import("@/lib/mind");
type NotesMod = typeof import("@/lib/notes");

let dbMod: DbMod;
let mindMod: MindMod;
let notesMod: NotesMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "mind-conv-exclude-"));
  dbMod = await import("@/lib/db");
  mindMod = await import("@/lib/mind");
  notesMod = await import("@/lib/notes");
  dbMod.db();
});

beforeEach(() => {
  const d = dbMod.db();
  d.prepare(`DELETE FROM entry_entities`).run();
  d.prepare(`DELETE FROM entry_analysis`).run();
  d.prepare(`DELETE FROM pages`).run();
  d.prepare(`DELETE FROM notebooks`).run();
});

function addNotebook(id: string, name: string, syncedAt: string) {
  dbMod
    .db()
    .prepare(`INSERT INTO notebooks(id, name, synced_at) VALUES(?,?,?)`)
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

describe("countPending excludes the mcp-conversations notebook", () => {
  it("a synthetic conversation page never counts as pending analysis", () => {
    addNotebook("nb1", "Diary", "2026-06-19 00:00:00");
    addPage("nb1", 0, "real diary text", "2026-06-19");
    addNotebook(
      notesMod.CONVERSATIONS_NOTEBOOK_ID,
      "Conversations (subscription Claude)",
      "2026-06-20 00:00:00"
    );
    addPage(notesMod.CONVERSATIONS_NOTEBOOK_ID, 0, "[Conversation] X", "2026-06-20");

    // Only the one real diary page is pending — the conversation placeholder
    // (despite having non-empty ocr_text) is excluded, so it never burns a
    // Claude call and never populates entry_analysis for getThemes/
    // getSentimentSeries/getEmbeddingMap to accidentally pick up.
    expect(mindMod.countPending()).toBe(1);
  });
});

describe("getHeatmap excludes the mcp-conversations notebook", () => {
  it("conversation placeholder pages never appear as diary writing volume", () => {
    addNotebook("nb1", "Diary", "2026-06-19 00:00:00");
    addPage("nb1", 0, "real diary text", "2026-06-19");
    addNotebook(
      notesMod.CONVERSATIONS_NOTEBOOK_ID,
      "Conversations (subscription Claude)",
      "2026-06-20 00:00:00"
    );
    addPage(notesMod.CONVERSATIONS_NOTEBOOK_ID, 0, "[Conversation] X", "2026-06-20");

    const buckets = mindMod.getHeatmap();
    expect(buckets.map((b) => b.date)).toEqual(["2026-06-19"]);
  });
});

describe("getTopEntities INCLUDES conversation-derived entities (deliberate)", () => {
  it("a person tagged only via a conversation page still ranks", () => {
    addNotebook(
      notesMod.CONVERSATIONS_NOTEBOOK_ID,
      "Conversations (subscription Claude)",
      "2026-06-20 00:00:00"
    );
    const cp = addPage(
      notesMod.CONVERSATIONS_NOTEBOOK_ID,
      0,
      "[Conversation] X",
      "2026-06-20"
    );
    dbMod
      .db()
      .prepare(
        `INSERT INTO entry_entities(page_id, kind, name, name_norm) VALUES(?,?,?,?)`
      )
      .run(cp, "person", "Suwon Friend", "suwon friend");

    const { people } = mindMod.getTopEntities();
    expect(people.map((p) => p.name)).toContain("Suwon Friend");
  });
});

// The mcp-reflections synthetic notebook (lib/reflectionEntities.ts) needs
// the SAME dual inclusion/exclusion treatment as mcp-conversations above.

describe("countPending excludes the mcp-reflections notebook", () => {
  it("a synthetic reflection page never counts as pending analysis", () => {
    addNotebook("nb1", "Diary", "2026-06-19 00:00:00");
    addPage("nb1", 0, "real diary text", "2026-06-19");
    addNotebook(
      notesMod.REFLECTIONS_NOTEBOOK_ID,
      "Reflections (subscription Claude)",
      "2026-06-20 00:00:00"
    );
    addPage(notesMod.REFLECTIONS_NOTEBOOK_ID, 0, "[Reflection] X", "2026-06-20");

    expect(mindMod.countPending()).toBe(1);
  });
});

describe("getHeatmap excludes the mcp-reflections notebook", () => {
  it("reflection placeholder pages never appear as diary writing volume", () => {
    addNotebook("nb1", "Diary", "2026-06-19 00:00:00");
    addPage("nb1", 0, "real diary text", "2026-06-19");
    addNotebook(
      notesMod.REFLECTIONS_NOTEBOOK_ID,
      "Reflections (subscription Claude)",
      "2026-06-20 00:00:00"
    );
    addPage(notesMod.REFLECTIONS_NOTEBOOK_ID, 0, "[Reflection] X", "2026-06-20");

    const buckets = mindMod.getHeatmap();
    expect(buckets.map((b) => b.date)).toEqual(["2026-06-19"]);
  });
});

describe("getTopEntities INCLUDES reflection-derived entities (deliberate)", () => {
  it("a person tagged only via a reflection page still ranks", () => {
    addNotebook(
      notesMod.REFLECTIONS_NOTEBOOK_ID,
      "Reflections (subscription Claude)",
      "2026-06-20 00:00:00"
    );
    const rp = addPage(
      notesMod.REFLECTIONS_NOTEBOOK_ID,
      0,
      "[Reflection] X",
      "2026-06-20"
    );
    dbMod
      .db()
      .prepare(
        `INSERT INTO entry_entities(page_id, kind, name, name_norm) VALUES(?,?,?,?)`
      )
      .run(rp, "person", "Reflection Friend", "reflection friend");

    const { people } = mindMod.getTopEntities();
    expect(people.map((p) => p.name)).toContain("Reflection Friend");
  });
});

// The mcp-decisions synthetic notebook (lib/decisionEntities.ts) gets the
// SAME dual inclusion/exclusion treatment (4th synthetic notebook).

describe("mcp-decisions notebook: excluded from /mind, included in rankings", () => {
  it("a decision page never counts as pending analysis or heatmap volume", () => {
    addNotebook("nb1", "Diary", "2026-06-19 00:00:00");
    addPage("nb1", 0, "real diary text", "2026-06-19");
    addNotebook(
      notesMod.DECISIONS_NOTEBOOK_ID,
      "Decisions (subscription Claude)",
      "2026-06-20 00:00:00"
    );
    addPage(notesMod.DECISIONS_NOTEBOOK_ID, 0, "[Decision] X", "2026-06-20");

    expect(mindMod.countPending()).toBe(1);
    expect(mindMod.getHeatmap().map((b) => b.date)).toEqual(["2026-06-19"]);
  });

  it("a person tagged only via a decision page still ranks in getTopEntities", () => {
    addNotebook(
      notesMod.DECISIONS_NOTEBOOK_ID,
      "Decisions (subscription Claude)",
      "2026-06-20 00:00:00"
    );
    const dp = addPage(notesMod.DECISIONS_NOTEBOOK_ID, 0, "[Decision] X", "2026-06-20");
    dbMod
      .db()
      .prepare(
        `INSERT INTO entry_entities(page_id, kind, name, name_norm) VALUES(?,?,?,?)`
      )
      .run(dp, "project", "ETF", "etf");

    const { projects } = mindMod.getTopEntities();
    expect(projects.map((p) => p.name)).toContain("ETF");
  });
});
