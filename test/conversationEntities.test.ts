import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Phase C: the "librarian" agent tags entities from exported conversations
// and keeps its own notes about an entity SEPARATE from the in-app
// Claude-composed diary bio (entity_wiki.summary). These pins lock:
//   - a synthetic pages row is created deterministically from an already
//     exported conversation, never from an agent-supplied id/date;
//   - unknown conversation_key is an error, not a silent no-op;
//   - tagging is idempotent (delete+reinsert) and marks the conversation linked;
//   - entity_conversation_notes and entity_wiki never interfere with each other.

type CwMod = typeof import("@/lib/conversationWiki");
type CeMod = typeof import("@/lib/conversationEntities");
type DbMod = typeof import("@/lib/db");
let cw: CwMod;
let ce: CeMod;
let dbMod: DbMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "conv-entities-"));
  cw = await import("@/lib/conversationWiki");
  ce = await import("@/lib/conversationEntities");
  dbMod = await import("@/lib/db");
  dbMod.db();
});

beforeEach(() => {
  dbMod.db().prepare("DELETE FROM mcp_conversations").run();
  dbMod.db().prepare("DELETE FROM entry_entities").run();
  dbMod.db().prepare("DELETE FROM entity_wiki").run();
  dbMod.db().prepare("DELETE FROM entity_conversation_notes").run();
  dbMod.db().prepare("DELETE FROM pages").run();
  dbMod.db().prepare("DELETE FROM notebooks").run();
  dbMod.db().prepare("DELETE FROM entity_aliases").run();
});

describe("ensureConversationPage", () => {
  it("returns null for an unknown conversation_key", () => {
    expect(ce.ensureConversationPage("nope")).toBeNull();
  });

  it("creates a deterministic page id and entry_date from the stored conversation", () => {
    cw.saveExportedConversation({
      content: "hello",
      title: "Trip",
      conversationId: "k1",
    });
    const page = ce.ensureConversationPage("k1");
    expect(page).not.toBeNull();
    expect(page!.pageId).toBe("mcp-conversations:k1");

    const row = dbMod
      .db()
      .prepare("SELECT ocr_text, entry_date, notebook_id FROM pages WHERE id = ?")
      .get(page!.pageId) as { ocr_text: string; entry_date: string; notebook_id: string };
    expect(row.notebook_id).toBe("mcp-conversations");
    expect(row.entry_date).toBe(page!.entryDate);
    // The placeholder is short and does NOT contain the full transcript.
    expect(row.ocr_text).toContain("Trip");
    expect(row.ocr_text).not.toContain("hello");
  });

  it("is idempotent — re-calling the same key updates the same row, no duplicates", () => {
    cw.saveExportedConversation({ content: "a", conversationId: "k1" });
    ce.ensureConversationPage("k1");
    ce.ensureConversationPage("k1");
    const count = (
      dbMod
        .db()
        .prepare("SELECT COUNT(*) AS c FROM pages WHERE notebook_id = 'mcp-conversations'")
        .get() as { c: number }
    ).c;
    expect(count).toBe(1);
  });
});

describe("tagConversationEntities", () => {
  it("errors on an unknown conversation_key instead of silently no-op'ing", () => {
    const result = ce.tagConversationEntities({
      conversationKey: "missing",
      entities: [{ kind: "person", name: "Jin" }],
    });
    expect("error" in result).toBe(true);
  });

  it("tags entities, marks the conversation linked, and an empty list is a valid completing call", () => {
    cw.saveExportedConversation({ content: "a", conversationId: "k1" });
    const result = ce.tagConversationEntities({
      conversationKey: "k1",
      entities: [
        { kind: "person", name: "Jin" },
        { kind: "place", name: "Suwon" },
      ],
    });
    expect("error" in result).toBe(false);
    expect((result as { tagged: number }).tagged).toBe(2);

    const linked = dbMod
      .db()
      .prepare("SELECT linked_at FROM mcp_conversations WHERE conversation_key = 'k1'")
      .get() as { linked_at: string | null };
    expect(linked.linked_at).not.toBeNull();

    // Re-tagging with an empty list REPLACES (not "keeps old") — deliberate,
    // since this caller is explicit, unlike analyzePending's noisy-classifier
    // empty-guard.
    const second = ce.tagConversationEntities({ conversationKey: "k1", entities: [] });
    expect((second as { tagged: number }).tagged).toBe(0);
    const count = (
      dbMod
        .db()
        .prepare("SELECT COUNT(*) AS c FROM entry_entities WHERE page_id = 'mcp-conversations:k1'")
        .get() as { c: number }
    ).c;
    expect(count).toBe(0);
  });

  it("caps entities at 30 and drops invalid kinds/empty names", () => {
    cw.saveExportedConversation({ content: "a", conversationId: "k1" });
    const many = Array.from({ length: 40 }, (_, i) => ({
      kind: "person",
      name: `Person ${i}`,
    }));
    many.push({ kind: "bogus" as "person", name: "X" });
    many.push({ kind: "person", name: "" });
    const result = ce.tagConversationEntities({ conversationKey: "k1", entities: many });
    expect((result as { tagged: number }).tagged).toBeLessThanOrEqual(30);
  });
});

describe("resolveConversationEntityName", () => {
  it("prefers an existing canonical casing over the agent's freshly supplied one", () => {
    // Seed an existing diary-sourced entity with a specific casing.
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

    const resolved = ce.resolveConversationEntityName("person", "JIN");
    expect(resolved.norm).toBe("jin");
    expect(resolved.name).toBe("Jin");
  });

  it("uses the agent's supplied casing when nothing exists yet", () => {
    const resolved = ce.resolveConversationEntityName("person", "New Person");
    expect(resolved.name).toBe("New Person");
  });
});

describe("entity_conversation_notes (ownership separation from entity_wiki)", () => {
  it("writing conversation notes never touches entity_wiki, and vice versa", () => {
    dbMod
      .db()
      .prepare(
        `INSERT INTO entity_wiki(kind, name_norm, name, summary, source_hash)
         VALUES('person', 'jin', 'Jin', 'diary bio text', 'hash1')`
      )
      .run();

    const result = ce.updateConversationNotes({
      kind: "person",
      name: "Jin",
      notes: "Talked about Jin's new job.",
    });
    expect("error" in result).toBe(false);

    // entity_wiki's row is untouched.
    const wiki = dbMod
      .db()
      .prepare("SELECT summary FROM entity_wiki WHERE kind='person' AND name_norm='jin'")
      .get() as { summary: string };
    expect(wiki.summary).toBe("diary bio text");

    // The combined reader surfaces both, from their own disjoint tables.
    const combined = ce.getCombinedEntityWiki("person", "jin");
    expect(combined.bio).toBe("diary bio text");
    expect(combined.conversation_notes).toBe("Talked about Jin's new job.");
  });

  it("rejects notes over the size cap", () => {
    const huge = "x".repeat(ce.MAX_ENTITY_NOTES_CHARS + 1);
    const result = ce.updateConversationNotes({ kind: "person", name: "Jin", notes: huge });
    expect("error" in result).toBe(true);
  });

  it("upserts by (kind, name_norm) — one row per entity, full-text replace", () => {
    ce.updateConversationNotes({ kind: "person", name: "Jin", notes: "first" });
    ce.updateConversationNotes({ kind: "person", name: "Jin", notes: "second" });
    const rows = dbMod
      .db()
      .prepare("SELECT notes FROM entity_conversation_notes WHERE kind='person' AND name_norm='jin'")
      .all() as Array<{ notes: string }>;
    expect(rows.length).toBe(1);
    expect(rows[0].notes).toBe("second");
  });
});

describe("recordLibrarianHeartbeat / librarianStatus", () => {
  it("stamps last-run and clears error on ok:true", () => {
    ce.recordLibrarianHeartbeat({ ok: false, error: "boom" });
    expect(ce.librarianStatus().lastRunError).toBe("boom");
    ce.recordLibrarianHeartbeat({ ok: true, note: "did 2 conversations" });
    const status = ce.librarianStatus();
    expect(status.lastRunError).toBeNull();
    expect(status.lastRunNote).toBe("did 2 conversations");
    expect(status.lastRunAt).not.toBeNull();
  });
});
