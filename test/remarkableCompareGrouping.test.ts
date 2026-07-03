import { describe, it, expect } from "vitest";
import { textByEffectiveDate } from "@/lib/remarkableCompare";
import type { DiaryPageRow } from "@/lib/diaryExport";

// Regression: the quality-gate compare must include CONTINUATION pages
// (entry_date='none', inheriting the previous header's date) on both sides.
// The first implementation grouped by stored entry_date only, which silently
// dropped a correctly-transcribed section that landed on its own header-less
// page after the tall-page split — making it look "missing from the import"
// through several fix cycles.

function row(
  overrides: Partial<DiaryPageRow> & { page_index: number }
): DiaryPageRow {
  return {
    id: `p${overrides.page_index}`,
    notebook_id: "nb1",
    notebook_name: "2026-06",
    entry_date: null,
    ocr_text: "",
    themes: null,
    sentiment: null,
    ...overrides,
  };
}

describe("textByEffectiveDate", () => {
  it("carries a header date forward onto continuation ('none') pages", () => {
    const m = textByEffectiveDate([
      row({ page_index: 0, entry_date: "2026-06-03", ocr_text: "main entry" }),
      row({ page_index: 1, entry_date: "none", ocr_text: "instagram tips" }),
      row({ page_index: 2, entry_date: "2026-06-05", ocr_text: "next day" }),
    ]);
    expect(m.get("2026-06-03")).toBe("main entry\n\ninstagram tips");
    expect(m.get("2026-06-05")).toBe("next day");
  });

  it("resets the carry at notebook boundaries", () => {
    const m = textByEffectiveDate([
      row({ page_index: 0, entry_date: "2026-06-03", ocr_text: "a" }),
      row({
        page_index: 0,
        notebook_id: "nb2",
        entry_date: "none",
        ocr_text: "orphan",
      }),
    ]);
    expect(m.get("2026-06-03")).toBe("a");
    // The orphan page has no header anywhere before it in ITS notebook.
    expect(Array.from(m.keys())).toEqual(["2026-06-03"]);
  });

  it("skips pages with no text and notebooks with no dated header", () => {
    const m = textByEffectiveDate([
      row({ page_index: 0, entry_date: "none", ocr_text: "undated only" }),
      row({ page_index: 1, entry_date: "2026-06-03", ocr_text: "" }),
    ]);
    expect(m.size).toBe(0);
  });
});
