import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildNotesContext } from "@/lib/notes";
import { generateInsights } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  const insights = db()
    .prepare(`SELECT id, content, created_at FROM insights ORDER BY id DESC`)
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
  const priorRows = db()
    .prepare(`SELECT content FROM insights ORDER BY id DESC LIMIT 3`)
    .all() as Array<{ content: string }>;

  let content: string;
  try {
    content = await generateInsights({
      notesContext,
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

  const info = db()
    .prepare(`INSERT INTO insights(content) VALUES(?)`)
    .run(content.trim());
  const insight = db()
    .prepare(`SELECT id, content, created_at FROM insights WHERE id = ?`)
    .get(info.lastInsertRowid);

  return NextResponse.json({ ok: true, insight });
}
