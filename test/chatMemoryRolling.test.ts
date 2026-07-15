import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Rolling memory: as an ACTIVE conversation grows past the raw-history window,
// its older turns are compressed into chat_memories WITHOUT being archived, so
// nothing scrolls out of the window into a blind spot before a Clear. These
// pins lock the invariants that keep it additive and non-double-counting:
//   - rolled messages stay visible (archived_at NULL);
//   - a rolled message is never also in the last-12 raw-history window;
//   - a later Clear leaves rolled messages in their rolling batch (COALESCE).
// createRollingBatch is the pure-DB half (no Claude call), so it is directly
// testable. Knob values live in lib/chatMemory.ts: KEEP_RECENT=20, MIN_OLD=12.

type DbMod = typeof import("@/lib/db");
type ChatMemMod = typeof import("@/lib/chatMemory");

let dbMod: DbMod;
let cm: ChatMemMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "chat-mem-roll-"));
  dbMod = await import("@/lib/db");
  cm = await import("@/lib/chatMemory");
  dbMod.db();
});

beforeEach(() => {
  dbMod.db().prepare(`DELETE FROM chat_memories`).run();
  dbMod.db().prepare(`DELETE FROM chat_messages`).run();
  dbMod.db().prepare(`DELETE FROM chat_archive_batches`).run();
});

function insertMsgs(n: number, conversationId = "default") {
  const stmt = dbMod
    .db()
    .prepare(
      `INSERT INTO chat_messages(conversation_id, role, content) VALUES(?,?,?)`
    );
  for (let i = 0; i < n; i++) {
    stmt.run(conversationId, i % 2 === 0 ? "user" : "assistant", `msg ${i}`);
  }
}

function counts(conversationId = "default") {
  const row = dbMod
    .db()
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN archived_at IS NULL THEN 1 ELSE 0 END) AS visible,
         SUM(CASE WHEN archive_batch_id IS NOT NULL THEN 1 ELSE 0 END) AS batched,
         SUM(CASE WHEN archive_batch_id IS NOT NULL AND archived_at IS NULL THEN 1 ELSE 0 END) AS rolledVisible
       FROM chat_messages WHERE conversation_id = ?`
    )
    .get(conversationId) as {
    total: number;
    visible: number;
    batched: number;
    rolledVisible: number;
  };
  return row;
}

// Mirrors app/api/chat/route.ts:DELETE (Clear) — enough to exercise COALESCE.
function clearChat(conversationId: string): number | null {
  return dbMod.db().transaction(() => {
    const id = Number(
      dbMod
        .db()
        .prepare(`INSERT INTO chat_archive_batches(conversation_id) VALUES(?)`)
        .run(conversationId).lastInsertRowid
    );
    dbMod
      .db()
      .prepare(
        `UPDATE chat_messages
           SET archived_at = datetime('now'),
               archive_batch_id = COALESCE(archive_batch_id, ?)
         WHERE conversation_id = ? AND archived_at IS NULL`
      )
      .run(id, conversationId);
    const c = (
      dbMod
        .db()
        .prepare(`SELECT COUNT(*) AS c FROM chat_messages WHERE archive_batch_id = ?`)
        .get(id) as { c: number }
    ).c;
    if (c === 0) {
      dbMod.db().prepare(`DELETE FROM chat_archive_batches WHERE id = ?`).run(id);
      return null;
    }
    dbMod
      .db()
      .prepare(`UPDATE chat_archive_batches SET message_count = ? WHERE id = ?`)
      .run(c, id);
    return id;
  })();
}

describe("createRollingBatch", () => {
  it("does nothing when the conversation is at/under the keep window", () => {
    insertMsgs(20); // exactly KEEP_RECENT → no message is older than the window
    expect(cm.createRollingBatch("default")).toBeNull();
    expect(counts().batched).toBe(0);
  });

  it("does nothing when too few messages have scrolled out (below MIN_OLD)", () => {
    insertMsgs(31); // 31 - 20 = 11 old candidates, one under MIN_OLD (12)
    expect(cm.createRollingBatch("default")).toBeNull();
    expect(counts().batched).toBe(0);
  });

  it("rolls the oldest out-of-window turns into a batch, keeping them visible", () => {
    insertMsgs(32); // 32 - 20 = 12 old candidates == MIN_OLD
    const batchId = cm.createRollingBatch("default");
    expect(batchId).not.toBeNull();

    const c = counts();
    expect(c.total).toBe(32);
    expect(c.batched).toBe(12); // the 12 oldest got a batch id
    expect(c.rolledVisible).toBe(12); // ...and are STILL visible (archived_at NULL)
    expect(c.visible).toBe(32); // nothing disappeared from the UI

    const batch = dbMod
      .db()
      .prepare(`SELECT message_count FROM chat_archive_batches WHERE id = ?`)
      .get(batchId) as { message_count: number };
    expect(batch.message_count).toBe(12);
  });

  it("never rolls a message that is still in the last-12 raw-history window", () => {
    insertMsgs(32);
    cm.createRollingBatch("default");
    // The exact query the chat POST runs for raw history.
    const window = dbMod
      .db()
      .prepare(
        `SELECT archive_batch_id FROM chat_messages
         WHERE conversation_id = ? AND archived_at IS NULL
         ORDER BY id DESC LIMIT 12`
      )
      .all("default") as Array<{ archive_batch_id: number | null }>;
    expect(window.length).toBe(12);
    // None of the live-window rows may carry a batch id — else it would feed
    // Claude as raw history AND as a recalled memory (double-count).
    expect(window.every((r) => r.archive_batch_id === null)).toBe(true);
  });

  it("is idempotent: a second roll with no new turns does nothing", () => {
    insertMsgs(32);
    expect(cm.createRollingBatch("default")).not.toBeNull();
    expect(cm.createRollingBatch("default")).toBeNull(); // nothing new to roll
    expect(counts().batched).toBe(12);
  });

  it("rolls again once more turns scroll out of the window", () => {
    insertMsgs(32);
    const b1 = cm.createRollingBatch("default");
    insertMsgs(12); // 12 fresh turns → the previous window's tail is now old
    const b2 = cm.createRollingBatch("default");
    expect(b2).not.toBeNull();
    expect(b2).not.toBe(b1);
    expect(counts().batched).toBe(24); // 12 + 12
  });

  it("a later Clear leaves rolled messages in their rolling batch (COALESCE)", () => {
    insertMsgs(32);
    const rollBatch = cm.createRollingBatch("default")!;
    const clearBatch = clearChat("default")!;
    expect(clearBatch).not.toBe(rollBatch);

    const rows = dbMod
      .db()
      .prepare(`SELECT archive_batch_id, archived_at FROM chat_messages ORDER BY id ASC`)
      .all() as Array<{ archive_batch_id: number; archived_at: string | null }>;
    // Everything is archived now (Clear hides the whole conversation)...
    expect(rows.every((r) => r.archived_at !== null)).toBe(true);
    // ...the 12 rolled stay in the rolling batch, the other 20 go to Clear's.
    expect(rows.filter((r) => r.archive_batch_id === rollBatch).length).toBe(12);
    expect(rows.filter((r) => r.archive_batch_id === clearBatch).length).toBe(20);
  });

  it("keeps conversations independent", () => {
    insertMsgs(32, "A");
    insertMsgs(5, "B");
    expect(cm.createRollingBatch("A")).not.toBeNull();
    expect(cm.createRollingBatch("B")).toBeNull();
    expect(counts("A").batched).toBe(12);
    expect(counts("B").batched).toBe(0);
  });
});
