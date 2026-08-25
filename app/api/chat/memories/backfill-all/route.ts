import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { maybeCompressChatSessions } from "@/lib/chatMemory";
import { chunkedBackfillForConversation } from "@/lib/chatMemoryBackfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

/**
 * Chunked backfill of chat history into the chat-memory layer. Only ever
 * touches ARCHIVED (cleared) messages — Clear is the semantic boundary
 * for memory extraction, and active visible chat is out of scope. If we
 * stamped active messages here, the next Clear's COALESCE(archive_batch_id, ?)
 * in app/api/chat/route.ts would preserve our batch id and the user's
 * Clear would silently fail to create its own batch.
 *
 * Modes:
 *  - default (no `?reset=true`): only touches archived messages that
 *    aren't already in a batch. Groups them per conversation, chunks each
 *    conversation into multiple batches by char budget, fires extraction.
 *  - `?reset=true`: destructive — drops every chat_memories row, every
 *    chat_archive_batches row, NULLs out chat_messages.archive_batch_id,
 *    then runs the same chunked backfill from scratch. Used when the
 *    previous extraction was incomplete (e.g. single-batch-with-truncation)
 *    and the user wants a clean re-run. archived_at is never touched, so
 *    visible chat stays visible. Active (un-archived) messages are still
 *    excluded — reset means "redo the memory extraction", not "compress
 *    every message that exists".
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
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
         WHERE archived_at IS NOT NULL AND archive_batch_id IS NULL`
      )
      .all() as Array<{ conversation_id: string }>;

    const ids: number[] = [];
    for (const { conversation_id } of orphanConvs) {
      const batchIds = chunkedBackfillForConversation(db(), conversation_id, {
        onlyArchived: true,
      });
      ids.push(...batchIds);
    }
    return ids;
  })();

  // The .catch() is load-bearing: the outer try/catch only guards the
  // synchronous call setup, so an async rejection would otherwise be an
  // unhandled rejection (CLAUDE.md's fire-and-forget rule).
  try {
    void maybeCompressChatSessions(Math.max(created.length, 5)).catch((e) =>
      console.warn("[chat] memory compression failed:", (e as Error).message)
    );
  } catch {
    // best-effort
  }
  return NextResponse.json({ ok: true, batchesCreated: created.length, reset });
}
