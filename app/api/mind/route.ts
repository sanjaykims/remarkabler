import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  getHeatmap,
  getThemes,
  getSentimentSeries,
  getEmbeddingMap,
  countAnalyzed,
  countPending,
} from "@/lib/mind";
import { embeddingsEnabled } from "@/lib/embeddings";

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
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  try {
    return NextResponse.json({
      heatmap: getHeatmap(),
      themes: getThemes(80),
      sentiment: getSentimentSeries(),
      embeddingMap: embeddingsEnabled() ? getEmbeddingMap(500) : [],
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
