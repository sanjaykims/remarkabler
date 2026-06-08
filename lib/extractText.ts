// Convert attached files (PDF, Word) to plain text BEFORE sending to Claude.
// The point is token cost: a PDF sent as a `document` content block burns
// ~1.5-2K tokens per page on vision processing. The same PDF's text layer
// extracted here and sent as a plain user message costs ~250-500 tokens per
// page — a 3-5x reduction on every text-based attachment chat costs.
//
// CRITICAL: Many of the user's PDFs are reMarkable handwritten ink with NO
// text layer. For those, pdf-parse returns essentially empty text. The
// extractor signals that with `fallbackToRaw: true` so the caller can send
// the original document block instead — we never want to silently substitute
// nothing for a real attachment.
//
// We deliberately use Node.js libraries (pdf-parse, mammoth) instead of
// Microsoft's MarkItDown (Python). Same end result for the formats we
// actually receive in chat, without adding Python to the Railway container.

// pdf-parse ships as a thin CommonJS wrapper. The dynamic require keeps the
// dependency lazy so a missing install never breaks the route at module load.
type PdfParse = (data: Buffer) => Promise<{ text: string; numpages?: number }>;
type Mammoth = {
  convertToMarkdown: (input: { buffer: Buffer }) => Promise<{ value: string }>;
};

let _pdfParse: PdfParse | null = null;
function pdfParse(): PdfParse {
  if (!_pdfParse) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _pdfParse = require("pdf-parse") as PdfParse;
  }
  return _pdfParse;
}
let _mammoth: Mammoth | null = null;
function mammoth(): Mammoth {
  if (!_mammoth) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _mammoth = require("mammoth") as Mammoth;
  }
  return _mammoth;
}

export type ExtractResult =
  | { kind: "text"; text: string; numPages?: number }
  | { kind: "fallback"; reason: string };

// Threshold: if extracted text is below this, treat it as "no real text layer"
// and fall back to the raw document block. reMarkable handwritten PDFs come
// back with a few stray characters at most, well under this floor.
const MIN_TEXT_CHARS = 50;

function shouldFallback(text: string): boolean {
  return text.replace(/\s+/g, "").length < MIN_TEXT_CHARS;
}

export async function extractTextFromAttachment(opts: {
  mediaType: string;
  bytes: Buffer;
  filename?: string;
}): Promise<ExtractResult> {
  const mt = (opts.mediaType || "").toLowerCase();

  // Plain markdown / text — already optimal. Just return decoded UTF-8.
  if (
    mt.startsWith("text/") ||
    mt === "application/markdown" ||
    /\.(md|markdown|txt)$/i.test(opts.filename || "")
  ) {
    const text = opts.bytes.toString("utf8");
    if (shouldFallback(text)) {
      return { kind: "fallback", reason: "text body was empty" };
    }
    return { kind: "text", text };
  }

  if (mt === "application/pdf" || /\.pdf$/i.test(opts.filename || "")) {
    try {
      const out = await pdfParse()(opts.bytes);
      const text = (out.text || "").trim();
      if (shouldFallback(text)) {
        return {
          kind: "fallback",
          reason:
            "PDF has no extractable text layer (likely handwritten or scanned)",
        };
      }
      return { kind: "text", text, numPages: out.numpages };
    } catch (e) {
      return { kind: "fallback", reason: `pdf-parse failed: ${(e as Error).message}` };
    }
  }

  if (
    mt === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(opts.filename || "")
  ) {
    try {
      const out = await mammoth().convertToMarkdown({ buffer: opts.bytes });
      const text = (out.value || "").trim();
      if (shouldFallback(text)) {
        return { kind: "fallback", reason: "Word doc had no usable text" };
      }
      return { kind: "text", text };
    } catch (e) {
      return { kind: "fallback", reason: `mammoth failed: ${(e as Error).message}` };
    }
  }

  // Anything else (images, .doc, .pptx, .xlsx): let the caller decide. Images
  // SHOULD go through as a vision block. Legacy .doc / Office formats we
  // don't support yet — caller falls back to raw, Claude reads them as
  // document blocks at full cost.
  return { kind: "fallback", reason: `no extractor for ${mt || "unknown type"}` };
}
