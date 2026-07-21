import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Decision Records (MCP save_decision tool) are stored and filed into the
// Obsidian vault as one Markdown note each — mirroring reflectionWiki, since
// lib/decisionWiki.ts mirrors lib/reflectionWiki.ts. These pins lock:
//   - the note preserves the content, frontmattered as claude-decision;
//   - upsert-by-key keeps ONE record per decision and re-files on update;
//   - filing selects only unfiled rows and marks them after upload;
//   - entity-linking helpers + the "Connects to" section.

type Mod = typeof import("@/lib/decisionWiki");
type DbMod = typeof import("@/lib/db");
let dw: Mod;
let dbMod: DbMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "decision-wiki-"));
  dw = await import("@/lib/decisionWiki");
  dbMod = await import("@/lib/db");
  dbMod.db();
});

beforeEach(() => {
  dbMod.db().prepare("DELETE FROM mcp_decisions").run();
  dbMod.db().prepare("DELETE FROM entry_entities").run();
  dbMod.db().prepare("DELETE FROM pages").run();
  dbMod.db().prepare("DELETE FROM notebooks").run();
});

describe("renderDecisionNote (distinct type)", () => {
  it("preserves content and frontmatters it as claude-decision", () => {
    const content = "Decided to defer the Redis migration to Q2 because the API contract comes first.";
    const md = dw.renderDecisionNote({
      title: "Defer Redis migration",
      content,
      created_at: "2026-07-19 14:41:00",
    });
    expect(md).toContain(content);
    expect(md).toContain('title: "Defer Redis migration"');
    expect(md).toContain("type: claude-decision");
    expect(md).not.toContain("type: claude-reflection");
    expect(md).toContain('date: "2026-07-19"');
  });

  it("filenames are Decisions/<date>-<slug>-<hash>.md", () => {
    const f = dw.decisionNoteFileName({
      decision_key: "k1",
      title: "Defer Redis / migration?",
      created_at: "2026-07-19 14:41:00",
    });
    expect(f).toMatch(/^Decisions\/2026-07-19-Defer Redis migration-[0-9a-f]{6}\.md$/);
  });

  it("renders a Connects-to section for tagged entities (bare basenames)", () => {
    const md = dw.renderDecisionNote(
      { title: "D", content: "text", created_at: "2026-07-19 09:00:00" },
      [{ kind: "project", name: "ETF" }]
    );
    expect(md).toContain("## Connects to");
    expect(md).toContain("- [[ETF]]");
    expect(md).not.toContain("Projects/ETF");
  });

  it("decisionPageId is deterministic: mcp-decisions:<key>", () => {
    expect(dw.decisionPageId("abc")).toBe("mcp-decisions:abc");
  });
});

describe("saveDecision (upsert, add-only)", () => {
  it("inserts a new row, generates a dec_ key when none given", () => {
    const { key } = dw.saveDecision({ content: "decided X", title: "X" });
    expect(key).toMatch(/^dec_/);
    expect(dw.unfiledDecisionCount()).toBe(1);
    const row = dbMod
      .db()
      .prepare("SELECT content, filed_at, linked_at FROM mcp_decisions WHERE decision_key = ?")
      .get(key) as { content: string; filed_at: string | null; linked_at: string | null };
    expect(row.content).toBe("decided X");
    expect(row.filed_at).toBeNull();
    expect(row.linked_at).toBeNull();
  });

  it("re-saving the same id UPDATES one record and clears filed_at + linked_at", () => {
    dw.saveDecision({ content: "draft", decisionId: "d1" });
    dw.markDecisionsFiled(["d1"]);
    dw.markDecisionsLinked(["d1"]);
    dw.saveDecision({ content: "revised", decisionId: "d1" });
    const rows = dbMod
      .db()
      .prepare("SELECT content, filed_at, linked_at FROM mcp_decisions")
      .all() as Array<{ content: string; filed_at: string | null; linked_at: string | null }>;
    expect(rows.length).toBe(1);
    expect(rows[0].content).toBe("revised");
    expect(rows[0].filed_at).toBeNull();
    expect(rows[0].linked_at).toBeNull();
  });
});

describe("filing + linking selection", () => {
  it("renderDecisionNoteFiles(true) returns only unfiled; mark advances", () => {
    dw.saveDecision({ content: "a", decisionId: "k1", title: "A" });
    dw.saveDecision({ content: "b", decisionId: "k2", title: "B" });
    expect(dw.renderDecisionNoteFiles(true).size).toBe(2);
    dw.markDecisionsFiled(["k1"]);
    expect(dw.unfiledDecisionKeys()).toEqual(["k2"]);
    expect(dw.renderDecisionNoteFiles(false).size).toBe(2);
  });

  it("listUnlinkedDecisions / markDecisionsLinked", () => {
    dw.saveDecision({ content: "a", decisionId: "k1" });
    dw.saveDecision({ content: "b", decisionId: "k2" });
    expect(dw.listUnlinkedDecisions().map((r) => r.decision_key).sort()).toEqual(["k1", "k2"]);
    dw.markDecisionsLinked(["k1"]);
    expect(dw.listUnlinkedDecisions().map((r) => r.decision_key)).toEqual(["k2"]);
  });

  it("renderDecisionNoteFiles joins entry_entities per row via decisionPageId", () => {
    dw.saveDecision({ content: "a", decisionId: "k1", title: "A" });
    dbMod
      .db()
      .prepare(`INSERT OR IGNORE INTO notebooks(id, name, synced_at) VALUES('mcp-decisions', 'Decisions', datetime('now'))`)
      .run();
    dbMod
      .db()
      .prepare(`INSERT INTO pages(id, notebook_id, page_index, ocr_text) VALUES('mcp-decisions:k1', 'mcp-decisions', 0, '[Decision] A')`)
      .run();
    dbMod
      .db()
      .prepare(`INSERT INTO entry_entities(page_id, kind, name, name_norm) VALUES('mcp-decisions:k1', 'project', 'ETF', 'etf')`)
      .run();
    const md = [...dw.renderDecisionNoteFiles(false).values()][0];
    expect(md).toContain("## Connects to");
    expect(md).toContain("- [[ETF]]");
  });

  it("allDecisionFileNames maps every key to its note filename", () => {
    dw.saveDecision({ content: "a", decisionId: "k1", title: "A" });
    const row = dbMod
      .db()
      .prepare("SELECT decision_key, title, created_at FROM mcp_decisions WHERE decision_key='k1'")
      .get() as { decision_key: string; title: string | null; created_at: string };
    expect(dw.allDecisionFileNames().get("k1")).toBe(dw.decisionNoteFileName(row));
  });
});
