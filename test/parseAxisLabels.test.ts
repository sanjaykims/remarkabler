import { describe, it, expect } from "vitest";
import { parseAxisLabels } from "@/lib/claude";

// The axis-label parser has to survive whatever the chat-tier model returns.
// These cover the real-world deviations we designed it to tolerate: fences,
// preambles, nesting, trailing commas, partial fields, and outright garbage.

const clean = JSON.stringify({
  pc1: { positive: "family life", negative: "business strategy" },
  pc2: { positive: "morning calm", negative: "late-night anxiety" },
  pc3: { positive: "outward insight", negative: "small daily routine" },
});

describe("parseAxisLabels", () => {
  it("parses clean JSON", () => {
    const { labels, parseError } = parseAxisLabels(clean);
    expect(parseError).toBe("");
    expect(labels?.pc1.positive).toBe("family life");
    expect(labels?.pc3.negative).toBe("small daily routine");
  });

  it("strips a ```json fence", () => {
    const { labels } = parseAxisLabels("```json\n" + clean + "\n```");
    expect(labels?.pc1.negative).toBe("business strategy");
  });

  it("strips a bare ``` fence", () => {
    const { labels } = parseAxisLabels("```\n" + clean + "\n```");
    expect(labels?.pc2.positive).toBe("morning calm");
  });

  it("extracts JSON after a preamble", () => {
    const { labels } = parseAxisLabels("Here are the labels:\n" + clean);
    expect(labels?.pc1.positive).toBe("family life");
  });

  it("tolerates trailing commas", () => {
    const sloppy =
      '{"pc1":{"positive":"a","negative":"b",},"pc2":{"positive":"c","negative":"d"},"pc3":{"positive":"e","negative":"f"},}';
    const { labels } = parseAxisLabels(sloppy);
    expect(labels?.pc1.positive).toBe("a");
    expect(labels?.pc3.negative).toBe("f");
  });

  it("unwraps a nested { axes: ... } object", () => {
    const nested = JSON.stringify({ axes: JSON.parse(clean) });
    const { labels } = parseAxisLabels(nested);
    expect(labels?.pc2.negative).toBe("late-night anxiety");
  });

  it("unwraps a nested { labels: ... } object", () => {
    const nested = JSON.stringify({ labels: JSON.parse(clean) });
    const { labels } = parseAxisLabels(nested);
    expect(labels?.pc1.positive).toBe("family life");
  });

  it("accepts Korean labels (English is preferred but not enforced here)", () => {
    const kr = JSON.stringify({
      pc1: { positive: "가족 일상", negative: "사업 전략" },
      pc2: { positive: "아침", negative: "밤" },
      pc3: { positive: "통찰", negative: "루틴" },
    });
    const { labels } = parseAxisLabels(kr);
    expect(labels?.pc1.positive).toBe("가족 일상");
  });

  it("synthesises (missing) for a blank side rather than discarding all", () => {
    const partial = JSON.stringify({
      pc1: { positive: "a", negative: "" },
      pc2: { positive: "c", negative: "d" },
      pc3: { positive: "e", negative: "f" },
    });
    const { labels, parseError } = parseAxisLabels(partial);
    expect(parseError).toBe("");
    expect(labels?.pc1.positive).toBe("a");
    expect(labels?.pc1.negative).toBe("(missing)");
  });

  it("truncates absurdly long labels to 40 chars", () => {
    const long = JSON.stringify({
      pc1: { positive: "x".repeat(200), negative: "b" },
      pc2: { positive: "c", negative: "d" },
      pc3: { positive: "e", negative: "f" },
    });
    const { labels } = parseAxisLabels(long);
    expect(labels?.pc1.positive.length).toBe(40);
  });

  it("returns an error for empty input", () => {
    const { labels, parseError } = parseAxisLabels("");
    expect(labels).toBeNull();
    expect(parseError).toMatch(/empty/i);
  });

  it("returns an error for non-JSON garbage", () => {
    const { labels } = parseAxisLabels("I cannot analyse this, sorry.");
    expect(labels).toBeNull();
  });

  it("returns an error when an axis is missing entirely", () => {
    const missing = JSON.stringify({
      pc1: { positive: "a", negative: "b" },
      pc2: { positive: "c", negative: "d" },
      // pc3 absent
    });
    const { labels, parseError } = parseAxisLabels(missing);
    expect(labels).toBeNull();
    expect(parseError).toMatch(/pc3/);
  });
});
