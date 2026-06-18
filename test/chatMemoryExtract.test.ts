import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// compressBatch is the end-to-end glue: Clear → archive batch → Claude
// extraction → embed → dedup → insert. Mocked at the Claude + Voyage
// boundaries so the test runs offline, hits the real DB, exercises the
// real bounded-retry state machine, and proves the noise-floor guard
// short-circuits without burning an API call.

type DbMod = typeof import("@/lib/db");
type CmMod = typeof import("@/lib/chatMemory");
type ClaudeMod = typeof import("@/lib/claude");

let dbMod: DbMod;
let cmMod: CmMod;
let claudeMod: ClaudeMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "chat-mem-extract-"));
  // No Voyage key — embeddings stay null. That isolates the test from the
  // network and lets us verify the no-embedding code path explicitly.
  delete process.env.VOYAGE_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";
  dbMod = await import("@/lib/db");
  cmMod = await import("@/lib/chatMemory");
  claudeMod = await import("@/lib/claude");
  dbMod.db();
});

beforeEach(() => {
  dbMod.db().prepare(`DELETE FROM chat_memories`).run();
  dbMod.db().prepare(`DELETE FROM chat_messages`).run();
  dbMod.db().prepare(`DELETE FROM chat_archive_batches`).run();
  vi.restoreAllMocks();
});

function makeBatch(messages: Array<{ role: "user" | "assistant"; content: string }>) {
  const insertMsg = dbMod
    .db()
    .prepare(
      `INSERT INTO chat_messages(conversation_id, role, content, archived_at, archive_batch_id)
       VALUES(?,?,?,?,?)`
    );
  const batchIns = dbMod
    .db()
    .prepare(`INSERT INTO chat_archive_batches(conversation_id) VALUES(?)`)
    .run("default");
  const batchId = Number(batchIns.lastInsertRowid);
  for (const m of messages) {
    insertMsg.run("default", m.role, m.content, "2026-06-01 00:00:00", batchId);
  }
  const stats = dbMod
    .db()
    .prepare(
      `SELECT MIN(id) AS s, MAX(id) AS e, COUNT(*) AS c,
              COALESCE(SUM(CASE WHEN role='user' THEN LENGTH(content) ELSE 0 END), 0) AS uc
         FROM chat_messages WHERE archive_batch_id = ?`
    )
    .get(batchId) as { s: number; e: number; c: number; uc: number };
  dbMod
    .db()
    .prepare(
      `UPDATE chat_archive_batches
         SET message_start_id=?, message_end_id=?, message_count=?, user_char_count=?
       WHERE id=?`
    )
    .run(stats.s, stats.e, stats.c, stats.uc, batchId);
  return batchId;
}

function mockExtraction(
  result: Parameters<typeof vi.fn>[0] | ReturnType<typeof claudeMod.compressChatSession>
) {
  const fn =
    typeof result === "function"
      ? (result as () => unknown)
      : () => result;
  vi.spyOn(claudeMod, "compressChatSession").mockImplementation(
    fn as unknown as typeof claudeMod.compressChatSession
  );
}

describe("compressBatch", () => {
  it("noise-floor: skips batches with too few messages without calling Claude", async () => {
    const spy = vi
      .spyOn(claudeMod, "compressChatSession")
      .mockResolvedValue({
        items: [],
        raw: "",
        parseError: "",
        model: "test",
      });
    const id = makeBatch([
      {
        role: "user",
        content: "x".repeat(500), // enough chars
      },
      { role: "assistant", content: "ok" },
      // only 2 messages — below MIN_MESSAGES_FOR_COMPRESSION (4)
    ]);
    const r = await cmMod.compressBatch(id);
    expect(r.skipped).toBe("too-short");
    expect(spy).not.toHaveBeenCalled();
    const row = dbMod
      .db()
      .prepare(`SELECT memory_extracted_at FROM chat_archive_batches WHERE id=?`)
      .get(id) as { memory_extracted_at: string | null };
    expect(row.memory_extracted_at).not.toBeNull();
  });

  it("noise-floor: skips when user_char_count is below threshold", async () => {
    const spy = vi.spyOn(claudeMod, "compressChatSession");
    const id = makeBatch([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hi back" },
      { role: "user", content: "how are you" },
      { role: "assistant", content: "fine thanks" },
    ]);
    const r = await cmMod.compressBatch(id);
    expect(r.skipped).toBe("too-short");
    expect(spy).not.toHaveBeenCalled();
  });

  it("happy path: inserts items, marks the batch done", async () => {
    mockExtraction(
      Promise.resolve({
        items: [
          {
            category: "preference",
            text: "Prefers writing in the morning.",
            source_excerpt: "I always write in the morning.",
          },
          {
            category: "fact",
            text: "Has a dog named Hopper.",
            source_excerpt: "Hopper barked all night.",
          },
        ],
        raw: "{...}",
        parseError: "",
        model: "test-model",
      }) as unknown as ReturnType<typeof claudeMod.compressChatSession>
    );
    const id = makeBatch([
      { role: "user", content: "x".repeat(300) },
      { role: "assistant", content: "ok" },
      { role: "user", content: "more thoughts here, plenty of words" },
      { role: "assistant", content: "ack" },
    ]);
    const r = await cmMod.compressBatch(id);
    expect(r.inserted).toBe(2);
    const row = dbMod
      .db()
      .prepare(
        `SELECT memory_extracted_at, memories_inserted, failed_attempts
         FROM chat_archive_batches WHERE id=?`
      )
      .get(id) as {
      memory_extracted_at: string | null;
      memories_inserted: number;
      failed_attempts: number;
    };
    expect(row.memory_extracted_at).not.toBeNull();
    expect(row.memories_inserted).toBe(2);
    expect(row.failed_attempts).toBe(0);

    const memories = dbMod
      .db()
      .prepare(`SELECT category, text FROM chat_memories ORDER BY id ASC`)
      .all() as Array<{ category: string; text: string }>;
    expect(memories.length).toBe(2);
    expect(memories[0].category).toBe("preference");
    expect(memories[1].text).toBe("Has a dog named Hopper.");
  });

  it("dedup: skips an item whose text_norm already exists", async () => {
    dbMod
      .db()
      .prepare(
        `INSERT INTO chat_memories(source_conversation_id, text, text_norm)
         VALUES('default', 'Has a dog named Hopper.', 'has a dog named hopper')`
      )
      .run();
    mockExtraction(
      Promise.resolve({
        items: [
          {
            category: "fact",
            text: "Has a dog named Hopper.",
            source_excerpt: "Hopper.",
          },
          {
            category: "fact",
            text: "Works at Acme Corp.",
            source_excerpt: "Acme.",
          },
        ],
        raw: "{...}",
        parseError: "",
        model: "t",
      }) as unknown as ReturnType<typeof claudeMod.compressChatSession>
    );
    const id = makeBatch([
      { role: "user", content: "x".repeat(300) },
      { role: "assistant", content: "y" },
      { role: "user", content: "z".repeat(100) },
      { role: "assistant", content: "w" },
    ]);
    const r = await cmMod.compressBatch(id);
    expect(r.inserted).toBe(1);
    expect(r.duplicatesSkipped).toBe(1);
  });

  it("bounded retry: first parse failure leaves batch pending with failed_attempts=1", async () => {
    mockExtraction(
      Promise.resolve({
        items: [],
        raw: "garbage not JSON",
        parseError: "Unexpected token",
        model: "t",
      }) as unknown as ReturnType<typeof claudeMod.compressChatSession>
    );
    const id = makeBatch([
      { role: "user", content: "x".repeat(300) },
      { role: "assistant", content: "y" },
      { role: "user", content: "z".repeat(100) },
      { role: "assistant", content: "w" },
    ]);
    const r = await cmMod.compressBatch(id);
    expect(r.failed).toBeTruthy();
    expect(r.permanentlyFailed).toBeUndefined();
    const row = dbMod
      .db()
      .prepare(
        `SELECT memory_extracted_at, failed_attempts, extraction_error
         FROM chat_archive_batches WHERE id=?`
      )
      .get(id) as {
      memory_extracted_at: string | null;
      failed_attempts: number;
      extraction_error: string | null;
    };
    expect(row.memory_extracted_at).toBeNull();
    expect(row.failed_attempts).toBe(1);
    expect(row.extraction_error).toMatch(/Unexpected/);
  });

  it("bounded retry: second failure marks the batch permanently skipped", async () => {
    mockExtraction(
      Promise.resolve({
        items: [],
        raw: "still garbage",
        parseError: "still bad",
        model: "t",
      }) as unknown as ReturnType<typeof claudeMod.compressChatSession>
    );
    const id = makeBatch([
      { role: "user", content: "x".repeat(300) },
      { role: "assistant", content: "y" },
      { role: "user", content: "z".repeat(100) },
      { role: "assistant", content: "w" },
    ]);
    const r1 = await cmMod.compressBatch(id);
    expect(r1.permanentlyFailed).toBeUndefined();
    const r2 = await cmMod.compressBatch(id);
    expect(r2.permanentlyFailed).toBe(true);

    const row = dbMod
      .db()
      .prepare(
        `SELECT memory_extracted_at, failed_attempts
         FROM chat_archive_batches WHERE id=?`
      )
      .get(id) as {
      memory_extracted_at: string | null;
      failed_attempts: number;
    };
    expect(row.memory_extracted_at).not.toBeNull();
    expect(row.failed_attempts).toBe(2);
  });

  it("resetBatchForRetry: clears the skip and lets the next sweep pick it up", async () => {
    mockExtraction(
      Promise.resolve({
        items: [],
        raw: "still garbage",
        parseError: "still bad",
        model: "t",
      }) as unknown as ReturnType<typeof claudeMod.compressChatSession>
    );
    const id = makeBatch([
      { role: "user", content: "x".repeat(300) },
      { role: "assistant", content: "y" },
      { role: "user", content: "z".repeat(100) },
      { role: "assistant", content: "w" },
    ]);
    await cmMod.compressBatch(id);
    await cmMod.compressBatch(id); // → permanent
    const ok = cmMod.resetBatchForRetry(id);
    expect(ok).toBe(true);
    const row = dbMod
      .db()
      .prepare(
        `SELECT memory_extracted_at, failed_attempts, extraction_error
         FROM chat_archive_batches WHERE id=?`
      )
      .get(id) as {
      memory_extracted_at: string | null;
      failed_attempts: number;
      extraction_error: string | null;
    };
    expect(row.memory_extracted_at).toBeNull();
    expect(row.failed_attempts).toBe(0);
    expect(row.extraction_error).toBeNull();
  });

  it("already-extracted: re-running on a completed batch is a no-op", async () => {
    mockExtraction(
      Promise.resolve({
        items: [
          { category: "fact", text: "Works at Acme.", source_excerpt: "" },
        ],
        raw: "{...}",
        parseError: "",
        model: "t",
      }) as unknown as ReturnType<typeof claudeMod.compressChatSession>
    );
    const id = makeBatch([
      { role: "user", content: "x".repeat(300) },
      { role: "assistant", content: "y" },
      { role: "user", content: "z".repeat(100) },
      { role: "assistant", content: "w" },
    ]);
    await cmMod.compressBatch(id);
    const r2 = await cmMod.compressBatch(id);
    expect(r2.skipped).toBe("already-extracted");
    expect(r2.inserted).toBe(0);
  });

  it("empty-extraction with no parse error is a valid success (not a failure)", async () => {
    // "Claude legitimately had nothing durable to extract" must NOT trip
    // the retry path — otherwise short small-talk batches would compete
    // for Claude attempts forever.
    mockExtraction(
      Promise.resolve({
        items: [],
        raw: '{"items": []}',
        parseError: "",
        model: "t",
      }) as unknown as ReturnType<typeof claudeMod.compressChatSession>
    );
    const id = makeBatch([
      { role: "user", content: "x".repeat(300) },
      { role: "assistant", content: "y" },
      { role: "user", content: "z".repeat(100) },
      { role: "assistant", content: "w" },
    ]);
    const r = await cmMod.compressBatch(id);
    expect(r.inserted).toBe(0);
    expect(r.failed).toBeUndefined();
    const row = dbMod
      .db()
      .prepare(
        `SELECT memory_extracted_at, failed_attempts
         FROM chat_archive_batches WHERE id=?`
      )
      .get(id) as { memory_extracted_at: string | null; failed_attempts: number };
    expect(row.memory_extracted_at).not.toBeNull();
    expect(row.failed_attempts).toBe(0);
  });
});
