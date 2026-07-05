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

// Canonical display name per (kind, name_norm), reusing the exact
// MIN(name) GROUP BY name_norm convention already used by
// lib/mind.ts:getTopEntities and the top_entities chat tool
// (lib/chatTools.ts) — so the diary export, /mind, and chat all agree on
// one display casing per real-world entity. One aggregate query for the
// whole table; joined to per-page rows in JS below (no N+1).
//
// MUST join through pages and apply the same notebook_id != DISCIPLINE_ID
// scope as the exported rows (and as getTopEntities/topEntities) — without
// it, a discipline-notebook entity with a lexicographically smaller name
// could win MIN(name) and leak an entity spelling into the diary export
// that the diary's own (discipline-excluded) data never produced (Codex,
// PR #101).
function fetchCanonicalEntityNames(): Map<string, string> {
  const rows = db()
    .prepare(
      `SELECT e.kind, e.name_norm, MIN(e.name) AS canonical_name
       FROM entry_entities e
       JOIN pages p ON p.id = e.page_id
       WHERE p.notebook_id != ?
       GROUP BY e.kind, e.name_norm`
    )
    .all(DISCIPLINE_ID) as Array<{
    kind: string;
    name_norm: string;
    canonical_name: string;
  }>;
  const map = new Map<string, string>();
  // Space-joined key: kind is always one of a fixed 3-value enum with no
  // whitespace of its own, so this key is unambiguous even though
  // name_norm is free text.
  for (const r of rows) map.set(`${r.kind} ${r.name_norm}`, r.canonical_name);
  return map;
}

// Strip characters that would corrupt [[wikilink]] or YAML syntax if an
// extracted name happens to contain them (rare — Claude's entity
// extraction has no character allowlist). Applied once here so every
// consumer (pageMetaLine, the frontmatter arrays) gets already-safe names.
function sanitizeEntityName(name: string): string {
  return name.replace(/[[\]|]/g, "").replace(/\r?\n/g, " ").trim();
}

// Shared fetch: all diary pages (discipline notebook excluded) in
// notebook-walk order so carry-forward is correct, plus the per-page
// entity map (canonical, sanitized display names — see
// fetchCanonicalEntityNames/sanitizeEntityName above).
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

  const canonicalNames = fetchCanonicalEntityNames();
  const entityRows = db()
    .prepare(
      `SELECT page_id, kind, name_norm FROM entry_entities ORDER BY kind, name_norm`
    )
    .all() as Array<{ page_id: string; kind: string; name_norm: string }>;
  const entitiesByPage = new Map<string, PageEntities>();
  for (const e of entityRows) {
    let bucket = entitiesByPage.get(e.page_id);
    if (!bucket) {
      bucket = { person: [], place: [], project: [] };
      entitiesByPage.set(e.page_id, bucket);
    }
    if (e.kind === "person" || e.kind === "place" || e.kind === "project") {
      const canonical =
        canonicalNames.get(`${e.kind} ${e.name_norm}`) ?? e.name_norm;
      bucket[e.kind].push(sanitizeEntityName(canonical));
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
