import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { getCurrentProfileRow } from "@/lib/profile";
import { TZ_OFFSET_MIN, parseSqliteUtc } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

function shifted(d: Date): Date {
  return new Date(d.getTime() + TZ_OFFSET_MIN * 60 * 1000);
}

function fmtDate(iso: string | null): string {
  const d = parseSqliteUtc(iso);
  if (!d) return "";
  return shifted(d).toISOString().slice(0, 10);
}

function fmtDateTime(iso: string | null): string {
  const d = parseSqliteUtc(iso);
  if (!d) return "";
  return shifted(d).toISOString().slice(0, 16).replace("T", " ");
}

function fmtTime(iso: string | null): string {
  const d = parseSqliteUtc(iso);
  if (!d) return "";
  return shifted(d).toISOString().slice(11, 16);
}

export async function GET() {
  if (!(await isAuthenticated())) return LOCKED();

  const profileRow = getCurrentProfileRow();

  // Notebooks oldest-first so the diary reads chronologically in the book.
  const notebooks = db()
    .prepare(
      `SELECT id, name, synced_at FROM notebooks
       ORDER BY synced_at ASC NULLS LAST, name`
    )
    .all() as Array<{ id: string; name: string; synced_at: string | null }>;

  const pages = db()
    .prepare(
      `SELECT notebook_id, page_index, ocr_text FROM pages
       WHERE ocr_text IS NOT NULL AND ocr_text != ''
       ORDER BY notebook_id, page_index`
    )
    .all() as Array<{ notebook_id: string; page_index: number; ocr_text: string }>;

  // All chats, archived included — the point of a book is the full record.
  const chats = db()
    .prepare(
      `SELECT role, content, created_at FROM chat_messages ORDER BY id ASC`
    )
    .all() as Array<{ role: string; content: string; created_at: string }>;

  const insights = db()
    .prepare(
      `SELECT title, content, created_at FROM insights ORDER BY id ASC`
    )
    .all() as Array<{
      title: string | null;
      content: string;
      created_at: string;
    }>;

  // Bucket pages by notebook id for fast lookup.
  const pagesByNotebook = new Map<string, typeof pages>();
  for (const p of pages) {
    const list = pagesByNotebook.get(p.notebook_id);
    if (list) list.push(p);
    else pagesByNotebook.set(p.notebook_id, [p]);
  }

  const exportedAt = fmtDateTime(
    new Date().toISOString().slice(0, 19).replace("T", " ")
  );

  const lines: string[] = [];

  lines.push("# Remarkabler — Book Draft");
  lines.push("");
  lines.push(`_Exported ${exportedAt}_`);
  lines.push("");

  // Profile
  if (profileRow?.content?.trim()) {
    lines.push("---");
    lines.push("");
    lines.push("## Your Profile");
    lines.push("");
    lines.push(
      `_What Claude has come to understand about you (last updated ${fmtDateTime(
        profileRow.created_at
      )})._`
    );
    lines.push("");
    lines.push(profileRow.content.trim());
    lines.push("");
  }

  // Diary
  const hasAnyDiary = notebooks.some((n) =>
    (pagesByNotebook.get(n.id) || []).length > 0
  );
  if (hasAnyDiary) {
    lines.push("---");
    lines.push("");
    lines.push("## Diary");
    lines.push("");
    for (const nb of notebooks) {
      const nbPages = pagesByNotebook.get(nb.id);
      if (!nbPages || nbPages.length === 0) continue;
      const when = nb.synced_at ? fmtDate(nb.synced_at) : "";
      lines.push(`### ${nb.name}`);
      if (when) {
        lines.push(`_Uploaded ${when}_`);
        lines.push("");
      }
      for (const p of nbPages) {
        lines.push(p.ocr_text.trim());
        lines.push("");
      }
    }
  }

  // Conversations
  if (chats.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Conversations with Claude");
    lines.push("");
    let currentDate = "";
    for (const m of chats) {
      const d = fmtDate(m.created_at);
      if (d !== currentDate) {
        if (currentDate) lines.push("");
        lines.push(`### ${d}`);
        lines.push("");
        currentDate = d;
      }
      const time = fmtTime(m.created_at);
      const speaker = m.role === "user" ? "**You**" : "**Claude**";
      lines.push(`${speaker} _(${time})_`);
      lines.push("");
      lines.push(m.content.trim());
      lines.push("");
    }
  }

  // Insights (oldest first to read as a growing record)
  if (insights.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Insights");
    lines.push("");
    for (const ins of insights) {
      const when = fmtDate(ins.created_at);
      const title = ins.title?.trim() || "(untitled)";
      lines.push(`### ${title} — ${when}`);
      lines.push("");
      lines.push(ins.content.trim());
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
  lines.push("_End of export._");
  lines.push("");

  const md = lines.join("\n");
  const dateStamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="remarkabler-book-draft-${dateStamp}.md"`,
    },
  });
}
