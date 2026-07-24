import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// entity_wiki (the in-app Claude-composed diary bio) must stay DIARY-ONLY —
// the mcp-conversations, mcp-reflections, and mcp-decisions synthetic notebooks are
// bookkeeping devices, not real diary entries, so their pages must never
// feed into a Claude call here even when an entity is ALSO mentioned in the
// real diary. This is a pre-existing exclusion (lib/entityWiki.ts's private
// candidates()/mentions()) that had no test coverage before this file, for
// those synthetic notebooks.

type DbMod = typeof import("@/lib/db");
type EwMod = typeof import("@/lib/entityWiki");
type ClaudeMod = typeof import("@/lib/claude");

let dbMod: DbMod;
let ew: EwMod;
let claudeMod: ClaudeMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "entity-wiki-exclude-"));
  process.env.ANTHROPIC_API_KEY = "test-key";
  dbMod = await import("@/lib/db");
  ew = await import("@/lib/entityWiki");
  claudeMod = await import("@/lib/claude");
  dbMod.db();
});

beforeEach(() => {
  dbMod.db().prepare("DELETE FROM entry_entities").run();
  dbMod.db().prepare("DELETE FROM entity_wiki").run();
  dbMod.db().prepare("DELETE FROM pages").run();
  dbMod.db().prepare("DELETE FROM notebooks").run();
  vi.restoreAllMocks();
});

function seedNotebookPage(notebookId: string, pageId: string, text: string, entryDate?: string) {
  dbMod
    .db()
    .prepare(`INSERT OR IGNORE INTO notebooks(id, name, synced_at) VALUES(?, ?, datetime('now'))`)
    .run(notebookId, notebookId);
  dbMod
    .db()
    .prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text, entry_date) VALUES(?, ?, 0, ?, ?)`
    )
    .run(pageId, notebookId, text, entryDate ?? null);
  dbMod
    .db()
    .prepare(
      `INSERT INTO entry_entities(page_id, kind, name, name_norm) VALUES(?, 'person', 'Jin', 'jin')`
    )
    .run(pageId);
}

describe("refreshEntityWiki excludes mcp-conversations AND mcp-reflections pages", () => {
  it("only sends the real diary excerpt to Claude, even when the entity is also tagged on a conversation and a reflection page", async () => {
    seedNotebookPage("diary-1", "d1", "Real diary text about Jin.", "2026-01-01");
    seedNotebookPage("mcp-conversations", "mcp-conversations:c1", "[Conversation] should never reach Claude");
    seedNotebookPage("mcp-reflections", "mcp-reflections:r1", "[Reflection] should never reach Claude");

    const spy = vi.spyOn(claudeMod, "composeEntityWiki").mockResolvedValue("a written bio");
    const result = await ew.refreshEntityWiki();

    expect(result.generated).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
    const excerpts = spy.mock.calls[0][2] as Array<{ text: string }>;
    const allText = excerpts.map((e) => e.text).join(" ");
    expect(allText).toContain("Real diary text about Jin.");
    expect(allText).not.toContain("should never reach Claude");
  });

  it("an entity tagged ONLY on a conversation/reflection page never triggers a Claude call at all", async () => {
    seedNotebookPage("mcp-conversations", "mcp-conversations:c1", "[Conversation] Jin only here");
    seedNotebookPage("mcp-reflections", "mcp-reflections:r1", "[Reflection] Jin only here too");

    const spy = vi.spyOn(claudeMod, "composeEntityWiki").mockResolvedValue("should not be called");
    const result = await ew.refreshEntityWiki();

    expect(result.generated).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });
});
