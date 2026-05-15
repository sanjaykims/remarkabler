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
 * Transcribe an entire notebook PDF in one Claude call. Claude ingests the
 * PDF directly as a `document` block.
 *
 * The output uses a simple `--- PAGE n ---` delimiter format rather than
 * JSON: a delimited transcript can't be broken by an unescaped quote, and if
 * the response is ever cut short, every complete page before the cut is
 * still recoverable. `max_tokens` is set high so a dense notebook does not
 * overflow; if it overflows anyway, we throw instead of silently returning
 * nothing.
 */
export async function ocrNotebookPdf(pdfBytes: Uint8Array): Promise<PageOcr[]> {
  const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

  // Stream the response. The SDK rejects a non-streaming request whose
  // max_tokens is large enough that it could exceed the 10-minute timeout;
  // streaming also keeps the connection alive for a long transcription.
  const stream = client().messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system: [
      "You transcribe handwritten notebooks from a reMarkable tablet.",
      "The input is a PDF; each PDF page is one notebook page (handwriting,",
      "sketches, or printed text).",
      "",
      "Transcribe EVERY page, in order. Output format, with nothing else:",
      "",
      "  For each page, first a line containing exactly `--- PAGE n ---`",
      "  (n starts at 1 and increases by 1 each page), then the faithful",
      "  transcription of that page on the following lines.",
      "",
      "Preserve line breaks, bullet points, and checkboxes ([ ] or [x]).",
      "Describe diagrams in brackets, e.g. [diagram: timeline of project].",
      "If a page has no writing at all, output exactly `(blank)` for it.",
      "Do not add commentary, summaries, or markdown code fences.",
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
  const resp = await stream.finalMessage();

  if (resp.stop_reason === "max_tokens") {
    throw new Error(
      "This notebook is too long to transcribe in one pass. Split it into smaller notebooks on the reMarkable and upload them separately."
    );
  }

  const block = resp.content.find((b) => b.type === "text");
  const raw = block && block.type === "text" ? block.text : "";
  const pages = parsePages(raw);

  if (pages.length === 0) {
    throw new Error("Claude returned no transcribable content for this PDF.");
  }
  return pages;
}

function parsePages(raw: string): PageOcr[] {
  const marker = /^[ \t]*-{2,}\s*PAGE\s+\d+\s*-{2,}[ \t]*$/im;
  const parts = raw.split(marker);

  // parts[0] is whatever preceded the first marker (normally empty).
  if (parts.length <= 1) {
    // No page markers came back — keep the whole transcript as one page
    // rather than losing the content.
    const whole = raw.trim();
    return whole ? [{ pageIndex: 0, text: whole, summary: "" }] : [];
  }

  return parts.slice(1).map((chunk, i) => {
    const text = chunk.trim();
    return {
      pageIndex: i,
      text: text.toLowerCase() === "(blank)" ? "" : text,
      summary: "",
    };
  });
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
