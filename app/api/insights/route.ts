import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildNotesContext, buildChatContext } from "@/lib/notes";
import { generateInsights, generateInsightTitle } from "@/lib/claude";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LOCKED = () =>
  NextResponse.json({ error: "Locked" }, { status: 401 });

// Throttle title backfill: only one attempt every ~5 minutes, and at most
// 3 titles per attempt. Previously this fired one Anthropic call PER untitled
// row in parallel on every Insights page load — at $0.05+ a call, a user
// refreshing the page a few times a day with a handful of untitled entries
// could quietly burn $10+/month.
const TITLE_BACKFILL_INTERVAL_MS = 5 * 60 * 1000;
const TITLE_BACKFILL_PER_RUN = 3;
let lastTitleBackfillAt = 0;

async function backfillTitles() {
  const now = Date.now();
  if (now - lastTitleBackfillAt < TITLE_BACKFILL_INTERVAL_MS) return;
  lastTitleBackfillAt = now;

  let untitled: Array<{ id: number; content: string }>;
  try {
    untitled = db()
      .prepare(
        `SELECT id, content FROM insights
         WHERE title IS NULL OR title = ''
         ORDER BY id DESC LIMIT ?`
      )
      .all(TITLE_BACKFILL_PER_RUN) as Array<{ id: number; content: string }>;
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
      } catch (e) {
        // Leave untitled; a later run will retry. Log so a persistent
        // failure shows up in Railway logs.
        console.warn("[insights] title backfill failed:", (e as Error).message);
      }
    })
  );
}

export async function GET() {
  if (!isAuthenticated()) return LOCKED();
  // Fire-and-forget — the user shouldn't wait for title backfill on every
  // page load. The throttle above caps cost; the response still ships the
  // current state and titles populate over subsequent refreshes.
  backfillTitles().catch(() => {});
  const insights = db()
    .prepare(`SELECT id, title, content, created_at FROM insights ORDER BY id DESC`)
    .all();
  return NextResponse.json({ insights });
}

export async function POST() {
  if (!isAuthenticated()) return LOCKED();
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
