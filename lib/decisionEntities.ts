import { db, setSetting } from "./db";
import { DECISIONS_NOTEBOOK_ID } from "./notes";
import {
  dateKey,
  getDecisionByKey,
  markDecisionsLinked,
  decisionPageId,
} from "./decisionWiki";
import { resolveConversationEntityName } from "./conversationEntities";

// Entity-tagging for Decision Records (lib/decisionWiki.ts) — a trimmed
// mirror of lib/reflectionEntities.ts's page/tagging logic. Only the tagging
// path is duplicated here; note-writing (entity_conversation_notes) and the
// wiki read (get_entity_wiki) are already generic on (kind, name), so
// decisions reuse those as-is via lib/conversationEntities.ts.
//
// Same governing discipline: the caller decides CONTENT (which entities),
// this code decides DESTINATION (which row).

const KINDS = new Set(["person", "place", "project"]);
const MAX_ENTITIES_PER_CALL = 30;
const MAX_NAME_CHARS = 200;

function ensureDecisionsNotebook(): void {
  db()
    .prepare(
      `INSERT OR IGNORE INTO notebooks(id, name, synced_at)
       VALUES (?, ?, datetime('now'))`
    )
    .run(DECISIONS_NOTEBOOK_ID, "Decisions (subscription Claude)");
}

// One synthetic `pages` row per saved decision, mirroring
// reflectionEntities.ts's ensureReflectionPage exactly (short bounded
// ocr_text placeholder, never the full decision — that stays only in
// mcp_decisions.content — but non-empty, since related_entities' day-
// membership query requires it; no pages_fts row, no embedding).
export function ensureDecisionPage(
  decisionKey: string
): { pageId: string; entryDate: string } | null {
  const dec = getDecisionByKey(decisionKey);
  if (!dec) return null;
  ensureDecisionsNotebook();
  const pageId = decisionPageId(decisionKey);
  const entryDate = dateKey(dec.created_at);
  const label = (dec.title || decisionKey).slice(0, 180);
  db()
    .prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text, entry_date)
       VALUES (?, ?, 0, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         ocr_text = excluded.ocr_text, entry_date = excluded.entry_date`
    )
    .run(pageId, DECISIONS_NOTEBOOK_ID, `[Decision] ${label}`, entryDate);
  return { pageId, entryDate };
}

export type DecisionEntityInput = { kind: string; name: string };

// Scoped replace of exactly one page's entity tags — mirrors
// tagReflectionEntities. An explicit empty `entities` is a valid, completing
// call (nothing worth tagging), not an error.
export function tagDecisionEntities(input: {
  decisionKey: string;
  entities: DecisionEntityInput[];
}): { pageId: string; tagged: number } | { error: string } {
  const page = ensureDecisionPage(input.decisionKey);
  if (!page) {
    return {
      error: `Unknown decision_key "${input.decisionKey}" — save it first with save_decision.`,
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
  markDecisionsLinked([input.decisionKey]);
  setSetting("librarian_last_write_at", new Date().toISOString());
  return { pageId: page.pageId, tagged: entities.length };
}
