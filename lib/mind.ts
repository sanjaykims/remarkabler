import { db } from "@/lib/db";
import { analyzeEntryContent } from "@/lib/claude";
import { decodeEmbedding } from "@/lib/embeddings";

// ──────────────────────────────────────────────────────────────────────────
// Per-entry analysis driver. Pulls pages with OCR text but no row in
// `entry_analysis`, asks Claude for {themes, sentiment, summary}, and writes
// the result. Designed to be safe to run repeatedly: at-most-once per page,
// bounded by an explicit `limit`, and tolerates individual-entry failures.
// ──────────────────────────────────────────────────────────────────────────

// Sensible defaults. The page picks the lower number when triggering a
// backfill so we never accidentally hit Claude for hundreds of entries at
// once from a single user click.
export const ANALYZE_DEFAULT_LIMIT = 25;
export const ANALYZE_MAX_LIMIT = 200;

// "Discipline" notebook (synced from GitHub) is excluded from analysis: it
// reflects external rules, not the user's own diary entries, and skewing
// the theme cloud / mood line with it would be misleading.
function disciplineNotebookId(): string | null {
  try {
    const row = db()
      .prepare(
        `SELECT id FROM notebooks WHERE name = 'discipline' LIMIT 1`
      )
      .get() as { id: string } | undefined;
    return row?.id ?? null;
  } catch {
    return null;
  }
}

function pendingPagesSql(excludeId: string | null, limit: number) {
  const where = [
    "p.ocr_text IS NOT NULL",
    "p.ocr_text != ''",
    "a.page_id IS NULL",
  ];
  const params: Array<string | number> = [];
  if (excludeId) {
    where.push("p.notebook_id != ?");
    params.push(excludeId);
  }
  params.push(limit);
  return {
    sql: `SELECT p.id, p.ocr_text
            FROM pages p
            LEFT JOIN entry_analysis a ON a.page_id = p.id
            WHERE ${where.join(" AND ")}
            ORDER BY p.entry_date IS NULL ASC, p.entry_date DESC, p.id DESC
            LIMIT ?`,
    params,
  };
}

export function countPending(): number {
  const exc = disciplineNotebookId();
  const params: string[] = [];
  let extra = "";
  if (exc) {
    extra = " AND p.notebook_id != ?";
    params.push(exc);
  }
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS c
         FROM pages p
         LEFT JOIN entry_analysis a ON a.page_id = p.id
         WHERE p.ocr_text IS NOT NULL AND p.ocr_text != '' AND a.page_id IS NULL${extra}`
    )
    .get(...params) as { c: number };
  return row.c;
}

export function countAnalyzed(): number {
  const row = db()
    .prepare(`SELECT COUNT(*) AS c FROM entry_analysis`)
    .get() as { c: number };
  return row.c;
}

export async function analyzePending(
  limit: number = ANALYZE_DEFAULT_LIMIT
): Promise<{ analyzed: number; failed: number; remaining: number }> {
  const n = Math.max(1, Math.min(ANALYZE_MAX_LIMIT, Math.floor(limit)));
  const exc = disciplineNotebookId();
  const { sql, params } = pendingPagesSql(exc, n);
  const rows = db().prepare(sql).all(...params) as Array<{
    id: string;
    ocr_text: string;
  }>;

  const upsert = db().prepare(
    `INSERT INTO entry_analysis
       (page_id, themes, sentiment, summary, model, analyzed_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(page_id) DO UPDATE SET
       themes      = excluded.themes,
       sentiment   = excluded.sentiment,
       summary     = excluded.summary,
       model       = excluded.model,
       analyzed_at = excluded.analyzed_at`
  );

  // Process serially so we don't fan out parallel Claude calls (the SDK is
  // fine with concurrency but the rate-limit accounting is not, and burning
  // through tokens 10x at once is exactly the kind of cost surprise that
  // motivated /raw).
  let analyzed = 0;
  let failed = 0;
  const model = process.env.CHAT_MODEL || "claude-sonnet-4-6";
  for (const row of rows) {
    try {
      const result = await analyzeEntryContent(row.ocr_text);
      if (!result) {
        failed++;
        continue;
      }
      upsert.run(
        row.id,
        JSON.stringify(result.themes),
        result.sentiment,
        result.summary || null,
        model
      );
      analyzed++;
    } catch (e) {
      console.warn("[mind] analyze failed:", row.id, (e as Error).message);
      failed++;
    }
  }
  return { analyzed, failed, remaining: countPending() };
}

// ──────────────────────────────────────────────────────────────────────────
// Aggregations — all pure SQL / pure JS over the cached results. Cheap to
// hit repeatedly, no Claude calls.
// ──────────────────────────────────────────────────────────────────────────

export type HeatmapBucket = { date: string; pages: number; chars: number };

export function getHeatmap(): HeatmapBucket[] {
  return db()
    .prepare(
      `SELECT entry_date AS date,
              COUNT(*)   AS pages,
              SUM(LENGTH(ocr_text)) AS chars
         FROM pages
         WHERE ocr_text IS NOT NULL AND ocr_text != ''
           AND entry_date IS NOT NULL AND entry_date != 'none'
         GROUP BY entry_date
         ORDER BY entry_date ASC`
    )
    .all() as HeatmapBucket[];
}

export type ThemeBucket = {
  theme: string;
  count: number;
  // page_ids of a few sample entries, so clicking a theme can show examples.
  sample_page_ids: string[];
};

export function getThemes(limit: number = 80): ThemeBucket[] {
  // Themes are stored per-entry as a JSON array. Pull all rows, accumulate
  // counts in a Map. JSON1's json_each would be more elegant but isn't
  // guaranteed enabled in every better-sqlite3 build; doing it in JS keeps
  // the dependency surface flat. Corpus is small enough (≤ a few thousand
  // entries) that this is well under a millisecond.
  const rows = db()
    .prepare(
      `SELECT page_id, themes
         FROM entry_analysis
         WHERE themes IS NOT NULL AND themes != '[]'`
    )
    .all() as Array<{ page_id: string; themes: string }>;
  const counts = new Map<string, { count: number; samples: string[] }>();
  for (const row of rows) {
    let arr: unknown;
    try {
      arr = JSON.parse(row.themes);
    } catch {
      continue;
    }
    if (!Array.isArray(arr)) continue;
    // De-dup within an entry so a theme repeated by the model only counts
    // once per page.
    const seen = new Set<string>();
    for (const t of arr) {
      if (typeof t !== "string") continue;
      const key = t.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(key) || { count: 0, samples: [] };
      entry.count += 1;
      if (entry.samples.length < 5) entry.samples.push(row.page_id);
      counts.set(key, entry);
    }
  }
  return Array.from(counts.entries())
    .map(([theme, v]) => ({
      theme,
      count: v.count,
      sample_page_ids: v.samples,
    }))
    .sort((a, b) => b.count - a.count || a.theme.localeCompare(b.theme))
    .slice(0, Math.max(1, Math.min(500, limit)));
}

export type SentimentPoint = {
  date: string;
  avg_sentiment: number;
  n: number;
};

export function getSentimentSeries(): SentimentPoint[] {
  return db()
    .prepare(
      `SELECT p.entry_date AS date,
              AVG(a.sentiment) AS avg_sentiment,
              COUNT(*) AS n
         FROM pages p
         JOIN entry_analysis a ON a.page_id = p.id
         WHERE a.sentiment IS NOT NULL
           AND p.entry_date IS NOT NULL AND p.entry_date != 'none'
         GROUP BY p.entry_date
         ORDER BY p.entry_date ASC`
    )
    .all() as SentimentPoint[];
}

// ──────────────────────────────────────────────────────────────────────────
// Embedding map: read each page's Float32 BLOB, reduce to 2D via PCA, and
// return point cloud data. PCA over a ≤1024-dim space with a few hundred
// pages is fast (sub-second on the deployed Pi-class instance), needs no
// external dep, and is deterministic — runs of the page produce the same
// layout. UMAP would give better visual clustering but pulls in a real
// numerical lib and randomness; PCA is the right v1.
// ──────────────────────────────────────────────────────────────────────────

export type MapPoint = {
  page_id: string;
  x: number;
  y: number;
  entry_date: string | null;
  notebook_name: string;
  page_index: number;
  sentiment: number | null;
  themes: string[];
  summary: string;
  preview: string;
};

// TS5+ types typed arrays with a generic over the backing buffer. Using bare
// `Float32Array` here keeps the matMulVec callback compatible with values
// returned from `new Float32Array(...)` (which TS narrows to <ArrayBuffer>)
// without requiring callers to over-specify the generic.
type Vec = Float32Array;

function powerIterTopEigenvector(
  matMulVec: (v: Vec) => Vec,
  dim: number,
  iters = 60
): Vec {
  // Random unit vector to start; deterministic seed so the layout doesn't
  // shift between calls. (Real determinism would need a seeded RNG, but for
  // PCA the eigenvector direction is unique up to sign so any non-pathological
  // start converges to the same line.)
  let v: Vec = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    v[i] = ((i * 2654435761) >>> 0) / 0xffffffff - 0.5;
  }
  // Normalise.
  let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  for (let i = 0; i < dim; i++) v[i] /= norm;

  for (let k = 0; k < iters; k++) {
    const w: Vec = matMulVec(v);
    norm = Math.sqrt(w.reduce((s, x) => s + x * x, 0));
    if (norm === 0) break;
    for (let i = 0; i < dim; i++) w[i] /= norm;
    v = w;
  }
  return v;
}

function pca2d(vectors: Float32Array[]): Array<[number, number]> | null {
  const n = vectors.length;
  if (n === 0) return [];
  const dim = vectors[0].length;
  if (dim === 0) return null;

  // Centre.
  const mean = new Float32Array(dim);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) mean[i] += v[i];
  }
  for (let i = 0; i < dim; i++) mean[i] /= n;

  const centred: Float32Array[] = vectors.map((v) => {
    const c = new Float32Array(dim);
    for (let i = 0; i < dim; i++) c[i] = v[i] - mean[i];
    return c;
  });

  // Matrix-vector product: (X^T X) v. We never form the dim×dim matrix —
  // for a 1024-dim, 200-row dataset that'd be 4MB of work per iteration.
  // Instead each step is two passes over the data: y = X v, then result = X^T y.
  const matMulVec = (v: Vec): Vec => {
    const y = new Float32Array(n);
    for (let r = 0; r < n; r++) {
      const row = centred[r];
      let s = 0;
      for (let i = 0; i < dim; i++) s += row[i] * v[i];
      y[r] = s;
    }
    const out = new Float32Array(dim);
    for (let r = 0; r < n; r++) {
      const row = centred[r];
      const yr = y[r];
      for (let i = 0; i < dim; i++) out[i] += row[i] * yr;
    }
    return out;
  };

  const pc1 = powerIterTopEigenvector(matMulVec, dim);

  // Deflate: remove pc1 component from each centred vector so the next
  // power iteration finds the orthogonal direction. Mutates a fresh copy.
  const deflated: Float32Array[] = centred.map((c) => {
    const proj = c.reduce((s, x, i) => s + x * pc1[i], 0);
    const out = new Float32Array(dim);
    for (let i = 0; i < dim; i++) out[i] = c[i] - proj * pc1[i];
    return out;
  });
  const matMulVec2 = (v: Float32Array): Float32Array => {
    const y = new Float32Array(n);
    for (let r = 0; r < n; r++) {
      const row = deflated[r];
      let s = 0;
      for (let i = 0; i < dim; i++) s += row[i] * v[i];
      y[r] = s;
    }
    const out = new Float32Array(dim);
    for (let r = 0; r < n; r++) {
      const row = deflated[r];
      const yr = y[r];
      for (let i = 0; i < dim; i++) out[i] += row[i] * yr;
    }
    return out;
  };
  const pc2 = powerIterTopEigenvector(matMulVec2, dim);

  // Project each centred vector onto pc1 / pc2.
  const points: Array<[number, number]> = centred.map((c) => {
    let x = 0;
    let y = 0;
    for (let i = 0; i < dim; i++) {
      x += c[i] * pc1[i];
      y += c[i] * pc2[i];
    }
    return [x, y];
  });
  return points;
}

export function getEmbeddingMap(limit: number = 500): MapPoint[] {
  // Pull pages with both an embedding and (preferably) an analysis row so the
  // tooltip has something to show. The map is informative without analysis,
  // so we LEFT JOIN and just hide themes/summary when missing.
  const rows = db()
    .prepare(
      `SELECT p.id          AS page_id,
              p.embedding   AS embedding,
              p.entry_date  AS entry_date,
              p.page_index  AS page_index,
              p.ocr_text    AS ocr_text,
              n.name        AS notebook_name,
              a.themes      AS themes,
              a.sentiment   AS sentiment,
              a.summary     AS summary
         FROM pages p
         JOIN notebooks n ON n.id = p.notebook_id
         LEFT JOIN entry_analysis a ON a.page_id = p.id
         WHERE p.embedding IS NOT NULL
           AND p.ocr_text IS NOT NULL AND p.ocr_text != ''
         ORDER BY p.entry_date IS NULL ASC, p.entry_date DESC, p.id DESC
         LIMIT ?`
    )
    .all(Math.max(1, Math.min(2000, limit))) as Array<{
    page_id: string;
    embedding: Buffer;
    entry_date: string | null;
    page_index: number;
    ocr_text: string;
    notebook_name: string;
    themes: string | null;
    sentiment: number | null;
    summary: string | null;
  }>;

  if (rows.length < 2) return [];

  // Decode + dimension-check. A truncated embedding (or one stored under a
  // different model with a different dim) would corrupt PCA — skip it.
  const usable: Array<{ row: (typeof rows)[number]; vec: Float32Array }> = [];
  let expectedDim = 0;
  for (const r of rows) {
    const v = decodeEmbedding(r.embedding);
    if (!v) continue;
    if (expectedDim === 0) expectedDim = v.length;
    if (v.length !== expectedDim) continue;
    usable.push({ row: r, vec: v });
  }
  if (usable.length < 2) return [];

  const reduced = pca2d(usable.map((u) => u.vec));
  if (!reduced) return [];

  // Normalise to roughly [-1, +1] so the front-end can scale to canvas size
  // without knowing the original variance.
  let maxAbs = 0;
  for (const [x, y] of reduced) {
    const a = Math.max(Math.abs(x), Math.abs(y));
    if (a > maxAbs) maxAbs = a;
  }
  const scale = maxAbs > 0 ? 1 / maxAbs : 1;

  return usable.map((u, i) => {
    const [rx, ry] = reduced[i];
    let themes: string[] = [];
    if (u.row.themes) {
      try {
        const t = JSON.parse(u.row.themes);
        if (Array.isArray(t)) {
          themes = t
            .filter((x): x is string => typeof x === "string")
            .slice(0, 5);
        }
      } catch {
        // ignore
      }
    }
    return {
      page_id: u.row.page_id,
      x: rx * scale,
      y: ry * scale,
      entry_date: u.row.entry_date,
      notebook_name: u.row.notebook_name,
      page_index: u.row.page_index,
      sentiment: u.row.sentiment,
      themes,
      summary: u.row.summary || "",
      preview: u.row.ocr_text.slice(0, 200),
    };
  });
}
