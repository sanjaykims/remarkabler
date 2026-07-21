import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { DECISIONS_NOTEBOOK_ID } from "@/lib/notes";
import { entityStubFileName } from "@/lib/diaryExport";

// Decision Records, saved by the MCP `save_decision` write tool (lib/mcp.ts)
// and filed as one Markdown note each into the Obsidian/Dropbox vault. This
// module is the store + the note renderer; the Dropbox upload is wired in
// lib/dropbox.ts and fired from the maintenance sweep (lib/notes.ts) — same
// shape as lib/reflectionWiki.ts, but deliberately a SEPARATE table/folder:
// a decision is a structured "we decided X because Y" record (obsidian-mind's
// Decision Record type), never a reflection or a verbatim conversation, so it
// must never be mixed in with (or mistaken for) either.
//
// Security note: content here is written by an EXTERNAL Claude session
// (subscription-Claude, a Routine, or Claude Code) — treat it as untrusted
// the same way lib/reflectionWiki.ts treats reflection content. It is stored
// + rendered as plain text and never executed or interpreted. Filing is
// deterministic (no API call), so there is no "librarian gets prompt-injected"
// surface.

export const DECISION_FOLDER = "Decisions";
// Hard cap on one decision record's size — a decision record is a short,
// structured note (what/why/alternatives), not a transcript, so this matches
// MAX_REFLECTION_CHARS rather than MAX_CONVERSATION_CHARS.
export const MAX_DECISION_CHARS = 20_000;

export type SavedDecisionRow = {
  decision_key: string;
  title: string | null;
  content: string;
  created_at: string;
};

// Filesystem-safe basename fragment (mirrors reflectionWiki's own intent).
export function sanitizeFileName(s: string): string {
  return s
    .replace(/[[\]|]/g, "")
    .replace(/[/\\:*?"<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

// The synthetic pages.id lib/decisionEntities.ts writes an entity-tagged page
// under — mirrors lib/reflectionWiki.ts's reflectionPageId.
export function decisionPageId(decisionKey: string): string {
  return `${DECISIONS_NOTEBOOK_ID}:${decisionKey}`;
}

// "YYYY-MM-DD" from a sqlite datetime ("YYYY-MM-DD HH:MM:SS") or ISO string.
// Exported for lib/decisionEntities.ts, which needs the same day-key logic
// for the synthetic decision page's entry_date.
export function dateKey(createdAt: string): string {
  const m = String(createdAt).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "undated";
}

function yamlQuote(v: string): string {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ")}"`;
}

// Decisions/YYYY-MM-DD-<slug>-<keyhash>.md — one note per decision. The 6-char
// hash of decision_key guarantees uniqueness while staying stable per key
// (re-saving under the same key overwrites its own note, never a sibling's).
export function decisionNoteFileName(row: {
  decision_key: string;
  title: string | null;
  created_at: string;
}): string {
  const base = sanitizeFileName(row.title || "") || "decision";
  const keyHash = createHash("sha256")
    .update(row.decision_key)
    .digest("hex")
    .slice(0, 6);
  return `${DECISION_FOLDER}/${dateKey(row.created_at)}-${base}-${keyHash}.md`;
}

// The Markdown note: frontmatter + the decision body. `type: claude-decision`
// so it's never confused with a reflection or conversation when browsing the
// vault. `entities` (kind+name, from entry_entities once this decision has
// been tagged — lib/entityTagging.ts / lib/decisionEntities.ts) renders as a
// "## Connects to" section, mirroring renderReflectionNote.
export function renderDecisionNote(
  row: { title: string | null; content: string; created_at: string },
  entities: Array<{ kind: string; name: string }> = []
): string {
  const title = row.title?.trim() || `Decision ${dateKey(row.created_at)}`;
  const lines = [
    "---",
    `title: ${yamlQuote(title)}`,
    "type: claude-decision",
    `date: ${yamlQuote(dateKey(row.created_at))}`,
    "source: subscription-claude",
    "---",
    "",
    `# ${title}`,
    "",
    `*A decision record from ${dateKey(row.created_at)}.*`,
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
// Upsert by decision_key: re-saving under the same key keeps ONE record
// (latest content), and filed_at is cleared so it re-files. Only ever touches
// mcp_decisions — never diary/pages/profile.
export function saveDecision(input: {
  content: string;
  title?: string;
  decisionId?: string;
}): { key: string } {
  const title = (input.title || "").trim().slice(0, 200) || null;
  const key =
    (input.decisionId || "").trim().slice(0, 200) ||
    `dec_${randomBytes(8).toString("hex")}`;
  db()
    .prepare(
      `INSERT INTO mcp_decisions(decision_key, title, content, filed_at, linked_at)
       VALUES(?,?,?,NULL,NULL)
       ON CONFLICT(decision_key) DO UPDATE SET
         title = excluded.title,
         content = excluded.content,
         updated_at = datetime('now'),
         filed_at = NULL,
         linked_at = NULL`
    )
    .run(key, title, input.content);
  return { key };
}

// --- Filing (read for the exporter) ----------------------------------------
export function unfiledDecisionCount(): number {
  return (
    db()
      .prepare(`SELECT COUNT(*) AS c FROM mcp_decisions WHERE filed_at IS NULL`)
      .get() as { c: number }
  ).c;
}

// The {vaultRelPath -> markdown} map to upload. `onlyUnfiled` (default) files
// just the new/changed ones; the whole-vault sync passes false.
export function renderDecisionNoteFiles(onlyUnfiled = true): Map<string, string> {
  const rows = db()
    .prepare(
      `SELECT decision_key, title, content, created_at FROM mcp_decisions
       ${onlyUnfiled ? "WHERE filed_at IS NULL" : ""}
       ORDER BY created_at ASC`
    )
    .all() as SavedDecisionRow[];
  const entityStmt = db().prepare(
    `SELECT kind, name FROM entry_entities WHERE page_id = ? ORDER BY kind, name`
  );
  const map = new Map<string, string>();
  for (const r of rows) {
    const entities = entityStmt.all(decisionPageId(r.decision_key)) as Array<{
      kind: string;
      name: string;
    }>;
    map.set(decisionNoteFileName(r), renderDecisionNote(r, entities));
  }
  return map;
}

export function markDecisionsFiled(keys: string[]): void {
  if (keys.length === 0) return;
  const placeholders = keys.map(() => "?").join(",");
  db()
    .prepare(
      `UPDATE mcp_decisions SET filed_at = datetime('now') WHERE decision_key IN (${placeholders})`
    )
    .run(...keys);
}

// Keys of the currently-unfiled decisions, so the exporter can mark exactly
// those filed after a successful upload (nothing newer gets marked prematurely).
export function unfiledDecisionKeys(): string[] {
  return (
    db()
      .prepare(`SELECT decision_key FROM mcp_decisions WHERE filed_at IS NULL`)
      .all() as Array<{ decision_key: string }>
  ).map((r) => r.decision_key);
}

// --- Entity-linking status (mirrors reflectionWiki's equivalents) ---------
// Distinct from filed_at (Dropbox filing status): a decision can be filed
// long before it's linked, and re-saving under the same key (which clears
// filed_at, see saveDecision) must not force re-linking.

export type UnlinkedDecision = {
  decision_key: string;
  title: string | null;
  created_at: string;
};

export function listUnlinkedDecisions(limit = 20): UnlinkedDecision[] {
  return db()
    .prepare(
      `SELECT decision_key, title, created_at FROM mcp_decisions
       WHERE linked_at IS NULL
       ORDER BY created_at ASC
       LIMIT ?`
    )
    .all(limit) as UnlinkedDecision[];
}

export function markDecisionsLinked(keys: string[]): void {
  if (keys.length === 0) return;
  const placeholders = keys.map(() => "?").join(",");
  db()
    .prepare(
      `UPDATE mcp_decisions SET linked_at = datetime('now') WHERE decision_key IN (${placeholders})`
    )
    .run(...keys);
}

export function getDecisionByKey(decisionKey: string): SavedDecisionRow | null {
  return (
    (db()
      .prepare(
        `SELECT decision_key, title, content, created_at FROM mcp_decisions
         WHERE decision_key = ?`
      )
      .get(decisionKey) as SavedDecisionRow | undefined) ?? null
  );
}

// decision_key -> the note's vault-relative file name, for every saved
// decision. Used by the entity-stub back-link rendering (lib/diaryExportDb.ts)
// — mirrors reflectionWiki's allReflectionFileNames.
export function allDecisionFileNames(): Map<string, string> {
  const rows = db()
    .prepare(`SELECT decision_key, title, created_at FROM mcp_decisions`)
    .all() as Array<{ decision_key: string; title: string | null; created_at: string }>;
  const map = new Map<string, string>();
  for (const r of rows) map.set(r.decision_key, decisionNoteFileName(r));
  return map;
}
