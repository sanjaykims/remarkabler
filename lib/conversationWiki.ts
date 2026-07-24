import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { CONVERSATIONS_NOTEBOOK_ID } from "@/lib/notes";
import { entityStubFileName } from "@/lib/diaryExport";

// Phase B: full subscription-conversation transcripts, exported by the MCP
// `export_conversation` write tool (lib/mcp.ts) and filed VERBATIM (no
// compression) into the Obsidian/Dropbox vault as one Markdown note each. This
// module is the store + the note renderer; the Dropbox upload is wired in
// lib/dropbox.ts and fired from the maintenance sweep (lib/notes.ts).
//
// Security note: content here is an EXTERNAL conversation from subscription-
// Claude — treat it as untrusted. It is stored + rendered as verbatim quoted
// text and never executed or interpreted. Filing is deterministic (no API
// call), so there is no "librarian gets prompt-injected" surface.

export const CONVERSATION_FOLDER = "Conversations";
// Hard cap on one export's size — prevents a runaway/abusive transcript from
// bloating the DB or the vault. ~500 KB of text is a very long conversation.
export const MAX_CONVERSATION_CHARS = 500_000;

export type ExportedConversationRow = {
  conversation_key: string;
  title: string | null;
  content: string;
  created_at: string;
};

// Filesystem-safe basename fragment (mirrors diaryExportDb's sanitize intent).
export function sanitizeFileName(s: string): string {
  return s
    .replace(/[[\]|]/g, "")
    .replace(/[/\\:*?"<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

// "YYYY-MM-DD" from a sqlite datetime ("YYYY-MM-DD HH:MM:SS") or ISO string.
// Exported for lib/conversationEntities.ts, which needs the same day-key
// logic for the synthetic conversation page's entry_date.
export function dateKey(createdAt: string): string {
  const m = String(createdAt).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "undated";
}

function yamlQuote(v: string): string {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ")}"`;
}

// Conversations/YYYY-MM-DD-<slug>-<keyhash>.md — one note per conversation.
// The 6-char hash of conversation_key guarantees UNIQUENESS (two conversations
// with the same title on the same day must not collide onto one file and lose
// one) while staying STABLE per key (re-exporting a conversation overwrites its
// own note, never a sibling's).
export function conversationNoteFileName(row: {
  conversation_key: string;
  title: string | null;
  created_at: string;
}): string {
  const base = sanitizeFileName(row.title || "") || "conversation";
  const keyHash = createHash("sha256")
    .update(row.conversation_key)
    .digest("hex")
    .slice(0, 6);
  return `${CONVERSATION_FOLDER}/${dateKey(row.created_at)}-${base}-${keyHash}.md`;
}

// The synthetic pages.id lib/conversationEntities.ts writes an entity-tagged
// page under. Extracted here (not left inline there) so lib/entityTagging.ts
// and Part C's stub back-link lookup can derive the same id without
// depending on the Phase C module.
export function conversationPageId(conversationKey: string): string {
  return `${CONVERSATIONS_NOTEBOOK_ID}:${conversationKey}`;
}

// The Markdown note: frontmatter + the full transcript verbatim. Content is
// emitted as-is (it is already the model's own formatting) but never as
// executable directives — it's plain body text under a heading.
//
// `entities` (kind+name, from entry_entities once this conversation has been
// tagged — lib/entityTagging.ts / lib/conversationEntities.ts) renders as a
// "## Connects to" section of bare-basename [[Name]] wikilinks, matching the
// vault's existing bare `[[YYYY-MM-DD]]`/`[[Name]]` convention (no folder
// prefix — Obsidian resolves wikilinks by basename vault-wide). Omitted
// entirely when empty (tagging never ran, or found nothing) — no new flag
// needed, this just degrades to the note's previous shape.
export function renderConversationNote(
  row: { title: string | null; content: string; created_at: string },
  entities: Array<{ kind: string; name: string }> = []
): string {
  const title = row.title?.trim() || `Conversation ${dateKey(row.created_at)}`;
  const lines = [
    "---",
    `title: ${yamlQuote(title)}`,
    "type: claude-conversation",
    `date: ${yamlQuote(dateKey(row.created_at))}`,
    "source: subscription-claude",
    "---",
    "",
    `# ${title}`,
    "",
    `*Recorded from a Claude subscription conversation on ${dateKey(row.created_at)}.*`,
    "",
    row.content.trimEnd(),
    "",
  ];
  const links = entities
    .filter((e) => e.kind === "person" || e.kind === "place" || e.kind === "project")
    .map((e) => entityStubFileName(e.kind as "person" | "place" | "project", e.name))
    .map((f) => f.replace(/^[^/]+\//, "").replace(/\.md$/, ""));
  if (links.length > 0) {
    lines.push("## Connects to", "");
    for (const link of links) lines.push(`- [[${link}]]`);
    lines.push("");
  }
  return lines.join("\n");
}

// --- Store (the write path) ----------------------------------------------
// Upsert by conversation_key: a growing conversation re-exported keeps ONE
// record (latest full content), and filed_at/linked_at are cleared so it
// re-files and the librarian/auto-tag pass can refresh entities against the
// new text. Only ever touches mcp_conversations — never diary/pages/profile.
export function saveExportedConversation(input: {
  content: string;
  title?: string;
  conversationId?: string;
}): { key: string } {
  const title = (input.title || "").trim().slice(0, 200) || null;
  const key =
    (input.conversationId || "").trim().slice(0, 200) ||
    `conv_${randomBytes(8).toString("hex")}`;
  db()
    .prepare(
      `INSERT INTO mcp_conversations(conversation_key, title, content, filed_at)
       VALUES(?,?,?,NULL)
       ON CONFLICT(conversation_key) DO UPDATE SET
         title = excluded.title,
         content = excluded.content,
         updated_at = datetime('now'),
         filed_at = NULL,
         linked_at = NULL`
    )
    .run(key, title, input.content);
  return { key };
}

// --- Filing (read for the exporter) --------------------------------------
export function unfiledConversationCount(): number {
  return (
    db()
      .prepare(`SELECT COUNT(*) AS c FROM mcp_conversations WHERE filed_at IS NULL`)
      .get() as { c: number }
  ).c;
}

// The {vaultRelPath -> markdown} map to upload. `onlyUnfiled` (default) files
// just the new/changed ones; the whole-vault sync passes false.
export function renderConversationNoteFiles(onlyUnfiled = true): Map<string, string> {
  const rows = db()
    .prepare(
      `SELECT conversation_key, title, content, created_at FROM mcp_conversations
       ${onlyUnfiled ? "WHERE filed_at IS NULL" : ""}
       ORDER BY created_at ASC`
    )
    .all() as ExportedConversationRow[];
  const entityStmt = db().prepare(
    `SELECT kind, name FROM entry_entities WHERE page_id = ? ORDER BY kind, name`
  );
  const map = new Map<string, string>();
  for (const r of rows) {
    const entities = entityStmt.all(conversationPageId(r.conversation_key)) as Array<{
      kind: string;
      name: string;
    }>;
    map.set(conversationNoteFileName(r), renderConversationNote(r, entities));
  }
  return map;
}

export function markConversationsFiled(keys: string[]): void {
  if (keys.length === 0) return;
  const placeholders = keys.map(() => "?").join(",");
  db()
    .prepare(
      `UPDATE mcp_conversations SET filed_at = datetime('now') WHERE conversation_key IN (${placeholders})`
    )
    .run(...keys);
}

// Keys of the currently-unfiled conversations, so the exporter can mark exactly
// those filed after a successful upload (nothing newer gets marked prematurely).
export function unfiledConversationKeys(): string[] {
  return (
    db()
      .prepare(`SELECT conversation_key FROM mcp_conversations WHERE filed_at IS NULL`)
      .all() as Array<{ conversation_key: string }>
  ).map((r) => r.conversation_key);
}

// --- Entity-linking status (the librarian agent's own progress marker) ---
// Distinct from filed_at (Dropbox filing status): a conversation can be
// filed long before it's linked, and re-filing a growing conversation (which
// clears filed_at, see saveExportedConversation) must not force re-linking.

export type UnlinkedConversation = {
  conversation_key: string;
  title: string | null;
  created_at: string;
};

export function listUnlinkedConversations(limit = 20): UnlinkedConversation[] {
  return db()
    .prepare(
      `SELECT conversation_key, title, created_at FROM mcp_conversations
       WHERE linked_at IS NULL
       ORDER BY created_at ASC
       LIMIT ?`
    )
    .all(limit) as UnlinkedConversation[];
}

export function markConversationsLinked(keys: string[]): void {
  if (keys.length === 0) return;
  const placeholders = keys.map(() => "?").join(",");
  db()
    .prepare(
      `UPDATE mcp_conversations SET linked_at = datetime('now') WHERE conversation_key IN (${placeholders})`
    )
    .run(...keys);
}

export function getConversationByKey(
  conversationKey: string
): ExportedConversationRow | null {
  return (
    (db()
      .prepare(
        `SELECT conversation_key, title, content, created_at FROM mcp_conversations
         WHERE conversation_key = ?`
      )
      .get(conversationKey) as ExportedConversationRow | undefined) ?? null
  );
}

// conversation_key -> the note's vault-relative file name, for every exported
// conversation. Used by Part C's entity-stub back-link rendering
// (lib/diaryExportDb.ts) to turn a tagged conversation's synthetic page id
// back into a wikilink target, without re-deriving the filename logic there.
export function allConversationFileNames(): Map<string, string> {
  const rows = db()
    .prepare(`SELECT conversation_key, title, created_at FROM mcp_conversations`)
    .all() as Array<{ conversation_key: string; title: string | null; created_at: string }>;
  const map = new Map<string, string>();
  for (const r of rows) map.set(r.conversation_key, conversationNoteFileName(r));
  return map;
}
