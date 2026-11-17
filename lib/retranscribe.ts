import fs from "fs";
import path from "path";
import { db, getSetting, setSetting } from "./db";
import { modelMain } from "./claude";
import { priceFor } from "./usage";
import { queueNotebookProcessing } from "./notes";

// Whole-notebook re-transcription with the current prompt, hints and handwriting
// examples. Unlike the proofreading pass this REPLACES page text (the previous
// text is kept in ocr_text_backup). Runs through the normal durable OCR queue.

const FILES_DIR = path.join(process.env.DATA_DIR || path.join(process.cwd(), "data"), "files");
export const MAX_QUEUE_PER_CALL = 5;
const AUTO_KEY = "retranscribe_auto";
const NOTE_KEY = "retranscribe_auto_note";
const LEFT_KEY = "retranscribe_auto_left";
const PDF_TOKENS_PER_PAGE = 1700;
const SKIP = ["github-discipline"];

type Cand = { id: string; name: string; pages: number; chars: number };

/** Done notebooks with a stored PDF, not yet re-transcribed. Notebooks under reMarkable
 *  page-level sync are excluded: a whole-PDF redo would delete their per-page rows. */
export function retranscribeCandidates(): Cand[] {
  const rows = db()
    .prepare(
      `SELECT n.id, n.name, COUNT(p.id) AS pages, COALESCE(SUM(LENGTH(p.ocr_text)), 0) AS chars
         FROM notebooks n JOIN pages p ON p.notebook_id = n.id
        WHERE n.status = 'done' AND n.retranscribed_at IS NULL AND n.retranscribe = 0
          AND n.id NOT IN (${SKIP.map(() => "?").join(",")})
          AND NOT EXISTS (SELECT 1 FROM pages q WHERE q.notebook_id = n.id AND q.remarkable_page_id IS NOT NULL)
        GROUP BY n.id
        ORDER BY n.synced_at DESC, n.rowid DESC`
    )
    .all(...SKIP) as Cand[];
  return rows.filter((r) => fs.existsSync(path.join(FILES_DIR, r.id, "notebook.pdf")));
}

export function estimateRetranscribe() {
  const c = retranscribeCandidates();
  const pages = c.reduce((a, r) => a + r.pages, 0);
  const chars = c.reduce((a, r) => a + r.chars, 0);
  const p = priceFor(modelMain());
  const usd = ((pages * PDF_TOKENS_PER_PAGE + 8000 * c.length) * p.input + (chars / 3.5) * p.output) / 1e6;
  const inProgress = (
    db().prepare(`SELECT COUNT(*) AS n FROM notebooks WHERE retranscribe = 1`).get() as { n: number }
  ).n;
  return {
    notebooks: c.length,
    pages,
    estimatedUsd: Math.round(usd * 100) / 100,
    inProgress,
    auto: getSetting(AUTO_KEY) === "1",
    autoNote: getSetting(NOTE_KEY) || "",
    next: c[0] ? { name: c[0].name, pages: c[0].pages } : null,
  };
}

/** Queue the next few notebooks (newest first). The OCR queue does the work in the background. */
export function queueRetranscribe(limit = 1) {
  const n = Math.max(1, Math.min(MAX_QUEUE_PER_CALL, Math.floor(limit) || 1));
  const picked = retranscribeCandidates().slice(0, n);
  const set = db().prepare(`UPDATE notebooks SET status = 'queued', retranscribe = 1, error = NULL WHERE id = ? AND status = 'done'`);
  let queued = 0;
  for (const c of picked) {
    if (set.run(c.id).changes === 1) queued++;
  }
  if (queued) queueNotebookProcessing(picked[0].id);
  return { queued, left: estimateRetranscribe() };
}

/** Turn the server-side "keep going until done" mode on or off. */
export function setAutoRetranscribe(on: boolean) {
  setSetting(AUTO_KEY, on ? "1" : "");
  setSetting(NOTE_KEY, "");
  setSetting(LEFT_KEY, "");
  return on ? queueRetranscribe(MAX_QUEUE_PER_CALL) : { queued: 0, left: estimateRetranscribe() };
}

/** Called from the maintenance sweep: when auto mode is on and the last batch has finished,
 *  queue the next one. Stops by itself when none are left or a whole batch made no progress
 *  (every notebook failed), so a broken notebook can never loop forever. Never throws. */
export function maybeContinueRetranscribe(): void {
  try {
    if (getSetting(AUTO_KEY) !== "1") return;
    const e = estimateRetranscribe();
    if (e.inProgress > 0) return;
    if (e.notebooks === 0) {
      setSetting(AUTO_KEY, "");
      setSetting(NOTE_KEY, "All notebooks re-transcribed.");
      return;
    }
    const last = Number(getSetting(LEFT_KEY) || "0");
    if (last > 0 && e.notebooks >= last) {
      setSetting(AUTO_KEY, "");
      setSetting(NOTE_KEY, "Stopped: the last batch made no progress. Try Test on 1 notebook to see the error.");
      return;
    }
    setSetting(LEFT_KEY, String(e.notebooks));
    queueRetranscribe(MAX_QUEUE_PER_CALL);
  } catch (err) {
    console.warn("[retranscribe] auto-continue failed:", (err as Error).message);
  }
}

/** Make every finished notebook eligible for re-transcription again (does not start anything). */
export function resetRetranscribed(): number {
  return db()
    .prepare(`UPDATE notebooks SET retranscribed_at = NULL WHERE status = 'done' AND retranscribe = 0 AND retranscribed_at IS NOT NULL`)
    .run().changes;
}
