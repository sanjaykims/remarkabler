import { db, getSetting, setSetting, clearSetting } from "./db";
import { CONVERSATIONS_NOTEBOOK_ID } from "./notes";
import { applyEntityAlias } from "./entityMerge";
import { normaliseEntityName } from "./mind";
import {
  dateKey,
  getConversationByKey,
  markConversationsLinked,
} from "./conversationWiki";
import { getEntityWikiSummary } from "./entityWiki";

// Phase C: the "librarian" agent — a recurring, subscription-billed Claude
// Code session (not this app's own ANTHROPIC_API_KEY) — links exported
// conversations (lib/conversationWiki.ts) into the diary's existing entity
// graph/wiki. This module holds its data layer; the MCP tool surface lives
// in lib/mcp.ts, gated behind wikiLinkingEnabled().
//
// Governing discipline (same as export_conversation): the agent decides
// CONTENT, this code decides DESTINATION. Every write below resolves its
// own target row deterministically from inputs it validates itself — never
// from an agent-supplied id/path.

export function wikiLinkingEnabled(): boolean {
  return process.env.MCP_ALLOW_WIKI_LINKING === "true";
}

const KINDS = new Set(["person", "place", "project"]);
const MAX_ENTITIES_PER_CALL = 30;
const MAX_NAME_CHARS = 200;
export const MAX_ENTITY_NOTES_CHARS = 20_000;

function ensureConversationsNotebook(): void {
  db()
    .prepare(
      `INSERT OR IGNORE INTO notebooks(id, name, synced_at)
       VALUES (?, ?, datetime('now'))`
    )
    .run(CONVERSATIONS_NOTEBOOK_ID, "Conversations (subscription Claude)");
}

// One synthetic `pages` row per exported conversation, so entity tags flow
// through the same entry_entities/pages pipeline diary content uses. The
// conversation must already exist (export_conversation must run first) —
// the agent supplies only a key, never a page id or date. ocr_text is a
// short bounded placeholder, NOT the full transcript (that stays only in
// mcp_conversations.content) — but it must be non-empty, because
// related_entities' day-membership query requires non-empty ocr_text to
// build day memberships. No pages_fts row, no embedding: this page is never
// meant to be full-text/semantically searched, only tagged.
export function ensureConversationPage(
  conversationKey: string
): { pageId: string; entryDate: string } | null {
  const convo = getConversationByKey(conversationKey);
  if (!convo) return null;
  ensureConversationsNotebook();
  const pageId = `${CONVERSATIONS_NOTEBOOK_ID}:${conversationKey}`;
  const entryDate = dateKey(convo.created_at);
  const label = (convo.title || conversationKey).slice(0, 180);
  db()
    .prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text, entry_date)
       VALUES (?, ?, 0, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         ocr_text = excluded.ocr_text, entry_date = excluded.entry_date`
    )
    .run(pageId, CONVERSATIONS_NOTEBOOK_ID, `[Conversation] ${label}`, entryDate);
  return { pageId, entryDate };
}

// Normalize + fold through entity_aliases (same as every other entity
// writer/reader), then prefer whatever canonical casing ALREADY exists for
// this identity (from a diary page or an earlier tagging call) over the
// agent's freshly supplied casing, so repeated tags across separate agent
// runs converge on one casing instead of forking it.
export function resolveConversationEntityName(
  kind: string,
  rawName: string
): { norm: string; name: string } {
  const aliased = applyEntityAlias(kind, normaliseEntityName(rawName), rawName);
  const existing = db()
    .prepare(
      `SELECT MIN(name) AS name FROM entry_entities WHERE kind = ? AND name_norm = ?`
    )
    .get(kind, aliased.norm) as { name: string | null } | undefined;
  return { norm: aliased.norm, name: existing?.name || aliased.name };
}

export type ConversationEntityInput = { kind: string; name: string };

// Scoped replace of exactly one page's entity tags — the same delete+reinsert
// shape lib/mind.ts's analyzePending already uses on this table, just newly
// reachable from the librarian. An explicit empty `entities` is a valid,
// completing call (the agent decided nothing was worth tagging), not an
// error — unlike analyzePending's noisy-classifier guard, this caller is
// deliberate, so there's no "keep the old set" fallback here.
export function tagConversationEntities(input: {
  conversationKey: string;
  entities: ConversationEntityInput[];
}): { pageId: string; tagged: number } | { error: string } {
  const page = ensureConversationPage(input.conversationKey);
  if (!page) {
    return {
      error: `Unknown conversation_key "${input.conversationKey}" — export it first with export_conversation.`,
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
  markConversationsLinked([input.conversationKey]);
  setSetting("librarian_last_write_at", new Date().toISOString());
  return { pageId: page.pageId, tagged: entities.length };
}

// --- Ownership-separated wiki content ("## Recent conversations") --------
// A table disjoint from entity_wiki (the in-app Claude-composed diary bio),
// so the librarian and the in-app content-addressed regen (lib/entityWiki.ts)
// can never write the same field and clobber each other.

export function getConversationNotes(kind: string, norm: string): string | null {
  try {
    const row = db()
      .prepare(
        `SELECT notes FROM entity_conversation_notes WHERE kind = ? AND name_norm = ?`
      )
      .get(kind, norm) as { notes: string } | undefined;
    return row?.notes ?? null;
  } catch {
    return null;
  }
}

export function allConversationNotesRows(): Array<{
  kind: string;
  name_norm: string;
  name: string;
  notes: string;
}> {
  try {
    return db()
      .prepare(`SELECT kind, name_norm, name, notes FROM entity_conversation_notes`)
      .all() as Array<{ kind: string; name_norm: string; name: string; notes: string }>;
  } catch {
    return []; // table missing on an older DB — stubs just render without this section
  }
}

export function updateConversationNotes(input: {
  kind: string;
  name: string;
  notes: string;
}): { kind: string; name: string } | { error: string } {
  const kind = String(input.kind || "").trim().toLowerCase();
  if (!KINDS.has(kind)) {
    return { error: "kind must be one of: person, place, project." };
  }
  const rawName = String(input.name || "").trim();
  if (!rawName) return { error: "name is required." };
  const notes = String(input.notes || "").trim();
  if (!notes) return { error: "notes is required." };
  if (notes.length > MAX_ENTITY_NOTES_CHARS) {
    return {
      error: `notes too large — ${notes.length} chars, max ${MAX_ENTITY_NOTES_CHARS}.`,
    };
  }
  const resolved = resolveConversationEntityName(kind, rawName);
  db()
    .prepare(
      `INSERT INTO entity_conversation_notes(kind, name_norm, name, notes, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(kind, name_norm) DO UPDATE SET
         name = excluded.name, notes = excluded.notes, updated_at = excluded.updated_at`
    )
    .run(kind, resolved.norm, resolved.name, notes);
  setSetting("librarian_last_write_at", new Date().toISOString());
  return { kind, name: resolved.name };
}

// The combined read the librarian needs before deciding whether to append or
// rewrite: the in-app diary bio plus its own prior notes for the same entity.
export function getCombinedEntityWiki(
  kind: string,
  rawName: string
): { kind: string; name: string; bio: string | null; conversation_notes: string | null } {
  const { norm, name } = resolveConversationEntityName(kind, rawName);
  return {
    kind,
    name,
    bio: getEntityWikiSummary(kind, norm),
    conversation_notes: getConversationNotes(kind, norm),
  };
}

// --- Heartbeat (mirrors lib/backup.ts's backup_last_at/attempt/error) ----

export function recordLibrarianHeartbeat(input: {
  ok?: boolean;
  note?: string;
  error?: string;
}): { ok: boolean } {
  const ok = input.ok !== false;
  setSetting("librarian_last_run_at", new Date().toISOString());
  if (ok) {
    clearSetting("librarian_last_run_error");
    if (input.note) {
      setSetting("librarian_last_run_note", String(input.note).slice(0, 300));
    }
  } else {
    setSetting(
      "librarian_last_run_error",
      String(input.error || "unknown error").slice(0, 500)
    );
  }
  return { ok };
}

export type LibrarianStatus = {
  configured: boolean;
  lastRunAt: string | null;
  lastRunNote: string | null;
  lastRunError: string | null;
  lastWriteAt: string | null;
};

export function librarianStatus(): LibrarianStatus {
  return {
    configured: wikiLinkingEnabled(),
    lastRunAt: getSetting("librarian_last_run_at"),
    lastRunNote: getSetting("librarian_last_run_note"),
    lastRunError: getSetting("librarian_last_run_error"),
    lastWriteAt: getSetting("librarian_last_write_at"),
  };
}
