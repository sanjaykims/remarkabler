import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  getHeatmap,
  getThemes,
  getSentimentSeries,
  getEmbeddingMap,
  countAnalyzed,
  countPending,
  getStoredAxisLabels,
  getTopEntities,
} from "@/lib/mind";
import { embeddingsEnabled } from "@/lib/embeddings";
import { reparseAllEntryDates, runMaintenanceSweep } from "@/lib/notes";
import { getSetting, setSetting } from "@/lib/db";

// One-time migration: the old extractEntryDate regex expected
// yyyy-mm-dd-hhmm-KST (no separator between hour/minute, uppercase). The
// user's actual handwritten format is yyyy-mm-dd-hh-mm-kst, so every page
// was stored with entry_date='none'. The new regex matches both. Run a
// single reparse pass the first time /api/mind is hit after this deploy so
// the heatmap and mood timeline light up without the user touching a button.
const REPARSE_FLAG = "mind_dates_reparsed_v2";
function reparseIfNeeded(): void {
  if (getSetting(REPARSE_FLAG)) return;
  try {
    reparseAllEntryDates();
    setSetting(REPARSE_FLAG, new Date().toISOString());
  } catch (e) {
    // Don't block the GET — if reparse fails the heatmap just keeps using
    // the upload-date fallback.
    console.warn("[mind] one-time reparse failed:", (e as Error).message);
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/mind
// Returns all four datasets the /mind page needs in one round-trip:
//   - heatmap           : { date, pages, chars }[]            (free, SQL only)
//   - themes            : { theme, count, sample_page_ids }[] (from cache)
//   - sentiment         : { date, avg_sentiment, n }[]        (from cache)
//   - embeddingMap      : { page_id, x, y, ... }[]            (PCA on cache)
//   - counts            : { analyzed, pending }               (for backfill UI)
//   - embeddingsEnabled : bool                                (toggle the map)
//
// Everything is free per call — no Claude / Voyage requests. The backfill
// itself lives at POST /api/mind/analyze.
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  try {
    // Fire-and-forget the background sweep — gated internally to ≤ once
    // per 5 min. Lets opening /mind pick up new Dropbox notebooks too.
    runMaintenanceSweep();
    reparseIfNeeded();
    return NextResponse.json({
      heatmap: getHeatmap(),
      themes: getThemes(80),
      sentiment: getSentimentSeries(),
      embeddingMap: embeddingsEnabled() ? getEmbeddingMap(500) : [],
      axisLabels: getStoredAxisLabels(),
      entities: getTopEntities(10),
      counts: {
        analyzed: countAnalyzed(),
        pending: countPending(),
      },
      embeddingsEnabled: embeddingsEnabled(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Mind data failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
