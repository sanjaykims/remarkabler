import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { normaliseDates, isDisciplineEnabled } from "./notes";

// Tools exposed to chatOverNotes so Claude can look up specific diary
// entries on demand instead of being pre-fed retrieved excerpts. The
// discipline notebook is always excluded when the user has turned off
// "Share discipline notes with Remarkabler."

const DISCIPLINE_ID = "github-discipline";
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
];

function searchDiary(input: { query?: string; limit?: number }): unknown {
  const query = String(input.query || "").trim();
  if (!query) return { excerpts: [], note: "Empty query." };
  const limit = Math.max(1, Math.min(20, Number(input.limit) || 8));
  const terms = normaliseDates(query.toLowerCase())
    .replace(/["'()*:^{}[\]~+\-.,!?]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 24);
  if (terms.length === 0) return { excerpts: [], note: "No usable terms in query." };
  const q = terms.map((t) => `"${t}"`).join(" OR ");
  const excludeId = isDisciplineEnabled() ? "__none__" : DISCIPLINE_ID;
  try {
    const rows = db()
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
    return {
      excerpts: rows.map((r) => ({
        notebook: r.notebook_name,
        page: Number((r.page_id || "").split(":")[1] || 0) + 1,
        text: trim(r.text),
      })),
    };
  } catch {
    return { excerpts: [], note: "Search failed." };
  }
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

export function executeTool(name: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  try {
    switch (name) {
      case "search_diary":
        return JSON.stringify(searchDiary(i));
      case "get_entries_by_date":
        return JSON.stringify(getEntriesByDate(i));
      case "list_notebooks":
        return JSON.stringify(listNotebooks());
      case "get_notebook":
        return JSON.stringify(getNotebook(i));
      case "get_recent_entries":
        return JSON.stringify(getRecentEntries(i));
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: (e as Error).message });
  }
}
