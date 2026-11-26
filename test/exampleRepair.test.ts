import { describe, it, expect } from "vitest";
import { flagForExample, type RepairFlag } from "../lib/exampleRepair";

const flag = (over: Partial<RepairFlag>): RepairFlag => ({
  phrase: "wrongword",
  resolved_text: "rightword",
  start_offset: 10,
  box: null,
  page_id: "p1",
  page_index: 0,
  ocr_text: "some page text",
  ...over,
});

describe("flagForExample", () => {
  it("matches a corrected word: text is the confirmed word, wrong is the first reading", () => {
    const flags = [flag({ phrase: "other", resolved_text: "else" }), flag({})];
    const f = flagForExample({ text: "rightword", wrong: "wrongword" }, flags);
    expect(f?.phrase).toBe("wrongword");
  });

  it("matches a kept word: confirmed as written means wrong is null", () => {
    const kept = flag({ phrase: "Elin", resolved_text: "Elin" });
    expect(flagForExample({ text: "Elin", wrong: null }, [kept])).toBe(kept);
    // a corrected card for the same word must not be mistaken for a kept one
    expect(flagForExample({ text: "Elin", wrong: null }, [flag({ phrase: "Elim", resolved_text: "Elin" })])).toBeUndefined();
  });

  it("ignores whitespace differences the way captureExample normalises text", () => {
    const f = flag({ phrase: "re Markable", resolved_text: "reMarkable  " });
    expect(flagForExample({ text: "reMarkable", wrong: "re Markable" }, [f])).toBe(f);
  });

  it("returns undefined when no answered card produced the example", () => {
    expect(flagForExample({ text: "nope", wrong: null }, [flag({})])).toBeUndefined();
    expect(flagForExample({ text: "rightword", wrong: "wrongword" }, [])).toBeUndefined();
  });
});
