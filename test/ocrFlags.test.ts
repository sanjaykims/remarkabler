import { describe, expect, it } from "vitest";
import {
  anchorPhrase,
  contextSnippet,
  parseFlagLines,
  replaceAt,
  splitFlagsBlock,
} from "../lib/ocrFlags";

describe("splitFlagsBlock", () => {
  it("keeps the transcript intact and peels the flags block off", () => {
    const raw = "--- PAGE 1 ---\nhello Elim\n--- FLAGS ---\n{\"page\":1,\"phrase\":\"Elim\"}\n";
    const { body, flagsRaw } = splitFlagsBlock(raw);
    expect(body).toBe("--- PAGE 1 ---\nhello Elim\n");
    expect(flagsRaw).toContain("Elim");
    expect(body).not.toContain("FLAGS");
  });
  it("is a no-op when there is no flags block", () => {
    const raw = "--- PAGE 1 ---\nhi";
    expect(splitFlagsBlock(raw)).toEqual({ body: raw, flagsRaw: "" });
  });
});

describe("parseFlagLines", () => {
  it("parses good lines, skips junk, dedupes and caps alternatives", () => {
    const raw = [
      '{"page":2,"phrase":"Elim","alternatives":["Elin","Elin","Elim","Ellen","Eli","Elan"],"reason":"unclear"}',
      "not json at all",
      '{"page":0,"phrase":"bad page"}',
      '{"page":1,"phrase":""}',
      '- {"page":1,"phrase":"Taylr","alternatives":["Taylor"]}',
      '{"page":3,"phrase":"cut off',
    ].join("\n");
    const f = parseFlagLines(raw);
    expect(f).toHaveLength(2);
    expect(f[0]).toMatchObject({ page: 2, phrase: "Elim", reason: "unclear" });
    expect(f[0].alternatives).toEqual(["Elin", "Ellen", "Eli"]); // no dup, no phrase itself, max 3
    expect(f[1]).toMatchObject({ page: 1, phrase: "Taylr", alternatives: ["Taylor"] });
  });
  it("caps the number of flags", () => {
    const lines = Array.from({ length: 40 }, (_, i) => `{"page":1,"phrase":"w${i}","alternatives":["x${i}"]}`).join("\n");
    expect(parseFlagLines(lines)).toHaveLength(15);
  });
});

describe("anchor / replace / snippet", () => {
  const text = "Met Elim today.\nElim was late.";
  it("prefers the occurrence nearest the hint", () => {
    expect(anchorPhrase(text, "Elim", 0)).toBe(4);
    expect(anchorPhrase(text, "Elim", 20)).toBe(16);
    expect(anchorPhrase(text, "nope")).toBe(-1);
  });
  it("replaces exactly the flagged occurrence", () => {
    expect(replaceAt(text, 16, "Elim", "Elin")).toBe("Met Elim today.\nElin was late.");
  });
  it("re-finds the phrase if the offset drifted, and refuses if it is gone", () => {
    expect(replaceAt("xx Elim", 0, "Elim", "Elin")).toBe("xx Elin");
    expect(replaceAt("nothing here", 0, "Elim", "Elin")).toBeNull();
  });
  it("builds a one-line context window", () => {
    const c = contextSnippet(text, 16, 4, 6);
    expect(c.match).toBe("Elim");
    expect(c.before).toContain("⏎");
    expect(c.after).toContain("was");
  });
});

describe("parseFlagLines noise filter", () => {
  const line = (o: object) => JSON.stringify(o);
  it("drops sentence-long phrases, self-dismissed flags and flags with no real alternative", () => {
    const raw = [
      line({ page: 1, phrase: "Elin, you are awesome!", alternatives: ["Ellin"], reason: "x" }),
      line({ page: 1, phrase: "Elin", alternatives: ["Ellin"], reason: "consistent, so no strong flag" }),
      line({ page: 1, phrase: "IOX", alternatives: ["iox", "I O X"], reason: "same" }),
      line({ page: 1, phrase: "Elim", alternatives: ["Elin", "ELIN", "e lin"], reason: "m vs n" }),
    ].join("\n");
    const f = parseFlagLines(raw);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ phrase: "Elim", alternatives: ["Elin"] });
  });
});

describe("whole-word anchoring", () => {
  it("never anchors a piece of a longer Latin word or number", async () => {
    const { anchorPhrase, parseFlagLines } = await import("../lib/ocrFlags");
    expect(anchorPhrase("회사에서 Copilot studio", "opilot")).toBe(-1);
    expect(anchorPhrase("about 100 won", "10")).toBe(-1);
    expect(anchorPhrase("met Copilot team", "Copilot")).toBe(4);
    expect(anchorPhrase("심천에서 Futian", "심천")).toBe(0); // Korean particles attach
    const line = JSON.stringify({ page: 1, phrase: "opilot", alternatives: ["Copilot"], reason: "it reads 'Copilot studio' correctly - no flag needed" });
    expect(parseFlagLines(line)).toEqual([]);
  });
});
