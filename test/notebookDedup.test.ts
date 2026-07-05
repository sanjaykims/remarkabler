import { describe, it, expect } from "vitest";
import {
  classifyDuplicate,
  buildCloudCoverage,
  buildCandidate,
} from "@/lib/notebookDedup";

// Pure-logic unit tests for duplicate-notebook classification. No DB — the
// DB-backed query/bucketing layer lives in lib/notebookDedupDb.ts and its
// own test/notebookDedupDb.test.ts.

describe("classifyDuplicate", () => {
  it("returns 'none' for an empty date list", () => {
    expect(classifyDuplicate([], new Set(["2026-06-19"]))).toBe("none");
  });

  it("returns 'none' for zero overlap", () => {
    expect(classifyDuplicate(["2026-06-19"], new Set(["2026-06-20"]))).toBe(
      "none"
    );
  });

  it("returns 'full' when every date is covered", () => {
    expect(
      classifyDuplicate(
        ["2026-06-19", "2026-06-20"],
        new Set(["2026-06-19", "2026-06-20", "2026-06-21"])
      )
    ).toBe("full");
  });

  it("returns 'partial' when some but not all dates are covered", () => {
    expect(
      classifyDuplicate(
        ["2026-06-19", "2026-06-20"],
        new Set(["2026-06-19"])
      )
    ).toBe("partial");
  });

  it("returns 'full' for a single exact-match date", () => {
    expect(classifyDuplicate(["2026-06-19"], new Set(["2026-06-19"]))).toBe(
      "full"
    );
  });
});

describe("buildCloudCoverage", () => {
  it("unions dates across multiple cloud notebooks", () => {
    const coverage = buildCloudCoverage([
      { id: "c1", name: "Diary", dates: ["2026-06-19"] },
      { id: "c2", name: "Diary 2", dates: ["2026-06-20"] },
    ]);
    expect([...coverage.coveredDates].sort()).toEqual([
      "2026-06-19",
      "2026-06-20",
    ]);
  });

  it("records both notebooks when they cover the same date", () => {
    const coverage = buildCloudCoverage([
      { id: "c1", name: "Diary", dates: ["2026-06-19"] },
      { id: "c2", name: "Diary 2", dates: ["2026-06-19"] },
    ]);
    expect(coverage.coveringByDate.get("2026-06-19")).toEqual([
      { id: "c1", name: "Diary" },
      { id: "c2", name: "Diary 2" },
    ]);
  });

  it("returns empty coverage for empty input", () => {
    const coverage = buildCloudCoverage([]);
    expect(coverage.coveredDates.size).toBe(0);
    expect(coverage.coveringByDate.size).toBe(0);
  });
});

describe("buildCandidate", () => {
  it("returns null when classification is 'none'", () => {
    const coverage = buildCloudCoverage([
      { id: "c1", name: "Diary", dates: ["2026-06-20"] },
    ]);
    const candidate = buildCandidate(
      { id: "o1", name: "Old", pageCount: 1, dates: ["2026-06-19"] },
      coverage
    );
    expect(candidate).toBeNull();
  });

  it("has empty uncoveredDates for a 'full' match", () => {
    const coverage = buildCloudCoverage([
      { id: "c1", name: "Diary", dates: ["2026-06-19", "2026-06-20"] },
    ]);
    const candidate = buildCandidate(
      { id: "o1", name: "Old", pageCount: 2, dates: ["2026-06-19", "2026-06-20"] },
      coverage
    );
    expect(candidate?.classification).toBe("full");
    expect(candidate?.uncoveredDates).toEqual([]);
  });

  it("lists exactly the non-overlapping dates for a 'partial' match", () => {
    const coverage = buildCloudCoverage([
      { id: "c1", name: "Diary", dates: ["2026-06-19"] },
    ]);
    const candidate = buildCandidate(
      {
        id: "o1",
        name: "Old",
        pageCount: 2,
        dates: ["2026-06-19", "2026-06-20"],
      },
      coverage
    );
    expect(candidate?.classification).toBe("partial");
    expect(candidate?.uncoveredDates).toEqual(["2026-06-20"]);
  });

  it("only includes covering notebooks that overlap this old notebook's dates", () => {
    const coverage = buildCloudCoverage([
      { id: "c1", name: "Covers 19", dates: ["2026-06-19"] },
      { id: "c2", name: "Covers 25 only", dates: ["2026-06-25"] },
    ]);
    const candidate = buildCandidate(
      { id: "o1", name: "Old", pageCount: 1, dates: ["2026-06-19"] },
      coverage
    );
    expect(candidate?.coveringNotebooks).toEqual([
      { id: "c1", name: "Covers 19" },
    ]);
  });

  it("dedupes a covering notebook that covers multiple of the old notebook's dates", () => {
    const coverage = buildCloudCoverage([
      { id: "c1", name: "Diary", dates: ["2026-06-19", "2026-06-20"] },
    ]);
    const candidate = buildCandidate(
      {
        id: "o1",
        name: "Old",
        pageCount: 2,
        dates: ["2026-06-19", "2026-06-20"],
      },
      coverage
    );
    expect(candidate?.coveringNotebooks).toEqual([{ id: "c1", name: "Diary" }]);
  });

  it("sorts dates and uncoveredDates on the returned candidate", () => {
    const coverage = buildCloudCoverage([
      { id: "c1", name: "Diary", dates: ["2026-06-19"] },
    ]);
    const candidate = buildCandidate(
      {
        id: "o1",
        name: "Old",
        pageCount: 3,
        dates: ["2026-06-21", "2026-06-19", "2026-06-20"],
      },
      coverage
    );
    expect(candidate?.dates).toEqual(["2026-06-19", "2026-06-20", "2026-06-21"]);
    expect(candidate?.uncoveredDates).toEqual(["2026-06-20", "2026-06-21"]);
  });
});
