import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  _client = new Anthropic({ apiKey });
  return _client;
}

export type PageOcr = { pageIndex: number; text: string; summary: string };

/**
 * OCR an entire notebook PDF in one Claude call. Claude can ingest PDFs
 * directly as `document` blocks and "see" each page, so no client-side
 * PDF→PNG splitting is needed.
 */
export async function ocrNotebookPdf(pdfBytes: Uint8Array): Promise<PageOcr[]> {
  const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

  const resp = await client().messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: [
      "You transcribe handwritten notebooks from a reMarkable tablet.",
      "The input is a PDF where each page is one notebook page (possibly mixed handwriting, sketches, printed text).",
      "Return ONLY a JSON object: { \"pages\": [ { \"pageIndex\": number, \"text\": string, \"summary\": string }, ... ] }.",
      "- `pageIndex` is 0-based and matches the PDF page order.",
      "- `text` is a faithful transcription preserving line breaks, bullets, checkboxes as [ ] or [x], and diagrams as bracketed descriptions like [diagram: ...].",
      "- `summary` is one short sentence describing what the page is about.",
      "Output the JSON only. No prose, no markdown fences.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
          },
          { type: "text", text: "Transcribe every page." },
        ],
      },
    ],
  });

  const block = resp.content.find((b) => b.type === "text");
  const raw = block && block.type === "text" ? block.text : "{}";
  try {
    const parsed = JSON.parse(stripFences(raw));
    if (Array.isArray(parsed.pages)) {
      return parsed.pages
        .filter((p: unknown): p is Record<string, unknown> => typeof p === "object" && p !== null)
        .map((p, i) => ({
          pageIndex: typeof p.pageIndex === "number" ? p.pageIndex : i,
          text: typeof p.text === "string" ? p.text : "",
          summary: typeof p.summary === "string" ? p.summary : "",
        }));
    }
  } catch {
    // fall through
  }
  return [];
}

export async function chatOverNotes(opts: {
  notesContext: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
}): Promise<string> {
  const resp = await client().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [
      "You are the user's personal notes assistant.",
      "You have access to the user's reMarkable notebooks below, transcribed from handwriting.",
      "Answer questions, summarize, draft follow-ups, or extract todos based on this material.",
      "When citing a note, reference it by notebook name and page number.",
      "If the notes don't contain enough information to answer, say so plainly.",
      "",
      "=== USER NOTES ===",
      opts.notesContext,
      "=== END NOTES ===",
    ].join("\n"),
    messages: [
      ...opts.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: opts.userMessage },
    ],
  });

  const block = resp.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}
