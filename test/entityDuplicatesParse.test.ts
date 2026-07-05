import { describe, it, expect } from "vitest";
import { parseEntityDuplicates } from "@/lib/claude";

// Pure parser for findEntityDuplicates' JSON. Guards against Claude inventing
// names, merging things it wasn't offered, or self-referential groups.

const INPUT = ["Yaofang", "야오팡", "Kim", "Mom", "엄마"];

describe("parseEntityDuplicates", () => {
  it("returns groups whose names all come from the input list", () => {
    const raw = JSON.stringify({
      groups: [
        { canonical: "Yaofang", aliases: ["야오팡"] },
        { canonical: "Mom", aliases: ["엄마"] },
      ],
    });
    expect(parseEntityDuplicates(raw, INPUT)).toEqual([
      { canonical: "Yaofang", aliases: ["야오팡"] },
      { canonical: "Mom", aliases: ["엄마"] },
    ]);
  });

  it("tolerates a ```json fence", () => {
    const raw = '```json\n{"groups":[{"canonical":"Yaofang","aliases":["야오팡"]}]}\n```';
    expect(parseEntityDuplicates(raw, INPUT)).toEqual([
      { canonical: "Yaofang", aliases: ["야오팡"] },
    ]);
  });

  it("drops a canonical that isn't in the input (no invented names)", () => {
    const raw = JSON.stringify({
      groups: [{ canonical: "Yao Fang Chen", aliases: ["야오팡"] }],
    });
    expect(parseEntityDuplicates(raw, INPUT)).toEqual([]);
  });

  it("drops aliases not in the input, and the group if none remain", () => {
    const raw = JSON.stringify({
      groups: [
        { canonical: "Yaofang", aliases: ["야오팡", "Ghost"] },
        { canonical: "Kim", aliases: ["Nobody"] },
      ],
    });
    expect(parseEntityDuplicates(raw, INPUT)).toEqual([
      { canonical: "Yaofang", aliases: ["야오팡"] },
    ]);
  });

  it("never lets the canonical appear in its own aliases", () => {
    const raw = JSON.stringify({
      groups: [{ canonical: "Yaofang", aliases: ["Yaofang", "야오팡"] }],
    });
    expect(parseEntityDuplicates(raw, INPUT)).toEqual([
      { canonical: "Yaofang", aliases: ["야오팡"] },
    ]);
  });

  it("assigns a name to only one group (no double-claim)", () => {
    const raw = JSON.stringify({
      groups: [
        { canonical: "Yaofang", aliases: ["야오팡"] },
        { canonical: "Kim", aliases: ["야오팡"] }, // 야오팡 already claimed
      ],
    });
    const out = parseEntityDuplicates(raw, INPUT);
    expect(out).toEqual([{ canonical: "Yaofang", aliases: ["야오팡"] }]);
  });

  it("matches input names case-insensitively but emits the input's casing", () => {
    const raw = JSON.stringify({
      groups: [{ canonical: "yaofang", aliases: ["야오팡"] }],
    });
    // "yaofang" maps back to the exact input spelling "Yaofang".
    expect(parseEntityDuplicates(raw, INPUT)).toEqual([
      { canonical: "Yaofang", aliases: ["야오팡"] },
    ]);
  });

  it("returns [] on malformed JSON or missing groups", () => {
    expect(parseEntityDuplicates("not json", INPUT)).toEqual([]);
    expect(parseEntityDuplicates(JSON.stringify({ x: 1 }), INPUT)).toEqual([]);
  });
});
