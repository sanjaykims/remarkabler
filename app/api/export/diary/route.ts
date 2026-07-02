import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { renderDiaryMarkdown } from "@/lib/diaryExportDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// Diary-only Markdown export. Distinct from /api/export (the full "raw
// bundle": profile + diary + chats + insights) — this is JUST the
// transcribed diary, per-day, oldest → newest, for Obsidian / NotebookLM /
// offline backup. No LLM calls, no external writes: reads the local DB via
// renderDiaryMarkdown() (shared with the Dropbox auto-export) and streams
// the file back as a download.

export async function GET() {
  if (!isAuthenticated()) return LOCKED();

  const md = renderDiaryMarkdown();
  const dateStamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="remarkabler-diary-${dateStamp}.md"`,
    },
  });
}
