import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Standalone AI-written reflections (MCP save_reflection tool) are stored
// and filed into the Obsidian vault as one Markdown note each — deliberately
// mirroring test/conversationWiki.test.ts's shape, since lib/reflectionWiki.ts
// mirrors lib/conversationWiki.ts's shape. These pins lock:
//   - the note preserves the full content unchanged;
//   - it's frontmattered as claude-reflection, never claude-conversation;
//   - upsert-by-key keeps ONE record per reflection and re-files on update;
//   - filing selects only unfiled rows and marks them after upload.

type Mod = typeof import("@/lib/reflectionWiki");
type DbMod = typeof import("@/lib/db");
let rw: Mod;
let dbMod: DbMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "refl-wiki-"));
  rw = await import("@/lib/reflectionWiki");
  dbMod = await import("@/lib/db");
  dbMod.db();
});

beforeEach(() => {
  dbMod.db().prepare("DELETE FROM mcp_reflections").run();
});

describe("renderReflectionNote (verbatim, distinct type from conversations)", () => {
  it("preserves the full content unchanged and adds frontmatter", () => {
    const content = "You're a builder by nature, but a specific kind...";
    const md = rw.renderReflectionNote({
      title: "Who am I, and am I a good person?",
      content,
      created_at: "2026-07-19 14:41:00",
    });
    // Full content present verbatim — nothing dropped or shortened.
    expect(md).toContain(content);
    expect(md).toContain('title: "Who am I, and am I a good person?"');
    expect(md).toContain("type: claude-reflection");
    expect(md).not.toContain("type: claude-conversation");
    expect(md).toContain('date: "2026-07-19"');
  });

  it("filenames are Reflections/<date>-<slug>-<hash>.md and sanitized", () => {
    const f = rw.reflectionNoteFileName({
      reflection_key: "k1",
      title: "Who am I / really?",
      created_at: "2026-07-19 14:41:00",
    });
    expect(f).toMatch(/^Reflections\/2026-07-19-Who am I really-[0-9a-f]{6}\.md$/);
  });

  it("two same-title, same-day reflections get DISTINCT files (no collision)", () => {
    const a = rw.reflectionNoteFileName({
      reflection_key: "keyA",
      title: "Reflection",
      created_at: "2026-07-19 09:00:00",
    });
    const b = rw.reflectionNoteFileName({
      reflection_key: "keyB",
      title: "Reflection",
      created_at: "2026-07-19 20:00:00",
    });
    expect(a).not.toBe(b);
    // ...and the same key always maps to the same file (re-save overwrites its own).
    expect(a).toBe(
      rw.reflectionNoteFileName({ reflection_key: "keyA", title: "Reflection", created_at: "2026-07-19 09:00:00" })
    );
  });

  it("sanitizeFileName strips path/link-hostile characters", () => {
    expect(rw.sanitizeFileName("a[b]|c/d:e*f?\"g<h>")).not.toMatch(/[[\]|/\\:*?"<>]/);
  });
});

describe("saveReflection (upsert, add-only)", () => {
  it("inserts a new row, generates a key when none given", () => {
    const { key } = rw.saveReflection({ content: "hello", title: "Hi" });
    expect(key).toMatch(/^refl_/);
    expect(rw.unfiledReflectionCount()).toBe(1);
    const row = dbMod
      .db()
      .prepare("SELECT content, title, filed_at FROM mcp_reflections WHERE reflection_key = ?")
      .get(key) as { content: string; title: string; filed_at: string | null };
    expect(row.content).toBe("hello");
    expect(row.title).toBe("Hi");
    expect(row.filed_at).toBeNull();
  });

  it("re-saving the same reflection_id UPDATES one record and re-files", () => {
    rw.saveReflection({ content: "draft 1", reflectionId: "refl-1" });
    rw.markReflectionsFiled(["refl-1"]); // simulate it was filed
    expect(rw.unfiledReflectionCount()).toBe(0);

    // Re-saved with the same id -> same row, new content, filed_at cleared
    // so it re-files.
    rw.saveReflection({ content: "revised draft", reflectionId: "refl-1" });
    const rows = dbMod.db().prepare("SELECT content, filed_at FROM mcp_reflections").all() as Array<{
      content: string;
      filed_at: string | null;
    }>;
    expect(rows.length).toBe(1); // ONE record, not two
    expect(rows[0].content).toBe("revised draft");
    expect(rows[0].filed_at).toBeNull();
    expect(rw.unfiledReflectionCount()).toBe(1);
  });
});

describe("filing selection", () => {
  it("renderReflectionNoteFiles(true) returns only unfiled; mark advances", () => {
    rw.saveReflection({ content: "a", reflectionId: "k1", title: "A" });
    rw.saveReflection({ content: "b", reflectionId: "k2", title: "B" });
    expect(rw.renderReflectionNoteFiles(true).size).toBe(2);
    expect(rw.unfiledReflectionKeys().sort()).toEqual(["k1", "k2"]);

    rw.markReflectionsFiled(["k1"]);
    expect(rw.unfiledReflectionKeys()).toEqual(["k2"]);
    expect(rw.renderReflectionNoteFiles(true).size).toBe(1);
    // ...but a full render still has both.
    expect(rw.renderReflectionNoteFiles(false).size).toBe(2);
  });
});
