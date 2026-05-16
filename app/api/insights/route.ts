import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildNotesContext, buildChatContext } from "@/lib/notes";
import { generateInsights, generateInsightTitle } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 120;

// Give a short topic title to any older insight that predates the title
// feature. Resilient: a failure leaves the entry untitled and is retried on
// the next load, and never breaks the listing.
async function backfillTitles() {
  let untitled: Array<{ id: number; content: string }>;
  try {
    untitled = db()
      .prepare(`SELECT id, content FROM insights WHERE title IS NULL OR title = ''`)
      .all() as Array<{ id: number; content: string }>;
  } catch {
    return;
  }
  if (untitled.length === 0) return;

  await Promise.allSettled(
    untitled.map(async (row) => {
      try {
        const title = await generateInsightTitle(row.content);
        if (title) {
          db().prepare(`UPDATE insights SET title = ? WHERE id = ?`).run(title, row.id);
        }
      } catch {
        // leave untitled; a later load will retry
      }
    })
  );
}

export async function GET() {
  await backfillTitles();
  const insights = db()
    .prepare(`SELECT id, title, content, created_at FROM insights ORDER BY id DESC`)
    .all();
  return NextResponse.json({ insights });
}

export async function POST() {
  const noteCount = db()
    .prepare(
      `SELECT COUNT(*) AS c FROM pages WHERE ocr_text IS NOT NULL AND ocr_text != ''`
    )
    .get() as { c: number };
  if (noteCount.c === 0) {
    return NextResponse.json(
      { error: "Add some notebooks first — there's nothing to reflect on yet." },
      { status: 400 }
    );
  }

  const notesContext = buildNotesContext();
  const chatContext = buildChatContext();
  const priorRows = db()
    .prepare(`SELECT content FROM insights ORDER BY id DESC LIMIT 3`)
    .all() as Array<{ content: string }>;

  let content: string;
  try {
    content = await generateInsights({
      notesContext,
      chatContext,
      priorInsights: priorRows.map((r) => r.content),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Insight generation failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  if (!content.trim()) {
    return NextResponse.json(
      { error: "No insights were generated. Please try again." },
      { status: 500 }
    );
  }

  let title = "";
  try {
    title = await generateInsightTitle(content.trim());
  } catch {
    // a title is optional — save the entry without one rather than failing
  }

  const info = db()
    .prepare(`INSERT INTO insights(content, title) VALUES(?, ?)`)
    .run(content.trim(), title || null);
  const insight = db()
    .prepare(`SELECT id, title, content, created_at FROM insights WHERE id = ?`)
    .get(info.lastInsertRowid);

  return NextResponse.json({ ok: true, insight });
}
