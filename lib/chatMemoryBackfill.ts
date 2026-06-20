// Pure helpers for the backfill-all endpoint, extracted so they can be
// unit-tested without dragging Next.js route plumbing into the test
// graph (Next forbids non-route exports from app/**/route.ts).

import type { Database } from "better-sqlite3";

// Target chars per batch's transcript. compressBatch's MAX_TRANSCRIPT_CHARS
// is 16_000; we aim for ~12K so each chunk fits cleanly with headroom and
// nothing gets silently truncated. A single huge batch (one per conversation)
// would lose everything before the most recent 16K chars — exactly the bug
// the first version of this endpoint shipped with.
export const CHUNK_TARGET_CHARS = 12_000;

export type BackfillMessage = { id: number; role: string; content: string };

export function estimateTranscriptCost(role: string, content: string): number {
  // Matches buildTranscript() in lib/chatMemory.ts: "User: <text>\n\n" or
  // "Claude: <text>\n\n". Used to greedy-chunk by char budget.
  const label = role === "user" ? "User: " : "Claude: ";
  return label.length + (content || "").length + 2;
}

export function chunkMessageIds(messages: BackfillMessage[]): number[][] {
  const chunks: number[][] = [];
  let current: number[] = [];
  let cost = 0;
  for (const m of messages) {
    const c = estimateTranscriptCost(m.role, m.content);
    if (current.length > 0 && cost + c > CHUNK_TARGET_CHARS) {
      chunks.push(current);
      current = [];
      cost = 0;
    }
    current.push(m.id);
    cost += c;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Create one chat_archive_batches row and stamp the given message ids with
 * its batch_id, then populate the batch's denormalised stats. Returns the
 * batch id, or null if no messages were actually stamped (e.g. they were
 * concurrently deleted). Always called from a transaction by both the
 * startup orphan migration and the backfill-all route.
 *
 * The two call sites used to have copy-pasted versions of this routine.
 * The startup migration's copy created one giant batch per conversation,
 * which combined with compressBatch's 16K-char cap silently truncated
 * months of chat. Use this helper + chunkMessageIds() so both paths can't
 * drift again.
 */
export function createBatchForChunk(
  db: Database,
  conversationId: string,
  messageIds: number[]
): number | null {
  if (messageIds.length === 0) return null;
  const ins = db
    .prepare(`INSERT INTO chat_archive_batches(conversation_id) VALUES(?)`)
    .run(conversationId);
  const batchId = Number(ins.lastInsertRowid);
  const placeholders = messageIds.map(() => "?").join(",");
  db.prepare(
    `UPDATE chat_messages SET archive_batch_id = ?
     WHERE id IN (${placeholders})`
  ).run(batchId, ...messageIds);
  const stats = db
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
    db.prepare(`DELETE FROM chat_archive_batches WHERE id = ?`).run(batchId);
    return null;
  }
  db.prepare(
    `UPDATE chat_archive_batches
       SET message_start_id = ?, message_end_id = ?,
           message_count = ?, user_char_count = ?
     WHERE id = ?`
  ).run(stats.s, stats.e, stats.c, stats.uc, batchId);
  return batchId;
}

/**
 * Read every un-batched message for a conversation, chunk them by char
 * budget, and create one chat_archive_batches row per chunk. Returns the
 * created batch ids. If `onlyArchived` is true (the safe default), only
 * messages with `archived_at IS NOT NULL` are considered — active
 * (visible) chat is left alone. The startup orphan migration uses
 * `onlyArchived: true`; the backfill-all route also passes true so it
 * never compresses messages the user hasn't cleared yet.
 */
export function chunkedBackfillForConversation(
  db: Database,
  conversationId: string,
  options: { onlyArchived: boolean }
): number[] {
  const filter = options.onlyArchived
    ? `AND archived_at IS NOT NULL`
    : ``;
  const messages = db
    .prepare(
      `SELECT id, role, content FROM chat_messages
       WHERE conversation_id = ? AND archive_batch_id IS NULL ${filter}
       ORDER BY id ASC`
    )
    .all(conversationId) as BackfillMessage[];
  if (messages.length === 0) return [];
  const chunks = chunkMessageIds(messages);
  const batchIds: number[] = [];
  for (const chunk of chunks) {
    const id = createBatchForChunk(db, conversationId, chunk);
    if (id !== null) batchIds.push(id);
  }
  return batchIds;
}
