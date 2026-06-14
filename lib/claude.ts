import Anthropic from "@anthropic-ai/sdk";
import { recordUsage } from "@/lib/usage";
import { db, getSetting } from "@/lib/db";
import { CHAT_TOOLS, executeTool } from "@/lib/chatTools";

// When updating / rebuilding the profile, also feed in the most recent
// on-demand reflections so Claude's "memory of you" knows what it has been
// noticing — not just what was written in the diary.
function recentInsightsBlock(maxChars = 2000): string {
  try {
    const rows = db()
      .prepare(
        `SELECT title, content FROM insights ORDER BY id DESC LIMIT 3`
      )
      .all() as Array<{ title: string | null; content: string }>;
    if (rows.length === 0) return "";
    return rows
      .map((r) => {
        const header = r.title ? `[${r.title}]\n` : "";
        const text =
          r.content.length > maxChars
            ? r.content.slice(0, maxChars) + "…"
            : r.content;
        return `${header}${text}`;
      })
      .join("\n\n---\n\n");
  } catch {
    return "";
  }
}

// Each Claude model resolves at call time: in-app setting (Memory tab) overrides
// the Railway env var, which overrides the built-in default. Building the model
// dynamically means flipping a model in the UI takes effect immediately, with
// no restart, and the env var keeps working when nothing's been set in-app.
function modelMain(): string {
  return (
    getSetting("model_main") ||
    process.env.CLAUDE_MODEL ||
    "claude-opus-4-7"
  );
}
function modelChat(): string {
  return (
    getSetting("model_chat") ||
    process.env.CHAT_MODEL ||
    "claude-sonnet-4-6"
  );
}
function modelChatFallback(): string {
  return (
    getSetting("model_chat_fallback") ||
    process.env.CHAT_FALLBACK_MODEL ||
    "claude-sonnet-4-6"
  );
}

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

export type PageOcr = { pageIndex: number; text: string };

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
    model: modelMain(),
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
  recordUsage("ocr", modelMain(), resp.usage);

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
    return whole ? [{ pageIndex: 0, text: whole }] : [];
  }

  return parts.slice(1).map((chunk, i) => {
    const text = chunk.trim();
    return {
      pageIndex: i,
      text: text.toLowerCase() === "(blank)" ? "" : text,
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
  const insights = recentInsightsBlock();
  const resp = await client().messages.create({
    model: modelMain(),
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
          ...(insights
            ? [
                "",
                "=== YOUR RECENT REFLECTIONS ABOUT ME (latest first) ===",
                insights,
                "=== END REFLECTIONS ===",
                "",
                "Weave the patterns you've already noticed into the profile;",
                "don't restate them verbatim.",
              ]
            : []),
        ].join("\n"),
      },
    ],
  });
  recordUsage("memory", modelMain(), resp.usage);
  const block = resp.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

/** Revise the existing profile to incorporate one new diary entry. */
export async function updateSelfModel(opts: {
  currentProfile: string;
  newContent: string;
}): Promise<string> {
  const insights = recentInsightsBlock(1500);
  const resp = await client().messages.create({
    model: modelMain(),
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
          ...(insights
            ? [
                "",
                "=== YOUR RECENT REFLECTIONS ABOUT ME (latest first) ===",
                insights,
                "=== END REFLECTIONS ===",
              ]
            : []),
          "",
          "Return the full, revised understanding of me.",
        ].join("\n"),
      },
    ],
  });
  recordUsage("memory", modelMain(), resp.usage);
  const block = resp.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

const MAX_TOOL_ITERATIONS = 6;

export async function chatOverNotes(opts: {
  profile: string;
  recentLocations?: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
  attachment?: { kind: "image" | "document"; mediaType: string; dataBase64: string };
}): Promise<{ reply: string; model: string }> {
  const messages: Anthropic.MessageParam[] = opts.history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const userText = opts.userMessage || "Please look at this attachment.";

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

  // Static guidance + tool policy. This block is the one we want cached on
  // every chat turn — it never changes between requests. Keeping it in its
  // own TextBlock with cache_control lets Anthropic reuse it across turns
  // and across messages even when the profile / locations differ.
  const staticGuidance = [
    "You are this person's personal companion — you know them through",
    "their diary. Below is your accumulated understanding of who they are,",
    "built up over time; treat it as your memory of them.",
    "When they ask you something, think it through in light of everything",
    "you understand about them, and answer with your honest, thoughtful",
    "opinion — not a bare summary of their notes.",
    "",
    "You have tools to look up specific things on demand:",
    "- Diary content: search_diary (keyword/theme), get_entries_by_date",
    "  (specific date), get_recent_entries (\"lately\"/\"this week\"),",
    "  list_notebooks + get_notebook (whole notebook by id),",
    "  count_entries_mentioning (\"how often do I write about X?\").",
    "- Daily / weekly / monthly summaries (auto-generated, cheaper than",
    "  raw entries): get_day_summary, get_week_summary, get_month_summary.",
    "  Prefer these for \"how was [date/week/month]?\" — only fall back to",
    "  get_entries_by_date when you need the raw words.",
    "- The clock: current_time_kst — call this whenever the user says",
    "  \"today\", \"yesterday\", \"this week\", \"last month\" etc. You don't",
    "  know what today is otherwise.",
    "- Where they've been: get_recent_locations (longer ranges than the",
    "  3 days already in this prompt).",
    "- Past conversations + reflections: search_chat_history,",
    "  get_insights.",
    "- Writing stats: get_writing_stats (\"how much have I written?\").",
    "Use tools only when the question genuinely needs a specific lookup —",
    "many questions are answerable from the profile alone. After fetching,",
    "answer from what's actually in the result; if it's not there, say so",
    "honestly and don't guess.",
    "",
    "Be warm, direct, and specific. If you genuinely don't know, say so.",
    "",
    "Their diary entries carry timestamps written as YYYY-MM-DD-HHMM-KST",
    "(year-month-day-time-Korea Standard Time, UTC+9).",
  ].join("\n");

  // Dynamic context — profile + recent locations. Changes whenever a new
  // notebook is folded into the profile or new OwnTracks stays land, so
  // it lives in its own block WITHOUT cache_control. The static block above
  // still gets cached even when this one changes.
  const dynamicContext = [
    "=== YOUR UNDERSTANDING OF THEM ===",
    opts.profile.trim() ||
      "(No profile yet — use the tools to fetch real entries and answer with care.)",
    "=== END UNDERSTANDING ===",
    ...(opts.recentLocations?.trim()
      ? [
          "",
          "=== WHERE THEY'VE BEEN RECENTLY (places they logged) ===",
          opts.recentLocations,
          "=== END LOCATIONS ===",
        ]
      : []),
  ].join("\n");

  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: staticGuidance,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: dynamicContext,
    },
  ];

  const chat = modelChat();
  const fallback = modelChatFallback();
  let usedModel = chat;
  let currentMessages: Anthropic.MessageParam[] = messages;

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    let resp;
    try {
      resp = await client().messages.create({
        model: usedModel,
        max_tokens: 4096,
        system,
        tools: CHAT_TOOLS,
        messages: currentMessages,
      });
    } catch (err) {
      const status = (err as { status?: number }).status;
      const overloaded =
        status === 429 || status === 529 || (typeof status === "number" && status >= 500);
      if (overloaded && fallback && fallback !== usedModel) {
        // The chat model is busy — fall back for the rest of this turn,
        // including subsequent tool-call iterations. The previous gate
        // (`iter === 0`) meant a mid-loop 529 surfaced as an error even
        // when the fallback was available.
        console.warn(
          `[chat] ${usedModel} returned ${status}; falling back to ${fallback}`
        );
        usedModel = fallback;
        resp = await client().messages.create({
          model: usedModel,
          max_tokens: 4096,
          system,
          tools: CHAT_TOOLS,
          messages: currentMessages,
        });
      } else {
        throw err;
      }
    }
    recordUsage("chat", usedModel, resp.usage);

    if (resp.stop_reason !== "tool_use") {
      // Terminal turn: end_turn / max_tokens / stop_sequence — return the text.
      const block = resp.content.find((b) => b.type === "text");
      const reply = block && block.type === "text" ? block.text : "";
      return { reply, model: usedModel };
    }

    // Execute every tool_use block in this assistant turn (in parallel).
    const toolUses = resp.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUses.map(async (tu) => ({
        type: "tool_result" as const,
        tool_use_id: tu.id,
        content: await executeTool(tu.name, tu.input),
      }))
    );
    // Mark the last tool_result with cache_control so the conversation
    // history through this point gets cached. The next iteration's API call
    // then hits the cache for everything before its own new tool_use, which
    // dramatically reduces billed input tokens on multi-tool turns.
    if (toolResults.length > 0) {
      toolResults[toolResults.length - 1].cache_control = { type: "ephemeral" };
    }

    currentMessages = [
      ...currentMessages,
      { role: "assistant", content: resp.content as Anthropic.ContentBlockParam[] },
      { role: "user", content: toolResults },
    ];
  }

  // Iteration limit hit — return a graceful note.
  return {
    reply:
      "I had to look up a lot and didn't finish — try asking again, maybe a bit more specifically.",
    model: usedModel,
  };
}

/**
 * Summarise one day's diary entries into a short third-person paragraph.
 * Used by the multi-level memory: each dated entry gets a daily summary;
 * weeks and months are aggregated from these. Runs on the cheaper main
 * model so daily generation stays inexpensive even at scale.
 */
/**
 * Per-entry semantic analysis used by /mind: extract a small set of concrete
 * themes (1–3 word noun phrases), an overall sentiment in [-1, +1], and a
 * one-line summary. Runs on the chat (cheap) model — themes/sentiment don't
 * need Opus reasoning, and we want a low marginal cost per entry so a
 * 200-page backfill stays under a dollar.
 *
 * Returns null on parse failure rather than throwing, so the batch loop can
 * skip and keep going.
 */
export async function analyzeEntryContent(text: string): Promise<{
  themes: string[];
  sentiment: number | null;
  summary: string;
} | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  // Cap input — Sonnet handles 200K context but a single diary page rarely
  // exceeds a few thousand characters, and trimming bounds worst-case cost
  // on a runaway-large OCR'd page.
  const input = trimmed.length > 8000 ? trimmed.slice(0, 8000) : trimmed;

  const resp = await client().messages.create({
    model: modelChat(),
    max_tokens: 400,
    system: [
      "You analyse one diary entry and return STRICT JSON, nothing else.",
      "No preamble, no Markdown fence, no explanation — just the JSON object.",
      "",
      "Schema:",
      "{",
      '  "themes": [string, ...],  // 2 to 5 concrete topics, each 1-3 words, in the entry\'s language. Specific, not generic — "family dinner", "work stress", "running form", "사업 아이디어" — NOT "life", "feelings", "thoughts".',
      '  "sentiment": number,      // overall emotional valence, -1.0 very negative ↔ +1.0 very positive, 0 for neutral. One decimal place is fine.',
      '  "summary": string         // one short sentence (≤25 words) in the entry\'s language, describing what the person wrote about.',
      "}",
      "",
      "If the entry is too short or empty to analyse, return:",
      '{"themes": [], "sentiment": null, "summary": ""}',
    ].join("\n"),
    messages: [{ role: "user", content: input }],
  });
  recordUsage("entry_analysis", modelChat(), resp.usage);

  const block = resp.content.find((b) => b.type === "text");
  const raw = block && block.type === "text" ? block.text.trim() : "";
  if (!raw) return null;

  // Tolerate occasional ```json fences even though we asked for none.
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;

  const themesRaw = Array.isArray(p.themes) ? p.themes : [];
  const themes = themesRaw
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 60)
    .slice(0, 8);

  let sentiment: number | null = null;
  if (typeof p.sentiment === "number" && Number.isFinite(p.sentiment)) {
    sentiment = Math.max(-1, Math.min(1, p.sentiment));
  }

  const summaryRaw = typeof p.summary === "string" ? p.summary.trim() : "";
  const summary = summaryRaw.length > 400 ? summaryRaw.slice(0, 400) : summaryRaw;

  return { themes, sentiment, summary };
}

export async function summarizeDay(opts: {
  date: string;
  entries: string;
}): Promise<string> {
  const resp = await client().messages.create({
    model: modelMain(),
    max_tokens: 800,
    system: [
      "You summarise a person's diary entries from one day into a short,",
      "specific, third-person paragraph (\"They wrote about…\"). Capture what",
      "happened, what they thought about, how they felt, and any new threads.",
      "Be grounded in the actual entries — quote a short phrase or two where",
      "it sharpens the point. 100–200 words. No preamble, no heading.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          `Date: ${opts.date}`,
          "",
          "Their entries:",
          opts.entries,
        ].join("\n"),
      },
    ],
  });
  recordUsage("daily_summary", modelMain(), resp.usage);
  const block = resp.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

/**
 * Compose a chaptered "book draft" — the editor pass that takes the raw
 * profile + diary + insights and produces a structured, narrated Markdown
 * document. Streamed so the long output can keep the connection alive.
 */
export async function composeBook(opts: {
  profile: string;
  diary: string;
  insights: string;
  exportedAt: string;
}): Promise<{ text: string; model: string }> {
  const model = modelMain();
  const stream = client().messages.stream({
    model,
    max_tokens: 24000,
    system: [
      "You are a thoughtful editor turning a person's private diary into a",
      "book draft about their life — written for them, not anyone else.",
      "You are given their accumulated profile (use it as your understanding",
      "of who they are), their diary entries (chronological), and your own",
      "past reflections about them.",
      "",
      "Compose a structured Markdown book with this shape:",
      "",
      "# (a title that captures the period or what stands out about it)",
      "",
      "_Subtitle — a single line setting what this is._",
      "",
      "## Prologue",
      "  Two or three paragraphs introducing who they were at the start of",
      "  this record and what they were carrying.",
      "",
      "## Chapters (multiple)",
      "  Organise chronologically by month or season — one chapter per",
      "  natural arc. Each chapter has a brief title, an opening paragraph",
      "  that sets the scene, and weaves real diary excerpts (quoted) with",
      "  editorial connective tissue. Keep their actual voice in the quotes;",
      "  your voice is the editor between them.",
      "",
      "## What I've Noticed",
      "  A reflection chapter distilling the patterns from your past",
      "  reflections — what's recurring, what's evolved, what hasn't.",
      "",
      "## Where You Are Now",
      "  A closing chapter on the present, grounded in the most recent",
      "  entries.",
      "",
      "Write in second person (\"You wrote…\"). Quote short real lines from",
      "the diary inside `> blockquotes`; the rest is your editorial voice.",
      "Be specific — this is one person's life, not a generic self-help",
      "essay. Don't hedge with \"perhaps\" or \"maybe\" when the diary is",
      "clear; do say so plainly when something is unclear.",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          `(Compiled ${opts.exportedAt}.)`,
          "",
          "=== MY PROFILE ===",
          opts.profile || "(No profile yet.)",
          "=== END PROFILE ===",
          "",
          "=== MY DIARY (chronological) ===",
          opts.diary || "(No diary entries yet.)",
          "=== END DIARY ===",
          ...(opts.insights
            ? [
                "",
                "=== YOUR PAST REFLECTIONS ABOUT ME ===",
                opts.insights,
                "=== END REFLECTIONS ===",
              ]
            : []),
          "",
          "Compose the book.",
        ].join("\n"),
      },
    ],
  });

  let text = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      text += event.delta.text;
    }
  }
  const final = await stream.finalMessage();
  recordUsage("book", model, final.usage);
  return { text, model };
}

/**
 * Produce a very short topic title for a single insight entry. Used to label
 * collapsed entries in the Insights history so they read as topics rather
 * than a trimmed opening sentence.
 */
export async function generateInsightTitle(content: string): Promise<string> {
  // Titles are 2-5 words — Opus is overkill. Use the chat model (Sonnet by
  // default) which is ~5× cheaper and indistinguishable for this task.
  const model = modelChat();
  const resp = await client().messages.create({
    model,
    max_tokens: 32,
    system: [
      "You write an extremely short topic title for a personal reflection note.",
      "Reply with 2 to 5 plain words naming the main theme — no punctuation,",
      "no quotes, no preamble, no trailing period.",
      'Example replies: "Work overwhelm and focus", "Progress on the notes".',
    ].join("\n"),
    messages: [{ role: "user", content: content.slice(0, 4000) }],
  });
  recordUsage("insight_title", model, resp.usage);

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
  // Split the system prompt into a CACHEABLE static block (instructions +
  // your big stable diary corpus) and an UNCACHED dynamic block (recent
  // chats + prior insights — those change between runs).
  //
  // Why: the corpus is ~50K tokens and barely changes week-to-week. With
  // cache_control, a second call within ~5 minutes pays $0.50/M tokens on
  // that prefix instead of $5/M — 90% off. Helps most when the user taps
  // "Generate insights" several times in a row (e.g. previewing variants);
  // the weekly auto-run is too spaced-out to benefit much.
  //
  // Identical output to the previous one-string version. Caching is a
  // billing-layer feature — Claude still reads every token. We just stop
  // paying full price to re-send the same diary the cache already holds.
  const staticGuidance = [
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
  ].join("\n");

  const dynamicContext = [
    ...(opts.chatContext.trim()
      ? [
          "=== THE PERSON'S RECENT CHATS WITH YOU ===",
          opts.chatContext,
          "=== END CHATS ===",
          "",
        ]
      : []),
    ...(opts.priorInsights.length
      ? [
          "=== YOUR PREVIOUS INSIGHTS (most recent first) ===",
          opts.priorInsights.join("\n\n---\n\n"),
          "=== END PREVIOUS INSIGHTS ===",
        ]
      : []),
  ].join("\n");

  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: staticGuidance,
      cache_control: { type: "ephemeral" },
    },
    ...(dynamicContext
      ? [{ type: "text" as const, text: dynamicContext }]
      : []),
  ];

  const resp = await client().messages.create({
    model: modelMain(),
    max_tokens: 2048,
    system,
    messages: [
      {
        role: "user",
        content: "Reflect on my notes and chats and share what you notice about me.",
      },
    ],
  });
  recordUsage("insights", modelMain(), resp.usage);

  const block = resp.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}
