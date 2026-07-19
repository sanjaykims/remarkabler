import { db, setSetting } from "./db";
import { REFLECTIONS_NOTEBOOK_ID } from "./notes";
import {
  dateKey,
  getReflectionByKey,
  markReflectionsLinked,
  reflectionPageId,
} from "./reflectionWiki";
import { resolveConversationEntityName } from "./conversationEntities";

// Entity-tagging for standalone reflections (lib/reflectionWiki.ts) — a
// trimmed mirror of lib/conversationEntities.ts's page/tagging logic. Only
// the tagging path is duplicated here; note-writing (entity_conversation_notes)
// and the wiki read (get_entity_wiki) are already generic on (kind, name)
// with no conversation-specific coupling, so reflections reuse those as-is
// via lib/conversationEntities.ts — no reflection-specific equivalent needed.
//
// Same governing discipline as conversationEntities.ts: the caller decides
// CONTENT (which entities), this code decides DESTINATION (which row).

const KINDS = new Set(["person", "place", "project"]);
const MAX_ENTITIES_PER_CALL = 30;
const MAX_NAME_CHARS = 200;

function ensureReflectionsNotebook(): void {
  db()
    .prepare(
      `INSERT OR IGNORE INTO notebooks(id, name, synced_at)
       VALUES (?, ?, datetime('now'))`
    )
    .run(REFLECTIONS_NOTEBOOK_ID, "Reflections (subscription Claude)");
}

// One synthetic `pages` row per saved reflection, mirroring
// conversationEntities.ts's ensureConversationPage exactly (short bounded
// ocr_text placeholder, never the full reflection — that stays only in
// mcp_reflections.content — but non-empty, since related_entities' day-
// membership query requires it; no pages_fts row, no embedding).
export function ensureReflectionPage(
  reflectionKey: string
): { pageId: string; entryDate: string } | null {
  const refl = getReflectionByKey(reflectionKey);
  if (!refl) return null;
  ensureReflectionsNotebook();
  const pageId = reflectionPageId(reflectionKey);
  const entryDate = dateKey(refl.created_at);
  const label = (refl.title || reflectionKey).slice(0, 180);
  db()
    .prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text, entry_date)
       VALUES (?, ?, 0, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         ocr_text = excluded.ocr_text, entry_date = excluded.entry_date`
    )
    .run(pageId, REFLECTIONS_NOTEBOOK_ID, `[Reflection] ${label}`, entryDate);
  return { pageId, entryDate };
}

export type ReflectionEntityInput = { kind: string; name: string };

// Scoped replace of exactly one page's entity tags — mirrors
// tagConversationEntities. An explicit empty `entities` is a valid,
// completing call (nothing worth tagging), not an error.
export function tagReflectionEntities(input: {
  reflectionKey: string;
  entities: ReflectionEntityInput[];
}): { pageId: string; tagged: number } | { error: string } {
  const page = ensureReflectionPage(input.reflectionKey);
  if (!page) {
    return {
      error: `Unknown reflection_key "${input.reflectionKey}" — save it first with save_reflection.`,
    };
  }
  const entities = (input.entities || [])
    .slice(0, MAX_ENTITIES_PER_CALL)
    .map((e) => ({
      kind: String(e?.kind || "").trim().toLowerCase(),
      name: String(e?.name || "").trim().slice(0, MAX_NAME_CHARS),
    }))
    .filter((e) => KINDS.has(e.kind) && e.name.length > 0);

  const delEntities = db().prepare(`DELETE FROM entry_entities WHERE page_id = ?`);
  const insEntity = db().prepare(
    `INSERT OR IGNORE INTO entry_entities(page_id, kind, name, name_norm) VALUES (?, ?, ?, ?)`
  );
  db().transaction(() => {
    delEntities.run(page.pageId);
    for (const e of entities) {
      const resolved = resolveConversationEntityName(e.kind, e.name);
      insEntity.run(page.pageId, e.kind, resolved.name, resolved.norm);
    }
  })();
  markReflectionsLinked([input.reflectionKey]);
  setSetting("librarian_last_write_at", new Date().toISOString());
  return { pageId: page.pageId, tagged: entities.length };
}
