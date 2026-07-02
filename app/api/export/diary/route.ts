import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { TZ_OFFSET_MIN, parseSqliteUtc } from "@/lib/format";
import {
  buildDiaryMarkdown,
  type DiaryPageRow,
  type PageEntities,
} from "@/lib/diaryExport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// Diary-only Markdown export. Distinct from /api/export (the full "raw
// bundle": profile + diary + chats + insights) — this is JUST the
// transcribed diary, organised by the date the user wrote each entry
// (pages.entry_date), oldest → newest. The portable, tool-agnostic copy of
// your diary: drop it into Obsidian, upload it to NotebookLM for an audio
// overview, or keep it as plain-text backup. No LLM calls, no external
// writes — reads the local DB and streams the text back as a download.
//
// Assembly lives in lib/diaryExport.ts (pure, unit-tested); this route only
// authenticates, queries, and shapes the rows.

function fmtExportedAt(): string {
  const nowSqlite = new Date().toISOString().slice(0, 19).replace("T", " ");
  const d = parseSqliteUtc(nowSqlite);
  if (!d) return "";
  return new Date(d.getTime() + TZ_OFFSET_MIN * 60 * 1000)
    .toISOString()
    .slice(0, 16)
    .replace("T", " ");
}

export async function GET() {
  if (!isAuthenticated()) return LOCKED();

  const rows = db()
    .prepare(
      `SELECT p.id, p.entry_date, p.page_index, p.ocr_text,
              n.name AS notebook_name,
              a.themes, a.sentiment
       FROM pages p
       JOIN notebooks n ON n.id = p.notebook_id
       LEFT JOIN entry_analysis a ON a.page_id = p.id
       WHERE p.ocr_text IS NOT NULL AND p.ocr_text != ''
       ORDER BY
         CASE WHEN p.entry_date IS NULL OR p.entry_date = 'none' THEN 1 ELSE 0 END ASC,
         p.entry_date ASC,
         n.synced_at ASC NULLS LAST,
         p.page_index ASC`
    )
    .all() as DiaryPageRow[];

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

  const md = buildDiaryMarkdown({
    rows,
    entitiesByPage,
    exportedAt: fmtExportedAt(),
  });
  const dateStamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="remarkabler-diary-${dateStamp}.md"`,
    },
  });
}
