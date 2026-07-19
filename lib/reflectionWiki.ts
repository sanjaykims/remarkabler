import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { REFLECTIONS_NOTEBOOK_ID } from "@/lib/notes";
import { entityStubFileName } from "@/lib/diaryExport";

// Standalone AI-written reflections, saved by the MCP `save_reflection`
// write tool (lib/mcp.ts) and filed as one Markdown note each into the
// Obsidian/Dropbox vault. This module is the store + the note renderer; the
// Dropbox upload is wired in lib/dropbox.ts and fired from the maintenance
// sweep (lib/notes.ts) — same shape as lib/conversationWiki.ts, but
// deliberately a SEPARATE table/folder: a reflection is Claude's own
// one-sided writing about the person, not a verbatim human<->Claude
// transcript, so it must never be mixed in with (or mistaken for) a real
// exported conversation.
//
// Security note: content here is written by an EXTERNAL Claude session
// (subscription-Claude, a Routine, or Claude Code) — treat it as untrusted
// the same way lib/conversationWiki.ts treats conversation content. It is
// stored + rendered as plain quoted text and never executed or interpreted.
// Filing is deterministic (no API call), so there is no
// "librarian gets prompt-injected" surface.

export const REFLECTION_FOLDER = "Reflections";
// Hard cap on one reflection's size — a reflection is meant to be a short
// piece of writing, not a transcript, so this is deliberately much smaller
// than MAX_CONVERSATION_CHARS (500_000).
export const MAX_REFLECTION_CHARS = 20_000;

export type SavedReflectionRow = {
  reflection_key: string;
  title: string | null;
  content: string;
  created_at: string;
};

// Filesystem-safe basename fragment (mirrors conversationWiki's own intent).
export function sanitizeFileName(s: string): string {
  return s
    .replace(/[[\]|]/g, "")
    .replace(/[/\\:*?"<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

// The synthetic pages.id lib/reflectionEntities.ts writes an entity-tagged
// page under — mirrors lib/conversationWiki.ts's conversationPageId.
export function reflectionPageId(reflectionKey: string): string {
  return `${REFLECTIONS_NOTEBOOK_ID}:${reflectionKey}`;
}

// "YYYY-MM-DD" from a sqlite datetime ("YYYY-MM-DD HH:MM:SS") or ISO string.
// Exported for lib/reflectionEntities.ts, which needs the same day-key logic
// for the synthetic reflection page's entry_date (mirrors conversationWiki's
// dateKey export for the same reason).
export function dateKey(createdAt: string): string {
  const m = String(createdAt).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "undated";
}

function yamlQuote(v: string): string {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ")}"`;
}

// Reflections/YYYY-MM-DD-<slug>-<keyhash>.md — one note per reflection. The
// 6-char hash of reflection_key guarantees uniqueness (two reflections
// titled the same on the same day must not collide onto one file) while
// staying stable per key (re-saving under the same key overwrites its own
// note, never a sibling's).
export function reflectionNoteFileName(row: {
  reflection_key: string;
  title: string | null;
  created_at: string;
}): string {
  const base = sanitizeFileName(row.title || "") || "reflection";
  const keyHash = createHash("sha256")
    .update(row.reflection_key)
    .digest("hex")
    .slice(0, 6);
  return `${REFLECTION_FOLDER}/${dateKey(row.created_at)}-${base}-${keyHash}.md`;
}

// The Markdown note: frontmatter + the reflection body. `type:
// claude-reflection` (not `claude-conversation`) so it's never confused
// with a real exported chat when browsing the vault.
// `entities` (kind+name, from entry_entities once this reflection has been
// tagged — lib/entityTagging.ts / lib/reflectionEntities.ts) renders as a
// "## Connects to" section, mirroring conversationWiki's renderConversationNote.
export function renderReflectionNote(
  row: { title: string | null; content: string; created_at: string },
  entities: Array<{ kind: string; name: string }> = []
): string {
  const title = row.title?.trim() || `Reflection ${dateKey(row.created_at)}`;
  const lines = [
    "---",
    `title: ${yamlQuote(title)}`,
    "type: claude-reflection",
    `date: ${yamlQuote(dateKey(row.created_at))}`,
    "source: subscription-claude",
    "---",
    "",
    `# ${title}`,
    "",
    `*An independent reflection Claude wrote on ${dateKey(row.created_at)} — not a conversation transcript.*`,
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

// --- Store (the write path) ------------------------------------------------
// Upsert by reflection_key: re-saving under the same key keeps ONE record
// (latest content), and filed_at is cleared so it re-files. Only ever
// touches mcp_reflections — never diary/pages/profile.
export function saveReflection(input: {
  content: string;
  title?: string;
  reflectionId?: string;
}): { key: string } {
  const title = (input.title || "").trim().slice(0, 200) || null;
  const key =
    (input.reflectionId || "").trim().slice(0, 200) ||
    `refl_${randomBytes(8).toString("hex")}`;
  db()
    .prepare(
      `INSERT INTO mcp_reflections(reflection_key, title, content, filed_at)
       VALUES(?,?,?,NULL)
       ON CONFLICT(reflection_key) DO UPDATE SET
         title = excluded.title,
         content = excluded.content,
         updated_at = datetime('now'),
         filed_at = NULL`
    )
    .run(key, title, input.content);
  return { key };
}

// --- Filing (read for the exporter) ----------------------------------------
export function unfiledReflectionCount(): number {
  return (
    db()
      .prepare(`SELECT COUNT(*) AS c FROM mcp_reflections WHERE filed_at IS NULL`)
      .get() as { c: number }
  ).c;
}

// The {vaultRelPath -> markdown} map to upload. `onlyUnfiled` (default)
// files just the new/changed ones; the whole-vault sync passes false.
export function renderReflectionNoteFiles(onlyUnfiled = true): Map<string, string> {
  const rows = db()
    .prepare(
      `SELECT reflection_key, title, content, created_at FROM mcp_reflections
       ${onlyUnfiled ? "WHERE filed_at IS NULL" : ""}
       ORDER BY created_at ASC`
    )
    .all() as SavedReflectionRow[];
  const entityStmt = db().prepare(
    `SELECT kind, name FROM entry_entities WHERE page_id = ? ORDER BY kind, name`
  );
  const map = new Map<string, string>();
  for (const r of rows) {
    const entities = entityStmt.all(reflectionPageId(r.reflection_key)) as Array<{
      kind: string;
      name: string;
    }>;
    map.set(reflectionNoteFileName(r), renderReflectionNote(r, entities));
  }
  return map;
}

export function markReflectionsFiled(keys: string[]): void {
  if (keys.length === 0) return;
  const placeholders = keys.map(() => "?").join(",");
  db()
    .prepare(
      `UPDATE mcp_reflections SET filed_at = datetime('now') WHERE reflection_key IN (${placeholders})`
    )
    .run(...keys);
}

// Keys of the currently-unfiled reflections, so the exporter can mark
// exactly those filed after a successful upload (nothing newer gets marked
// prematurely).
export function unfiledReflectionKeys(): string[] {
  return (
    db()
      .prepare(`SELECT reflection_key FROM mcp_reflections WHERE filed_at IS NULL`)
      .all() as Array<{ reflection_key: string }>
  ).map((r) => r.reflection_key);
}

// --- Entity-linking status (mirrors conversationWiki's equivalents) -------
// Distinct from filed_at (Dropbox filing status): a reflection can be filed
// long before it's linked, and re-saving under the same key (which clears
// filed_at, see saveReflection) must not force re-linking.

export type UnlinkedReflection = {
  reflection_key: string;
  title: string | null;
  created_at: string;
};

export function listUnlinkedReflections(limit = 20): UnlinkedReflection[] {
  return db()
    .prepare(
      `SELECT reflection_key, title, created_at FROM mcp_reflections
       WHERE linked_at IS NULL
       ORDER BY created_at ASC
       LIMIT ?`
    )
    .all(limit) as UnlinkedReflection[];
}

export function markReflectionsLinked(keys: string[]): void {
  if (keys.length === 0) return;
  const placeholders = keys.map(() => "?").join(",");
  db()
    .prepare(
      `UPDATE mcp_reflections SET linked_at = datetime('now') WHERE reflection_key IN (${placeholders})`
    )
    .run(...keys);
}

export function getReflectionByKey(reflectionKey: string): SavedReflectionRow | null {
  return (
    (db()
      .prepare(
        `SELECT reflection_key, title, content, created_at FROM mcp_reflections
         WHERE reflection_key = ?`
      )
      .get(reflectionKey) as SavedReflectionRow | undefined) ?? null
  );
}

// reflection_key -> the note's vault-relative file name, for every saved
// reflection. Used by Part C's entity-stub back-link rendering
// (lib/diaryExportDb.ts) — mirrors conversationWiki's allConversationFileNames.
export function allReflectionFileNames(): Map<string, string> {
  const rows = db()
    .prepare(`SELECT reflection_key, title, created_at FROM mcp_reflections`)
    .all() as Array<{ reflection_key: string; title: string | null; created_at: string }>;
  const map = new Map<string, string>();
  for (const r of rows) map.set(r.reflection_key, reflectionNoteFileName(r));
  return map;
}
