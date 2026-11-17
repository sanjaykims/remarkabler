import { describe, expect, it } from "vitest";
import { applySecondLook, parseLookAnswers } from "../lib/secondLook";

const flag = (phrase: string, alternatives: string[]) => ({ page: 1, phrase, alternatives, reason: "r" });

describe("second look", () => {
  it("parses answer lines and ignores junk", () => {
    expect(parseLookAnswers('x\n{"item":1,"read":"Elin","sure":true}\n{bad')).toEqual([
      { item: 1, read: "Elin", sure: true },
    ]);
  });

  it("drops a confirmed flag, fixes a unique word, leaves unsure and repeated ones", () => {
    const pages = [{ pageIndex: 0, text: "met Elim and Futian, Futian again, 5G" }];
    const flags = [flag("Elim", ["Elin"]), flag("Futian", ["Futien"]), flag("5G", ["SG"]), flag("met", ["net"])];
    const items = [
      { flag: 0, page: 0, offset: 4, occurrences: 1, candidates: ["Elim", "Elin"] },
      { flag: 1, page: 0, offset: 13, occurrences: 2, candidates: ["Futian", "Futien"] },
      { flag: 2, page: 0, offset: 35, occurrences: 1, candidates: ["5G", "SG"] },
      { flag: 3, page: 0, offset: 0, occurrences: 1, candidates: ["met", "net"] },
    ];
    const r = applySecondLook(pages, flags, items, [
      { item: 1, read: "Elin", sure: true },
      { item: 2, read: "Futien", sure: true },
      { item: 3, read: "5G", sure: true },
      { item: 4, read: "net", sure: false },
      { item: 9, read: "x", sure: true },
    ]);
    expect(r.pages[0].text).toBe("met Elin and Futian, Futian again, 5G");
    expect(pages[0].text).toContain("Elim"); // input untouched
    expect(r.flags.map((f) => f.phrase)).toEqual(["Elin", "Futian", "met"]);
    expect(r.flags[0].alternatives).toEqual(["Elim"]);
    expect(r.flags[1].alternatives[0]).toBe("Futien");
    expect([r.confirmed, r.changed]).toEqual([1, 1]);
  });
});
