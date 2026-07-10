import { db } from "./db";
import { DISCIPLINE_ID } from "./notes";
import { effectiveDateKeys } from "./diaryExport";
import {
  buildCloudCoverage,
  buildCandidate,
  type DuplicateCandidate,
} from "./notebookDedup";

// DB-backed duplicate-notebook detection. One query, no N+1: fetches every
// transcribed page (ocr_text non-empty), joined to its notebook's origin
// markers, then buckets by notebook_id in JS and runs the pure
// effectiveDateKeys/classification helpers per bucket.
//
// remarkable_doc_id IS NOT NULL means "ingested via reMarkable-cloud
// import/sync" (lib/remarkableImport.ts / lib/remarkableSync.ts). Everything
// else — Dropbox-ingested via dropbox_file_id, or manually uploaded with
// neither id — is a candidate "old" notebook that a later cloud import may
// duplicate. No status ('processing'/'error') gate on either side: a cloud
// notebook mid-incremental-resync still has real ocr_text on its
// already-synced pages (only new/changed pages get re-OCR'd), so gating on
// status would cause spurious full→partial flips during every resync.
export function findDuplicateCandidates(): DuplicateCandidate[] {
  const rows = db()
    .prepare(
      `SELECT p.notebook_id, p.page_index, p.entry_date,
              n.name AS notebook_name, n.remarkable_doc_id
       FROM pages p
       JOIN notebooks n ON n.id = p.notebook_id
       WHERE p.ocr_text IS NOT NULL AND p.ocr_text != ''
         AND p.notebook_id != ?
       ORDER BY p.notebook_id ASC, p.page_index ASC`
    )
    .all(DISCIPLINE_ID) as Array<{
    notebook_id: string;
    page_index: number;
    entry_date: string | null;
    notebook_name: string;
    remarkable_doc_id: string | null;
  }>;

  const byNotebook = new Map<
    string,
    { name: string; isCloud: boolean; rows: typeof rows }
  >();
  for (const r of rows) {
    let bucket = byNotebook.get(r.notebook_id);
    if (!bucket) {
      bucket = { name: r.notebook_name, isCloud: r.remarkable_doc_id !== null, rows: [] };
      byNotebook.set(r.notebook_id, bucket);
    }
    bucket.rows.push(r);
  }

  const cloudNotebooks: Array<{ id: string; name: string; dates: string[] }> = [];
  const oldNotebooks: Array<{
    id: string;
    name: string;
    pageCount: number;
    dates: string[];
    hasUndated: boolean;
  }> = [];
  for (const [id, bucket] of byNotebook) {
    // hasUndated is load-bearing for the delete flow: an undated page (no
    // effective date) contributes nothing to `dates`, so a "full" coverage
    // verdict says nothing about its content — the candidate must carry the
    // flag so the UI can warn instead of implying "safe to delete".
    const { dates, hasUndated } = effectiveDateKeys(bucket.rows);
    if (bucket.isCloud) {
      cloudNotebooks.push({ id, name: bucket.name, dates });
    } else {
      oldNotebooks.push({
        id,
        name: bucket.name,
        pageCount: bucket.rows.length,
        dates,
        hasUndated,
      });
    }
  }

  const coverage = buildCloudCoverage(cloudNotebooks);
  const candidates = oldNotebooks
    .map((old) => buildCandidate(old, coverage))
    .filter((c): c is DuplicateCandidate => c !== null);

  candidates.sort((a, b) => {
    if (a.classification !== b.classification) {
      return a.classification === "full" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  return candidates;
}
