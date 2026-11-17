import crypto from "crypto";
import { db } from "./db";
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
export function learnFromEdit(oldText: string, newText: string): number {
  let n = 0;
  for (const c of wordChanges(oldText, newText)) {
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
  cap?: number;
}): string {
  const cap = args.cap ?? HINT_CHAR_CAP;
  const termSet = new Set(args.terms.map((t) => t.toLowerCase()));
  let terms = [...args.terms];
  let pairs = [...args.pairs];
  let names = args.names.filter((n) => !termSet.has(n.toLowerCase()));
  if (!terms.length && !pairs.length && !names.length) return "";

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
    if (!terms.length && !pairs.length && !names.length) return "";
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

export type ProofreadingStats = {
  totals: { flagged: number; corrected: number; kept: number; pending: number };
  weeks: Array<{ week: string; flagged: number; corrected: number; kept: number }>;
  learnedTerms: number;
  learnedFixes: number;
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
  return { totals: t, weeks, learnedTerms: l.terms, learnedFixes: l.fixes };
}
