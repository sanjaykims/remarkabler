import { describe, it, expect } from "vitest";
import { normaliseChatMemoryCategory } from "@/lib/chatMemory";

// The model produces a long tail of plausible category synonyms. The
// normaliser maps them to a fixed 6-value enum so the UI filter chips and
// stored category column stay consistent — and aren't every variation Claude
// happened to emit that week.
describe("normaliseChatMemoryCategory", () => {
  it("preserves the canonical six", () => {
    expect(normaliseChatMemoryCategory("fact")).toBe("fact");
    expect(normaliseChatMemoryCategory("preference")).toBe("preference");
    expect(normaliseChatMemoryCategory("intent")).toBe("intent");
    expect(normaliseChatMemoryCategory("feeling")).toBe("feeling");
    expect(normaliseChatMemoryCategory("unresolved")).toBe("unresolved");
    expect(normaliseChatMemoryCategory("other")).toBe("other");
  });

  it("maps plural aliases", () => {
    expect(normaliseChatMemoryCategory("preferences")).toBe("preference");
    expect(normaliseChatMemoryCategory("intents")).toBe("intent");
    expect(normaliseChatMemoryCategory("feelings")).toBe("feeling");
    expect(normaliseChatMemoryCategory("facts")).toBe("fact");
  });

  it("maps semantically equivalent words", () => {
    expect(normaliseChatMemoryCategory("habit")).toBe("preference");
    expect(normaliseChatMemoryCategory("routine")).toBe("preference");
    expect(normaliseChatMemoryCategory("goal")).toBe("intent");
    expect(normaliseChatMemoryCategory("plan")).toBe("intent");
    expect(normaliseChatMemoryCategory("emotion")).toBe("feeling");
    expect(normaliseChatMemoryCategory("mood")).toBe("feeling");
    expect(normaliseChatMemoryCategory("open thread")).toBe("unresolved");
    expect(normaliseChatMemoryCategory("follow-up")).toBe("unresolved");
    expect(normaliseChatMemoryCategory("bio")).toBe("fact");
  });

  it("buckets 'context' into 'other'", () => {
    expect(normaliseChatMemoryCategory("context")).toBe("other");
  });

  it("falls back to 'other' for unknown values", () => {
    expect(normaliseChatMemoryCategory("vibe")).toBe("other");
    expect(normaliseChatMemoryCategory("random-thing")).toBe("other");
  });

  it("falls back to 'other' for empty input", () => {
    expect(normaliseChatMemoryCategory("")).toBe("other");
    expect(normaliseChatMemoryCategory("   ")).toBe("other");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(normaliseChatMemoryCategory("  PREFERENCE  ")).toBe("preference");
    expect(normaliseChatMemoryCategory("Intent")).toBe("intent");
  });

  it("falls back via the first word when given a phrase", () => {
    // "preferences for X" → "preferences" → "preference".
    expect(normaliseChatMemoryCategory("preferences for tea")).toBe("preference");
    expect(normaliseChatMemoryCategory("goal — short term")).toBe("intent");
  });
});
