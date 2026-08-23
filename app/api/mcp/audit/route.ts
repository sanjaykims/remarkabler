import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner-only, token-free view of the bounded MCP security trail. */
export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  const requested = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(requested)
    ? Math.max(1, Math.min(200, Math.floor(requested)))
    : 100;
  const before = Number(req.nextUrl.searchParams.get("before"));
  const rows = db()
    .prepare(
      `SELECT id, ts, ip, event, tool, ok
       FROM mcp_audit
       WHERE (? IS NULL OR id < ?)
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(
      Number.isFinite(before) && before > 0 ? Math.floor(before) : null,
      Number.isFinite(before) && before > 0 ? Math.floor(before) : null,
      limit
    );
  return NextResponse.json(
    { events: rows },
    { headers: { "cache-control": "no-store" } }
  );
}
