import { describe, expect, it } from "vitest";
import { wordChanges } from "../lib/ocrDiff";

describe("wordChanges (learning from manual edits)", () => {
  it("extracts a single word substitution with context", () => {
    const c = wordChanges("Met Elim today at the cafe", "Met Elin today at the cafe");
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ wrong: "Elim", right: "Elin" });
    expect(c[0].context).toContain("Met");
    expect(c[0].context).toContain("today");
  });

  it("ignores trailing punctuation differences and finds several fixes", () => {
    const c = wordChanges("Elim, and Taylr went home.", "Elin, and Taylor went home.");
    expect(c.map((x) => [x.wrong, x.right])).toEqual([
      ["Elim", "Elin"],
      ["Taylr", "Taylor"],
    ]);
  });

  it("learns small phrase substitutions", () => {
    const c = wordChanges("we saw re Markable today", "we saw reMarkable today");
    expect(c).toEqual([
      expect.objectContaining({ wrong: "re Markable", right: "reMarkable" }),
    ]);
  });

  it("ignores pure insertions, deletions and unchanged text", () => {
    expect(wordChanges("a b c", "a b c d")).toEqual([]);
    expect(wordChanges("a b c d", "a b c")).toEqual([]);
    expect(wordChanges("same text", "same text")).toEqual([]);
  });

  it("ignores rewrites: long replaced phrases and too many edits", () => {
    expect(wordChanges("one two three four five", "one alpha beta gamma delta five")).toEqual([]);
    const a = Array.from({ length: 30 }, (_, i) => `w${i}`).join(" ");
    const b = Array.from({ length: 30 }, (_, i) => `x${i}`).join(" ");
    expect(wordChanges(a, b)).toEqual([]);
  });

  it("ignores a punctuation-only change", () => {
    expect(wordChanges("hello world", "hello, world.")).toEqual([]);
  });
});
