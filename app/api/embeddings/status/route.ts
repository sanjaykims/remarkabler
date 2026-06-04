import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { embeddingsEnabled, voyageModel } from "@/lib/embeddings";
import { runEmbeddingBackfillOnce } from "@/lib/notes";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The full backfill can take a couple of minutes for a large corpus; let
// Vercel/Railway give us up to 5 minutes before terminating the request.
export const maxDuration = 300;

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  const enabled = embeddingsEnabled();
  const model = voyageModel();

  const total = (
    db()
      .prepare(
        `SELECT COUNT(*) AS c FROM pages WHERE ocr_text IS NOT NULL AND ocr_text != ''`
      )
      .get() as { c: number }
  ).c;
  const embedded = (
    db()
      .prepare(
        `SELECT COUNT(*) AS c FROM pages
         WHERE ocr_text IS NOT NULL AND ocr_text != ''
           AND embedding IS NOT NULL`
      )
      .get() as { c: number }
  ).c;

  const lastCall = db()
    .prepare(
      `SELECT created_at FROM api_usage
       WHERE feature = 'embeddings'
       ORDER BY id DESC LIMIT 1`
    )
    .get() as { created_at: string } | undefined;

  return NextResponse.json({
    enabled,
    model,
    embeddedPages: embedded,
    totalPages: total,
    lastCallAt: lastCall?.created_at || null,
  });
}

/**
 * Manual backfill trigger. Bypasses the 5-minute background-sweep throttle
 * and reports a real error when a Voyage batch fails (the background path
 * silently breaks out of the loop, which is why a stalled count never
 * resumed by itself).
 */
export async function POST() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  if (!embeddingsEnabled()) {
    return NextResponse.json(
      { error: "Voyage isn't enabled. Set VOYAGE_API_KEY in Railway." },
      { status: 400 }
    );
  }
  const result = await runEmbeddingBackfillOnce();
  return NextResponse.json(result, { status: result.error ? 500 : 200 });
}
