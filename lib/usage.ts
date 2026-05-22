import { db } from "@/lib/db";

// Per-model prices in USD per million tokens. Cache writes are 1.25x input,
// cache reads are 0.1x input. These are Anthropic list prices — the figure
// shown in the app is an estimate; the Anthropic console invoice is the
// source of truth. Rows store the cost computed at insert time, so changing
// these later only affects future usage.
type Prices = {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
};

const PRICES: Record<string, Prices> = {
  "claude-opus-4-7": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-opus-4-6": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-opus-4-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-sonnet-4-5": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};

// If a model isn't in the table, fall back to Opus pricing so we never
// under-report a real cost.
const FALLBACK: Prices = { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 };

// Match an exact model id, or a dated/variant suffix (e.g.
// "claude-haiku-4-5-20251001" → "claude-haiku-4-5"), else Opus fallback.
function priceFor(model: string): Prices {
  if (PRICES[model]) return PRICES[model];
  const key = Object.keys(PRICES).find((k) => model.startsWith(k));
  return key ? PRICES[key] : FALLBACK;
}

type UsageLike = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/** Record token usage + estimated cost for one Claude call. Never throws. */
export function recordUsage(
  feature: string,
  model: string,
  usage: UsageLike | null | undefined
) {
  if (!usage) return;
  try {
    const p = priceFor(model);
    const input = usage.input_tokens ?? 0;
    const output = usage.output_tokens ?? 0;
    const cacheWrite = usage.cache_creation_input_tokens ?? 0;
    const cacheRead = usage.cache_read_input_tokens ?? 0;
    const cost =
      (input * p.input +
        output * p.output +
        cacheWrite * p.cacheWrite +
        cacheRead * p.cacheRead) /
      1_000_000;
    db()
      .prepare(
        `INSERT INTO api_usage(feature, model, input_tokens, output_tokens,
           cache_creation_tokens, cache_read_tokens, cost_usd)
         VALUES(?,?,?,?,?,?,?)`
      )
      .run(feature, model, input, output, cacheWrite, cacheRead, cost);
  } catch {
    // usage logging must never break a real request
  }
}

// SQLite modifier that converts a stored UTC timestamp to the viewer's local
// time. tzMinutes is minutes to ADD to UTC (e.g. +540 for Seoul, UTC+9).
function tzModifier(tzMinutes: number): string {
  const n = Math.max(-840, Math.min(840, Math.trunc(tzMinutes || 0)));
  return `${n >= 0 ? "+" : "-"}${Math.abs(n)} minutes`;
}

export function totalUsage(): number {
  const row = db()
    .prepare(`SELECT COALESCE(SUM(cost_usd), 0) AS cost FROM api_usage`)
    .get() as { cost: number };
  return row.cost;
}

export function monthlyUsage(month: string, tzMinutes: number) {
  const mod = tzModifier(tzMinutes);
  const days = db()
    .prepare(
      `SELECT date(created_at, ?) AS day, SUM(cost_usd) AS cost, COUNT(*) AS calls
       FROM api_usage
       WHERE strftime('%Y-%m', created_at, ?) = ?
       GROUP BY day ORDER BY day`
    )
    .all(mod, mod, month) as Array<{ day: string; cost: number; calls: number }>;
  const total = days.reduce((s, d) => s + (d.cost || 0), 0);
  const calls = days.reduce((s, d) => s + (d.calls || 0), 0);
  return { days, total, calls };
}

export function dailyUsage(date: string, tzMinutes: number) {
  const mod = tzModifier(tzMinutes);
  const byFeature = db()
    .prepare(
      `SELECT feature, SUM(cost_usd) AS cost, COUNT(*) AS calls,
              SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens,
              SUM(cache_read_tokens) AS cache_read_tokens
       FROM api_usage
       WHERE date(created_at, ?) = ?
       GROUP BY feature ORDER BY cost DESC`
    )
    .all(mod, date) as Array<{
    feature: string;
    cost: number;
    calls: number;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
  }>;
  const total = byFeature.reduce((s, f) => s + (f.cost || 0), 0);
  return { date, byFeature, total };
}
