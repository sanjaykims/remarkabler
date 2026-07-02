import { describe, it, expect } from "vitest";
import { filterNotebooks } from "@/lib/remarkableCloud";

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

  it("maps to the display shape with name/hash/lastModified/parent", () => {
    const nb = filterNotebooks(entries).find((n) => n.id === "nb1")!;
    expect(nb).toEqual({
      id: "nb1",
      name: "Diary 2026",
      hash: "h1",
      lastModified: "1700000000",
      parent: "",
    });
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
