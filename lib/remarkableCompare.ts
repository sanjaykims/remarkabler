import { db } from "./db";
import { compareTranscriptions } from "./claude";
import { DISCIPLINE_ID } from "./notes";
import { carryForwardDates, type DiaryPageRow } from "./diaryExport";

// ── Phase 1b quality gate: compare a cloud import against existing entries ──
//
// The whole point of the on-demand import is to prove the server-side `.rm`
// render OCRs the user's handwriting as well as the trusted Dropbox path
// before Phase 2 (automatic polling) gets built. This runs server-side where
// the SQLite corpus lives: pair the imported notebook's pages with existing
// (non-cloud) pages for the SAME entry dates and have Claude judge the two
// transcriptions.
//
// Dates use the SAME carry-forward rule as the diary export: the user writes
// one "YYYY-MM-DD…KST" header per session and continuation pages inherit it.
// A page-level grouping without carry-forward silently DROPS continuation
// pages (stored entry_date='none') from both sides — that bug made a
// correctly-transcribed section look "missing from the import" in the first
// quality-gate reports, because the split of a tall page put the section on
// its own header-less page.

const MAX_CHARS_PER_SIDE_PER_DAY = 8_000;
const MAX_TOTAL_CHARS = 100_000;

export type CompareResult = {
  ok: boolean;
  report?: string;
  daysCompared?: number;
  daysOnlyImported?: string[];
  error?: string;
};

// Group page text by EFFECTIVE date (header date carried forward within each
// notebook, in page order). Rows must arrive ordered by notebook, page_index.
// Exported for unit testing.
export function textByEffectiveDate(rows: DiaryPageRow[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const { row, effectiveDate } of carryForwardDates(rows)) {
    if (!effectiveDate || !row.ocr_text) continue;
    m.set(
      effectiveDate,
      (m.get(effectiveDate) ? m.get(effectiveDate) + "\n\n" : "") + row.ocr_text
    );
  }
  return m;
}

// Minimal SELECT shaped like DiaryPageRow (themes/sentiment unused here).
const PAGE_COLS = `p.id, p.notebook_id, n.name AS notebook_name, p.page_index,
       p.entry_date, p.ocr_text, NULL AS themes, NULL AS sentiment`;

export async function compareImportedNotebook(
  remarkableDocId: string
): Promise<CompareResult> {
  const nb = db()
    .prepare(
      `SELECT id, name, status FROM notebooks WHERE remarkable_doc_id = ?`
    )
    .get(remarkableDocId) as
    | { id: string; name: string; status: string | null }
    | undefined;
  if (!nb) {
    return { ok: false, error: "Import this notebook first, then compare." };
  }
  if (nb.status === "processing") {
    return {
      ok: false,
      error: "Still transcribing — try comparing in a minute.",
    };
  }
  if (nb.status !== "done") {
    return { ok: false, error: "The import didn't finish transcribing (re-import it first)." };
  }

  const imported = db()
    .prepare(
      `SELECT ${PAGE_COLS} FROM pages p
       JOIN notebooks n ON n.id = p.notebook_id
       WHERE p.notebook_id = ? AND p.ocr_text IS NOT NULL AND p.ocr_text != ''
       ORDER BY p.page_index`
    )
    .all(nb.id) as DiaryPageRow[];
  const importedByDate = textByEffectiveDate(imported);
  if (importedByDate.size === 0) {
    return {
      ok: false,
      error:
        "The imported notebook has no dated entries to compare (no diary-style date headers found).",
    };
  }

  // Existing = ALL pages from non-cloud notebooks (manual/Dropbox), excluding
  // the GitHub discipline notebook. Fetched whole (not date-filtered in SQL)
  // because the effective date of a continuation page only exists after
  // carry-forward; filtering happens below on effective dates.
  const dates = Array.from(importedByDate.keys());
  const existing = db()
    .prepare(
      `SELECT ${PAGE_COLS} FROM pages p
       JOIN notebooks n ON n.id = p.notebook_id
       WHERE n.remarkable_doc_id IS NULL AND n.id != ?
         AND p.ocr_text IS NOT NULL AND p.ocr_text != ''
       ORDER BY n.synced_at, p.notebook_id, p.page_index`
    )
    .all(DISCIPLINE_ID) as DiaryPageRow[];
  const existingByDate = textByEffectiveDate(existing);

  const days: Array<{ date: string; existing: string; imported: string }> = [];
  const daysOnlyImported: string[] = [];
  let total = 0;
  for (const date of dates.sort()) {
    const b = importedByDate.get(date) || "";
    const a = existingByDate.get(date) || "";
    if (!a) {
      daysOnlyImported.push(date);
      continue;
    }
    const ea = a.slice(0, MAX_CHARS_PER_SIDE_PER_DAY);
    const eb = b.slice(0, MAX_CHARS_PER_SIDE_PER_DAY);
    if (total + ea.length + eb.length > MAX_TOTAL_CHARS) break;
    total += ea.length + eb.length;
    days.push({ date, existing: ea, imported: eb });
  }

  if (days.length === 0) {
    return {
      ok: false,
      error:
        `No existing diary entries share dates with this import (dates found: ${dates
          .sort()
          .join(", ")}). Nothing to compare against — was the same notebook ever sent via Dropbox?`,
    };
  }

  try {
    const report = await compareTranscriptions(days);
    if (!report) {
      return { ok: false, error: "The comparison came back empty — try again." };
    }
    return {
      ok: true,
      report,
      daysCompared: days.length,
      daysOnlyImported,
    };
  } catch (e) {
    return {
      ok: false,
      error: `Comparison failed: ${((e as Error).message || "unknown error").slice(0, 160)}`,
    };
  }
}
