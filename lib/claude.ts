import Anthropic from "@anthropic-ai/sdk";
import { recordUsage } from "@/lib/usage";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
// Chat is the high-volume, cost-sensitive path — default it to Sonnet (cheaper
// than Opus). OCR and insights stay on the configured CLAUDE_MODEL.
const CHAT_MODEL = process.env.CHAT_MODEL || "claude-sonnet-4-6";
// If the chat model is overloaded, fall back to this one for that message so
// chat never gets stuck on a busy model (e.g. Haiku → Sonnet).
const CHAT_FALLBACK_MODEL = process.env.CHAT_FALLBACK_MODEL || "claude-sonnet-4-6";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  // Retry transient overloads (429 / 5xx / 529) with exponential backoff
  // instead of failing the user's request on the first hiccup.
  _client = new Anthropic({ apiKey, maxRetries: 4 });
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
  recordUsage("ocr", MODEL, resp.usage);

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

// Shared guidance for building/maintaining the evolving profile of the person.
const PROFILE_FORMAT = [
  "Write it as a concise living document of about 400–700 words, in the third",
  "person ('They…'), with short section headers covering: who they are and what",
  "they value; recurring patterns in how they think, feel, and react;",
  "their emotional landscape; important relationships; goals and worries;",
  "their current state right now; and open threads worth following up.",
  "Be specific and grounded in what they actually wrote — not generic.",
  "No preamble, no sign-off, no markdown code fences.",
].join("\n");

/** Build the first profile of the person from their full notes corpus. */
export async function buildSelfModel(opts: {
  notesContext: string;
}): Promise<string> {
  const resp = await client().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
      "You are building a private, evolving profile of a person from their",
      "personal diary, so that an assistant can understand them deeply without",
      "re-reading everything each time.",
      PROFILE_FORMAT,
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          "Here is my diary so far. Build your understanding of me.",
          "",
          "=== MY DIARY ===",
          opts.notesContext,
          "=== END DIARY ===",
        ].join("\n"),
      },
    ],
  });
  recordUsage("memory", MODEL, resp.usage);
  const block = resp.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

/** Revise the existing profile to incorporate one new diary entry. */
export async function updateSelfModel(opts: {
  currentProfile: string;
  newContent: string;
}): Promise<string> {
  const resp = await client().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
      "You maintain a private, evolving profile of a person, built from their",
      "diary over time. You will be given your current profile and one new",
      "diary entry. Return the FULL updated profile: integrate what is new,",
      "note what has changed, progressed, or recurred, gently revise impressions",
      "that no longer fit, and consolidate so it stays sharp — do not simply",
      "append. Keep it about the same length.",
      PROFILE_FORMAT,
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          "=== YOUR CURRENT UNDERSTANDING OF ME ===",
          opts.currentProfile,
          "=== END ===",
          "",
          "=== MY NEW DIARY ENTRY ===",
          opts.newContent,
          "=== END ===",
          "",
          "Return the full, revised understanding of me.",
        ].join("\n"),
      },
    ],
  });
  recordUsage("memory", MODEL, resp.usage);
  const block = resp.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

export async function chatOverNotes(opts: {
  profile: string;
  relevantNotes: string;
  recentLocations?: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
  attachment?: { kind: "image" | "document"; mediaType: string; dataBase64: string };
}): Promise<string> {
  const messages: Anthropic.MessageParam[] = opts.history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Relevant diary excerpts (and any attachment) ride with the user's turn so
  // the cached system block (instructions + profile) stays identical across a
  // session — follow-up questions re-read it at cache rates.
  const excerpts = opts.relevantNotes.trim()
    ? `Relevant diary excerpts for this question:\n${opts.relevantNotes}\n\n`
    : "";
  const userText =
    excerpts + (opts.userMessage || "Please look at this attachment.");

  if (opts.attachment) {
    const a = opts.attachment;
    const fileBlock = (
      a.kind === "image"
        ? {
            type: "image",
            source: { type: "base64", media_type: a.mediaType, data: a.dataBase64 },
          }
        : {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: a.dataBase64,
            },
          }
    ) as Anthropic.ContentBlockParam;
    messages.push({
      role: "user",
      content: [fileBlock, { type: "text", text: userText }],
    });
  } else {
    messages.push({ role: "user", content: userText });
  }

  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: [
        "You are this person's personal companion — you know them through",
        "their diary. Below is your accumulated understanding of who they are,",
        "built up over time; treat it as your memory of them.",
        "When they ask you something, think it through in light of everything",
        "you understand about them, and answer with your honest, thoughtful",
        "opinion — not a bare summary of their notes.",
        "You may also be given specific diary excerpts relevant to the",
        "question — use them for concrete detail and quotes.",
        "Be warm, direct, and specific. If you genuinely don't know, say so.",
        "",
        "=== YOUR UNDERSTANDING OF THEM ===",
        opts.profile.trim() ||
          "(No profile yet — rely on the excerpts provided and answer with care.)",
        "=== END UNDERSTANDING ===",
        ...(opts.recentLocations?.trim()
          ? [
              "",
              "=== WHERE THEY'VE BEEN RECENTLY (places they logged) ===",
              opts.recentLocations,
              "=== END LOCATIONS ===",
            ]
          : []),
      ].join("\n"),
      cache_control: { type: "ephemeral" },
    },
  ];

  let usedModel = CHAT_MODEL;
  let resp;
  try {
    resp = await client().messages.create({ model: CHAT_MODEL, max_tokens: 4096, system, messages });
  } catch (err) {
    const status = (err as { status?: number }).status;
    const overloaded =
      status === 429 || status === 529 || (typeof status === "number" && status >= 500);
    if (overloaded && CHAT_FALLBACK_MODEL && CHAT_FALLBACK_MODEL !== CHAT_MODEL) {
      // The chat model is busy — answer this one on the fallback model.
      usedModel = CHAT_FALLBACK_MODEL;
      resp = await client().messages.create({ model: CHAT_FALLBACK_MODEL, max_tokens: 4096, system, messages });
    } else {
      throw err;
    }
  }
  recordUsage("chat", usedModel, resp.usage);

  const block = resp.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

/**
 * Produce a very short topic title for a single insight entry. Used to label
 * collapsed entries in the Insights history so they read as topics rather
 * than a trimmed opening sentence.
 */
export async function generateInsightTitle(content: string): Promise<string> {
  const resp = await client().messages.create({
    model: MODEL,
    max_tokens: 32,
    system: [
      "You write an extremely short topic title for a personal reflection note.",
      "Reply with 2 to 5 plain words naming the main theme — no punctuation,",
      "no quotes, no preamble, no trailing period.",
      'Example replies: "Work overwhelm and focus", "Progress on the notes".',
    ].join("\n"),
    messages: [{ role: "user", content: content.slice(0, 4000) }],
  });
  recordUsage("insight_title", MODEL, resp.usage);

  const block = resp.content.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text : "";
  return text.trim().replace(/^["']+|["'.]+$/g, "").slice(0, 80);
}

/**
 * Reflect on the user's notes and chats and produce a fresh set of insights
 * about them. Prior insights are passed in so each new entry builds on the
 * last rather than repeating — the result is a cumulative record.
 */
export async function generateInsights(opts: {
  notesContext: string;
  chatContext: string;
  priorInsights: string[];
}): Promise<string> {
  const priorBlock = opts.priorInsights.length
    ? [
        "",
        "=== YOUR PREVIOUS INSIGHTS (most recent first) ===",
        opts.priorInsights.join("\n\n---\n\n"),
        "=== END PREVIOUS INSIGHTS ===",
      ].join("\n")
    : "";

  const chatBlock = opts.chatContext.trim()
    ? [
        "",
        "=== THE PERSON'S RECENT CHATS WITH YOU ===",
        opts.chatContext,
        "=== END CHATS ===",
      ].join("\n")
    : "";

  const resp = await client().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
      "You help a person understand themselves by reflecting on their",
      "handwritten notebooks and their conversations with you.",
      "Write a concise, specific set of insights about this person:",
      "recurring themes, what they value, patterns in how they think and feel,",
      "their goals and worries, and anything notable or worth their attention.",
      "Their notes are the main source. Their recent chats with you also count —",
      "what they ask about reveals their current concerns and interests.",
      "Be warm, honest, and concrete — point to what they actually wrote or asked.",
      "If previous insights are provided, build on them: note what has changed,",
      "progressed, or recurred, and do not simply repeat earlier observations.",
      "Write a few short paragraphs or bullet points. No preamble, no sign-off.",
      "",
      "=== THE PERSON'S NOTES ===",
      opts.notesContext,
      "=== END NOTES ===",
      chatBlock,
      priorBlock,
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: "Reflect on my notes and chats and share what you notice about me.",
      },
    ],
  });
  recordUsage("insights", MODEL, resp.usage);

  const block = resp.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}
