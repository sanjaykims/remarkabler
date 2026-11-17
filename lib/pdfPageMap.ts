// Which page of a notebook's stored PDF shows a given page row?
//
// Uploaded / Dropbox notebooks: PDF page n is page row n-1, valid only while the PDF has
// exactly one page per row. reMarkable-cloud notebooks: one row per TABLET page, but a tall
// (scrolled) tablet page is rendered as several PDF pages, so the sync writes a page map
// (pagemap.json next to notebook.pdf) saying where each tablet page starts and how many PDF
// pages it takes. Pure and unit-tested; the file reading lives in lib/handwritingExamples.ts.

export type PageMap = { total: number; pages: Record<string, { start: number; count: number }> };

export function buildPageMap(counts: Array<{ pageId: string; count: number }>): PageMap {
  const pages: PageMap["pages"] = {};
  let at = 0;
  for (const c of counts) {
    pages[c.pageId] = { start: at, count: c.count };
    at += c.count;
  }
  return { total: at, pages };
}

/** -> 1-based PDF page and the page count the PDF must have, or null when it can't be told. */
export function pickPdfPage(a: {
  /** tablet page id for reMarkable-cloud rows, null/undefined otherwise */
  rmPageId?: string | null;
  /** 0-based index the flag was stored with (meaningless for reMarkable-cloud rows) */
  flagPageIndex: number;
  /** the row's current 0-based position in the notebook */
  rowPageIndex: number;
  /** number of page rows in the notebook */
  rows: number;
  map?: PageMap | null;
}): { pageNo: number; expect: number } | null {
  if (!a.rmPageId) return { pageNo: a.flagPageIndex + 1, expect: a.rows };
  if (a.map) {
    const e = a.map.pages[a.rmPageId];
    // A tall page spread over several PDF pages can't be matched to one transcript.
    if (!e || e.count !== 1) return null;
    return { pageNo: e.start + 1, expect: a.map.total };
  }
  // No map yet (written on the next sync): safe only when every row is exactly one PDF page.
  return { pageNo: a.rowPageIndex + 1, expect: a.rows };
}
