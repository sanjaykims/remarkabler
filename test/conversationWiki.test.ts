import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Phase B: full subscription-conversation transcripts are stored VERBATIM and
// filed into the Obsidian vault as one Markdown note each. These pins lock:
//   - the note preserves the full content unchanged (no summarizing);
//   - upsert-by-key keeps ONE record per conversation and re-files on update;
//   - filing selects only unfiled rows and marks them after upload.

type Mod = typeof import("@/lib/conversationWiki");
type DbMod = typeof import("@/lib/db");
let cw: Mod;
let dbMod: DbMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "conv-wiki-"));
  cw = await import("@/lib/conversationWiki");
  dbMod = await import("@/lib/db");
  dbMod.db();
});

beforeEach(() => {
  dbMod.db().prepare("DELETE FROM mcp_conversations").run();
});

describe("renderConversationNote (verbatim, no summarizing)", () => {
  it("preserves the full content unchanged and adds frontmatter", () => {
    const content = "User: what did I do?\n\nClaude: You wrote about Jeju.\n\nUser: thanks!";
    const md = cw.renderConversationNote({
      title: "Jeju recap",
      content,
      created_at: "2026-07-18 09:30:00",
    });
    // Full content present verbatim — nothing dropped or shortened.
    expect(md).toContain(content);
    expect(md).toContain("title: \"Jeju recap\"");
    expect(md).toContain("type: claude-conversation");
    expect(md).toContain("date: \"2026-07-18\"");
  });

  it("filenames are Conversations/<date>-<slug>-<hash>.md and sanitized", () => {
    const f = cw.conversationNoteFileName({
      conversation_key: "k1",
      title: "Trip / plan: Suwon?",
      created_at: "2026-07-18 09:30:00",
    });
    expect(f).toMatch(/^Conversations\/2026-07-18-Trip plan Suwon-[0-9a-f]{6}\.md$/);
  });

  it("two same-title, same-day conversations get DISTINCT files (no collision)", () => {
    const a = cw.conversationNoteFileName({
      conversation_key: "keyA",
      title: "Chat",
      created_at: "2026-07-18 09:00:00",
    });
    const b = cw.conversationNoteFileName({
      conversation_key: "keyB",
      title: "Chat",
      created_at: "2026-07-18 20:00:00",
    });
    expect(a).not.toBe(b);
    // ...and the same key always maps to the same file (re-export overwrites its own).
    expect(a).toBe(
      cw.conversationNoteFileName({ conversation_key: "keyA", title: "Chat", created_at: "2026-07-18 09:00:00" })
    );
  });

  it("sanitizeFileName strips path/link-hostile characters", () => {
    expect(cw.sanitizeFileName("a[b]|c/d:e*f?\"g<h>")).not.toMatch(/[[\]|/\\:*?"<>]/);
  });
});

describe("saveExportedConversation (upsert, add-only)", () => {
  it("inserts a new row, generates a key when none given", () => {
    const { key } = cw.saveExportedConversation({ content: "hello", title: "Hi" });
    expect(key).toMatch(/^conv_/);
    expect(cw.unfiledConversationCount()).toBe(1);
    const row = dbMod
      .db()
      .prepare("SELECT content, title, filed_at FROM mcp_conversations WHERE conversation_key = ?")
      .get(key) as { content: string; title: string; filed_at: string | null };
    expect(row.content).toBe("hello");
    expect(row.title).toBe("Hi");
    expect(row.filed_at).toBeNull();
  });

  it("re-exporting the same conversation_id UPDATES one record and re-files", () => {
    cw.saveExportedConversation({ content: "turn 1", conversationId: "sess-1" });
    cw.markConversationsFiled(["sess-1"]); // simulate it was filed
    expect(cw.unfiledConversationCount()).toBe(0);

    // Growing conversation re-exported with the same id → same row, new content,
    // filed_at cleared so it re-files.
    cw.saveExportedConversation({ content: "turn 1\nturn 2", conversationId: "sess-1" });
    const rows = dbMod.db().prepare("SELECT content, filed_at FROM mcp_conversations").all() as Array<{
      content: string;
      filed_at: string | null;
    }>;
    expect(rows.length).toBe(1); // ONE record, not two
    expect(rows[0].content).toBe("turn 1\nturn 2");
    expect(rows[0].filed_at).toBeNull();
    expect(cw.unfiledConversationCount()).toBe(1);
  });
});

describe("filing selection", () => {
  it("renderConversationNoteFiles(true) returns only unfiled; mark advances", () => {
    cw.saveExportedConversation({ content: "a", conversationId: "k1", title: "A" });
    cw.saveExportedConversation({ content: "b", conversationId: "k2", title: "B" });
    expect(cw.renderConversationNoteFiles(true).size).toBe(2);
    expect(cw.unfiledConversationKeys().sort()).toEqual(["k1", "k2"]);

    cw.markConversationsFiled(["k1"]);
    expect(cw.unfiledConversationKeys()).toEqual(["k2"]);
    expect(cw.renderConversationNoteFiles(true).size).toBe(1);
    // ...but a full render still has both.
    expect(cw.renderConversationNoteFiles(false).size).toBe(2);
  });
});
