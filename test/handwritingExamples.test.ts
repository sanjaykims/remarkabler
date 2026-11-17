import { describe, it, expect } from "vitest";
import { parseFlagLines } from "../lib/ocrFlags";
import { looksLikeMisread } from "../lib/ocrLearning";
import { exampleBlocks } from "../lib/handwritingExamples";

describe("flag box", () => {
  it("keeps a sane box and drops a bad one", () => {
    const line = (box: unknown) =>
      JSON.stringify({ page: 1, phrase: "Elim", alternatives: ["Elin"], reason: "n", box });
    expect(parseFlagLines(line([100, 200, 300, 260]))[0].box).toEqual([100, 200, 300, 260]);
    expect(parseFlagLines(line([0, 0, 1000, 1000]))[0].box).toBeUndefined();
    expect(parseFlagLines(line("x"))[0].box).toBeUndefined();
  });
});

describe("looksLikeMisread", () => {
  it("accepts look-alike words, rejects rewordings", () => {
    expect(looksLikeMisread("Elim", "Elin")).toBe(true);
    expect(looksLikeMisread("reMarkable", "re Markable")).toBe(true);
    expect(looksLikeMisread("big", "enormous")).toBe(false);
  });
});

describe("exampleBlocks", () => {
  it("is empty without examples and pairs image with label", () => {
    expect(exampleBlocks([])).toEqual([]);
    const b = exampleBlocks([{ text: "Elin", png: Buffer.from("x") }]);
    expect(b.map((x) => x.type)).toEqual(["text", "image", "text"]);
  });
});
