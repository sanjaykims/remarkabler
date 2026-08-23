import { describe, it, expect } from "vitest";
import {
  buildDiaryMarkdown,
  buildDayFiles,
  buildEntityStubFiles,
  carryForwardDates,
  effectiveDateKeys,
  entityStubFileName,
  isDatedEntry,
  parseThemes,
  yamlQuoted,
  UNDATED_FILE,
  type DiaryPageRow,
  type EntityStub,
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
    expect(md).toContain("people: [[Jin]]");
    expect(md).toContain("places: [[Seoul]]");
    expect(md).toContain("projects: [[Sermorizer]]");
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

describe("effectiveDateKeys", () => {
  it("collects carried-forward dates and flags undated tails", () => {
    const r = effectiveDateKeys([
      { notebook_id: "nb1", entry_date: "2026-06-19" },
      { notebook_id: "nb1", entry_date: "none" }, // carries 06-19
      { notebook_id: "nb1", entry_date: "2026-06-20" },
    ]);
    expect(r.dates.sort()).toEqual(["2026-06-19", "2026-06-20"]);
    expect(r.hasUndated).toBe(false);
  });

  it("flags hasUndated when a notebook starts before any date", () => {
    const r = effectiveDateKeys([
      { notebook_id: "nb1", entry_date: "none" },
      { notebook_id: "nb1", entry_date: "2026-06-19" },
    ]);
    expect(r.dates).toEqual(["2026-06-19"]);
    expect(r.hasUndated).toBe(true);
  });

  it("resets carry across notebooks", () => {
    const r = effectiveDateKeys([
      { notebook_id: "nb1", entry_date: "2026-06-19" },
      { notebook_id: "nb2", entry_date: "none" }, // must NOT inherit nb1
    ]);
    expect(r.dates).toEqual(["2026-06-19"]);
    expect(r.hasUndated).toBe(true);
  });
});

describe("buildDayFiles", () => {
  const noEnt = new Map<string, PageEntities>();

  it("produces one file per day, keyed by filename", () => {
    const files = buildDayFiles({
      rows: [
        row({ id: "a", notebook_id: "nb1", entry_date: "2026-06-19" }),
        row({ id: "b", notebook_id: "nb1", entry_date: "2026-06-20", page_index: 1 }),
      ],
      entitiesByPage: noEnt,
      exportedAt: "x",
    });
    expect([...files.keys()].sort()).toEqual(["2026-06-19.md", "2026-06-20.md"]);
    expect(files.get("2026-06-19.md")).toContain("# 2026-06-19");
    expect(files.get("2026-06-19.md")).toContain("date: 2026-06-19");
  });

  it("keeps carried-forward continuation pages in the same day file", () => {
    const files = buildDayFiles({
      rows: [
        row({ id: "a", notebook_id: "nb1", entry_date: "2026-06-19", ocr_text: "one" }),
        row({ id: "b", notebook_id: "nb1", entry_date: "none", page_index: 1, ocr_text: "two" }),
      ],
      entitiesByPage: noEnt,
      exportedAt: "x",
    });
    expect([...files.keys()]).toEqual(["2026-06-19.md"]);
    const day = files.get("2026-06-19.md") as string;
    expect(day).toContain("one");
    expect(day).toContain("two");
    expect(files.has(UNDATED_FILE)).toBe(false);
  });

  it("writes undated.md only when there are undated pages", () => {
    const files = buildDayFiles({
      rows: [
        row({ id: "a", notebook_id: "nbLoose", entry_date: "none", notebook_name: "Loose", ocr_text: "floating" }),
      ],
      entitiesByPage: noEnt,
      exportedAt: "x",
    });
    expect(files.has(UNDATED_FILE)).toBe(true);
    expect(files.get(UNDATED_FILE)).toContain("floating");
  });

  it("renders entities as wikilinks in a day file's metadata line", () => {
    const ent = new Map<string, PageEntities>([
      ["a", { person: ["Jin"], place: [], project: [] }],
    ]);
    const files = buildDayFiles({
      rows: [row({ id: "a", notebook_id: "nb1", entry_date: "2026-06-19" })],
      entitiesByPage: ent,
      exportedAt: "x",
    });
    expect(files.get("2026-06-19.md")).toContain("people: [[Jin]]");
  });
});

describe("frontmatter entity arrays", () => {
  it("adds a YAML wikilink array to a day file's frontmatter", () => {
    const ent = new Map<string, PageEntities>([
      ["a", { person: ["Jin"], place: ["Seoul"], project: [] }],
    ]);
    const files = buildDayFiles({
      rows: [row({ id: "a", notebook_id: "nb1", entry_date: "2026-06-19" })],
      entitiesByPage: ent,
      exportedAt: "x",
    });
    const day = files.get("2026-06-19.md") as string;
    expect(day).toContain('people:\n  - "[[Jin]]"');
    expect(day).toContain('places:\n  - "[[Seoul]]"');
    expect(day).not.toContain("projects:");
  });

  it("dedupes an entity mentioned on multiple pages of the same day", () => {
    const ent = new Map<string, PageEntities>([
      ["a", { person: ["Jin"], place: [], project: [] }],
      ["b", { person: ["Jin"], place: [], project: [] }],
    ]);
    const files = buildDayFiles({
      rows: [
        row({ id: "a", notebook_id: "nb1", entry_date: "2026-06-19", page_index: 0 }),
        row({ id: "b", notebook_id: "nb1", entry_date: "none", page_index: 1 }),
      ],
      entitiesByPage: ent,
      exportedAt: "x",
    });
    const day = files.get("2026-06-19.md") as string;
    expect(day.match(/\[\[Jin\]\]/g)?.length).toBe(3); // frontmatter once + one per page line
  });

  it("omits all entity keys from frontmatter when a day has no entities", () => {
    const files = buildDayFiles({
      rows: [row({ id: "a", notebook_id: "nb1", entry_date: "2026-06-19" })],
      entitiesByPage: new Map<string, PageEntities>(),
      exportedAt: "x",
    });
    const day = files.get("2026-06-19.md") as string;
    expect(day).not.toContain("people:");
    expect(day).not.toContain("places:");
    expect(day).not.toContain("projects:");
  });

  it("aggregates entities across multiple days in the combined document", () => {
    const ent = new Map<string, PageEntities>([
      ["a", { person: ["Jin"], place: [], project: [] }],
      ["b", { person: ["Kim"], place: [], project: [] }],
    ]);
    const md = buildDiaryMarkdown({
      rows: [
        row({ id: "a", entry_date: "2026-06-19" }),
        row({ id: "b", entry_date: "2026-06-20", page_index: 1 }),
      ],
      entitiesByPage: ent,
      exportedAt: "x",
    });
    const frontmatter = md.slice(0, md.indexOf("\n---\n", 4));
    expect(frontmatter).toContain('"[[Jin]]"');
    expect(frontmatter).toContain('"[[Kim]]"');
  });
});

describe("yamlQuoted", () => {
  it("quotes a plain string", () => {
    expect(yamlQuoted("Jin")).toBe('"Jin"');
  });

  it("preserves a colon inside quotes", () => {
    expect(yamlQuoted("Dr. Kim: MD")).toBe('"Dr. Kim: MD"');
  });

  it("escapes an embedded double quote", () => {
    expect(yamlQuoted('Say "hi"')).toBe('"Say \\"hi\\""');
  });

  it("escapes a backslash", () => {
    expect(yamlQuoted("back\\slash")).toBe('"back\\\\slash"');
  });

  it("flattens a newline to a space", () => {
    expect(yamlQuoted("line1\nline2")).toBe('"line1 line2"');
  });
});

describe("entityStubFileName", () => {
  it("files each kind under its folder", () => {
    expect(entityStubFileName("person", "Jin")).toBe("People/Jin.md");
    expect(entityStubFileName("place", "Seoul")).toBe("Places/Seoul.md");
    expect(entityStubFileName("project", "Thesis")).toBe("Projects/Thesis.md");
  });

  it("replaces path-illegal characters so the file can be written", () => {
    expect(entityStubFileName("person", "Dr/Kim: MD")).toBe(
      "People/Dr Kim MD.md"
    );
  });

  it("uses the established stub sanitizer for wikilink syntax characters", () => {
    expect(entityStubFileName("person", "Dr [Kim]|MD")).toBe(
      "People/Dr KimMD.md"
    );
  });

  it("falls back to 'unnamed' when a name reduces to empty", () => {
    expect(entityStubFileName("person", "///")).toBe("People/unnamed.md");
  });
});

describe("buildEntityStubFiles", () => {
  const stub = (over: Partial<EntityStub>): EntityStub => ({
    kind: "person",
    name: "Jin",
    dates: ["2026-06-19"],
    undated: false,
    ...over,
  });

  it("writes one file per entity with day wikilinks back to the day notes", () => {
    const files = buildEntityStubFiles({
      stubs: [stub({ dates: ["2026-06-19", "2026-06-20"] })],
      exportedAt: "x",
    });
    const jin = files.get("People/Jin.md") as string;
    expect(jin).toContain("type: person");
    expect(jin).toContain("# Jin");
    expect(jin).toContain("- [[2026-06-19]]");
    expect(jin).toContain("- [[2026-06-20]]");
    expect(jin).toContain("appears on 2 days");
  });

  it("adds an [[undated]] link and counts it toward mentions", () => {
    const files = buildEntityStubFiles({
      stubs: [stub({ dates: ["2026-06-19"], undated: true })],
      exportedAt: "x",
    });
    const jin = files.get("People/Jin.md") as string;
    expect(jin).toContain("- [[undated]]");
    expect(jin).toContain("mentions: 2");
  });

  it("quotes the title so a name with a colon can't corrupt YAML", () => {
    const files = buildEntityStubFiles({
      stubs: [stub({ name: "Dr. Kim: MD", dates: ["2026-06-19"] })],
      exportedAt: "x",
    });
    const f = files.get("People/Dr. Kim MD.md") as string;
    expect(f).toContain('title: "Dr. Kim: MD"');
  });

  it("returns an empty map for no stubs", () => {
    expect(buildEntityStubFiles({ stubs: [], exportedAt: "x" }).size).toBe(0);
  });

  it("embeds a wiki profile above the Mentions list when present", () => {
    const files = buildEntityStubFiles({
      stubs: [stub({ summary: "Jin is the author's close friend from Wuhan." })],
      exportedAt: "x",
    });
    const jin = files.get("People/Jin.md") as string;
    expect(jin).toContain("Jin is the author's close friend from Wuhan.");
    expect(jin).toContain("## Mentions");
    // The profile appears before the day backlinks.
    expect(jin.indexOf("close friend")).toBeLessThan(jin.indexOf("## Mentions"));
  });

  it("omits the profile paragraph but keeps Mentions when there's no summary", () => {
    const files = buildEntityStubFiles({
      stubs: [stub({ summary: null })],
      exportedAt: "x",
    });
    const jin = files.get("People/Jin.md") as string;
    expect(jin).toContain("## Mentions");
    expect(jin).toContain("- [[2026-06-19]]");
  });

  it("renders a 'Recent conversations' section when conversationNotes is present", () => {
    const files = buildEntityStubFiles({
      stubs: [stub({ conversationNotes: "Talked about Jin's new job." })],
      exportedAt: "x",
    });
    const jin = files.get("People/Jin.md") as string;
    expect(jin).toContain("## Recent conversations");
    expect(jin).toContain("Talked about Jin's new job.");
    // Comes after the diary bio (absent here) and before Mentions.
    expect(jin.indexOf("## Recent conversations")).toBeLessThan(jin.indexOf("## Mentions"));
  });

  it("renders identically to before when conversationNotes is absent/empty (additive only)", () => {
    const withUndefined = buildEntityStubFiles({ stubs: [stub({})], exportedAt: "x" }).get(
      "People/Jin.md"
    );
    const withEmpty = buildEntityStubFiles({
      stubs: [stub({ conversationNotes: "" })],
      exportedAt: "x",
    }).get("People/Jin.md");
    expect(withUndefined).not.toContain("## Recent conversations");
    expect(withEmpty).not.toContain("## Recent conversations");
    expect(withEmpty).toBe(withUndefined);
  });

  it("renders outgoing and incoming relationships with readable labels and wikilinks", () => {
    const files = buildEntityStubFiles({
      stubs: [
        stub({
          relationships: [
            { predicate: "works_at", otherName: "Samsung", direction: "out" },
            { predicate: "lives_in", otherName: "Suwon", direction: "in" },
          ],
        }),
      ],
      exportedAt: "x",
    });
    const jin = files.get("People/Jin.md") as string;
    expect(jin).toContain("## Relationships");
    expect(jin).toContain("- works at [[Samsung]]");
    expect(jin).toContain("- [[Suwon]] — lives in");
    expect(jin.indexOf("## Relationships")).toBeLessThan(jin.indexOf("## Mentions"));
  });

  it("omits Relationships when empty (additive only)", () => {
    const withUndefined = buildEntityStubFiles({ stubs: [stub({})], exportedAt: "x" }).get(
      "People/Jin.md"
    );
    const withEmpty = buildEntityStubFiles({
      stubs: [stub({ relationships: [] })],
      exportedAt: "x",
    }).get("People/Jin.md");
    expect(withUndefined).not.toContain("## Relationships");
    expect(withEmpty).toBe(withUndefined);
  });

  it("a conversation-only entity (zero days) skips Mentions and says so", () => {
    const files = buildEntityStubFiles({
      stubs: [
        stub({
          dates: [],
          undated: false,
          conversationNotes: "Only ever discussed in chat so far.",
        }),
      ],
      exportedAt: "x",
    });
    const jin = files.get("People/Jin.md") as string;
    expect(jin).toContain("mentioned only in conversations so far");
    expect(jin).not.toContain("## Mentions");
    expect(jin).toContain("## Recent conversations");
  });
});
