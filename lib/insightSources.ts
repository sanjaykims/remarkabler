import { db, getSetting } from "./db";
import { readDropboxTextFolders } from "./dropbox";

// Extra context fed into Insights generation, beyond the notebook pages and
// in-app chat messages:
//   1. Saved Claude sessions: conversations, reflections and decision records
//      that subscription-Claude filed into the app (MCP write tools).
//   2. The user's own Dropbox vault folders "Records" and "claude's lens",
//      read live (read-only) at generate time.
// Both are bounded and fail-soft: a problem here must never block Insights.

export const DEFAULT_INSIGHT_DROPBOX_FOLDERS = [
  "/Apps/remotely-save/Diary/Records",
  "/Apps/remotely-save/Diary/claude's lens",
];

/** Folders to read; override with the `insights_dropbox_folders` setting (one path per line). */
export function insightDropboxFolders(): string[] {
  const raw = (getSetting("insights_dropbox_folders") || "").trim();
  if (!raw) return DEFAULT_INSIGHT_DROPBOX_FOLDERS;
  const list = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.startsWith("/") ? l : `/${l}`).replace(/\/+$/, ""));
  return list.length ? list : DEFAULT_INSIGHT_DROPBOX_FOLDERS;
}

type SavedRow = { title: string | null; content: string; created_at: string };

function blocksFor(label: string, rows: SavedRow[], perItem: number): string[] {
  return rows.map((r) => {
    const body = r.content.trim();
    const clipped = body.length > perItem ? `${body.slice(0, perItem)}\n[…clipped]` : body;
    return `--- ${label}: ${r.title || "(untitled)"} (${r.created_at.slice(0, 10)}) ---\n${clipped}\n`;
  });
}

/**
 * Saved conversations + reflections + decisions, newest first overall, within
 * `maxChars`. Pure DB read.
 */
export function buildSavedSessionsContext(
  opts: { maxChars?: number; perItemChars?: number } = {}
): { text: string; count: number } {
  const maxChars = opts.maxChars ?? 40_000;
  const perItem = opts.perItemChars ?? 6_000;
  const pull = (table: string) => {
    try {
      return db()
        .prepare(
          `SELECT title, content, created_at FROM ${table} ORDER BY created_at DESC LIMIT 40`
        )
        .all() as SavedRow[];
    } catch {
      return [] as SavedRow[];
    }
  };
  // Merge all three kinds by date.
  const all: Array<{ at: string; b: string }> = [];
  for (const [label, table] of [
    ["Conversation with Claude", "mcp_conversations"],
    ["Claude's reflection", "mcp_reflections"],
    ["Decision record", "mcp_decisions"],
  ] as const) {
    const rows = pull(table);
    const bs = blocksFor(label, rows, perItem);
    rows.forEach((r, i) => all.push({ at: r.created_at, b: bs[i] }));
  }
  all.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const out: string[] = [];
  let used = 0;
  for (const item of all) {
    if (used + item.b.length > maxChars) break;
    out.push(item.b);
    used += item.b.length;
  }
  return { text: out.join("\n").trim(), count: out.length };
}

export type InsightExtraContext = {
  /** Ready-to-embed text (labelled sections); empty if nothing was found. */
  text: string;
  sessions: number;
  vaultFiles: number;
  /** Set when the Dropbox folders could not be read (insights still run). */
  vaultError?: string;
};

export async function buildInsightExtraContext(): Promise<InsightExtraContext> {
  const sessions = buildSavedSessionsContext();
  let vault: { text: string; files: number; error?: string } = { text: "", files: 0 };
  try {
    vault = await readDropboxTextFolders(insightDropboxFolders());
  } catch (e) {
    vault = { text: "", files: 0, error: (e as Error).message };
  }
  const parts: string[] = [];
  if (sessions.text) {
    parts.push(
      "=== SAVED SESSIONS WITH CLAUDE (conversations, reflections, decisions) ===",
      sessions.text,
      "=== END SAVED SESSIONS ===",
      ""
    );
  }
  if (vault.text) {
    parts.push(
      "=== THE PERSON'S OBSIDIAN VAULT: Records and claude's lens ===",
      vault.text,
      "=== END VAULT NOTES ===",
      ""
    );
  }
  return {
    text: parts.join("\n").trim(),
    sessions: sessions.count,
    vaultFiles: vault.files,
    ...(vault.error ? { vaultError: vault.error } : {}),
  };
}
