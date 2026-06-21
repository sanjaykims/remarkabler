import { describe, it, expect } from "vitest";
import { parseChatMemories } from "@/lib/claude";

// parseChatMemories has to survive whatever the chat-tier model returns
// for the durable-memory extraction. Same leniency posture as
// parseAxisLabels — strip fences, find embedded JSON in a preamble,
// tolerate trailing commas, accept partial fields.

const clean = JSON.stringify({
  items: [
    {
      category: "preference",
      text: "Prefers writing in the morning before work.",
      source_excerpt: "I always write better in the morning before work.",
    },
    {
      category: "fact",
      text: "Has a dog named Hopper.",
      source_excerpt: "Hopper barked all night again.",
    },
  ],
});

describe("parseChatMemories", () => {
  it("parses clean JSON", () => {
    const { items, parseError } = parseChatMemories(clean);
    expect(parseError).toBe("");
    expect(items.length).toBe(2);
    expect(items[0].category).toBe("preference");
    expect(items[1].text).toBe("Has a dog named Hopper.");
  });

  it("strips a ```json fence", () => {
    const { items } = parseChatMemories("```json\n" + clean + "\n```");
    expect(items.length).toBe(2);
  });

  it("strips a bare ``` fence", () => {
    const { items } = parseChatMemories("```\n" + clean + "\n```");
    expect(items.length).toBe(2);
  });

  it("extracts JSON after a preamble", () => {
    const { items } = parseChatMemories("Here are the memories:\n" + clean);
    expect(items.length).toBe(2);
  });

  it("tolerates trailing commas", () => {
    const sloppy =
      '{"items":[{"category":"fact","text":"works at Acme",},],}';
    const { items, parseError } = parseChatMemories(sloppy);
    expect(parseError).toBe("");
    expect(items.length).toBe(1);
    expect(items[0].text).toBe("works at Acme");
  });

  it("accepts a bare array of items", () => {
    const bare = JSON.stringify([
      { category: "intent", text: "Wants to run a half-marathon this fall." },
    ]);
    const { items } = parseChatMemories(bare);
    expect(items.length).toBe(1);
    expect(items[0].category).toBe("intent");
  });

  it("falls back to 'fact' when category is missing", () => {
    const partial = JSON.stringify({
      items: [{ text: "has a daughter named Mia" }],
    });
    const { items } = parseChatMemories(partial);
    expect(items.length).toBe(1);
    expect(items[0].category).toBe("fact");
  });

  it("drops items with empty text", () => {
    const partial = JSON.stringify({
      items: [
        { category: "fact", text: "" },
        { category: "fact", text: "real fact" },
      ],
    });
    const { items } = parseChatMemories(partial);
    expect(items.length).toBe(1);
    expect(items[0].text).toBe("real fact");
  });

  it("accepts 'excerpt' as a synonym for 'source_excerpt'", () => {
    const alt = JSON.stringify({
      items: [{ category: "fact", text: "x", excerpt: "the source" }],
    });
    const { items } = parseChatMemories(alt);
    expect(items[0].source_excerpt).toBe("the source");
  });

  it("returns an empty list with parseError for empty input", () => {
    const { items, parseError } = parseChatMemories("");
    expect(items).toEqual([]);
    expect(parseError).toMatch(/empty/i);
  });

  it("returns an empty list with parseError for non-JSON garbage", () => {
    const { items, parseError } = parseChatMemories("nope nothing here");
    expect(items).toEqual([]);
    expect(parseError).not.toBe("");
  });

  it("returns parseError when items key is missing entirely", () => {
    const noItems = JSON.stringify({ foo: "bar" });
    const { items, parseError } = parseChatMemories(noItems);
    expect(items).toEqual([]);
    expect(parseError).toMatch(/items/i);
  });

  it("accepts a legitimate empty extraction (no items in array)", () => {
    const empty = JSON.stringify({ items: [] });
    const { items, parseError } = parseChatMemories(empty);
    expect(items).toEqual([]);
    expect(parseError).toBe("");
  });

  it("salvages complete items from a max_tokens-truncated reply", () => {
    // Real-world failure: Claude's reply got cut off mid-array (the
    // "Unexpected end of JSON input" error). Salvage path pulls complete
    // {...} objects out and drops the truncated tail. Better than losing
    // the whole batch.
    const truncated =
      '{"items":[' +
      '{"category":"intent","text":"Will depart for biz trip Sunday June 21.","source_excerpt":"Leaving on upcoming sunday."},' +
      '{"category":"fact","text":"Confirmed Wuhan trip.","source_excerpt":"trip got fixed."},' +
      '{"category":"feeling","text":"Tired from long work days.","source_excer'; // truncated mid-string
    const { items, parseError } = parseChatMemories(truncated);
    expect(items.length).toBe(2);
    expect(items[0].text).toContain("Sunday June 21");
    expect(items[1].text).toContain("Wuhan");
    // Salvage success → no parseError (some items beats zero).
    expect(parseError).toBe("");
  });

  it("salvage respects strings: braces inside text don't end the object early", () => {
    const truncated =
      '{"items":[' +
      '{"category":"fact","text":"likes the song } from that album","source_excerpt":""},' +
      '{"category":"intent","text":"plan to visit { restaurant","source_excerpt":""},' +
      '{"category":"feeling","text":"unfinished';
    const { items } = parseChatMemories(truncated);
    expect(items.length).toBe(2);
    expect(items[0].text).toBe("likes the song } from that album");
    expect(items[1].text).toBe("plan to visit { restaurant");
  });

  it("truncated reply with zero salvageable items → parseError", () => {
    // First object itself is truncated → nothing to recover.
    const truncated = '{"items":[{"category":"intent","text":"unfinish';
    const { items, parseError } = parseChatMemories(truncated);
    expect(items).toEqual([]);
    expect(parseError).not.toBe("");
  });
});
