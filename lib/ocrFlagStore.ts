import crypto from "crypto";
import { db } from "./db";
import { MAX_FLAGS_PER_CALL, anchorPhrase, type OcrFlag } from "./ocrFlags";

// Write side of the proofreading queue. Kept apart from lib/ocrReview.ts
// (which needs lib/notes.ts for corrections) so the ingest paths in
// lib/notes.ts / lib/remarkableSync.ts can import it without an import cycle.

const MAX_PENDING_PER_PAGE = MAX_FLAGS_PER_CALL;

/**
 * Store the flags for ONE page row, superseding any still-pending flags for
 * that page (it was just re-transcribed). Flags whose phrase can't be found in
 * `text` are dropped: an unanchorable flag could never be applied.
 */
export function saveOcrFlags(args: {
  notebookId: string;
  pageRowId: string;
  pageIndex: number;
  text: string;
  flags: Array<Pick<OcrFlag, "phrase" | "alternatives" | "reason">>;
}): number {
  const { notebookId, pageRowId, pageIndex, text, flags } = args;
  const d = db();
  let saved = 0;
  d.transaction(() => {
    d.prepare(`DELETE FROM ocr_flags WHERE page_id = ? AND status = 'pending'`).run(pageRowId);
    const ins = d.prepare(
      `INSERT INTO ocr_flags(id, notebook_id, page_id, page_index, start_offset, phrase, candidates, reason)
       VALUES(?,?,?,?,?,?,?,?)`
    );
    const seen = new Set<string>();
    for (const f of flags.slice(0, MAX_PENDING_PER_PAGE)) {
      if (seen.has(f.phrase)) continue;
      const start = anchorPhrase(text, f.phrase);
      if (start === -1) continue;
      seen.add(f.phrase);
      ins.run(
        crypto.randomUUID(),
        notebookId,
        pageRowId,
        pageIndex,
        start,
        f.phrase,
        JSON.stringify(f.alternatives.slice(0, 3)),
        f.reason || null
      );
      saved++;
    }
  })();
  return saved;
}

/** A page's re-transcription replaced its text: clear flags that no longer apply. */
export function clearPendingFlagsForNotebook(notebookId: string): void {
  db().prepare(`DELETE FROM ocr_flags WHERE notebook_id = ? AND status = 'pending'`).run(notebookId);
}

