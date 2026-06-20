import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// End-to-end-ish: drive the schema + Clear-batch creation + Option B history
// filter. These are the invariants that broke if the implementation skewed
// from the plan — and the ones Codex explicitly asked for as guardrails.

type DbMod = typeof import("@/lib/db");

let dbMod: DbMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "chat-mem-flow-"));
  dbMod = await import("@/lib/db");
  dbMod.db();
});

beforeEach(() => {
  dbMod.db().prepare(`DELETE FROM chat_memories`).run();
  dbMod.db().prepare(`DELETE FROM chat_messages`).run();
  dbMod.db().prepare(`DELETE FROM chat_archive_batches`).run();
});

function insertMsg(role: "user" | "assistant", content: string) {
  dbMod
    .db()
    .prepare(
      `INSERT INTO chat_messages(conversation_id, role, content) VALUES('default', ?, ?)`
    )
    .run(role, content);
}

// Mirrors the transaction in app/api/chat/route.ts:DELETE without pulling in
// next/server. Lets the test exercise the exact SQL the route runs.
function clearChat(conversationId: string): number | null {
  return dbMod.db().transaction(() => {
    const ins = dbMod
      .db()
      .prepare(`INSERT INTO chat_archive_batches(conversation_id) VALUES(?)`)
      .run(conversationId);
    const id = Number(ins.lastInsertRowid);
    // COALESCE matches the production Clear route in app/api/chat/route.ts —
    // if a message was already stamped with a batch id by the backfill
    // path, Clear preserves that batch and only the still-NULL messages
    // get the new batch id. Without COALESCE the test wouldn't exercise
    // the same SQL shape that ships.
    dbMod
      .db()
      .prepare(
        `UPDATE chat_messages
           SET archived_at = datetime('now'),
               archive_batch_id = COALESCE(archive_batch_id, ?)
         WHERE conversation_id = ? AND archived_at IS NULL`
      )
      .run(id, conversationId);
    const stats = dbMod
      .db()
      .prepare(
        `SELECT MIN(id) AS s, MAX(id) AS e, COUNT(*) AS c,
                COALESCE(SUM(CASE WHEN role='user' THEN LENGTH(content) ELSE 0 END), 0) AS uc
           FROM chat_messages WHERE archive_batch_id = ?`
      )
      .get(id) as { s: number | null; e: number | null; c: number; uc: number };
    if (stats.c === 0) {
      dbMod.db().prepare(`DELETE FROM chat_archive_batches WHERE id = ?`).run(id);
      return null;
    }
    dbMod
      .db()
      .prepare(
        `UPDATE chat_archive_batches
           SET message_start_id = ?, message_end_id = ?,
               message_count = ?, user_char_count = ?
         WHERE id = ?`
      )
      .run(stats.s, stats.e, stats.c, stats.uc, id);
    return id;
  })();
}

describe("chat-memory flow: Clear creates an archive batch", () => {
  it("populates a batch with start/end ids, count, user char count", () => {
    insertMsg("user", "Hello, I prefer mornings");
    insertMsg("assistant", "Got it.");
    insertMsg("user", "More to share");
    const batchId = clearChat("default");
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
      message_start_id: number | null;
      message_end_id: number | null;
    };
    expect(row.message_count).toBe(3);
    // Two user messages: "Hello, I prefer mornings" (24) + "More to share" (13) = 37
    expect(row.user_char_count).toBe(37);
    expect(row.message_start_id).not.toBeNull();
    expect(row.message_end_id).not.toBeNull();
  });

  it("stamps each archived message with archive_batch_id", () => {
    insertMsg("user", "Hello");
    insertMsg("assistant", "Hi");
    const batchId = clearChat("default")!;
    const rows = dbMod
      .db()
      .prepare(`SELECT archive_batch_id, archived_at FROM chat_messages`)
      .all() as Array<{ archive_batch_id: number | null; archived_at: string | null }>;
    for (const r of rows) {
      expect(r.archive_batch_id).toBe(batchId);
      expect(r.archived_at).not.toBeNull();
    }
  });

  it("no-op Clear (no visible messages) does NOT create an empty batch", () => {
    const result = clearChat("default");
    expect(result).toBeNull();
    const count = (
      dbMod
        .db()
        .prepare(`SELECT COUNT(*) AS c FROM chat_archive_batches`)
        .get() as { c: number }
    ).c;
    expect(count).toBe(0);
  });

  it("re-Clear after new messages creates a SECOND distinct batch", () => {
    insertMsg("user", "Round one");
    const b1 = clearChat("default")!;
    insertMsg("user", "Round two");
    const b2 = clearChat("default")!;
    expect(b1).not.toBe(b2);
    const msgs = dbMod
      .db()
      .prepare(
        `SELECT content, archive_batch_id FROM chat_messages ORDER BY id ASC`
      )
      .all() as Array<{ content: string; archive_batch_id: number }>;
    expect(msgs[0].archive_batch_id).toBe(b1);
    expect(msgs[1].archive_batch_id).toBe(b2);
  });
});

describe("chat-memory flow: Option B Clear semantics", () => {
  it("POST history query filters archived_at IS NULL", () => {
    insertMsg("user", "first");
    insertMsg("assistant", "second");
    clearChat("default");
    // After Clear, the POST handler runs this SQL:
    const rows = dbMod
      .db()
      .prepare(
        `SELECT role, content FROM chat_messages
         WHERE conversation_id = ? AND archived_at IS NULL
         ORDER BY id DESC LIMIT 12`
      )
      .all("default") as Array<{ role: string; content: string }>;
    expect(rows.length).toBe(0);
  });

  it("a fresh message after Clear shows up as the only history row", () => {
    insertMsg("user", "old");
    insertMsg("assistant", "older reply");
    clearChat("default");
    insertMsg("user", "fresh start");
    const rows = (
      dbMod
        .db()
        .prepare(
          `SELECT role, content FROM chat_messages
           WHERE conversation_id = ? AND archived_at IS NULL
           ORDER BY id DESC LIMIT 12`
        )
        .all("default") as Array<{ role: string; content: string }>
    ).reverse();
    expect(rows.length).toBe(1);
    expect(rows[0].content).toBe("fresh start");
  });
});
