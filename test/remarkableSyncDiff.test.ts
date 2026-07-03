import { describe, it, expect } from "vitest";
import { diffRmPages, orderPagesKeepStale } from "@/lib/remarkableSync";

// Pure logic behind the Phase 2 zero-tap sync: which pages to (re-)OCR when
// a notebook's cloud hash changes, and how to order pages afterwards. This
// is the cost-control core — a wrong diff either re-OCRs the whole notebook
// on every diary session (cost explosion) or misses changed pages (data
// loss), so it gets direct coverage.

describe("diffRmPages", () => {
  const existing = [
    { pageId: "a", hash: "h-a" },
    { pageId: "b", hash: "h-b" },
    { pageId: "c", hash: "h-c" },
  ];

  it("OCRs only new and changed pages", () => {
    const incoming = [
      { pageId: "a", hash: "h-a" }, // untouched
      { pageId: "b", hash: "h-b2" }, // edited
      { pageId: "c", hash: "h-c" }, // untouched
      { pageId: "d", hash: "h-d" }, // new page (today's diary session)
    ];
    const r = diffRmPages(existing, incoming);
    expect(r.toOcr).toEqual(["b", "d"]);
    expect(r.unchanged).toEqual(["a", "c"]);
    expect(r.removed).toEqual([]);
  });

  it("reports pages deleted on the tablet without OCRing anything", () => {
    const r = diffRmPages(existing, [
      { pageId: "a", hash: "h-a" },
      { pageId: "c", hash: "h-c" },
    ]);
    expect(r.toOcr).toEqual([]);
    expect(r.removed).toEqual(["b"]);
  });

  it("treats an empty existing set as all-new (first sync)", () => {
    const r = diffRmPages([], [
      { pageId: "x", hash: "h" },
      { pageId: "y", hash: "h2" },
    ]);
    expect(r.toOcr).toEqual(["x", "y"]);
  });

  it("a stored empty hash never matches, forcing re-OCR", () => {
    const r = diffRmPages([{ pageId: "a", hash: "" }], [
      { pageId: "a", hash: "h-a" },
    ]);
    expect(r.toOcr).toEqual(["a"]);
  });
});

describe("orderPagesKeepStale", () => {
  it("live cloud order first, tablet-deleted pages after (kept)", () => {
    expect(
      orderPagesKeepStale(["c", "a", "d"], ["a", "b", "c"])
    ).toEqual(["c", "a", "d", "b"]);
  });

  it("no stale pages → live order verbatim", () => {
    expect(orderPagesKeepStale(["a", "b"], ["a", "b"])).toEqual(["a", "b"]);
  });

  it("everything deleted → previous order preserved", () => {
    expect(orderPagesKeepStale([], ["a", "b"])).toEqual(["a", "b"]);
  });
});
