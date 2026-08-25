import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  analyzePending,
  ANALYZE_DEFAULT_LIMIT,
  ANALYZE_MAX_LIMIT,
} from "@/lib/mind";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mind/analyze?limit=N
// Runs the per-entry Claude analysis for up to N pages that don't yet have
// a row in entry_analysis. Bounded to ANALYZE_MAX_LIMIT so a single user
// click can never accidentally request a multi-thousand-entry pass.
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  const limitRaw = Number(
    new URL(req.url).searchParams.get("limit") || ANALYZE_DEFAULT_LIMIT
  );
  const limit = Math.max(
    1,
    Math.min(ANALYZE_MAX_LIMIT, Number.isFinite(limitRaw) ? limitRaw : ANALYZE_DEFAULT_LIMIT)
  );
  try {
    const result = await analyzePending(limit);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: `Analyze failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
