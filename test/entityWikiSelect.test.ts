import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Pure test for selectWikiExcerpts — turns an entity's full chronological
// mention history into the excerpts sent to Claude: per-page trim, and an
// even chronological sample (keeping first + last) when over the char budget.
// DATA_DIR is set only because importing the module pulls in lib/db.

type WikiMod = typeof import("@/lib/entityWiki");
let wiki: WikiMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "wiki-select-"));
  wiki = await import("@/lib/entityWiki");
});

function rows(n: number, chars: number) {
  return Array.from({ length: n }, (_, i) => ({
    date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    text: `entry ${i} `.padEnd(chars, "x"),
  }));
}

describe("selectWikiExcerpts", () => {
  it("returns everything (per-page trimmed) when under budget", () => {
    const out = wiki.selectWikiExcerpts(rows(5, 100), 10000, 50);
    expect(out).toHaveLength(5);
    expect(out.every((e) => e.text.length <= 50)).toBe(true);
  });

  it("trims each page to perPageChars", () => {
    const out = wiki.selectWikiExcerpts(
      [{ date: "2026-01-01", text: "x".repeat(5000) }],
      10000,
      1500
    );
    expect(out[0].text.length).toBe(1500);
  });

  it("samples down to fit the budget when over it", () => {
    // 100 pages × 1000 chars = 100k; budget 10k → ~10 pages kept.
    const out = wiki.selectWikiExcerpts(rows(100, 1000), 10000, 1000);
    expect(out.length).toBeLessThan(100);
    const total = out.reduce((n, e) => n + e.text.length, 0);
    // Roughly within budget (allow the last kept page to nudge slightly over).
    expect(total).toBeLessThanOrEqual(12000);
  });

  it("always keeps the first and last entry (the arc's endpoints)", () => {
    const input = rows(50, 2000); // way over a tiny budget
    const out = wiki.selectWikiExcerpts(input, 6000, 2000);
    expect(out[0].text.startsWith("entry 0 ")).toBe(true);
    expect(out[out.length - 1].text.startsWith("entry 49 ")).toBe(true);
  });

  it("keeps chronological order in the sample", () => {
    const out = wiki.selectWikiExcerpts(rows(60, 2000), 8000, 2000);
    const nums = out.map((e) => parseInt(e.text.split(" ")[1], 10));
    const sorted = [...nums].sort((a, b) => a - b);
    expect(nums).toEqual(sorted);
  });

  it("never samples below two entries", () => {
    const out = wiki.selectWikiExcerpts(rows(2, 100000), 10, 100000);
    expect(out).toHaveLength(2);
  });

  it("enforces the ACTUAL budget even with uneven mention lengths (PR #116)", () => {
    // Many tiny one-liners plus a few long pages, arranged so an even sample
    // could land on the long ones and overflow an average-based keep count.
    const mixed = Array.from({ length: 60 }, (_, i) => ({
      date: `2026-02-${String((i % 28) + 1).padStart(2, "0")}`,
      text: i % 5 === 0 ? "L".repeat(1500) : "short",
    }));
    const budget = 5000;
    const out = wiki.selectWikiExcerpts(mixed, budget, 1500);
    const total = out.reduce((n, e) => n + e.text.length, 0);
    expect(total).toBeLessThanOrEqual(budget); // hard guarantee
  });

  it("hard-trims when even the two endpoints overflow the budget", () => {
    const out = wiki.selectWikiExcerpts(
      [
        { date: "2026-01-01", text: "A".repeat(5000) },
        { date: "2026-12-31", text: "B".repeat(5000) },
      ],
      2000,
      5000
    );
    const total = out.reduce((n, e) => n + e.text.length, 0);
    expect(total).toBeLessThanOrEqual(2000);
    expect(out).toHaveLength(2); // both endpoints kept, just trimmed
  });
});
