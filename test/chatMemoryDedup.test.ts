import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// isDuplicateMemory has to catch (1) byte-equivalent restatements and (2)
// semantically-equivalent rephrasings, while leaving genuinely different
// facts untouched. Run against a throwaway SQLite so the index path is the
// real one.

type DbMod = typeof import("@/lib/db");
type EmbMod = typeof import("@/lib/embeddings");
type CmMod = typeof import("@/lib/chatMemory");

let dbMod: DbMod;
let embMod: EmbMod;
let cmMod: CmMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "chat-mem-dedup-"));
  dbMod = await import("@/lib/db");
  embMod = await import("@/lib/embeddings");
  cmMod = await import("@/lib/chatMemory");
  // Force the connection to open so the schema is created before tests.
  dbMod.db();
});

beforeEach(() => {
  dbMod.db().prepare(`DELETE FROM chat_memories`).run();
});

function insertMemory(
  text: string,
  embedding: Float32Array | null = null,
  deleted = false
) {
  const norm = cmMod.normaliseMemoryText(text);
  const buf = embedding ? embMod.encodeEmbedding(embedding) : null;
  dbMod
    .db()
    .prepare(
      `INSERT INTO chat_memories(
         source_conversation_id, text, text_norm, embedding, deleted_at
       ) VALUES (?, ?, ?, ?, ?)`
    )
    .run("default", text, norm, buf, deleted ? "2026-06-01 00:00:00" : null);
}

describe("normaliseMemoryText", () => {
  it("lowercases and collapses whitespace", () => {
    expect(cmMod.normaliseMemoryText("  Hello   World  ")).toBe("hello world");
  });
  it("strips light punctuation", () => {
    expect(cmMod.normaliseMemoryText("They prefer tea, not coffee.")).toBe(
      "they prefer tea not coffee"
    );
  });
  it("normalises smart quotes", () => {
    expect(cmMod.normaliseMemoryText("they’re going")).toBe("they're going");
  });
});

describe("isDuplicateMemory — exact text match", () => {
  it("catches a byte-equivalent restatement", () => {
    insertMemory("Has a dog named Hopper.");
    const r = cmMod.isDuplicateMemory({
      text: "Has a dog named Hopper.",
      embedding: null,
    });
    expect(r.duplicate).toBe(true);
    expect(r.reason).toBe("exact");
  });

  it("catches a case/punctuation variant via text_norm", () => {
    insertMemory("Has a dog named Hopper.");
    const r = cmMod.isDuplicateMemory({
      text: "  has  a dog named Hopper  ",
      embedding: null,
    });
    expect(r.duplicate).toBe(true);
  });

  it("does NOT catch a genuinely different fact", () => {
    insertMemory("Has a dog named Hopper.");
    const r = cmMod.isDuplicateMemory({
      text: "Works at Acme Corp.",
      embedding: null,
    });
    expect(r.duplicate).toBe(false);
  });

  it("ignores deleted rows", () => {
    insertMemory("Has a dog named Hopper.", null, true);
    const r = cmMod.isDuplicateMemory({
      text: "Has a dog named Hopper.",
      embedding: null,
    });
    expect(r.duplicate).toBe(false);
  });
});

describe("isDuplicateMemory — cosine semantic match", () => {
  it("catches a near-identical embedding (>= 0.88)", () => {
    const existing = new Float32Array([1, 0, 0, 0]);
    insertMemory("Prefers morning runs.", existing);
    // Slightly perturbed version — same direction, cosine ~= 1.0
    const candidate = new Float32Array([0.99, 0.01, 0, 0]);
    const r = cmMod.isDuplicateMemory({
      text: "Likes running in the morning.",
      embedding: candidate,
    });
    expect(r.duplicate).toBe(true);
    expect(r.reason).toBe("cosine");
  });

  it("leaves orthogonal embeddings alone", () => {
    const existing = new Float32Array([1, 0, 0, 0]);
    insertMemory("Prefers morning runs.", existing);
    const candidate = new Float32Array([0, 1, 0, 0]); // cosine 0
    const r = cmMod.isDuplicateMemory({
      text: "Works at Acme Corp.",
      embedding: candidate,
    });
    expect(r.duplicate).toBe(false);
  });

  it("falls back to no-dup when candidate has no embedding and exact misses", () => {
    const existing = new Float32Array([1, 0, 0, 0]);
    insertMemory("Prefers morning runs.", existing);
    const r = cmMod.isDuplicateMemory({
      text: "Some other unrelated thing.",
      embedding: null,
    });
    expect(r.duplicate).toBe(false);
  });

  it("ignores deleted rows in the cosine scan", () => {
    const existing = new Float32Array([1, 0, 0, 0]);
    insertMemory("Prefers morning runs.", existing, true); // deleted
    const candidate = new Float32Array([0.99, 0.01, 0, 0]);
    const r = cmMod.isDuplicateMemory({
      text: "Likes running in the morning.",
      embedding: candidate,
    });
    expect(r.duplicate).toBe(false);
  });

  it("exact match wins even without embedding (Voyage outage tolerance)", () => {
    insertMemory("Works at Acme Corp.", new Float32Array([1, 0, 0, 0]));
    const r = cmMod.isDuplicateMemory({
      text: "Works at Acme Corp.",
      embedding: null,
    });
    expect(r.duplicate).toBe(true);
    expect(r.reason).toBe("exact");
  });
});
