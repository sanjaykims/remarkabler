import fs from "fs";
import path from "path";
import { db } from "./db";
import { proofreadExistingPdf, modelMain } from "./claude";
import { priceFor } from "./usage";
import { saveOcrFlags } from "./ocrFlagStore";
import { pendingFlagCount } from "./ocrReview";

// Phase 4: run the proofreading pass over diary that was transcribed BEFORE
// proofreading existed. It only ADDS "Needs your eye" cards; it never edits a
// page's text (the owner's tap does, through correctPageText), so hand-corrected
// pages are safe: a flag whose phrase is gone from the text is simply dropped.

const FILES_DIR = path.join(process.env.DATA_DIR || path.join(process.cwd(), "data"), "files");
/** Stop feeding the queue when this many cards already wait, so it never floods. */
export const PENDING_CAP = 60;
export const MAX_PER_RUN = 3;
// Rough per-page figures used only for the estimate (PDF page ≈ 1.7k tokens in, a few flags out).
const PDF_TOKENS_PER_PAGE = 1700;
const OUT_TOKENS_PER_PAGE = 60;

const pdfPath = (id: string) => path.join(FILES_DIR, id, "notebook.pdf");

export type Candidate = { id: string; name: string; pages: number; chars: number };

/** Notebooks not yet proofread that have a stored PDF and text, newest first. */
export function backfillCandidates(): Candidate[] {
  const rows = db()
    .prepare(
      `SELECT n.id, n.name, COUNT(p.id) AS pages, COALESCE(SUM(LENGTH(p.ocr_text)), 0) AS chars
         FROM notebooks n JOIN pages p ON p.notebook_id = n.id
        WHERE n.status = 'done' AND n.proofread_at IS NULL
          AND p.ocr_text IS NOT NULL AND TRIM(p.ocr_text) != ''
          AND n.id NOT IN ('github-discipline')
        GROUP BY n.id
        ORDER BY n.synced_at DESC, n.rowid DESC`
    )
    .all() as Candidate[];
  return rows.filter((r) => fs.existsSync(pdfPath(r.id)));
}

export function estimateBackfill() {
  const c = backfillCandidates();
  const pages = c.reduce((a, r) => a + r.pages, 0);
  const chars = c.reduce((a, r) => a + r.chars, 0);
  const p = priceFor(modelMain());
  const inTok = pages * PDF_TOKENS_PER_PAGE + chars / 3.5;
  const outTok = pages * OUT_TOKENS_PER_PAGE;
  const usd = (inTok * p.input + outTok * p.output) / 1e6;
  return {
    notebooks: c.length,
    pages,
    estimatedUsd: Math.round(usd * 100) / 100,
    pendingCards: pendingFlagCount(),
    next: c[0] ? { id: c[0].id, name: c[0].name, pages: c[0].pages } : null,
  };
}

export type NotebookResult =
  | { ok: true; flags: number }
  | { ok: false; skipped: "queue-full" | "no-pdf" | "no-text" | "error"; error?: string };

/** Proofread one notebook. Failure leaves proofread_at NULL so it can be retried. */
export async function proofreadNotebook(id: string): Promise<NotebookResult> {
  if (pendingFlagCount() >= PENDING_CAP) return { ok: false, skipped: "queue-full" };
  let pdf: Buffer;
  try {
    pdf = fs.readFileSync(pdfPath(id));
  } catch {
    return { ok: false, skipped: "no-pdf" };
  }
  const pages = db()
    .prepare(
      `SELECT id, page_index AS pageIndex, ocr_text AS text FROM pages
        WHERE notebook_id = ? AND ocr_text IS NOT NULL AND TRIM(ocr_text) != ''
        ORDER BY page_index`
    )
    .all(id) as Array<{ id: string; pageIndex: number; text: string }>;
  if (!pages.length) return { ok: false, skipped: "no-text" };
  try {
    const flags = await proofreadExistingPdf(pdf, pages);
    let saved = 0;
    for (const p of pages) {
      const pf = flags.filter((f) => f.page === p.pageIndex + 1);
      if (!pf.length) continue;
      saved += saveOcrFlags({
        notebookId: id,
        pageRowId: p.id,
        pageIndex: p.pageIndex,
        text: p.text,
        flags: pf,
      });
    }
    db().prepare(`UPDATE notebooks SET proofread_at = datetime('now') WHERE id = ?`).run(id);
    return { ok: true, flags: saved };
  } catch (e) {
    return { ok: false, skipped: "error", error: (e as Error).message.slice(0, 200) };
  }
}

let running = false;

/** Newest-first, serial, at most MAX_PER_RUN notebooks per call. */
export async function runBackfill(limit = 1) {
  if (running) return { busy: true as const };
  running = true;
  try {
    const n = Math.max(1, Math.min(MAX_PER_RUN, Math.floor(limit) || 1));
    let notebooks = 0;
    let flags = 0;
    let stopped: string | null = null;
    for (const c of backfillCandidates().slice(0, n)) {
      const r = await proofreadNotebook(c.id);
      if (r.ok) {
        notebooks++;
        flags += r.flags;
      } else {
        stopped = r.skipped === "error" ? `error: ${r.error}` : r.skipped;
        if (r.skipped !== "no-pdf" && r.skipped !== "no-text") break;
      }
    }
    return { busy: false as const, done: notebooks, flags, stopped, left: estimateBackfill() };
  } finally {
    running = false;
  }
}
