import { describe, expect, it } from "vitest";
import { buildPageMap, pickPdfPage } from "../lib/pdfPageMap";

describe("pdf page map", () => {
  const map = buildPageMap([
    { pageId: "a", count: 1 },
    { pageId: "tall", count: 3 },
    { pageId: "c", count: 1 },
  ]);

  it("builds starts and a total", () => {
    expect(map).toEqual({ total: 5, pages: { a: { start: 0, count: 1 }, tall: { start: 1, count: 3 }, c: { start: 4, count: 1 } } });
  });

  it("uploaded notebooks use the flag's page index", () => {
    expect(pickPdfPage({ flagPageIndex: 2, rowPageIndex: 2, rows: 9 })).toEqual({ pageNo: 3, expect: 9 });
  });

  it("cloud pages go through the map; tall or unknown pages get nothing", () => {
    const base = { flagPageIndex: 0, rowPageIndex: 2, rows: 3, map };
    expect(pickPdfPage({ ...base, rmPageId: "c" })).toEqual({ pageNo: 5, expect: 5 });
    expect(pickPdfPage({ ...base, rmPageId: "tall" })).toBeNull();
    expect(pickPdfPage({ ...base, rmPageId: "gone" })).toBeNull();
  });

  it("without a map a cloud page falls back to its row position", () => {
    expect(pickPdfPage({ rmPageId: "c", flagPageIndex: 0, rowPageIndex: 2, rows: 3 })).toEqual({ pageNo: 3, expect: 3 });
  });
});
