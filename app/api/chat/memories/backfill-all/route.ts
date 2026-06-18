import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { maybeCompressChatSessions } from "@/lib/chatMemory";
import { chunkMessageIds, type BackfillMessage } from "@/lib/chatMemoryBackfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

function createBatchForChunk(
  conversation_id: string,
  messageIds: number[]
): number | null {
  const ins = db()
    .prepare(`INSERT INTO chat_archive_batches(conversation_id) VALUES(?)`)
    .run(conversation_id);
  const batchId = Number(ins.lastInsertRowid);
  const placeholders = messageIds.map(() => "?").join(",");
  db()
    .prepare(
      `UPDATE chat_messages SET archive_batch_id = ?
       WHERE id IN (${placeholders})`
    )
    .run(batchId, ...messageIds);
  const stats = db()
    .prepare(
      `SELECT MIN(id) AS s, MAX(id) AS e, COUNT(*) AS c,
              COALESCE(SUM(CASE WHEN role='user' THEN LENGTH(content) ELSE 0 END), 0) AS uc
         FROM chat_messages WHERE archive_batch_id = ?`
    )
    .get(batchId) as {
    s: number | null;
    e: number | null;
    c: number;
    uc: number;
  };
  if (stats.c === 0) {
    db()
      .prepare(`DELETE FROM chat_archive_batches WHERE id = ?`)
      .run(batchId);
    return null;
  }
  db()
    .prepare(
      `UPDATE chat_archive_batches
         SET message_start_id = ?, message_end_id = ?,
             message_count = ?, user_char_count = ?
       WHERE id = ?`
    )
    .run(stats.s, stats.e, stats.c, stats.uc, batchId);
  return batchId;
}

/**
 * Chunked backfill of chat history into the chat-memory layer.
 *
 * Modes:
 *  - default (no `?reset=true`): only touches messages that aren't already
 *    in a batch. Groups them per conversation, chunks each conversation
 *    into multiple batches by char budget, fires extraction. Safe.
 *  - `?reset=true`: destructive — drops every chat_memories row, every
 *    chat_archive_batches row, NULLs out chat_messages.archive_batch_id,
 *    then runs the same chunked backfill from scratch. Used when the
 *    previous extraction was incomplete (e.g. single-batch-with-truncation)
 *    and the user wants a clean re-run. archived_at is never touched, so
 *    visible chat stays visible.
 */
export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return LOCKED();
  const reset = req.nextUrl.searchParams.get("reset") === "true";

  const created = db().transaction(() => {
    if (reset) {
      // Wipe everything that the memory layer owns. archived_at on
      // chat_messages stays put — visible chat stays visible.
      db().prepare(`DELETE FROM chat_memories`).run();
      db().prepare(`UPDATE chat_messages SET archive_batch_id = NULL`).run();
      db().prepare(`DELETE FROM chat_archive_batches`).run();
    }

    const orphanConvs = db()
      .prepare(
        `SELECT DISTINCT conversation_id FROM chat_messages
         WHERE archive_batch_id IS NULL`
      )
      .all() as Array<{ conversation_id: string }>;

    const ids: number[] = [];
    for (const { conversation_id } of orphanConvs) {
      const messages = db()
        .prepare(
          `SELECT id, role, content FROM chat_messages
           WHERE conversation_id = ? AND archive_batch_id IS NULL
           ORDER BY id ASC`
        )
        .all(conversation_id) as BackfillMessage[];
      if (messages.length === 0) continue;

      const chunks = chunkMessageIds(messages);
      for (const chunk of chunks) {
        const batchId = createBatchForChunk(conversation_id, chunk);
        if (batchId !== null) ids.push(batchId);
      }
    }
    return ids;
  })();

  try {
    void maybeCompressChatSessions(Math.max(created.length, 5));
  } catch {
    // best-effort
  }
  return NextResponse.json({ ok: true, batchesCreated: created.length, reset });
}
