import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/db";
import { analyzePending, ANALYZE_MAX_LIMIT } from "@/lib/mind";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mind/reanalyze
// One-shot "redo every per-entry analysis" — wipes the cached themes /
// sentiment / summary rows and kicks `analyzePending` in the background so
// the new (English-only) prompts re-fill the table. Returns immediately; the
// user reloads /mind to watch progress via the existing "Analysed X · Y
// pending" counter. Bounded by ANALYZE_MAX_LIMIT (200) so a single click
// can't accidentally run the whole corpus uncapped.
export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  try {
    const cleared = db()
      .prepare(`DELETE FROM entry_analysis`)
      .run().changes as number;
    // Fire-and-forget the analyse loop so we return quickly. The page's
    // pending counter updates as it works. analyzePending has its own
    // in-flight guard so a stray double-click is harmless.
    void analyzePending(ANALYZE_MAX_LIMIT).catch((err) => {
      console.warn("[mind] background reanalyse failed:", (err as Error).message);
    });
    return NextResponse.json({
      ok: true,
      cleared,
      message:
        cleared === 0
          ? "Nothing to clear. Re-analysis started in the background."
          : `Cleared ${cleared} cached analyses. Re-analysis started in the background — refresh in a minute or two to see progress.`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Reanalyze failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
