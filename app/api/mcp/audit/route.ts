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
  // Number(null) is 0 and Number("") is 0, and both are finite — so reading
  // the param straight into Number() made an absent ?limit clamp to 1 and the
  // 100 default unreachable. The endpoint exists to make security events
  // visible; returning a single row read as "nothing happened".
  const rawLimit = req.nextUrl.searchParams.get("limit");
  const requested = rawLimit === null || rawLimit === "" ? NaN : Number(rawLimit);
  const limit = Number.isFinite(requested)
    ? Math.max(1, Math.min(200, Math.floor(requested)))
    : 100;
  const rawBefore = req.nextUrl.searchParams.get("before");
  const before = rawBefore === null || rawBefore === "" ? NaN : Number(rawBefore);
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
