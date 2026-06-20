import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// recallChatMemories — ranking, threshold, soft-delete exclusion, fail-open.
// Voyage's `embed` is stubbed to return a deterministic query vector so the
// test runs offline. Database rows carry pre-computed embeddings so the
// ranking is exactly what the cosine code would produce.

type DbMod = typeof import("@/lib/db");
type EmbMod = typeof import("@/lib/embeddings");
type CmMod = typeof import("@/lib/chatMemory");

let dbMod: DbMod;
let embMod: EmbMod;
let cmMod: CmMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "chat-mem-recall-"));
  process.env.VOYAGE_API_KEY = "test-key"; // so embeddingsEnabled() returns true
  dbMod = await import("@/lib/db");
  embMod = await import("@/lib/embeddings");
  cmMod = await import("@/lib/chatMemory");
  dbMod.db();
});

beforeEach(() => {
  dbMod.db().prepare(`DELETE FROM chat_memories`).run();
  vi.restoreAllMocks();
});

function insert(
  text: string,
  vec: Float32Array | null,
  opts: { category?: string; deleted?: boolean } = {}
) {
  const norm = cmMod.normaliseMemoryText(text);
  const buf = vec ? embMod.encodeEmbedding(vec) : null;
  dbMod
    .db()
    .prepare(
      `INSERT INTO chat_memories(
         source_conversation_id, category, text, text_norm, embedding, deleted_at
       ) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      "default",
      opts.category || "fact",
      text,
      norm,
      buf,
      opts.deleted ? "2026-06-01 00:00:00" : null
    );
}

function stubEmbed(vec: Float32Array) {
  vi.spyOn(embMod, "embed").mockResolvedValue(vec);
}

describe("recallChatMemories", () => {
  it("ranks by cosine similarity, most relevant first (small corpus)", async () => {
    insert("Prefers writing in the morning.", new Float32Array([1, 0, 0, 0]));
    insert("Has a dog named Hopper.", new Float32Array([0, 1, 0, 0]));
    insert("Works at Acme Corp.", new Float32Array([0, 0, 1, 0]));
    stubEmbed(new Float32Array([0.9, 0.1, 0, 0]));
    const { items } = await cmMod.recallChatMemories("when do you write?", 2, 0);
    // Small corpus → all included; most relevant first.
    expect(items.length).toBe(3);
    expect(items[0].text).toBe("Prefers writing in the morning.");
  });

  it("excludes soft-deleted rows", async () => {
    insert("Has a dog named Hopper.", new Float32Array([1, 0, 0, 0]), {
      deleted: true,
    });
    stubEmbed(new Float32Array([1, 0, 0, 0]));
    const { items } = await cmMod.recallChatMemories("dog?", 5, 0);
    expect(items.length).toBe(0);
  });

  it("INCLUDES rows with NULL embeddings (small corpus, recency fallback)", async () => {
    // The regression this fixes: a memory stored without an embedding (e.g.
    // Voyage rate-limited during extraction) must still reach Claude.
    insert("Business trip departs Sunday for Wuhan.", null);
    stubEmbed(new Float32Array([1, 0, 0, 0]));
    const { items } = await cmMod.recallChatMemories("where am I going?", 5);
    expect(items.length).toBe(1);
    expect(items[0].text).toBe("Business trip departs Sunday for Wuhan.");
  });

  it("does NOT drop sub-threshold items in a small corpus", async () => {
    insert("Prefers writing in the morning.", new Float32Array([1, 0, 0, 0]));
    insert("Works at Acme Corp.", new Float32Array([0, 0, 1, 0]));
    // Query near-parallel to the first, orthogonal to the second.
    stubEmbed(new Float32Array([0.9, 0.1, 0, 0]));
    const { items } = await cmMod.recallChatMemories("morning?", 5, 0.4);
    // Both included (small corpus); relevant one ranked first.
    expect(items.length).toBe(2);
    expect(items[0].text).toBe("Prefers writing in the morning.");
  });

  it("fails open to RECENCY when embed() returns null", async () => {
    insert("Older fact.", new Float32Array([1, 0, 0, 0]));
    insert("Newer fact.", new Float32Array([1, 0, 0, 0]));
    vi.spyOn(embMod, "embed").mockResolvedValue(null);
    const { items } = await cmMod.recallChatMemories("any?", 5);
    // No semantic signal → recency order, newest first, nothing dropped.
    expect(items.map((m) => m.text)).toEqual(["Newer fact.", "Older fact."]);
  });

  it("fails open to RECENCY when embed() throws", async () => {
    insert("Prefers writing in the morning.", new Float32Array([1, 0, 0, 0]));
    vi.spyOn(embMod, "embed").mockRejectedValue(new Error("voyage 500"));
    const { items } = await cmMod.recallChatMemories("any?", 5);
    expect(items.length).toBe(1);
    expect(items[0].text).toBe("Prefers writing in the morning.");
  });

  it("empty corpus → empty result", async () => {
    const { items } = await cmMod.recallChatMemories("anything?");
    expect(items).toEqual([]);
  });

  it("empty input → no embed call, but still surfaces memories by recency", async () => {
    insert("Prefers writing in the morning.", new Float32Array([1, 0, 0, 0]));
    const spy = vi.spyOn(embMod, "embed");
    const { items } = await cmMod.recallChatMemories("");
    expect(spy).not.toHaveBeenCalled();
    expect(items.length).toBe(1);
  });

  it("normalises stored category through the recall path", async () => {
    insert("Likes tea, not coffee.", new Float32Array([1, 0, 0, 0]), {
      category: "preferences", // plural alias
    });
    stubEmbed(new Float32Array([1, 0, 0, 0]));
    const { items } = await cmMod.recallChatMemories("any?", 5, 0);
    expect(items.length).toBe(1);
    expect(items[0].category).toBe("preference");
  });

  it("large corpus: blends semantic top-K with most-recent floor", async () => {
    // 31 rows (> RECALL_INCLUDE_ALL_MAX = 30) forces the large-corpus path.
    // Rows 1..29 are filler orthogonal to the query. The semantically
    // matching row is OLD (inserted first, so least recent); a fresh,
    // unrelated row is inserted last. The match must surface via top-K AND
    // the fresh row must surface via the recency floor.
    insert("OLD strongly relevant memory.", new Float32Array([1, 0, 0, 0]));
    for (let i = 0; i < 29; i++) {
      insert(`filler ${i}`, new Float32Array([0, 0, 1, 0]));
    }
    insert("BRAND NEW unrelated memory.", new Float32Array([0, 1, 0, 0]));
    stubEmbed(new Float32Array([1, 0, 0, 0])); // matches the OLD relevant row
    const { items } = await cmMod.recallChatMemories("relevant?", 5, 0.4);
    const texts = items.map((m) => m.text);
    expect(texts).toContain("OLD strongly relevant memory.");
    expect(texts).toContain("BRAND NEW unrelated memory.");
  });
});

describe("formatRecalledMemoriesBlock", () => {
  it("returns empty string when there are no items", () => {
    expect(cmMod.formatRecalledMemoriesBlock([])).toBe("");
  });

  it("renders header + advisory framing + items + footer", () => {
    const now = new Date("2026-06-18T00:00:00Z");
    const block = cmMod.formatRecalledMemoriesBlock(
      [
        {
          id: 1,
          category: "preference",
          text: "Prefers writing in the morning.",
          score: 0.9,
          created_at: "2026-06-17 12:00:00",
        },
      ],
      now
    );
    expect(block).toContain("THINGS THEY'VE TOLD YOU BEFORE");
    expect(block).toContain("prefer the current information");
    expect(block).toContain("[preference] Prefers writing in the morning.");
    expect(block).toContain("END");
  });

  it("includes a relative-time hint", () => {
    const now = new Date("2026-06-18T00:00:00Z");
    const block = cmMod.formatRecalledMemoriesBlock(
      [
        {
          id: 1,
          category: "fact",
          text: "x",
          score: 1,
          created_at: "2026-06-17 12:00:00",
        },
      ],
      now
    );
    expect(block).toMatch(/from (today|yesterday|\d+ days ago)/);
  });
});
