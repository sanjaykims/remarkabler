import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { CHUNK_TARGET_CHARS } from "@/lib/chatMemoryBackfill";

// Regression coverage for two correctness fixes shipped in this PR:
//
// (1) The startup orphan migration in lib/db.ts used to create one giant
//     archive batch per conversation. Combined with compressBatch's
//     16K-char cap that silently truncated months of cleared chat. The
//     fix is to share chunkedBackfillForConversation with the backfill
//     route so both paths chunk.
//
// (2) /api/chat/memories/backfill-all used to filter only
//     `archive_batch_id IS NULL` — it would stamp ACTIVE (un-archived)
//     messages with a batch_id, which then conflicted with the Clear
//     route's COALESCE(archive_batch_id, ?) (the user's Clear would
//     silently fail to create its own batch). The fix is to require
//     `archived_at IS NOT NULL` on default backfill — the route now
//     never touches messages the user hasn't cleared.
//
// Throwaway-SQLite per test file (same pattern as chatMemoryDedup).

type DbMod = typeof import("@/lib/db");
type BackfillHelpers = typeof import("@/lib/chatMemoryBackfill");

let dbMod: DbMod;
let backfill: BackfillHelpers;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(
    path.join(tmpdir(), "chat-memory-tier1-")
  );
  dbMod = await import("@/lib/db");
  backfill = await import("@/lib/chatMemoryBackfill");
  dbMod.db();
});

beforeEach(() => {
  dbMod.db().prepare(`DELETE FROM chat_memories`).run();
  dbMod.db().prepare(`DELETE FROM chat_archive_batches`).run();
  dbMod.db().prepare(`DELETE FROM chat_messages`).run();
});

function insertMsg(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  archived: boolean
) {
  dbMod
    .db()
    .prepare(
      `INSERT INTO chat_messages (conversation_id, role, content, archived_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(conversationId, role, content, archived ? "2026-06-01T00:00:00Z" : null);
}

function countBatchesFor(conversationId: string): number {
  const row = dbMod
    .db()
    .prepare(
      `SELECT COUNT(*) AS c FROM chat_archive_batches WHERE conversation_id = ?`
    )
    .get(conversationId) as { c: number };
  return row.c;
}

describe("chunkedBackfillForConversation — chunks long conversations", () => {
  it("creates multiple batches when the message stream exceeds CHUNK_TARGET_CHARS", () => {
    // ~5K chars per message × 5 messages = 25K chars total → expect ≥ 2 chunks
    // at CHUNK_TARGET_CHARS = 12K. The previous startup migration would
    // have created 1 batch here and compressBatch would have truncated
    // everything before the last 16K chars.
    const big = "x".repeat(5000);
    for (let i = 0; i < 5; i++) {
      insertMsg("conv-a", i % 2 === 0 ? "user" : "assistant", big, true);
    }

    backfill.chunkedBackfillForConversation(dbMod.db(), "conv-a", {
      onlyArchived: true,
    });

    expect(countBatchesFor("conv-a")).toBeGreaterThan(1);
    expect(CHUNK_TARGET_CHARS).toBe(12_000); // sanity
  });

  it("creates exactly one batch when the conversation fits in one chunk", () => {
    insertMsg("conv-small", "user", "small message", true);
    insertMsg("conv-small", "assistant", "another small one", true);

    backfill.chunkedBackfillForConversation(dbMod.db(), "conv-small", {
      onlyArchived: true,
    });

    expect(countBatchesFor("conv-small")).toBe(1);
  });

  it("with onlyArchived:true, leaves active (un-archived) messages alone", () => {
    // Mix of archived + active. Default backfill should only batch the
    // archived ones; active messages stay archive_batch_id = NULL.
    insertMsg("conv-mix", "user", "old archived 1", true);
    insertMsg("conv-mix", "assistant", "old archived 2", true);
    insertMsg("conv-mix", "user", "active current", false);
    insertMsg("conv-mix", "assistant", "still active", false);

    backfill.chunkedBackfillForConversation(dbMod.db(), "conv-mix", {
      onlyArchived: true,
    });

    const rows = dbMod
      .db()
      .prepare(
        `SELECT content, archive_batch_id, archived_at FROM chat_messages
         WHERE conversation_id = 'conv-mix'
         ORDER BY id ASC`
      )
      .all() as Array<{
      content: string;
      archive_batch_id: number | null;
      archived_at: string | null;
    }>;

    expect(rows[0].archive_batch_id).not.toBeNull(); // archived
    expect(rows[1].archive_batch_id).not.toBeNull(); // archived
    expect(rows[2].archive_batch_id).toBeNull(); // active — left alone
    expect(rows[3].archive_batch_id).toBeNull(); // active — left alone
  });

  it("returns empty array (and creates nothing) for a conversation with no eligible messages", () => {
    insertMsg("conv-active-only", "user", "never cleared", false);

    const ids = backfill.chunkedBackfillForConversation(
      dbMod.db(),
      "conv-active-only",
      { onlyArchived: true }
    );

    expect(ids).toEqual([]);
    expect(countBatchesFor("conv-active-only")).toBe(0);
  });

  it("100K chars of archived chat produces many small batches, not one giant one", () => {
    // Specifically requested by Codex: "Add a DB-backed test proving 100K
    // chars of orphan archived chat creates multiple batches on
    // startup/migration, not one."
    const chunk = "y".repeat(1000);
    for (let i = 0; i < 100; i++) {
      insertMsg("conv-long", i % 2 === 0 ? "user" : "assistant", chunk, true);
    }
    // ~100K user+assistant chars total. CHUNK_TARGET_CHARS=12K → expect
    // roughly 9 batches (100K / 12K rounded up). Loose lower bound to
    // avoid coupling to the exact chunk math.
    backfill.chunkedBackfillForConversation(dbMod.db(), "conv-long", {
      onlyArchived: true,
    });

    const batches = countBatchesFor("conv-long");
    expect(batches).toBeGreaterThanOrEqual(5);
    // Sanity: every archived message got stamped with SOME batch.
    const unstamped = dbMod
      .db()
      .prepare(
        `SELECT COUNT(*) AS c FROM chat_messages
         WHERE conversation_id = 'conv-long' AND archive_batch_id IS NULL`
      )
      .get() as { c: number };
    expect(unstamped.c).toBe(0);
  });

  it("createBatchForChunk on an empty id list is a no-op", () => {
    const id = backfill.createBatchForChunk(dbMod.db(), "conv-empty", []);
    expect(id).toBeNull();
    expect(countBatchesFor("conv-empty")).toBe(0);
  });

  it("createBatchForChunk denormalises start/end/count/user_char_count", () => {
    insertMsg("conv-stats", "user", "hello", true); // 5 user chars
    insertMsg("conv-stats", "assistant", "hi there", true);
    insertMsg("conv-stats", "user", "more", true); // 4 user chars
    const ids = dbMod
      .db()
      .prepare(
        `SELECT id FROM chat_messages WHERE conversation_id = 'conv-stats' ORDER BY id ASC`
      )
      .all() as Array<{ id: number }>;
    const messageIds = ids.map((r) => r.id);

    const batchId = backfill.createBatchForChunk(
      dbMod.db(),
      "conv-stats",
      messageIds
    );

    expect(batchId).not.toBeNull();
    const row = dbMod
      .db()
      .prepare(
        `SELECT message_count, user_char_count, message_start_id, message_end_id
         FROM chat_archive_batches WHERE id = ?`
      )
      .get(batchId) as {
      message_count: number;
      user_char_count: number;
      message_start_id: number;
      message_end_id: number;
    };
    expect(row.message_count).toBe(3);
    expect(row.user_char_count).toBe(5 + 4); // user chars only
    expect(row.message_start_id).toBe(messageIds[0]);
    expect(row.message_end_id).toBe(messageIds[messageIds.length - 1]);
  });
});
