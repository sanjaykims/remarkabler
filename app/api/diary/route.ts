import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// Lookup result row shape returned to the UI + the chat /raw handler.
type Entry = {
  page_id: string;
  notebook_id: string;
  notebook_name: string;
  page_index: number;
  entry_date: string | null;
  ocr_text: string;
};

// GET /api/diary
// Browse the raw diary corpus directly — no AI involved, no cost per call.
// Backs the new /diary page AND the chat "/raw" shortcut so both share one
// well-tested query path.
//
// Query params (all optional):
//   q       — full-text search via pages_fts. Empty = no filter.
//   date    — exact entry_date (YYYY-MM-DD).
//   from    — entry_date >= (YYYY-MM-DD).
//   to      — entry_date <  (YYYY-MM-DD, exclusive end so "this week" math
//             works without off-by-one).
//   limit   — page size (default 50, max 500).
//   offset  — for pagination (default 0).
//
// Discipline-notebook pages are excluded when discipline-sharing is off,
// matching how the rest of the app treats that notebook.
export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const date = url.searchParams.get("date")?.trim() || "";
  const from = url.searchParams.get("from")?.trim() || "";
  const to = url.searchParams.get("to")?.trim() || "";
  const limit = Math.max(
    1,
    Math.min(500, Number(url.searchParams.get("limit") || "50") || 50)
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") || "0") || 0);

  // We pull from `pages` + join notebook name. The FTS table is only used
  // when q is set, joined back to pages by page_id (it's a regular column
  // we INSERT into pages_fts, not the rowid match path — keeps this query
  // simple and works alongside the other filters).
  const filters: string[] = [
    "p.ocr_text IS NOT NULL",
    "p.ocr_text != ''",
  ];
  const params: Array<string | number> = [];

  if (date) {
    filters.push("p.entry_date = ?");
    params.push(date);
  } else {
    if (from) {
      filters.push("p.entry_date >= ?");
      params.push(from);
    }
    if (to) {
      filters.push("p.entry_date < ?");
      params.push(to);
    }
  }

  let fromClause = "FROM pages p JOIN notebooks n ON n.id = p.notebook_id";
  if (q) {
    // FTS5: tokenise the query the same way chatTools does (drop punctuation,
    // OR the terms, quote each so spaces / special chars survive). Match the
    // virtual table, not a column — that's the supported FTS5 form here.
    const terms = q
      .toLowerCase()
      .replace(/["'()*:^{}[\]~+\-.,!?]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .slice(0, 24);
    if (terms.length > 0) {
      const matchExpr = terms.map((t) => `"${t}"`).join(" OR ");
      fromClause += ` JOIN pages_fts f ON f.page_id = p.id`;
      filters.push(`f MATCH ?`);
      params.push(matchExpr);
    }
  }

  // Ordering: entry_date desc (newest first), nulls last (entries without
  // a parsed date sink to the bottom), then page_index for stability.
  const sql =
    `SELECT p.id AS page_id,
            p.notebook_id,
            n.name AS notebook_name,
            p.page_index,
            p.entry_date,
            p.ocr_text
       ${fromClause}
       WHERE ${filters.join(" AND ")}
       ORDER BY (p.entry_date IS NULL) ASC,
                p.entry_date DESC,
                p.notebook_id DESC,
                p.page_index ASC
       LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  let rows: Entry[];
  try {
    rows = db().prepare(sql).all(...params) as Entry[];
  } catch (e) {
    return NextResponse.json(
      { error: `Diary query failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  // Distinct entry-date count for the UI header ("3 days, 7 pages").
  const totals = db()
    .prepare(
      `SELECT COUNT(*) AS pages,
              COUNT(DISTINCT entry_date) AS days
         FROM pages
         WHERE ocr_text IS NOT NULL AND ocr_text != ''`
    )
    .get() as { pages: number; days: number };

  return NextResponse.json({
    entries: rows,
    total: { pages: totals.pages, days: totals.days },
    returned: rows.length,
    limit,
    offset,
  });
}
