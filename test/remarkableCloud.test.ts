import { describe, it, expect } from "vitest";
import {
  filterNotebooks,
  orderedPageIdsFromContent,
} from "@/lib/remarkableCloud";

// Pure-logic test for the notebook filter that turns rmapi-js `listItems()`
// output into our display shape. No network — the rest of remarkableCloud is
// thin wrappers around rmapi-js calls.

describe("filterNotebooks", () => {
  const entries = [
    {
      id: "nb1",
      hash: "h1",
      visibleName: "Diary 2026",
      lastModified: "1700000000",
      type: "DocumentType",
      fileType: "notebook",
      parent: "",
    },
    {
      id: "pdf1",
      hash: "h2",
      visibleName: "Some Book.pdf",
      type: "DocumentType",
      fileType: "pdf",
      parent: "",
    },
    {
      id: "folder1",
      hash: "h3",
      visibleName: "My Folder",
      type: "CollectionType",
      parent: "",
    },
    {
      id: "nb-trash",
      hash: "h4",
      visibleName: "Deleted notebook",
      type: "DocumentType",
      fileType: "notebook",
      parent: "trash",
    },
    {
      id: "nb2",
      hash: "h5",
      visibleName: "Work notes",
      lastModified: "1700000500",
      type: "DocumentType",
      fileType: "notebook",
      parent: "folder1",
    },
  ];

  it("keeps only handwritten notebooks (not PDFs, folders, or trash)", () => {
    const nbs = filterNotebooks(entries);
    expect(nbs.map((n) => n.id).sort()).toEqual(["nb1", "nb2"]);
  });

  it("maps to the display shape with name/hash/lastModified/parent/folder", () => {
    const nb = filterNotebooks(entries).find((n) => n.id === "nb1")!;
    expect(nb).toEqual({
      id: "nb1",
      name: "Diary 2026",
      hash: "h1",
      // 10-digit epoch seconds → normalized to ISO for display.
      lastModified: new Date(1700000000 * 1000).toISOString(),
      parent: "",
      folder: "",
    });
  });

  it("resolves the containing folder's display name from CollectionType entries", () => {
    const nb = filterNotebooks(entries).find((n) => n.id === "nb2")!;
    expect(nb.folder).toBe("My Folder");
  });

  it("sorts newest-first by lastModified", () => {
    const nbs = filterNotebooks(entries);
    expect(nbs.map((n) => n.id)).toEqual(["nb2", "nb1"]); // nb2 edited later
  });

  it("normalizes epoch-milliseconds timestamps too", () => {
    const nbs = filterNotebooks([
      {
        id: "x",
        hash: "h",
        type: "DocumentType",
        fileType: "notebook",
        lastModified: "1780801738496", // 13-digit ms
      },
    ]);
    expect(nbs[0].lastModified).toBe(new Date(1780801738496).toISOString());
  });

  it("falls back to (untitled) when visibleName is missing", () => {
    const nbs = filterNotebooks([
      { id: "x", hash: "h", type: "DocumentType", fileType: "notebook" },
    ]);
    expect(nbs[0].name).toBe("(untitled)");
  });

  it("returns [] for an empty list", () => {
    expect(filterNotebooks([])).toEqual([]);
  });
});

// Page-order extraction from a notebook's `.content`, used to render the raw
// `.rm` pages in reading order. Drives the Phase 1b cloud import.
describe("orderedPageIdsFromContent", () => {
  it("reads modern cPages.pages[] in order", () => {
    const content = {
      cPages: {
        pages: [
          { id: "p-a", idx: { value: "ba" } },
          { id: "p-b", idx: { value: "bb" } },
          { id: "p-c", idx: { value: "bc" } },
        ],
      },
    };
    expect(orderedPageIdsFromContent(content)).toEqual(["p-a", "p-b", "p-c"]);
  });

  it("skips pages marked deleted", () => {
    const content = {
      cPages: {
        pages: [
          { id: "p-a" },
          { id: "p-gone", deleted: { timestamp: "1:2", value: 1 } },
          { id: "p-c" },
        ],
      },
    };
    expect(orderedPageIdsFromContent(content)).toEqual(["p-a", "p-c"]);
  });

  it("falls back to legacy pages: string[]", () => {
    const content = { pages: ["p-1", "p-2", "p-3"] };
    expect(orderedPageIdsFromContent(content)).toEqual(["p-1", "p-2", "p-3"]);
  });

  it("prefers cPages over legacy pages when both exist", () => {
    const content = {
      pages: ["legacy-1"],
      cPages: { pages: [{ id: "modern-1" }, { id: "modern-2" }] },
    };
    expect(orderedPageIdsFromContent(content)).toEqual(["modern-1", "modern-2"]);
  });

  it("ignores entries without a string id", () => {
    const content = {
      cPages: { pages: [{ id: "ok" }, { idx: { value: "z" } }, { id: 42 }] },
    };
    expect(orderedPageIdsFromContent(content)).toEqual(["ok"]);
  });

  it("returns [] for empty / missing / garbage content", () => {
    expect(orderedPageIdsFromContent({})).toEqual([]);
    expect(orderedPageIdsFromContent(null)).toEqual([]);
    expect(orderedPageIdsFromContent(undefined)).toEqual([]);
    expect(orderedPageIdsFromContent({ cPages: { pages: [] } })).toEqual([]);
    expect(orderedPageIdsFromContent({ pages: "nope" })).toEqual([]);
  });
});
