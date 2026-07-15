import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Rolling memory: as an ACTIVE conversation grows past the live (raw-history)
// window, its older turns are compressed into chat_memories WITHOUT being
// archived, so nothing scrolls out of the window into a blind spot before a
// Clear. These pins lock the invariants that keep it additive, non-double-
// counting, and lossless:
//   - rolled messages stay visible (archived_at NULL);
//   - a rolled message is never also in the live raw-history window;
//   - a later Clear leaves rolled messages in their rolling batch (COALESCE);
//   - a chunk too thin to survive compressBatch's `too-short` gate is NOT
//     rolled (it would be permanently skipped + never re-compressed by Clear).
// createRollingBatch is the pure-DB half (no Claude call), so it is directly
// testable. Knobs in lib/chatMemory.ts: KEEP_RECENT == RAW_HISTORY_WINDOW (20,
// so there is NO structural gap), MIN_OLD=8, substance gate 200 user chars.

type DbMod = typeof import("@/lib/db");
type ChatMemMod = typeof import("@/lib/chatMemory");

let dbMod: DbMod;
let cm: ChatMemMod;

// The live window == the keep window (both 20). Rolling therefore needs
// WINDOW + MIN_OLD (8) = 28 messages before the first batch forms.
const WINDOW = 20;
const ROLL_AT = 28;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "chat-mem-roll-"));
  dbMod = await import("@/lib/db");
  cm = await import("@/lib/chatMemory");
  dbMod.db();
  expect(cm.RAW_HISTORY_WINDOW).toBe(WINDOW); // pin the shared constant
});

beforeEach(() => {
  dbMod.db().prepare(`DELETE FROM chat_memories`).run();
  dbMod.db().prepare(`DELETE FROM chat_messages`).run();
  dbMod.db().prepare(`DELETE FROM chat_archive_batches`).run();
});

// User turns are ~60 chars each so a batch of 8 (4 user turns) clears the
// 200-char substance gate. Pass userLen to simulate terse turns for the gate
// test.
function insertMsgs(n: number, conversationId = "default", userLen = 60) {
  const stmt = dbMod
    .db()
    .prepare(
      `INSERT INTO chat_messages(conversation_id, role, content) VALUES(?,?,?)`
    );
  for (let i = 0; i < n; i++) {
    const isUser = i % 2 === 0;
    const content = isUser ? "u".repeat(userLen) : "assistant reply";
    stmt.run(conversationId, isUser ? "user" : "assistant", content);
  }
}

function counts(conversationId = "default") {
  return dbMod
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
    insertMsgs(WINDOW); // exactly the window → nothing older than it
    expect(cm.createRollingBatch("default")).toBeNull();
    expect(counts().batched).toBe(0);
  });

  it("does nothing when too few messages have scrolled out (below MIN_OLD)", () => {
    insertMsgs(ROLL_AT - 1); // 27 → 7 old candidates, one under MIN_OLD (8)
    expect(cm.createRollingBatch("default")).toBeNull();
    expect(counts().batched).toBe(0);
  });

  it("does NOT roll a chunk too thin to survive the substance gate", () => {
    // Enough messages (8 old candidates) but terse user turns, so the batch's
    // user text is under 200 chars. Rolling it would let compressBatch
    // permanently mark it `too-short`, and Clear's COALESCE would then never
    // re-compress those turns. So it must stay unrolled instead.
    insertMsgs(ROLL_AT, "default", 3); // "uuu" user turns → tiny user text
    expect(cm.createRollingBatch("default")).toBeNull();
    expect(counts().batched).toBe(0);
  });

  it("rolls the oldest out-of-window turns into a batch, keeping them visible", () => {
    insertMsgs(ROLL_AT); // 8 old candidates == MIN_OLD, with real text
    const batchId = cm.createRollingBatch("default");
    expect(batchId).not.toBeNull();

    const c = counts();
    expect(c.total).toBe(ROLL_AT);
    expect(c.batched).toBe(8); // the 8 oldest got a batch id
    expect(c.rolledVisible).toBe(8); // ...and are STILL visible (archived_at NULL)
    expect(c.visible).toBe(ROLL_AT); // nothing disappeared from the UI

    const batch = dbMod
      .db()
      .prepare(`SELECT message_count, user_char_count FROM chat_archive_batches WHERE id = ?`)
      .get(batchId) as { message_count: number; user_char_count: number };
    expect(batch.message_count).toBe(8);
    expect(batch.user_char_count).toBeGreaterThanOrEqual(200);
  });

  it("never rolls a message that is still in the live raw-history window", () => {
    insertMsgs(ROLL_AT);
    cm.createRollingBatch("default");
    const window = dbMod
      .db()
      .prepare(
        `SELECT archive_batch_id FROM chat_messages
         WHERE conversation_id = ? AND archived_at IS NULL
         ORDER BY id DESC LIMIT ${WINDOW}`
      )
      .all("default") as Array<{ archive_batch_id: number | null }>;
    expect(window.length).toBe(WINDOW);
    // None of the live-window rows may carry a batch id — else it would feed
    // Claude as raw history AND as a recalled memory (double-count).
    expect(window.every((r) => r.archive_batch_id === null)).toBe(true);
  });

  it("is idempotent: a second roll with no new turns does nothing", () => {
    insertMsgs(ROLL_AT);
    expect(cm.createRollingBatch("default")).not.toBeNull();
    expect(cm.createRollingBatch("default")).toBeNull();
    expect(counts().batched).toBe(8);
  });

  it("rolls again once more turns scroll out of the window", () => {
    insertMsgs(ROLL_AT);
    const b1 = cm.createRollingBatch("default");
    insertMsgs(12); // fresh turns push the previous window's tail out
    const b2 = cm.createRollingBatch("default");
    expect(b2).not.toBeNull();
    expect(b2).not.toBe(b1);
    expect(counts().batched).toBeGreaterThan(8);
  });

  it("a later Clear leaves rolled messages in their rolling batch (COALESCE)", () => {
    insertMsgs(ROLL_AT);
    const rollBatch = cm.createRollingBatch("default")!;
    const clearBatch = clearChat("default")!;
    expect(clearBatch).not.toBe(rollBatch);

    const rows = dbMod
      .db()
      .prepare(`SELECT archive_batch_id, archived_at FROM chat_messages ORDER BY id ASC`)
      .all() as Array<{ archive_batch_id: number; archived_at: string | null }>;
    expect(rows.every((r) => r.archived_at !== null)).toBe(true); // Clear hides all
    expect(rows.filter((r) => r.archive_batch_id === rollBatch).length).toBe(8);
    expect(rows.filter((r) => r.archive_batch_id === clearBatch).length).toBe(WINDOW);
  });

  it("keeps conversations independent", () => {
    insertMsgs(ROLL_AT, "A");
    insertMsgs(5, "B");
    expect(cm.createRollingBatch("A")).not.toBeNull();
    expect(cm.createRollingBatch("B")).toBeNull();
    expect(counts("A").batched).toBe(8);
    expect(counts("B").batched).toBe(0);
  });
});
