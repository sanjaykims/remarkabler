import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { normaliseDates, isDisciplineEnabled, DISCIPLINE_ID } from "./notes";
import { isLocationEnabled } from "./location";
import { owntracksRouteContext } from "./owntracks";
import {
  embed,
  decodeEmbedding,
  cosineSimilarity,
  embeddingsEnabled,
} from "./embeddings";
import { TZ_OFFSET_MIN } from "./format";

// Tools exposed to chatOverNotes so Claude can look up specific diary
// entries on demand instead of being pre-fed retrieved excerpts. The
// discipline notebook is always excluded when the user has turned off
// "Share discipline notes with Remarkabler."

const MAX_EXCERPT_CHARS = 1500;

function trim(s: string, max = MAX_EXCERPT_CHARS): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_diary",
    description:
      "Search the user's transcribed handwritten diary by keyword or phrase. Best for thematic / keyword lookups (\"anxiety\", \"workout\", \"productivity\"). Returns matching excerpts with notebook name and page number. Diary entries carry timestamps written as YYYY-MM-DD-HHMM-KST.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Words to search for. Use natural language; do not quote or use boolean operators.",
        },
        limit: {
          type: "integer",
          description: "Max excerpts to return (1-20). Default 8.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_entries_by_date",
    description:
      "Fetch every diary excerpt whose text or notebook name mentions a specific date. Use for date-specific questions (\"what did I write on May 28?\"). Accepts 'YYYY-MM-DD', 'M/D', or 'YYYY/M/D'.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "The date to look up." },
      },
      required: ["date"],
    },
  },
  {
    name: "list_notebooks",
    description:
      "List the user's uploaded notebooks with id, name, upload date, and page count. Use to see what's available before fetching a specific notebook.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_notebook",
    description:
      "Fetch every page of one notebook by its id. Use after list_notebooks when you need a notebook's full content.",
    input_schema: {
      type: "object",
      properties: {
        notebook_id: {
          type: "string",
          description: "The notebook id returned by list_notebooks.",
        },
      },
      required: ["notebook_id"],
    },
  },
  {
    name: "get_recent_entries",
    description:
      "Return the most recent diary excerpts by upload time. Use for vague \"lately/recently/this week\" questions when there's no specific date.",
    input_schema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description: "How many days back to include (default 7, max 30).",
        },
      },
    },
  },
  {
    name: "current_time_kst",
    description:
      "Get the current date, time, and day of the week in Korea Standard Time (UTC+9). Call this whenever the user says \"today\", \"yesterday\", \"this week\", \"last month\", etc. — you need to know what \"today\" actually is to look up the right entries.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_recent_locations",
    description:
      "Get the user's recent location route — places they were at, when, and how long they stayed — for the last N days. Use for \"where have I been this month?\" or \"how often was I at the gym?\". Returns nothing if location sharing is off.",
    input_schema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description: "How many days back to include (default 7, max 30).",
        },
      },
    },
  },
  {
    name: "search_chat_history",
    description:
      "Search the user's past chat conversations with you (including archived/cleared chats) by keyword or phrase. Use when the user references something they said to you before (\"remember when I told you about…\", \"what did you say about X?\").",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to search for in past messages." },
        limit: {
          type: "integer",
          description: "Max matches to return (default 10, max 30).",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_insights",
    description:
      "Return the most recent on-demand 'insights' (cumulative reflections you've written about the user from their notes). Use when the user asks about your earlier observations or reflections.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Max insights to return (default 5, max 20).",
        },
      },
    },
  },
  {
    name: "get_writing_stats",
    description:
      "Get a summary of how much the user has written: total notebooks, total OCR'd pages, approximate word count, and the date range. Use for questions about their writing volume or consistency.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_day_summary",
    description:
      "Return the auto-generated daily summary for one date — what they wrote, thought about, and felt that day. Use this when the user asks about a specific date; it's cheaper and tighter than fetching the raw entries via get_entries_by_date.",
    input_schema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD (e.g., '2026-05-28').",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "get_week_summary",
    description:
      "Return up to seven daily summaries covering one week. Use for \"how was this week / last week?\" questions. Returns whatever days the week contains — gaps just mean nothing was written that day.",
    input_schema: {
      type: "object",
      properties: {
        week_start: {
          type: "string",
          description:
            "First day of the week in YYYY-MM-DD. The tool returns this day plus the next six.",
        },
      },
      required: ["week_start"],
    },
  },
  {
    name: "get_month_summary",
    description:
      "Return every daily summary for one calendar month. Use for \"what was [month] like?\" questions — Claude can then synthesise the patterns itself from the daily summaries.",
    input_schema: {
      type: "object",
      properties: {
        month: {
          type: "string",
          description: "Month in YYYY-MM (e.g., '2026-05').",
        },
      },
      required: ["month"],
    },
  },
  {
    name: "count_entries_mentioning",
    description:
      "Count how many diary pages mention a specific word or phrase, and return the matching notebook names + page numbers. Use for \"how often have I written about X?\" or \"when did I last mention Y?\".",
    input_schema: {
      type: "object",
      properties: {
        term: { type: "string", description: "Word or phrase to count occurrences of." },
      },
      required: ["term"],
    },
  },
];

// FTS-only search (literal-word matches). Used as one half of the hybrid.
function ftsSearch(
  query: string,
  limit: number,
  excludeId: string
): Array<{ notebook_name: string; text: string; page_id: string }> {
  const terms = normaliseDates(query.toLowerCase())
    .replace(/["'()*:^{}[\]~+\-.,!?]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 24);
  if (terms.length === 0) return [];
  const q = terms.map((t) => `"${t}"`).join(" OR ");
  try {
    return db()
      .prepare(
        `SELECT notebook_name, ocr_text AS text, page_id
         FROM pages_fts
         WHERE pages_fts MATCH ? AND notebook_id != ?
         ORDER BY rank LIMIT ?`
      )
      .all(q, excludeId, limit) as Array<{
        notebook_name: string;
        text: string;
        page_id: string;
      }>;
  } catch {
    return [];
  }
}

// How many pages to brute-force cosine-compare against in a single semantic
// search. With a 1024-dim float32 embedding each row is ~4 KB; at 2000 rows
// that's ~8 MB and a couple-ms loop in JS — fine for now. When the corpus
// outgrows that we'll need a real vector index (sqlite-vec etc.).
const SEMANTIC_SCAN_CAP = 2000;

// Semantic search: embed the query, brute-force cosine sim against the
// most recent N page embeddings. Bounding the scan keeps the memory cost
// and CPU cost predictable as the corpus grows.
async function semanticSearch(
  query: string,
  limit: number,
  excludeId: string
): Promise<
  Array<{ notebook_name: string; text: string; page_id: string; score: number }>
> {
  if (!embeddingsEnabled()) return [];
  const qVec = await embed(query, "query");
  if (!qVec) return [];
  try {
    const rows = db()
      .prepare(
        `SELECT p.id AS page_id, p.ocr_text AS text, n.name AS notebook_name,
                p.embedding AS embedding
         FROM pages p JOIN notebooks n ON n.id = p.notebook_id
         WHERE p.embedding IS NOT NULL
           AND p.notebook_id != ?
         ORDER BY p.id DESC
         LIMIT ?`
      )
      .all(excludeId, SEMANTIC_SCAN_CAP) as Array<{
        page_id: string;
        text: string;
        notebook_name: string;
        embedding: Buffer;
      }>;
    const scored = rows.map((r) => ({
      page_id: r.page_id,
      notebook_name: r.notebook_name,
      text: r.text,
      score: cosineSimilarity(qVec, decodeEmbedding(r.embedding)),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  } catch {
    return [];
  }
}

async function searchDiary(input: {
  query?: string;
  limit?: number;
}): Promise<unknown> {
  const query = String(input.query || "").trim();
  if (!query) return { excerpts: [], note: "Empty query." };
  const limit = Math.max(1, Math.min(20, Number(input.limit) || 8));
  const excludeId = isDisciplineEnabled() ? "__none__" : DISCIPLINE_ID;

  // Run FTS (literal) and semantic (meaning) in parallel; combine + dedupe.
  const [fts, sem] = await Promise.all([
    Promise.resolve(ftsSearch(query, limit, excludeId)),
    semanticSearch(query, limit, excludeId),
  ]);

  const seen = new Set<string>();
  type Hit = {
    notebook: string;
    page: number;
    text: string;
    source: "fts" | "semantic" | "both";
  };
  const merged: Hit[] = [];
  // Semantic results come first (re-ranked by meaning), then FTS catches
  // literal matches the embedding might have missed.
  for (const r of sem) {
    if (seen.has(r.page_id)) continue;
    seen.add(r.page_id);
    merged.push({
      notebook: r.notebook_name,
      page: Number((r.page_id || "").split(":")[1] || 0) + 1,
      text: trim(r.text),
      source: "semantic",
    });
  }
  for (const r of fts) {
    if (seen.has(r.page_id)) continue;
    seen.add(r.page_id);
    merged.push({
      notebook: r.notebook_name,
      page: Number((r.page_id || "").split(":")[1] || 0) + 1,
      text: trim(r.text),
      source: "fts",
    });
  }
  return {
    excerpts: merged.slice(0, limit),
    note:
      sem.length === 0 && embeddingsEnabled()
        ? "Semantic search returned nothing (embeddings may still be backfilling). FTS results only."
        : undefined,
  };
}

function getEntriesByDate(input: { date?: string }): unknown {
  const raw = String(input.date || "").trim();
  if (!raw) return { excerpts: [], note: "No date given." };
  const patterns: string[] = [];
  const m1 = raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (m1) {
    patterns.push(
      `${m1[1]}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`
    );
  }
  const m2 = raw.match(/^(\d{1,2})[\/-](\d{1,2})$/);
  if (m2) {
    patterns.push(`-${m2[1].padStart(2, "0")}-${m2[2].padStart(2, "0")}`);
  }
  if (patterns.length === 0) {
    return { excerpts: [], note: `Couldn't parse "${raw}" as a date.` };
  }
  const excludeId = isDisciplineEnabled() ? "__none__" : DISCIPLINE_ID;
  const results: Array<{ notebook: string; page: number; text: string }> = [];
  const seen = new Set<string>();
  try {
    for (const pattern of patterns) {
      const rows = db()
        .prepare(
          `SELECT n.name AS notebook_name, p.page_index, p.ocr_text AS text, p.id AS page_id
           FROM pages p JOIN notebooks n ON n.id = p.notebook_id
           WHERE (p.ocr_text LIKE ? OR n.name LIKE ?) AND p.notebook_id != ?
           ORDER BY n.synced_at DESC, p.page_index`
        )
        .all(`%${pattern}%`, `%${pattern}%`, excludeId) as Array<{
          notebook_name: string;
          page_index: number;
          text: string;
          page_id: string;
        }>;
      for (const r of rows) {
        if (seen.has(r.page_id)) continue;
        seen.add(r.page_id);
        results.push({
          notebook: r.notebook_name,
          page: r.page_index + 1,
          text: trim(r.text),
        });
      }
    }
    return { excerpts: results.slice(0, 20) };
  } catch {
    return { excerpts: [], note: "Lookup failed." };
  }
}

function listNotebooks(): unknown {
  const excludeId = isDisciplineEnabled() ? "__none__" : DISCIPLINE_ID;
  try {
    const rows = db()
      .prepare(
        `SELECT n.id, n.name, n.synced_at AS uploaded, COUNT(p.id) AS pages
         FROM notebooks n LEFT JOIN pages p ON p.notebook_id = n.id
         WHERE n.id != ?
         GROUP BY n.id
         ORDER BY n.synced_at DESC NULLS LAST`
      )
      .all(excludeId) as Array<{
        id: string;
        name: string;
        uploaded: string | null;
        pages: number;
      }>;
    return { notebooks: rows };
  } catch {
    return { notebooks: [], note: "Couldn't list notebooks." };
  }
}

function getNotebook(input: { notebook_id?: string }): unknown {
  const id = String(input.notebook_id || "").trim();
  if (!id) return { pages: [], note: "Missing notebook_id." };
  if (id === DISCIPLINE_ID && !isDisciplineEnabled()) {
    return { pages: [], note: "Discipline sharing is off." };
  }
  try {
    const rows = db()
      .prepare(
        `SELECT page_index, ocr_text AS text FROM pages
         WHERE notebook_id = ? AND ocr_text IS NOT NULL AND ocr_text != ''
         ORDER BY page_index`
      )
      .all(id) as Array<{ page_index: number; text: string }>;
    return {
      pages: rows.map((r) => ({
        page: r.page_index + 1,
        text: trim(r.text, 3000),
      })),
    };
  } catch {
    return { pages: [], note: "Lookup failed." };
  }
}

function getRecentEntries(input: { days?: number }): unknown {
  const days = Math.max(1, Math.min(30, Number(input.days) || 7));
  const excludeId = isDisciplineEnabled() ? "__none__" : DISCIPLINE_ID;
  try {
    const rows = db()
      .prepare(
        `SELECT n.name AS notebook_name, p.page_index, p.ocr_text AS text
         FROM pages p JOIN notebooks n ON n.id = p.notebook_id
         WHERE p.ocr_text IS NOT NULL AND p.ocr_text != ''
           AND p.notebook_id != ?
           AND datetime(n.synced_at) >= datetime('now', ?)
         ORDER BY n.synced_at DESC, p.page_index`
      )
      .all(excludeId, `-${days} days`) as Array<{
        notebook_name: string;
        page_index: number;
        text: string;
      }>;
    return {
      excerpts: rows.slice(0, 20).map((r) => ({
        notebook: r.notebook_name,
        page: r.page_index + 1,
        text: trim(r.text),
      })),
    };
  } catch {
    return { excerpts: [], note: "Lookup failed." };
  }
}

function currentTimeKst(): unknown {
  const now = new Date();
  const shifted = new Date(now.getTime() + TZ_OFFSET_MIN * 60 * 1000);
  const iso = shifted.toISOString();
  const tzLabel =
    TZ_OFFSET_MIN === 540
      ? "KST"
      : `UTC${TZ_OFFSET_MIN >= 0 ? "+" : ""}${TZ_OFFSET_MIN / 60}`;
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return {
    now: `${iso.slice(0, 10)} ${iso.slice(11, 16)} ${tzLabel}`,
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
    day_of_week: dayNames[shifted.getUTCDay()],
    timezone: tzLabel,
  };
}

async function getRecentLocations(input: { days?: number }): Promise<unknown> {
  if (!isLocationEnabled()) {
    return { route: "", note: "Location sharing is off in Remarkabler." };
  }
  const days = Math.max(1, Math.min(30, Number(input.days) || 7));
  const route = await owntracksRouteContext(days);
  return route
    ? { days, route }
    : { days, route: "", note: "No automatic location data for that range." };
}

function searchChatHistory(input: { query?: string; limit?: number }): unknown {
  const query = String(input.query || "").trim();
  if (!query) return { matches: [], note: "Empty query." };
  const limit = Math.max(1, Math.min(30, Number(input.limit) || 10));
  const pattern = `%${query.toLowerCase()}%`;
  try {
    const rows = db()
      .prepare(
        `SELECT role, content, created_at FROM chat_messages
         WHERE LOWER(content) LIKE ?
         ORDER BY id DESC LIMIT ?`
      )
      .all(pattern, limit) as Array<{
        role: string;
        content: string;
        created_at: string;
      }>;
    return {
      matches: rows.map((r) => ({
        when: r.created_at,
        role: r.role,
        text: trim(r.content, 500),
      })),
    };
  } catch {
    return { matches: [], note: "Search failed." };
  }
}

function getInsights(input: { limit?: number }): unknown {
  const limit = Math.max(1, Math.min(20, Number(input.limit) || 5));
  try {
    const rows = db()
      .prepare(
        `SELECT title, content, created_at FROM insights
         ORDER BY id DESC LIMIT ?`
      )
      .all(limit) as Array<{
        title: string | null;
        content: string;
        created_at: string;
      }>;
    return {
      insights: rows.map((r) => ({
        when: r.created_at,
        title: r.title || "(untitled)",
        text: trim(r.content, 2000),
      })),
    };
  } catch {
    return { insights: [], note: "Lookup failed." };
  }
}

function getWritingStats(): unknown {
  const excludeId = isDisciplineEnabled() ? "__none__" : DISCIPLINE_ID;
  try {
    const row = db()
      .prepare(
        `SELECT
           COUNT(DISTINCT n.id) AS notebook_count,
           COUNT(p.id) AS page_count,
           SUM(LENGTH(p.ocr_text) - LENGTH(REPLACE(p.ocr_text, ' ', '')) + 1) AS word_count,
           MIN(n.synced_at) AS earliest_upload,
           MAX(n.synced_at) AS latest_upload
         FROM notebooks n LEFT JOIN pages p ON p.notebook_id = n.id
         WHERE n.id != ?
           AND p.ocr_text IS NOT NULL AND p.ocr_text != ''`
      )
      .get(excludeId) as {
        notebook_count: number | null;
        page_count: number | null;
        word_count: number | null;
        earliest_upload: string | null;
        latest_upload: string | null;
      };
    return {
      notebook_count: row.notebook_count || 0,
      page_count: row.page_count || 0,
      approx_word_count: row.word_count || 0,
      earliest_upload: row.earliest_upload,
      latest_upload: row.latest_upload,
    };
  } catch {
    return { note: "Lookup failed." };
  }
}

function getDaySummary(input: { date?: string }): unknown {
  const date = String(input.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { summary: null, note: "date must be YYYY-MM-DD." };
  }
  try {
    const row = db()
      .prepare(
        `SELECT summary, created_at FROM daily_summaries WHERE date = ?`
      )
      .get(date) as { summary: string; created_at: string } | undefined;
    if (!row) return { date, summary: null, note: "No summary for that date (no entries written or summary not generated yet)." };
    return { date, summary: row.summary, written_at: row.created_at };
  } catch {
    return { summary: null, note: "Lookup failed." };
  }
}

function getWeekSummary(input: { week_start?: string }): unknown {
  const start = String(input.week_start || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return { days: [], note: "week_start must be YYYY-MM-DD." };
  }
  try {
    const rows = db()
      .prepare(
        `SELECT date, summary FROM daily_summaries
         WHERE date >= ? AND date <= date(?, '+6 days')
         ORDER BY date ASC`
      )
      .all(start, start) as Array<{ date: string; summary: string }>;
    return { week_start: start, days: rows };
  } catch {
    return { days: [], note: "Lookup failed." };
  }
}

function getMonthSummary(input: { month?: string }): unknown {
  const month = String(input.month || "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return { days: [], note: "month must be YYYY-MM." };
  }
  try {
    const rows = db()
      .prepare(
        `SELECT date, summary FROM daily_summaries
         WHERE date LIKE ?
         ORDER BY date ASC`
      )
      .all(`${month}-%`) as Array<{ date: string; summary: string }>;
    return { month, days: rows };
  } catch {
    return { days: [], note: "Lookup failed." };
  }
}

function countEntriesMentioning(input: { term?: string }): unknown {
  const term = String(input.term || "").trim();
  if (!term) return { count: 0, note: "Empty term." };
  const terms = normaliseDates(term.toLowerCase())
    .replace(/["'()*:^{}[\]~+\-.,!?]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 10);
  if (terms.length === 0) return { count: 0, note: "Term not usable for search." };
  // AND is stricter than OR for counting "how often X" rather than "either X or Y".
  const q = terms.map((t) => `"${t}"`).join(" AND ");
  const excludeId = isDisciplineEnabled() ? "__none__" : DISCIPLINE_ID;
  try {
    const rows = db()
      .prepare(
        `SELECT notebook_name, page_id FROM pages_fts
         WHERE pages_fts MATCH ? AND notebook_id != ?
         ORDER BY rank`
      )
      .all(q, excludeId) as Array<{ notebook_name: string; page_id: string }>;
    return {
      count: rows.length,
      pages: rows.slice(0, 20).map((r) => ({
        notebook: r.notebook_name,
        page: Number((r.page_id || "").split(":")[1] || 0) + 1,
      })),
    };
  } catch {
    return { count: 0, note: "Lookup failed." };
  }
}

export async function executeTool(
  name: string,
  input: unknown
): Promise<string> {
  const i = (input ?? {}) as Record<string, unknown>;
  try {
    switch (name) {
      case "search_diary":
        return JSON.stringify(await searchDiary(i));
      case "get_entries_by_date":
        return JSON.stringify(getEntriesByDate(i));
      case "list_notebooks":
        return JSON.stringify(listNotebooks());
      case "get_notebook":
        return JSON.stringify(getNotebook(i));
      case "get_recent_entries":
        return JSON.stringify(getRecentEntries(i));
      case "current_time_kst":
        return JSON.stringify(currentTimeKst());
      case "get_recent_locations":
        return JSON.stringify(await getRecentLocations(i));
      case "search_chat_history":
        return JSON.stringify(searchChatHistory(i));
      case "get_insights":
        return JSON.stringify(getInsights(i));
      case "get_writing_stats":
        return JSON.stringify(getWritingStats());
      case "count_entries_mentioning":
        return JSON.stringify(countEntriesMentioning(i));
      case "get_day_summary":
        return JSON.stringify(getDaySummary(i));
      case "get_week_summary":
        return JSON.stringify(getWeekSummary(i));
      case "get_month_summary":
        return JSON.stringify(getMonthSummary(i));
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: (e as Error).message });
  }
}
