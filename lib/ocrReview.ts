import { db } from "./db";
import { correctPageText } from "./notes";
import { anchorPhrase, contextSnippet, replaceAt } from "./ocrFlags";
import { recordLearned } from "./ocrLearning";
import { captureExample, examplesAvailable } from "./handwritingExamples";

// Proofreading review queue. The transcription is saved immediately with
// Claude's best reading; doubtful spots become `ocr_flags` rows the owner
// confirms later. Resolving a flag edits the page through the same
// `correctPageText` path a manual edit uses, so search, embeddings, analysis,
// dates and day summaries all follow.

export const MAX_CUSTOM_LEN = 200;

export type ReviewCard = {
  id: string;
  notebookId: string;
  notebookName: string;
  pageId: string;
  pageIndex: number;
  phrase: string;
  candidates: string[];
  reason: string;
  context: { before: string; match: string; after: string };
  /** true when a picture of the handwritten word can be shown (/api/ocr-review/crop) */
  hasCrop: boolean;
};

type FlagRow = {
  id: string;
  notebook_id: string;
  notebook_name: string;
  page_id: string;
  page_index: number;
  start_offset: number;
  phrase: string;
  candidates: string;
  reason: string | null;
  box: string | null;
  ocr_text: string | null;
};

export function pendingFlagCount(): number {
  return (
    db().prepare(`SELECT COUNT(*) AS n FROM ocr_flags WHERE status = 'pending'`).get() as {
      n: number;
    }
  ).n;
}

/** Oldest-first pending cards. Flags whose phrase vanished are marked stale and skipped. */
export function listReviewCards(limit = 5): ReviewCard[] {
  const d = db();
  const rows = d
    .prepare(
      `SELECT f.id, f.notebook_id, n.name AS notebook_name, f.page_id, f.page_index,
              f.start_offset, f.phrase, f.candidates, f.reason, f.box, p.ocr_text
         FROM ocr_flags f
         JOIN notebooks n ON n.id = f.notebook_id
         LEFT JOIN pages p ON p.id = f.page_id
        WHERE f.status = 'pending'
        ORDER BY f.created_at, f.page_index, f.start_offset
        LIMIT ?`
    )
    .all(limit * 3) as FlagRow[];

  const cards: ReviewCard[] = [];
  for (const r of rows) {
    if (cards.length >= limit) break;
    const text = r.ocr_text || "";
    const start = anchorPhrase(text, r.phrase, r.start_offset);
    if (start === -1) {
      d.prepare(`UPDATE ocr_flags SET status = 'stale', resolved_at = CURRENT_TIMESTAMP WHERE id = ?`).run(r.id);
      continue;
    }
    let candidates: string[] = [];
    try {
      const j = JSON.parse(r.candidates);
      if (Array.isArray(j)) candidates = j.filter((c) => typeof c === "string");
    } catch {
      /* none */
    }
    cards.push({
      id: r.id,
      notebookId: r.notebook_id,
      notebookName: r.notebook_name,
      pageId: r.page_id,
      pageIndex: r.page_index,
      phrase: r.phrase,
      candidates,
      reason: r.reason || "",
      context: contextSnippet(text, start, r.phrase.length),
      hasCrop: !!r.box && examplesAvailable(),
    });
  }
  return cards;
}

/** Best-effort: learning must never block or fail the owner's answer. */
function learn(wrong: string, right: string, text: string, start: number, len: number) {
  try {
    const c = contextSnippet(text, start, len, 40);
    recordLearned({
      wrong,
      right,
      source: "review",
      context: `${c.before}[${c.match}]${c.after}`,
    });
  } catch (e) {
    console.warn("[ocrReview] recording what was learned failed:", (e as Error).message);
  }
}

/** Save a picture of the confirmed handwriting for the transcriber's examples (fire-and-forget). */
function captureHandwriting(
  row: { notebook_id: string; page_index: number; box: string | null; phrase: string },
  confirmed: string
) {
  if (!row.box) return;
  let box: [number, number, number, number] | null = null;
  try {
    const b = JSON.parse(row.box);
    if (Array.isArray(b) && b.length === 4) box = b as [number, number, number, number];
  } catch {
    return;
  }
  void captureExample({
    notebookId: row.notebook_id,
    pageIndex: row.page_index,
    box,
    text: confirmed,
    wrong: row.phrase,
  }).catch((e) => console.warn("[ocrReview] handwriting capture failed:", (e as Error).message));
}

export type ResolveAction =
  | { kind: "choose"; index: number }
  | { kind: "custom"; text: string }
  | { kind: "keep" };

export type ResolveResult =
  | { ok: true; notebookId: string; changed: boolean }
  | { ok: false; status: number; error: string };

export function resolveFlag(id: string, action: ResolveAction): ResolveResult {
  const d = db();
  const row = d
    .prepare(
      `SELECT f.id, f.notebook_id, f.page_id, f.page_index, f.box, f.start_offset, f.phrase, f.candidates, f.status,
              p.ocr_text
         FROM ocr_flags f LEFT JOIN pages p ON p.id = f.page_id
        WHERE f.id = ?`
    )
    .get(id) as
    | {
        id: string;
        notebook_id: string;
        page_id: string;
        page_index: number;
        box: string | null;
        start_offset: number;
        phrase: string;
        candidates: string;
        status: string;
        ocr_text: string | null;
      }
    | undefined;
  if (!row) return { ok: false, status: 404, error: "Flag not found" };
  if (row.status !== "pending") return { ok: false, status: 409, error: "Already handled" };

  if (action.kind === "keep") {
    d.prepare(
      `UPDATE ocr_flags SET status = 'kept', resolved_text = phrase, resolved_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(id);
    // Confirmed as written: known vocabulary, so it stops being flagged.
    learn(row.phrase, row.phrase, row.ocr_text || "", row.start_offset, row.phrase.length);
    captureHandwriting(row, row.phrase);
    return { ok: true, notebookId: row.notebook_id, changed: false };
  }

  let replacement: string;
  if (action.kind === "choose") {
    let cands: string[] = [];
    try {
      cands = JSON.parse(row.candidates);
    } catch {
      /* none */
    }
    const pick = cands[action.index];
    if (typeof pick !== "string" || !pick) {
      return { ok: false, status: 400, error: "No such option" };
    }
    replacement = pick;
  } else {
    replacement = action.text.replace(/\s+/g, " ").trim();
    if (!replacement) return { ok: false, status: 400, error: "Type the correct text" };
    if (replacement.length > MAX_CUSTOM_LEN) {
      return { ok: false, status: 400, error: "That's too long for a word fix" };
    }
  }

  const text = row.ocr_text || "";
  const next = replaceAt(text, row.start_offset, row.phrase, replacement);
  if (next === null) {
    d.prepare(`UPDATE ocr_flags SET status = 'stale', resolved_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
    return { ok: false, status: 409, error: "The page text changed; this question no longer applies" };
  }

  if (next !== text) {
    if (!correctPageText(row.notebook_id, row.page_id, next)) {
      return { ok: false, status: 404, error: "Page not found" };
    }
  }

  const at = anchorPhrase(text, row.phrase, row.start_offset);
  learn(row.phrase, replacement, text, at === -1 ? row.start_offset : at, row.phrase.length);
  captureHandwriting(row, replacement);
  const delta = replacement.length - row.phrase.length;
  d.transaction(() => {
    d.prepare(
      `UPDATE ocr_flags SET status = 'resolved', resolved_text = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(replacement, id);
    // Later flags on the same page moved by the length change.
    if (delta !== 0 && at !== -1) {
      d.prepare(
        `UPDATE ocr_flags SET start_offset = start_offset + ?
          WHERE page_id = ? AND status = 'pending' AND start_offset > ?`
      ).run(delta, row.page_id, at);
    }
  })();
  return { ok: true, notebookId: row.notebook_id, changed: next !== text };
}
