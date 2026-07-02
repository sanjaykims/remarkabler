import { db } from "./db";
import { compareTranscriptions } from "./claude";
import { DISCIPLINE_ID } from "./notes";

// ── Phase 1b quality gate: compare a cloud import against existing entries ──
//
// The whole point of the on-demand import is to prove the server-side `.rm`
// render OCRs the user's handwriting as well as the trusted Dropbox path
// before Phase 2 (automatic polling) gets built. This runs server-side where
// the SQLite corpus lives: pair the imported notebook's pages with existing
// (non-cloud) pages for the SAME entry dates and have Claude judge the two
// transcriptions.

const MAX_CHARS_PER_SIDE_PER_DAY = 4_000;
const MAX_TOTAL_CHARS = 60_000;

type PageRow = { entry_date: string | null; ocr_text: string };

export type CompareResult = {
  ok: boolean;
  report?: string;
  daysCompared?: number;
  daysOnlyImported?: string[];
  error?: string;
};

function textByDate(rows: PageRow[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows) {
    const d = r.entry_date && r.entry_date !== "none" ? r.entry_date : null;
    if (!d || !r.ocr_text) continue;
    m.set(d, (m.get(d) ? m.get(d) + "\n\n" : "") + r.ocr_text);
  }
  return m;
}

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
      `SELECT entry_date, ocr_text FROM pages
       WHERE notebook_id = ? AND ocr_text IS NOT NULL AND ocr_text != ''`
    )
    .all(nb.id) as PageRow[];
  const importedByDate = textByDate(imported);
  if (importedByDate.size === 0) {
    return {
      ok: false,
      error:
        "The imported notebook has no dated entries to compare (no diary-style date headers found).",
    };
  }

  // Existing = pages from non-cloud notebooks (manual/Dropbox), excluding the
  // GitHub discipline notebook, on the same dates.
  const dates = Array.from(importedByDate.keys());
  const placeholders = dates.map(() => "?").join(",");
  const existing = db()
    .prepare(
      `SELECT p.entry_date, p.ocr_text FROM pages p
       JOIN notebooks n ON n.id = p.notebook_id
       WHERE n.remarkable_doc_id IS NULL AND n.id != ?
         AND p.entry_date IN (${placeholders})
         AND p.ocr_text IS NOT NULL AND p.ocr_text != ''`
    )
    .all(DISCIPLINE_ID, ...dates) as PageRow[];
  const existingByDate = textByDate(existing);

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
