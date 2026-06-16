import { describe, it, expect } from "vitest";
import { looksLikePdf } from "@/lib/dropbox";

// Post-download sanity check: even if Dropbox's metadata said the file is
// small enough, verify the bytes are actually a PDF before handing them to
// the OCR pipeline. The metadata-driven size guard is the main gate; this
// catches files that arrived corrupted or were misclassified by extension.

describe("looksLikePdf", () => {
  it("accepts real PDF magic bytes %PDF", () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    expect(looksLikePdf(bytes)).toBe(true);
  });

  it("rejects a too-short file", () => {
    expect(looksLikePdf(new Uint8Array([0x25, 0x50]))).toBe(false);
    expect(looksLikePdf(new Uint8Array([]))).toBe(false);
  });

  it("rejects a JPEG that was wrongly given a .pdf extension", () => {
    // JPEG starts with FF D8 FF
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(looksLikePdf(bytes)).toBe(false);
  });

  it("rejects an HTML error page returned in place of a PDF", () => {
    // <!DOC...
    const bytes = new Uint8Array([0x3c, 0x21, 0x44, 0x4f]);
    expect(looksLikePdf(bytes)).toBe(false);
  });

  it("rejects garbage that happens to be 4 bytes", () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    expect(looksLikePdf(bytes)).toBe(false);
  });
});
