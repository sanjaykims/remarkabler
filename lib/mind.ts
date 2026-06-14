import { db } from "@/lib/db";
import { analyzeEntryContent } from "@/lib/claude";
import { decodeEmbedding } from "@/lib/embeddings";
import { DISCIPLINE_ID } from "@/lib/notes";

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

// "Discipline" notebook (synced from a GitHub repo) is excluded from
// analysis: it reflects external rules / reading material, not the user's
// own diary, and would skew the theme cloud and mood timeline if included.
// The notebook's ID is the fixed sentinel DISCIPLINE_ID — earlier versions
// of this file matched on `name = 'discipline'`, which never hit because
// the row is stored with a label like "Discipline (owner/repo)".
function disciplineNotebookId(): string {
  return DISCIPLINE_ID;
}

function pendingPagesSql(excludeId: string, limit: number) {
  return {
    sql: `SELECT p.id, p.ocr_text
            FROM pages p
            LEFT JOIN entry_analysis a ON a.page_id = p.id
            WHERE p.ocr_text IS NOT NULL
              AND p.ocr_text != ''
              AND a.page_id IS NULL
              AND p.notebook_id != ?
            ORDER BY p.entry_date IS NULL ASC, p.entry_date DESC, p.id DESC
            LIMIT ?`,
    params: [excludeId, limit] as Array<string | number>,
  };
}

export function countPending(): number {
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS c
         FROM pages p
         LEFT JOIN entry_analysis a ON a.page_id = p.id
         WHERE p.ocr_text IS NOT NULL
           AND p.ocr_text != ''
           AND a.page_id IS NULL
           AND p.notebook_id != ?`
    )
    .get(disciplineNotebookId()) as { c: number };
  return row.c;
}

export function countAnalyzed(): number {
  const row = db()
    .prepare(`SELECT COUNT(*) AS c FROM entry_analysis`)
    .get() as { c: number };
  return row.c;
}

// Module-level in-flight guard. better-sqlite3 is synchronous so DB-level
// races are limited, but the async Claude calls between SELECT and UPSERT
// create a window where two overlapping callers (e.g. the upload-triggered
// auto-analysis + a user click on "Analyse next 25") could each pick the
// same rows and double-bill Claude for them. Reject the second caller
// quickly instead of letting it duplicate work.
let analyzePendingInFlight = false;

export async function analyzePending(
  limit: number = ANALYZE_DEFAULT_LIMIT
): Promise<{
  analyzed: number;
  failed: number;
  remaining: number;
  skipped?: "in-flight";
}> {
  if (analyzePendingInFlight) {
    return {
      analyzed: 0,
      failed: 0,
      remaining: countPending(),
      skipped: "in-flight",
    };
  }
  analyzePendingInFlight = true;
  try {
    const n = Math.max(1, Math.min(ANALYZE_MAX_LIMIT, Math.floor(limit)));
    const { sql, params } = pendingPagesSql(disciplineNotebookId(), n);
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
      let result: Awaited<ReturnType<typeof analyzeEntryContent>> = null;
      try {
        result = await analyzeEntryContent(row.ocr_text);
      } catch (e) {
        // Claude error (network, 5xx, parse). Skip this page, continue the
        // loop — one bad page should never abort an entire backfill.
        console.warn(
          "[mind] analyze (claude) failed:",
          row.id,
          (e as Error).message
        );
        failed++;
        continue;
      }
      if (!result) {
        failed++;
        continue;
      }
      try {
        upsert.run(
          row.id,
          JSON.stringify(result.themes),
          result.sentiment,
          result.summary || null,
          model
        );
        analyzed++;
      } catch (e) {
        // DB write failed (busy / locked / FK violation if the page was just
        // deleted). Don't kill the loop — log and move on.
        console.warn(
          "[mind] analyze (db) failed:",
          row.id,
          (e as Error).message
        );
        failed++;
      }
    }
    return { analyzed, failed, remaining: countPending() };
  } finally {
    analyzePendingInFlight = false;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Aggregations — all pure SQL / pure JS over the cached results. Cheap to
// hit repeatedly, no Claude calls.
// ──────────────────────────────────────────────────────────────────────────

export type HeatmapBucket = { date: string; pages: number; chars: number };

// The diary's own entry_date is parsed from a "YYYY-MM-DD-HHMM-KST" timestamp
// the user writes at the top of each session, so only the first page of a
// session has it — every other page falls back to the sentinel 'none' and
// would never show on a heatmap of writing volume. To make the chart useful
// out of the box, we COALESCE to the notebook's upload date when entry_date
// is missing. That means the heatmap reflects "writing days" rather than
// strictly "diary days", which is a more forgiving signal.
const EFFECTIVE_DATE_SQL = `
  COALESCE(
    NULLIF(p.entry_date, 'none'),
    date(n.synced_at)
  )`;

export function getHeatmap(): HeatmapBucket[] {
  return db()
    .prepare(
      `SELECT ${EFFECTIVE_DATE_SQL} AS date,
              COUNT(*)               AS pages,
              SUM(LENGTH(p.ocr_text)) AS chars
         FROM pages p
         JOIN notebooks n ON n.id = p.notebook_id
         WHERE p.ocr_text IS NOT NULL AND p.ocr_text != ''
           AND ${EFFECTIVE_DATE_SQL} IS NOT NULL
         GROUP BY ${EFFECTIVE_DATE_SQL}
         ORDER BY date ASC`
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
  // Same fallback story as the heatmap — when no diary-date is parsable,
  // attribute the mood to the upload day so the line shows something.
  return db()
    .prepare(
      `SELECT ${EFFECTIVE_DATE_SQL} AS date,
              AVG(a.sentiment)       AS avg_sentiment,
              COUNT(*)               AS n
         FROM pages p
         JOIN notebooks n ON n.id = p.notebook_id
         JOIN entry_analysis a ON a.page_id = p.id
         WHERE a.sentiment IS NOT NULL
           AND ${EFFECTIVE_DATE_SQL} IS NOT NULL
         GROUP BY ${EFFECTIVE_DATE_SQL}
         ORDER BY date ASC`
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
  z: number;
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

// PCA reducing to k dimensions via repeated power-iteration with deflation.
// Each successive principal component is found on the residual after
// projecting out the previous PCs (X' = X − Xv₁v₁ᵀ → X'ᵀX' = XᵀX − λ₁v₁v₁ᵀ),
// which is the textbook deflation and stays well-conditioned in Float32 for
// the dim (1024) × n (≤500) regime this app sees.
function pcaNd(vectors: Float32Array[], k: number): Array<number[]> | null {
  const n = vectors.length;
  if (n === 0) return [];
  const dim = vectors[0].length;
  if (dim === 0) return null;
  const components = Math.min(k, dim, n);
  if (components === 0) return vectors.map(() => []);

  // Centre.
  const mean = new Float32Array(dim);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) mean[i] += v[i];
  }
  for (let i = 0; i < dim; i++) mean[i] /= n;

  // `working` is the running residual — starts at the centred data, gets
  // deflated in-place after each PC so memory stays at O(n · dim) rather
  // than O(k · n · dim).
  const working: Float32Array[] = vectors.map((v) => {
    const c = new Float32Array(dim);
    for (let i = 0; i < dim; i++) c[i] = v[i] - mean[i];
    return c;
  });

  // Matrix-vector product (XᵀX) v computed implicitly: y = X v, then result
  // = Xᵀy. Never materialises the dim×dim covariance.
  const makeXtx = (mat: Float32Array[]) => (v: Vec): Vec => {
    const y = new Float32Array(n);
    for (let r = 0; r < n; r++) {
      const row = mat[r];
      let s = 0;
      for (let i = 0; i < dim; i++) s += row[i] * v[i];
      y[r] = s;
    }
    const out = new Float32Array(dim);
    for (let r = 0; r < n; r++) {
      const row = mat[r];
      const yr = y[r];
      for (let i = 0; i < dim; i++) out[i] += row[i] * yr;
    }
    return out;
  };

  const pcs: Float32Array[] = [];
  for (let kk = 0; kk < components; kk++) {
    const pc = powerIterTopEigenvector(makeXtx(working), dim);
    pcs.push(pc);
    // Deflate: subtract the rank-1 projection onto pc from every row.
    for (let r = 0; r < n; r++) {
      const row = working[r];
      let proj = 0;
      for (let i = 0; i < dim; i++) proj += row[i] * pc[i];
      for (let i = 0; i < dim; i++) row[i] -= proj * pc[i];
    }
  }

  // Project each centred-from-original vector onto each principal component.
  // (working has been deflated in place, so recompute centred for projection.)
  const points: Array<number[]> = [];
  for (let r = 0; r < n; r++) {
    const centred = new Float32Array(dim);
    for (let i = 0; i < dim; i++) centred[i] = vectors[r][i] - mean[i];
    const coords: number[] = new Array(components);
    for (let c = 0; c < components; c++) {
      const pc = pcs[c];
      let s = 0;
      for (let i = 0; i < dim; i++) s += centred[i] * pc[i];
      coords[c] = s;
    }
    points.push(coords);
  }
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

  const reduced = pcaNd(
    usable.map((u) => u.vec),
    3
  );
  if (!reduced) return [];

  // Normalise to roughly [-1, +1] across all three axes so the front-end can
  // scale to canvas/scene size without knowing the original variance.
  let maxAbs = 0;
  for (const coords of reduced) {
    for (const v of coords) {
      const a = Math.abs(v);
      if (a > maxAbs) maxAbs = a;
    }
  }
  const scale = maxAbs > 0 ? 1 / maxAbs : 1;

  return usable.map((u, i) => {
    const [rx, ry, rz] = reduced[i];
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
      z: (rz ?? 0) * scale,
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
