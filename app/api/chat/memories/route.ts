import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { pendingBatchDetails } from "@/lib/chatMemory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// Mirrors MAX_EXTRACTION_ATTEMPTS in lib/chatMemory.ts; keeping the value in
// both places means the /memory UI can flag stuck batches without importing
// the whole module (and dragging the Anthropic SDK with it).
const STUCK_ATTEMPTS = 2;

type MemoryRow = {
  id: number;
  category: string;
  category_raw: string | null;
  text: string;
  source_excerpt: string | null;
  created_at: string;
  embedding: Buffer | null;
};

export async function GET() {
  if (!(await isAuthenticated())) return LOCKED();

  const rows = db()
    .prepare(
      `SELECT id, category, category_raw, text, source_excerpt, created_at, embedding
       FROM chat_memories
       WHERE deleted_at IS NULL
       ORDER BY id DESC
       LIMIT 500`
    )
    .all() as MemoryRow[];

  const memories = rows.map((r) => ({
    id: r.id,
    category: r.category,
    category_raw: r.category_raw,
    text: r.text,
    source_excerpt: r.source_excerpt,
    created_at: r.created_at,
    missing_embedding: r.embedding === null ? 1 : 0,
  }));

  const counts = db()
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM chat_memories WHERE deleted_at IS NULL) AS total,
         (SELECT COUNT(*) FROM chat_memories WHERE deleted_at IS NULL AND embedding IS NULL) AS missing_embedding,
         (SELECT MAX(created_at) FROM chat_memories WHERE deleted_at IS NULL) AS last_extracted_at,
         (SELECT COUNT(*) FROM chat_archive_batches WHERE memory_extracted_at IS NULL) AS pending_batches,
         (SELECT COUNT(*) FROM chat_archive_batches
            WHERE memory_extracted_at IS NOT NULL
              AND extraction_error IS NOT NULL
              AND failed_attempts >= ?) AS stuck_batches`
    )
    .get(STUCK_ATTEMPTS) as {
    total: number;
    missing_embedding: number;
    last_extracted_at: string | null;
    pending_batches: number;
    stuck_batches: number;
  };

  const lastErrorRow = db()
    .prepare(
      `SELECT extraction_error FROM chat_archive_batches
       WHERE extraction_error IS NOT NULL
       ORDER BY id DESC LIMIT 1`
    )
    .get() as { extraction_error: string | null } | undefined;

  const stuckBatchRows = db()
    .prepare(
      `SELECT id FROM chat_archive_batches
       WHERE memory_extracted_at IS NOT NULL
         AND extraction_error IS NOT NULL
         AND failed_attempts >= ?
       ORDER BY id DESC LIMIT 20`
    )
    .all(STUCK_ATTEMPTS) as Array<{ id: number }>;

  return NextResponse.json({
    memories,
    status: {
      total: counts.total,
      last_extracted_at: counts.last_extracted_at,
      missing_embedding: counts.missing_embedding,
      pending_batches: counts.pending_batches,
      pending_batch_details: pendingBatchDetails(),
      stuck_batches: counts.stuck_batches,
      stuck_batch_ids: stuckBatchRows.map((r) => r.id),
      last_extraction_error: lastErrorRow?.extraction_error ?? null,
    },
  });
}
