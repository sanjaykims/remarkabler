import { db } from "./db";
import { TZ_OFFSET_MIN, parseSqliteUtc } from "./format";
import { DISCIPLINE_ID } from "./notes";
import {
  buildDiaryMarkdown,
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

export function renderDiaryMarkdown(): string {
  // Notebook-walk order so date carry-forward in buildDiaryMarkdown is
  // correct. The github-discipline notebook (GitHub repo text files) is
  // excluded unconditionally — it is not diary content, same as /mind.
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

  return buildDiaryMarkdown({
    rows,
    entitiesByPage,
    exportedAt: fmtExportedAt(),
  });
}
