import crypto from "crypto";
import { db, getSetting, setSetting } from "./db";
import { wordChanges } from "./ocrDiff";

// The learning half of transcription proofreading. Claude itself is not
// retrained; what improves is the advisory context handed to the NEXT
// transcription: vocabulary the owner has confirmed (stop flagging it), past
// misreadings and their fixes, and the names that dominate this diary.
// Everything here is local to the database (never the repo, never MCP).

export const MAX_TERMS = 40;
export const MAX_PAIRS = 30;
export const MAX_ENTITIES = 30;
export const HINT_CHAR_CAP = 2500;
const MAX_LEN = 120;
// Kept in sync with DISCIPLINE_ID in lib/notes.ts; a literal here avoids an
// import cycle (notes -> claude -> ocrLearning).
const DISCIPLINE_NOTEBOOK = "github-discipline";

export const NOTES_KEY = "ocr_handwriting_notes";
const NOTES_AT_KEY = "ocr_handwriting_notes_at"; // corrected-pair count when notes were last written
const AUTOFIX_KEY = "ocr_autofix_count";
/** A fix confirmed this many times is applied automatically to new transcriptions. */
export const AUTOFIX_MIN = 3;
const AUTOFIX_MIN_LEN = 4;

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** Record one lesson. wrong === right means "confirmed as written". */
export function recordLearned(args: {
  wrong: string;
  right: string;
  source: "review" | "manual_edit";
  context?: string;
}): void {
  const wrong = norm(args.wrong);
  const right = norm(args.right);
  if (!wrong || !right || wrong.length > MAX_LEN || right.length > MAX_LEN) return;
  const kind = wrong === right ? "confirmed" : "corrected";
  db()
    .prepare(
      `INSERT INTO ocr_learned(id, wrong, right, kind, source, context)
       VALUES(?,?,?,?,?,?)
       ON CONFLICT(wrong, right) DO UPDATE SET
         count = count + 1,
         last_seen = CURRENT_TIMESTAMP,
         context = COALESCE(excluded.context, context)`
    )
    .run(
      crypto.randomUUID(),
      wrong,
      right,
      kind,
      args.source,
      args.context ? norm(args.context).slice(0, 200) : null
    );
}

/** Learn from a manual page edit: each small word substitution is a lesson. */
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** A manual edit is a handwriting misreading only when the two words look alike; a
 *  rewording ("big" -> "large") is the owner's word choice, not a lesson about the pen. */
export function looksLikeMisread(wrong: string, right: string): boolean {
  const a = wrong.toLowerCase().replace(/\s+/g, "");
  const b = right.toLowerCase().replace(/\s+/g, "");
  if (!a || !b) return false;
  if (a === b) return true;
  return editDistance(a, b) <= Math.max(2, Math.floor(Math.max(a.length, b.length) * 0.4));
}

export function learnFromEdit(oldText: string, newText: string): number {
  let n = 0;
  for (const c of wordChanges(oldText, newText)) {
    if (!looksLikeMisread(c.wrong, c.right)) continue;
    recordLearned({ wrong: c.wrong, right: c.right, source: "manual_edit", context: c.context });
    n++;
  }
  return n;
}

export function pageTextOf(notebookId: string, pageId: string): string {
  const r = db()
    .prepare(`SELECT ocr_text FROM pages WHERE id = ? AND notebook_id = ?`)
    .get(pageId, notebookId) as { ocr_text: string | null } | undefined;
  return r?.ocr_text || "";
}

type Row = { wrong: string; right: string; kind: string; count: number };

function confirmedTerms(limit: number): string[] {
  const rows = db()
    .prepare(
      `SELECT wrong, right, kind, count FROM ocr_learned
        WHERE kind = 'confirmed' ORDER BY count DESC, last_seen DESC`
    )
    .all() as Row[];
  const corrected = db()
    .prepare(`SELECT wrong, MAX(count) AS c FROM ocr_learned WHERE kind = 'corrected' GROUP BY wrong`)
    .all() as Array<{ wrong: string; c: number }>;
  const outweigh = new Map(corrected.map((r) => [r.wrong, r.c]));
  const out: string[] = [];
  for (const r of rows) {
    // If the owner has since corrected this very spelling at least as often as
    // they confirmed it, it is no longer "known good".
    if ((outweigh.get(r.wrong) ?? 0) >= r.count) continue;
    out.push(r.wrong);
    if (out.length >= limit) break;
  }
  return out;
}

export function isConfirmedTerm(phrase: string): boolean {
  const p = norm(phrase);
  return confirmedTerms(1000).includes(p);
}

function correctedPairs(limit: number): Array<{ wrong: string; right: string }> {
  return db()
    .prepare(
      `SELECT wrong, right FROM ocr_learned
        WHERE kind = 'corrected' ORDER BY count DESC, last_seen DESC LIMIT ?`
    )
    .all(limit) as Array<{ wrong: string; right: string }>;
}

/** The names that dominate this diary (already extracted per page), most mentioned first. */
function topNames(limit: number): string[] {
  return (
    db()
      .prepare(
        `SELECT MIN(e.name) AS name, COUNT(*) AS n
           FROM entry_entities e JOIN pages p ON p.id = e.page_id
          WHERE p.notebook_id != ?
          GROUP BY e.kind, e.name_norm
          ORDER BY n DESC LIMIT ?`
      )
      .all(DISCIPLINE_NOTEBOOK, limit) as Array<{ name: string }>
  ).map((r) => r.name);
}

/** Pure: render the advisory block. Empty string when there is nothing to say. */
export function formatHints(args: {
  terms: string[];
  pairs: Array<{ wrong: string; right: string }>;
  names: string[];
  /** Claude-written summary of this writer's handwriting habits (lib/handwritingNotes.ts). */
  notes?: string;
  cap?: number;
}): string {
  const cap = args.cap ?? HINT_CHAR_CAP;
  const termSet = new Set(args.terms.map((t) => t.toLowerCase()));
  let terms = [...args.terms];
  let pairs = [...args.pairs];
  let names = args.names.filter((n) => !termSet.has(n.toLowerCase()));
  const notes = (args.notes || "").trim();
  if (!terms.length && !pairs.length && !names.length && !notes) return "";

  const render = () => {
    const lines = [
      "KNOWN TO THIS WRITER (learned from their own confirmations). These are advisory hints:",
      "if the page clearly says something different, trust the page.",
    ];
    if (terms.length) {
      lines.push(
        `- Confirmed vocabulary. Spell exactly like this and do NOT flag these: ${terms.join("; ")}`
      );
    }
    if (pairs.length) {
      lines.push(
        "- Past corrections of this handwriting (when you read the left side it is usually the right side): " +
          pairs.map((p) => `"${p.wrong}" -> "${p.right}"`).join("; ")
      );
    }
    if (notes) lines.push(`- Handwriting habits observed in this writer: ${notes}`);
    if (names.length) {
      lines.push(
        `- Names that appear often in this diary (do not flag them when legible): ${names.join("; ")}`
      );
    }
    return lines.join("\n");
  };

  let out = render();
  while (out.length > cap) {
    // Drop from the tail of whichever list is longest until it fits.
    const longest = Math.max(terms.length, pairs.length, names.length);
    if (longest === 0) break;
    if (names.length === longest) names.pop();
    else if (pairs.length === longest) pairs.pop();
    else terms.pop();
    out = render();
    if (!terms.length && !pairs.length && !names.length) return notes ? render() : "";
  }
  return out;
}

/** The hint block for the next transcription. Fail-open: never throws. */
export function buildOcrHints(): string {
  try {
    return formatHints({
      terms: confirmedTerms(MAX_TERMS),
      pairs: correctedPairs(MAX_PAIRS),
      names: topNames(MAX_ENTITIES),
      notes: getSetting(NOTES_KEY) || "",
    });
  } catch (e) {
    console.warn("[ocrLearning] building hints failed:", (e as Error).message);
    return "";
  }
}

/** Learned fixes for this exact misreading go first, then Claude's own alternatives. */
export function rankCandidates(phrase: string, alternatives: string[]): string[] {
  let learned: string[] = [];
  try {
    learned = (
      db()
        .prepare(
          `SELECT right FROM ocr_learned WHERE kind = 'corrected' AND wrong = ?
            ORDER BY count DESC, last_seen DESC LIMIT 3`
        )
        .all(norm(phrase)) as Array<{ right: string }>
    ).map((r) => r.right);
  } catch {
    /* fall back to Claude's order */
  }
  const out: string[] = [];
  for (const c of [...learned, ...alternatives]) {
    if (c && c !== phrase && !out.includes(c)) out.push(c);
    if (out.length >= 3) break;
  }
  return out;
}

const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Fixes the owner has confirmed AUTOFIX_MIN+ times. Skipped when the same
 * spelling is a confirmed-correct term, or when the owner ever changed the fix
 * back (the reverse pair exists): their own edits always win over automation.
 */
export function autoFixablePairs(): Array<{ wrong: string; right: string }> {
  const rows = db()
    .prepare(
      `SELECT c.wrong, c.right FROM ocr_learned c
        WHERE c.kind = 'corrected' AND c.count >= ? AND length(c.wrong) >= ?
          AND NOT EXISTS (SELECT 1 FROM ocr_learned r
                           WHERE r.wrong = c.right AND r.right = c.wrong)
        ORDER BY length(c.wrong) DESC`
    )
    .all(AUTOFIX_MIN, AUTOFIX_MIN_LEN) as Array<{ wrong: string; right: string }>;
  const confirmed = new Set(confirmedTerms(1000));
  return rows.filter((r) => !confirmed.has(r.wrong));
}

/** Pure: replace whole-word, case-sensitive occurrences. Returns the new text and how many changes. */
export function applyFixes(
  text: string,
  pairs: Array<{ wrong: string; right: string }>
): { text: string; n: number } {
  let n = 0;
  let out = text;
  for (const p of pairs) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(p.wrong)}(?![\\p{L}\\p{N}])`, "gu");
    out = out.replace(re, () => {
      n++;
      return p.right;
    });
  }
  return { text: out, n };
}

/** Apply confirmed fixes to fresh transcriptions. Fail-open: any error returns the text untouched. */
export function autoFixPages<T extends { text: string }>(pages: T[]): T[] {
  try {
    const pairs = autoFixablePairs();
    if (!pairs.length) return pages;
    let total = 0;
    const out = pages.map((pg) => {
      const r = applyFixes(pg.text, pairs);
      total += r.n;
      return r.n ? { ...pg, text: r.text } : pg;
    });
    if (total) setSetting(AUTOFIX_KEY, String((Number(getSetting(AUTOFIX_KEY)) || 0) + total));
    return out;
  } catch (e) {
    console.warn("[ocrLearning] auto-fix failed:", (e as Error).message);
    return pages;
  }
}

/** Corrected pairs, for the handwriting-notes writer (most confirmed first). */
export function correctedPairsForNotes(limit = 60): Array<{ wrong: string; right: string; count: number }> {
  return db()
    .prepare(
      `SELECT wrong, right, count FROM ocr_learned WHERE kind = 'corrected'
        ORDER BY count DESC, last_seen DESC LIMIT ?`
    )
    .all(limit) as Array<{ wrong: string; right: string; count: number }>;
}

export const NOTES_EVERY = 8;

/** True once at least NOTES_EVERY new corrections exist since notes were last written. */
export function handwritingNotesDue(): boolean {
  const n = (
    db().prepare(`SELECT COUNT(*) AS n FROM ocr_learned WHERE kind = 'corrected'`).get() as { n: number }
  ).n;
  return n >= NOTES_EVERY && n - (Number(getSetting(NOTES_AT_KEY)) || 0) >= NOTES_EVERY;
}

export function saveHandwritingNotes(notes: string): void {
  const n = (
    db().prepare(`SELECT COUNT(*) AS n FROM ocr_learned WHERE kind = 'corrected'`).get() as { n: number }
  ).n;
  setSetting(NOTES_KEY, notes.trim().slice(0, 800));
  setSetting(NOTES_AT_KEY, String(n));
}

export type ProofreadingStats = {
  totals: { flagged: number; corrected: number; kept: number; pending: number };
  weeks: Array<{ week: string; flagged: number; corrected: number; kept: number }>;
  learnedTerms: number;
  learnedFixes: number;
  autoFixed: number;
  hasNotes: boolean;
};

export function proofreadingStats(): ProofreadingStats {
  const d = db();
  const t = d
    .prepare(
      `SELECT COUNT(*) AS flagged,
              COALESCE(SUM(status = 'resolved'), 0) AS corrected,
              COALESCE(SUM(status = 'kept'), 0) AS kept,
              COALESCE(SUM(status = 'pending'), 0) AS pending
         FROM ocr_flags`
    )
    .get() as ProofreadingStats["totals"];
  const weeks = d
    .prepare(
      `SELECT strftime('%Y-W%W', created_at) AS week, COUNT(*) AS flagged,
              COALESCE(SUM(status = 'resolved'), 0) AS corrected,
              COALESCE(SUM(status = 'kept'), 0) AS kept
         FROM ocr_flags GROUP BY week ORDER BY week DESC LIMIT 4`
    )
    .all() as ProofreadingStats["weeks"];
  const l = d
    .prepare(
      `SELECT COALESCE(SUM(kind = 'confirmed'), 0) AS terms,
              COALESCE(SUM(kind = 'corrected'), 0) AS fixes FROM ocr_learned`
    )
    .get() as { terms: number; fixes: number };
  return {
    totals: t,
    weeks,
    learnedTerms: l.terms,
    learnedFixes: l.fixes,
    autoFixed: Number(getSetting(AUTOFIX_KEY)) || 0,
    hasNotes: !!getSetting(NOTES_KEY),
  };
}
