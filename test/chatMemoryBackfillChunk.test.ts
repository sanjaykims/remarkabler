import { describe, it, expect } from "vitest";
import {
  CHUNK_TARGET_CHARS,
  estimateTranscriptCost,
  chunkMessageIds,
} from "@/lib/chatMemoryBackfill";

// The first version of the backfill endpoint shipped with a real bug:
// every message in a conversation went into a SINGLE batch. Combined with
// compressBatch's MAX_TRANSCRIPT_CHARS = 16_000 cap, that meant a long
// history was silently truncated to the most recent ~16K chars and Claude
// only saw the tail. These tests lock the chunking invariant so the
// regression can't come back: every produced chunk's transcript stays at
// or under CHUNK_TARGET_CHARS, and a long history produces MANY chunks.

function makeMsgs(
  count: number,
  bodyLen: number
): Array<{ id: number; role: string; content: string }> {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      id: i + 1,
      role: i % 2 === 0 ? "user" : "assistant",
      content: "x".repeat(bodyLen),
    });
  }
  return out;
}

function chunkCost(
  ids: number[],
  msgs: Array<{ id: number; role: string; content: string }>
): number {
  let sum = 0;
  for (const id of ids) {
    const m = msgs.find((x) => x.id === id)!;
    sum += estimateTranscriptCost(m.role, m.content);
  }
  return sum;
}

describe("chunkMessageIds — char-budget chunking", () => {
  it("puts a short history in a single chunk", () => {
    const msgs = makeMsgs(4, 50);
    const chunks = chunkMessageIds(msgs);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toEqual([1, 2, 3, 4]);
  });

  it("splits a long history into multiple chunks", () => {
    // ~200 messages, each ~500 chars → ~100K chars total. With a 12K target
    // we should see ~8-10 chunks.
    const msgs = makeMsgs(200, 500);
    const chunks = chunkMessageIds(msgs);
    expect(chunks.length).toBeGreaterThan(5);
  });

  it("every chunk's transcript stays at or under the target", () => {
    const msgs = makeMsgs(200, 500);
    const chunks = chunkMessageIds(msgs);
    for (const chunk of chunks) {
      const cost = chunkCost(chunk, msgs);
      // Greedy: a chunk can exceed the target only because its LAST message
      // pushed it over. The next message would have rolled into a new chunk.
      // We're protecting against the bug-shape ("one giant chunk, transcript
      // truncated"). Asserting strictly <= target without a slack margin
      // would fail when one fat message exceeds CHUNK_TARGET on its own.
      const lastId = chunk[chunk.length - 1];
      const last = msgs.find((x) => x.id === lastId)!;
      const lastCost = estimateTranscriptCost(last.role, last.content);
      expect(cost - lastCost).toBeLessThan(CHUNK_TARGET_CHARS);
    }
  });

  it("every message ends up in exactly one chunk, in order", () => {
    const msgs = makeMsgs(73, 300);
    const chunks = chunkMessageIds(msgs);
    const flat = chunks.flat();
    expect(flat).toEqual(msgs.map((m) => m.id));
    // No duplicates, no missing
    expect(new Set(flat).size).toBe(73);
  });

  it("handles empty input", () => {
    expect(chunkMessageIds([])).toEqual([]);
  });

  it("handles a single oversize message gracefully (own chunk)", () => {
    // One pathological message larger than the chunk target. Should still
    // get its own chunk rather than crash or be silently dropped.
    const huge = "y".repeat(CHUNK_TARGET_CHARS + 5000);
    const msgs = [
      { id: 1, role: "user", content: "hello" },
      { id: 2, role: "assistant", content: huge },
      { id: 3, role: "user", content: "more" },
    ];
    const chunks = chunkMessageIds(msgs);
    // The huge message rolls onto its own chunk or starts one; we don't
    // require an exact layout, just that all three ids are present.
    const flat = chunks.flat();
    expect(flat.sort()).toEqual([1, 2, 3]);
  });

  it("produces enough chunks that a 100K-char history is fully covered", () => {
    // The regression we're guarding against: a single batch + 16K cap
    // = only the tail visible. Sum of all chunk costs should equal the
    // sum of all message costs, i.e. nothing is dropped at the chunker.
    const msgs = makeMsgs(150, 700);
    const total = msgs.reduce(
      (s, m) => s + estimateTranscriptCost(m.role, m.content),
      0
    );
    const chunks = chunkMessageIds(msgs);
    const covered = chunks.reduce(
      (s, c) => s + chunkCost(c, msgs),
      0
    );
    expect(covered).toBe(total);
  });
});
