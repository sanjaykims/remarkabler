import { db } from "./db";
import { TZ_OFFSET_MIN, parseSqliteUtc } from "./format";
import { DISCIPLINE_ID } from "./notes";
import {
  buildDiaryMarkdown,
  buildDayFiles,
  effectiveDateKeys,
  UNDATED_FILE,
  type DiaryPageRow,
  type PageEntities,
} from "./diaryExport";

// DB-backed diary Markdown renderer shared by the download route
// (app/api/export/diary) and the Dropbox auto-export (lib/dropbox.ts), so
// both produce byte-identical output from one implementation. The pure
// assembly + carry-forward live in lib/diaryExport.ts (unit-tested); this
// just fetches rows and hands them over.

function fmtExportedAt(): string {
  const nowSqlite = new Date().toISOString().slice(0, 19).replace("T", " ");
  const d = parseSqliteUtc(nowSqlite);
  if (!d) return "";
  return new Date(d.getTime() + TZ_OFFSET_MIN * 60 * 1000)
    .toISOString()
    .slice(0, 16)
    .replace("T", " ");
}

// Shared fetch: all diary pages (discipline notebook excluded) in
// notebook-walk order so carry-forward is correct, plus the per-page
// entity map.
function fetchDiaryData(): {
  rows: DiaryPageRow[];
  entitiesByPage: Map<string, PageEntities>;
} {
  const rows = db()
    .prepare(
      `SELECT p.id, p.notebook_id, p.entry_date, p.page_index, p.ocr_text,
              n.name AS notebook_name,
              a.themes, a.sentiment
       FROM pages p
       JOIN notebooks n ON n.id = p.notebook_id
       LEFT JOIN entry_analysis a ON a.page_id = p.id
       WHERE p.ocr_text IS NOT NULL AND p.ocr_text != ''
         AND p.notebook_id != ?
       ORDER BY
         n.synced_at ASC NULLS LAST,
         p.notebook_id ASC,
         p.page_index ASC`
    )
    .all(DISCIPLINE_ID) as DiaryPageRow[];

  const entityRows = db()
    .prepare(
      `SELECT page_id, kind, name FROM entry_entities ORDER BY kind, name`
    )
    .all() as Array<{ page_id: string; kind: string; name: string }>;
  const entitiesByPage = new Map<string, PageEntities>();
  for (const e of entityRows) {
    let bucket = entitiesByPage.get(e.page_id);
    if (!bucket) {
      bucket = { person: [], place: [], project: [] };
      entitiesByPage.set(e.page_id, bucket);
    }
    if (e.kind === "person" || e.kind === "place" || e.kind === "project") {
      bucket[e.kind].push(e.name);
    }
  }
  return { rows, entitiesByPage };
}

// One combined Markdown document — used by the download route.
export function renderDiaryMarkdown(): string {
  const { rows, entitiesByPage } = fetchDiaryData();
  return buildDiaryMarkdown({ rows, entitiesByPage, exportedAt: fmtExportedAt() });
}

// One file per day (+ undated.md) — used by the Dropbox per-day export.
// Map key is the filename (e.g. "2026-06-19.md").
export function renderDiaryDayFiles(): Map<string, string> {
  const { rows, entitiesByPage } = fetchDiaryData();
  return buildDayFiles({ rows, entitiesByPage, exportedAt: fmtExportedAt() });
}

/**
 * The day-file names one notebook's pages could have changed, so the
 * Dropbox export can re-upload just those instead of the whole vault.
 * Excludes the discipline notebook (returns [] for it).
 */
export function affectedDayFileNames(notebookId: string): string[] {
  if (notebookId === DISCIPLINE_ID) return [];
  const rows = db()
    .prepare(
      `SELECT notebook_id, entry_date
       FROM pages
       WHERE notebook_id = ? AND ocr_text IS NOT NULL AND ocr_text != ''
       ORDER BY page_index ASC`
    )
    .all(notebookId) as Array<{ notebook_id: string; entry_date: string | null }>;
  const { dates, hasUndated } = effectiveDateKeys(rows);
  const names = dates.map((d) => `${d}.md`);
  if (hasUndated) names.push(UNDATED_FILE);
  return names;
}
