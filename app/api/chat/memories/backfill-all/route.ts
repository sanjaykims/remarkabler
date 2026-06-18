import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { maybeCompressChatSessions } from "@/lib/chatMemory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// Take every chat message that isn't already in a batch, group by
// conversation_id, and create one chat_archive_batches row per
// conversation. archive_batch_id is stamped on those messages so the
// extractor can find them, but archived_at is left alone — visible chat
// stays visible. A subsequent Clear preserves the existing batch_id via
// COALESCE so the backfill batch's audit trail stays intact.
//
// Self-idempotent: once every message has a batch_id, the SELECT below
// returns nothing and re-running is a no-op.
export async function POST() {
  if (!isAuthenticated()) return LOCKED();

  const created = db().transaction(() => {
    const orphanConvs = db()
      .prepare(
        `SELECT DISTINCT conversation_id FROM chat_messages
         WHERE archive_batch_id IS NULL`
      )
      .all() as Array<{ conversation_id: string }>;

    const ids: number[] = [];
    for (const { conversation_id } of orphanConvs) {
      const ins = db()
        .prepare(
          `INSERT INTO chat_archive_batches(conversation_id) VALUES(?)`
        )
        .run(conversation_id);
      const batchId = Number(ins.lastInsertRowid);
      db()
        .prepare(
          `UPDATE chat_messages SET archive_batch_id = ?
           WHERE conversation_id = ? AND archive_batch_id IS NULL`
        )
        .run(batchId, conversation_id);
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
        continue;
      }
      db()
        .prepare(
          `UPDATE chat_archive_batches
             SET message_start_id = ?, message_end_id = ?,
                 message_count = ?, user_char_count = ?
           WHERE id = ?`
        )
        .run(stats.s, stats.e, stats.c, stats.uc, batchId);
      ids.push(batchId);
    }
    return ids;
  })();

  try {
    void maybeCompressChatSessions();
  } catch {
    // best-effort
  }
  return NextResponse.json({ ok: true, batchesCreated: created.length });
}
