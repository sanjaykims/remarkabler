import { describe, it, expect } from "vitest";
import {
  buildDiaryMarkdown,
  carryForwardDates,
  isDatedEntry,
  parseThemes,
  type DiaryPageRow,
  type PageEntities,
} from "@/lib/diaryExport";

// Pure-logic unit tests for the diary Markdown export. No DB, no network —
// the route feeds notebook-ordered rows in; this pins carry-forward,
// grouping, ordering, frontmatter, and metadata rendering.

function row(over: Partial<DiaryPageRow>): DiaryPageRow {
  return {
    id: "p1",
    notebook_id: "nb1",
    entry_date: "2026-06-19",
    page_index: 0,
    ocr_text: "text",
    notebook_name: "Diary 2026",
    themes: null,
    sentiment: null,
    ...over,
  };
}

describe("isDatedEntry", () => {
  it("treats a real date as dated", () => {
    expect(isDatedEntry("2026-06-19")).toBe(true);
  });
  it("treats null and the 'none' sentinel as undated", () => {
    expect(isDatedEntry(null)).toBe(false);
    expect(isDatedEntry("none")).toBe(false);
  });
});

describe("parseThemes", () => {
  it("parses a JSON array", () => {
    expect(parseThemes('["sleep","work"]')).toEqual(["sleep", "work"]);
  });
  it("returns [] for null, garbage, or non-arrays", () => {
    expect(parseThemes(null)).toEqual([]);
    expect(parseThemes("not json")).toEqual([]);
    expect(parseThemes('{"a":1}')).toEqual([]);
  });
  it("drops non-string elements", () => {
    expect(parseThemes('["ok", 3, null]')).toEqual(["ok"]);
  });
});

const noEntities = new Map<string, PageEntities>();

describe("carryForwardDates", () => {
  it("carries a dated page's date forward to later undated pages in the same notebook", () => {
    const out = carryForwardDates([
      row({ id: "a", notebook_id: "nb1", page_index: 0, entry_date: "2026-06-19" }),
      row({ id: "b", notebook_id: "nb1", page_index: 1, entry_date: "none" }),
      row({ id: "c", notebook_id: "nb1", page_index: 2, entry_date: null }),
    ]);
    expect(out.map((e) => e.effectiveDate)).toEqual([
      "2026-06-19",
      "2026-06-19",
      "2026-06-19",
    ]);
  });

  it("leaves pages before the first dated page undated", () => {
    const out = carryForwardDates([
      row({ id: "a", notebook_id: "nb1", page_index: 0, entry_date: "none" }),
      row({ id: "b", notebook_id: "nb1", page_index: 1, entry_date: "2026-06-19" }),
    ]);
    expect(out.map((e) => e.effectiveDate)).toEqual([null, "2026-06-19"]);
  });

  it("resets the carry at a notebook boundary", () => {
    const out = carryForwardDates([
      row({ id: "a", notebook_id: "nb1", page_index: 0, entry_date: "2026-06-19" }),
      row({ id: "b", notebook_id: "nb2", page_index: 0, entry_date: "none" }),
    ]);
    // nb2's page must NOT inherit nb1's date.
    expect(out.map((e) => e.effectiveDate)).toEqual(["2026-06-19", null]);
  });

  it("switches the carried date when a later page has its own", () => {
    const out = carryForwardDates([
      row({ id: "a", notebook_id: "nb1", page_index: 0, entry_date: "2026-06-19" }),
      row({ id: "b", notebook_id: "nb1", page_index: 1, entry_date: "none" }),
      row({ id: "c", notebook_id: "nb1", page_index: 2, entry_date: "2026-06-22" }),
      row({ id: "d", notebook_id: "nb1", page_index: 3, entry_date: "none" }),
    ]);
    expect(out.map((e) => e.effectiveDate)).toEqual([
      "2026-06-19",
      "2026-06-19",
      "2026-06-22",
      "2026-06-22",
    ]);
  });
});

describe("buildDiaryMarkdown", () => {
  it("keeps carried-forward continuation pages under their day, not Undated", () => {
    const md = buildDiaryMarkdown({
      rows: [
        row({ id: "a", notebook_id: "nb1", page_index: 0, entry_date: "2026-06-19", ocr_text: "page one" }),
        row({ id: "b", notebook_id: "nb1", page_index: 1, entry_date: "none", ocr_text: "page two same session" }),
      ],
      entitiesByPage: noEntities,
      exportedAt: "x",
    });
    expect(md).not.toContain("## Undated entries");
    expect(md.match(/^## 2026-06-19$/gm)?.length).toBe(1);
    expect(md).toContain("page two same session");
  });
  it("emits YAML frontmatter with counts and date range", () => {
    const md = buildDiaryMarkdown({
      rows: [
        row({ id: "a", entry_date: "2026-06-19", notebook_name: "N1" }),
        row({ id: "b", entry_date: "2026-06-22", notebook_name: "N2" }),
      ],
      entitiesByPage: noEntities,
      exportedAt: "2026-06-25 09:00",
    });
    expect(md.startsWith("---\n")).toBe(true);
    expect(md).toContain('title: "My Diary"');
    expect(md).toContain("pages: 2");
    expect(md).toContain("notebooks: 2");
    expect(md).toContain("range: 2026-06-19 → 2026-06-22");
    expect(md).toContain("exported: 2026-06-25 09:00");
  });

  it("groups consecutive pages of the same day under one ## header", () => {
    const md = buildDiaryMarkdown({
      rows: [
        row({ id: "a", entry_date: "2026-06-19", ocr_text: "morning" }),
        row({ id: "b", entry_date: "2026-06-19", ocr_text: "evening", page_index: 1 }),
      ],
      entitiesByPage: noEntities,
      exportedAt: "x",
    });
    // Only one date header for the two same-day pages.
    expect(md.match(/^## 2026-06-19$/gm)?.length).toBe(1);
    expect(md).toContain("morning");
    expect(md).toContain("evening");
  });

  it("renders separate ## headers for different days in order", () => {
    const md = buildDiaryMarkdown({
      rows: [
        row({ id: "a", entry_date: "2026-06-19" }),
        row({ id: "b", entry_date: "2026-06-22" }),
      ],
      entitiesByPage: noEntities,
      exportedAt: "x",
    });
    const first = md.indexOf("## 2026-06-19");
    const second = md.indexOf("## 2026-06-22");
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first); // chronological
  });

  it("puts undated pages in a dedicated section grouped by notebook", () => {
    const md = buildDiaryMarkdown({
      rows: [
        row({ id: "a", notebook_id: "nb1", entry_date: "2026-06-19" }),
        // Separate notebook with no dated page → genuinely undated.
        row({ id: "u1", notebook_id: "nbLoose", entry_date: "none", notebook_name: "Loose Pages", page_index: 4 }),
        row({ id: "u2", notebook_id: "nbLoose", entry_date: null, notebook_name: "Loose Pages", page_index: 5 }),
      ],
      entitiesByPage: noEntities,
      exportedAt: "x",
    });
    expect(md).toContain("## Undated entries");
    expect(md).toContain("### Loose Pages");
    expect(md).toContain("_page 5_"); // page_index 4 → shown 1-based
    expect(md).toContain("_page 6_");
    // The undated section comes after the dated one.
    expect(md.indexOf("## Undated entries")).toBeGreaterThan(
      md.indexOf("## 2026-06-19")
    );
  });

  it("renders themes, sentiment, and entities in the metadata line", () => {
    const entities = new Map<string, PageEntities>([
      ["a", { person: ["Jin"], place: ["Seoul"], project: ["Sermorizer"] }],
    ]);
    const md = buildDiaryMarkdown({
      rows: [
        row({
          id: "a",
          themes: '["sleep","work"]',
          sentiment: -0.2,
        }),
      ],
      entitiesByPage: entities,
      exportedAt: "x",
    });
    expect(md).toContain("notebook: Diary 2026");
    expect(md).toContain("themes: sleep, work");
    expect(md).toContain("sentiment: -0.20");
    expect(md).toContain("people: Jin");
    expect(md).toContain("places: Seoul");
    expect(md).toContain("projects: Sermorizer");
  });

  it("omits optional metadata fields when absent", () => {
    const md = buildDiaryMarkdown({
      rows: [row({ id: "a", themes: null, sentiment: null })],
      entitiesByPage: noEntities,
      exportedAt: "x",
    });
    expect(md).toContain("_notebook: Diary 2026_"); // just the notebook, nothing else
    expect(md).not.toContain("themes:");
    expect(md).not.toContain("sentiment:");
  });

  it("handles an empty diary gracefully", () => {
    const md = buildDiaryMarkdown({
      rows: [],
      entitiesByPage: noEntities,
      exportedAt: "x",
    });
    expect(md).toContain("pages: 0");
    expect(md).toContain("_No transcribed diary pages yet._");
    expect(md).not.toContain("range:");
  });
});
