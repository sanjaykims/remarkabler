import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Entity-tagging for reflections (lib/reflectionEntities.ts) — a trimmed
// mirror of lib/conversationEntities.ts's page/tagging logic (see
// test/conversationEntities.test.ts for the conversation-side pins). These
// pin:
//   - a synthetic pages row is created deterministically from an already
//     saved reflection, never from an agent/caller-supplied id/date;
//   - unknown reflection_key is an error, not a silent no-op;
//   - tagging is idempotent (delete+reinsert) and marks the reflection linked;
//   - note-writing/wiki-read stay on the shared, already-generic
//     lib/conversationEntities.ts tools — no reflection-specific duplicates.

type RwMod = typeof import("@/lib/reflectionWiki");
type ReMod = typeof import("@/lib/reflectionEntities");
type CeMod = typeof import("@/lib/conversationEntities");
type DbMod = typeof import("@/lib/db");
let rw: RwMod;
let re: ReMod;
let ce: CeMod;
let dbMod: DbMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "refl-entities-"));
  rw = await import("@/lib/reflectionWiki");
  re = await import("@/lib/reflectionEntities");
  ce = await import("@/lib/conversationEntities");
  dbMod = await import("@/lib/db");
  dbMod.db();
});

beforeEach(() => {
  dbMod.db().prepare("DELETE FROM mcp_reflections").run();
  dbMod.db().prepare("DELETE FROM entry_entities").run();
  dbMod.db().prepare("DELETE FROM entity_conversation_notes").run();
  dbMod.db().prepare("DELETE FROM pages").run();
  dbMod.db().prepare("DELETE FROM notebooks").run();
  dbMod.db().prepare("DELETE FROM entity_aliases").run();
});

describe("ensureReflectionPage", () => {
  it("returns null for an unknown reflection_key", () => {
    expect(re.ensureReflectionPage("nope")).toBeNull();
  });

  it("creates a deterministic page id and entry_date from the stored reflection", () => {
    rw.saveReflection({ content: "hello", title: "Who am I", reflectionId: "k1" });
    const page = re.ensureReflectionPage("k1");
    expect(page).not.toBeNull();
    expect(page!.pageId).toBe("mcp-reflections:k1");

    const row = dbMod
      .db()
      .prepare("SELECT ocr_text, entry_date, notebook_id FROM pages WHERE id = ?")
      .get(page!.pageId) as { ocr_text: string; entry_date: string; notebook_id: string };
    expect(row.notebook_id).toBe("mcp-reflections");
    expect(row.entry_date).toBe(page!.entryDate);
    // The placeholder is short and does NOT contain the full reflection.
    expect(row.ocr_text).toContain("Who am I");
    expect(row.ocr_text).not.toContain("hello");
  });

  it("is idempotent — re-calling the same key updates the same row, no duplicates", () => {
    rw.saveReflection({ content: "a", reflectionId: "k1" });
    re.ensureReflectionPage("k1");
    re.ensureReflectionPage("k1");
    const count = (
      dbMod
        .db()
        .prepare("SELECT COUNT(*) AS c FROM pages WHERE notebook_id = 'mcp-reflections'")
        .get() as { c: number }
    ).c;
    expect(count).toBe(1);
  });
});

describe("tagReflectionEntities", () => {
  it("errors on an unknown reflection_key instead of silently no-op'ing", () => {
    const result = re.tagReflectionEntities({
      reflectionKey: "missing",
      entities: [{ kind: "person", name: "Jin" }],
    });
    expect("error" in result).toBe(true);
  });

  it("tags entities, marks the reflection linked, and an empty list is a valid completing call", () => {
    rw.saveReflection({ content: "a", reflectionId: "k1" });
    const result = re.tagReflectionEntities({
      reflectionKey: "k1",
      entities: [
        { kind: "person", name: "Jin" },
        { kind: "place", name: "Suwon" },
      ],
    });
    expect("error" in result).toBe(false);
    expect((result as { tagged: number }).tagged).toBe(2);

    const linked = dbMod
      .db()
      .prepare("SELECT linked_at FROM mcp_reflections WHERE reflection_key = 'k1'")
      .get() as { linked_at: string | null };
    expect(linked.linked_at).not.toBeNull();

    // Re-tagging with an empty list REPLACES (not "keeps old") — same
    // deliberate semantics as tagConversationEntities.
    const second = re.tagReflectionEntities({ reflectionKey: "k1", entities: [] });
    expect((second as { tagged: number }).tagged).toBe(0);
    const count = (
      dbMod
        .db()
        .prepare("SELECT COUNT(*) AS c FROM entry_entities WHERE page_id = 'mcp-reflections:k1'")
        .get() as { c: number }
    ).c;
    expect(count).toBe(0);
  });

  it("caps entities at 30 and drops invalid kinds/empty names", () => {
    rw.saveReflection({ content: "a", reflectionId: "k1" });
    const many = Array.from({ length: 40 }, (_, i) => ({
      kind: "person",
      name: `Person ${i}`,
    }));
    many.push({ kind: "bogus" as "person", name: "X" });
    many.push({ kind: "person", name: "" });
    const result = re.tagReflectionEntities({ reflectionKey: "k1", entities: many });
    expect((result as { tagged: number }).tagged).toBeLessThanOrEqual(30);
  });

  it("shares entity name resolution with conversations — same casing wins for both", () => {
    // Seed a diary-sourced canonical casing.
    dbMod
      .db()
      .prepare(
        `INSERT INTO notebooks(id, name, synced_at) VALUES('diary-1', 'Diary', datetime('now'))`
      )
      .run();
    dbMod
      .db()
      .prepare(`INSERT INTO pages(id, notebook_id, page_index, ocr_text) VALUES('p1', 'diary-1', 0, 'text')`)
      .run();
    dbMod
      .db()
      .prepare(
        `INSERT INTO entry_entities(page_id, kind, name, name_norm) VALUES('p1', 'person', 'Jin', 'jin')`
      )
      .run();

    rw.saveReflection({ content: "a", reflectionId: "k1" });
    re.tagReflectionEntities({ reflectionKey: "k1", entities: [{ kind: "person", name: "JIN" }] });
    const row = dbMod
      .db()
      .prepare("SELECT name FROM entry_entities WHERE page_id='mcp-reflections:k1'")
      .get() as { name: string };
    expect(row.name).toBe("Jin");
  });

  it("get_entity_wiki's generic notes tool works for reflection-sourced entities too", () => {
    const result = ce.updateConversationNotes({
      kind: "person",
      name: "Jin",
      notes: "Mentioned in a reflection.",
    });
    expect("error" in result).toBe(false);
    const combined = ce.getCombinedEntityWiki("person", "jin");
    expect(combined.conversation_notes).toBe("Mentioned in a reflection.");
  });
});
