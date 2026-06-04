import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { embeddingsEnabled, voyageModel } from "@/lib/embeddings";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
