"use client";

import { useEffect, useMemo, useState } from "react";

// All four visualisations on one page. Each section is self-contained so a
// failure in one (e.g. embeddings disabled) doesn't blank the rest.

type HeatmapBucket = { date: string; pages: number; chars: number };
type ThemeBucket = { theme: string; count: number; sample_page_ids: string[] };
type SentimentPoint = { date: string; avg_sentiment: number; n: number };
type MapPoint = {
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

type MindData = {
  heatmap: HeatmapBucket[];
  themes: ThemeBucket[];
  sentiment: SentimentPoint[];
  embeddingMap: MapPoint[];
  counts: { analyzed: number; pending: number };
  embeddingsEnabled: boolean;
};

export default function MindPage() {
  const [data, setData] = useState<MindData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/mind");
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `Failed (${r.status})`);
      }
      setData(await r.json());
    } catch (e) {
      setError((e as Error).message || "Couldn't load mind data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function analyze(limit: number) {
    setAnalyzing(true);
    setAnalyzeMsg(null);
    try {
      const r = await fetch(`/api/mind/analyze?limit=${limit}`, {
        method: "POST",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setAnalyzeMsg(
        `Analysed ${d.analyzed} entries${
          d.failed ? ` (${d.failed} failed)` : ""
        }. ${d.remaining} pending.`
      );
      await load();
    } catch (e) {
      setAnalyzeMsg((e as Error).message || "Analyse failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Your mind</h1>
        <p className="opacity-70 text-sm">
          Patterns surfaced from your diary: when you write, what you write
          about, how you feel, and how your entries cluster by meaning.
        </p>
      </header>

      <section className="rounded border border-stone-200 dark:border-stone-800 p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs opacity-70">
            Analysed {data?.counts.analyzed ?? "…"} ·{" "}
            {data?.counts.pending ?? "…"} pending
          </span>
          {data && data.counts.pending > 0 && (
            <>
              <button
                disabled={analyzing}
                onClick={() => analyze(Math.min(25, data.counts.pending))}
                className="rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {analyzing ? "Analysing…" : `Analyse next ${Math.min(25, data.counts.pending)}`}
              </button>
              {data.counts.pending > 25 && (
                <button
                  disabled={analyzing}
                  onClick={() => analyze(Math.min(200, data.counts.pending))}
                  className="rounded border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Analyse up to 200
                </button>
              )}
            </>
          )}
          {data && data.counts.pending === 0 && data.counts.analyzed > 0 && (
            <span className="text-[11px] opacity-50">All caught up.</span>
          )}
        </div>
        {analyzeMsg && (
          <p className="text-xs opacity-70">{analyzeMsg}</p>
        )}
        <p className="text-[11px] opacity-50">
          Analysis costs about $0.001–0.005 per entry (chat-tier model) and is
          cached — every chart on this page is free to view once your entries
          are analysed.
        </p>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && !data && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 rounded border border-stone-200 dark:border-stone-800 animate-pulse opacity-30"
            />
          ))}
        </div>
      )}

      {data && (
        <>
          <Heatmap data={data.heatmap} />
          <ThemeCloud data={data.themes} />
          <SentimentChart data={data.sentiment} />
          <EmbeddingMap
            data={data.embeddingMap}
            embeddingsEnabled={data.embeddingsEnabled}
          />
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 1. Calendar heatmap — last 52 weeks, GitHub-style. Mobile-first: horizontal
// scroll, week columns of 7-day rows.
// ──────────────────────────────────────────────────────────────────────────

function Heatmap({ data }: { data: HeatmapBucket[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 53 weeks back to today, ending on this Saturday so the right edge is
  // "this week".
  const weeks = 53;
  const days = weeks * 7;
  const start = new Date(today);
  start.setDate(start.getDate() - days + 1);
  // Snap start back to a Sunday so the grid aligns.
  start.setDate(start.getDate() - start.getDay());

  const byDate = new Map(data.map((d) => [d.date, d]));
  const maxPages = data.reduce((m, d) => Math.max(m, d.pages), 0) || 1;

  const cells: Array<{ date: string; pages: number; row: number; col: number }> = [];
  for (let i = 0; i < weeks * 7; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    const iso = dt.toISOString().slice(0, 10);
    const b = byDate.get(iso);
    cells.push({
      date: iso,
      pages: b?.pages || 0,
      row: dt.getDay(),
      col: Math.floor(i / 7),
    });
  }

  // Month labels: pick the first column where each month starts.
  const monthLabels: Array<{ col: number; label: string }> = [];
  let lastMonth = -1;
  for (let c = 0; c < weeks; c++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + c * 7);
    if (dt.getMonth() !== lastMonth) {
      monthLabels.push({
        col: c,
        label: dt.toLocaleString("default", { month: "short" }),
      });
      lastMonth = dt.getMonth();
    }
  }

  const cellSize = 11;
  const gap = 2;
  const width = weeks * (cellSize + gap);
  const height = 7 * (cellSize + gap) + 14;

  const shade = (pages: number) => {
    if (pages === 0) return "rgb(231, 229, 228)"; // stone-200
    const t = Math.min(1, pages / maxPages);
    // Warm amber ramp.
    const r = Math.round(254 - 90 * t);
    const g = Math.round(243 - 130 * t);
    const b = Math.round(199 - 180 * t);
    return `rgb(${r}, ${g}, ${b})`;
  };

  if (data.length === 0) {
    return (
      <Section title="When you write">
        <p className="opacity-60 text-sm">
          No dated entries yet. Once your diary pages have parsed dates, they
          show up here.
        </p>
      </Section>
    );
  }

  return (
    <Section
      title="When you write"
      subtitle={`Last 52 weeks. Each cell is one day; darker = more pages. ${data.length} day${data.length === 1 ? "" : "s"} with entries.`}
    >
      <div className="overflow-x-auto -mx-3 px-3">
        <svg
          width={width + 16}
          height={height}
          viewBox={`0 0 ${width + 16} ${height}`}
          role="img"
          aria-label="Writing volume by day, last year"
        >
          {monthLabels.map((m) => (
            <text
              key={m.col}
              x={16 + m.col * (cellSize + gap)}
              y={10}
              fontSize="9"
              className="fill-stone-500 dark:fill-stone-400"
            >
              {m.label}
            </text>
          ))}
          {cells.map((c) => (
            <rect
              key={c.date}
              x={16 + c.col * (cellSize + gap)}
              y={14 + c.row * (cellSize + gap)}
              width={cellSize}
              height={cellSize}
              rx={2}
              fill={shade(c.pages)}
            >
              <title>
                {c.date}: {c.pages} page{c.pages === 1 ? "" : "s"}
              </title>
            </rect>
          ))}
        </svg>
      </div>
    </Section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 2. Theme cloud — text sized by frequency. Tag-cloud style with sensible
// min/max font sizes so it's readable on a phone.
// ──────────────────────────────────────────────────────────────────────────

function ThemeCloud({ data }: { data: ThemeBucket[] }) {
  if (data.length === 0) {
    return (
      <Section title="What you write about">
        <p className="opacity-60 text-sm">
          Run the analyser above to surface the themes in your diary.
        </p>
      </Section>
    );
  }
  const max = data[0]?.count || 1;
  const min = data[data.length - 1]?.count || 1;
  const fontFor = (c: number) => {
    if (max === min) return 18;
    const t = (c - min) / (max - min);
    return Math.round(13 + t * 22); // 13 → 35 px
  };
  return (
    <Section
      title="What you write about"
      subtitle={`Top ${data.length} themes Claude extracted from your entries. Bigger = more often.`}
    >
      <div className="flex flex-wrap gap-x-3 gap-y-1 items-baseline leading-snug">
        {data.map((t) => (
          <span
            key={t.theme}
            title={`${t.count} entr${t.count === 1 ? "y" : "ies"}`}
            style={{ fontSize: fontFor(t.count) }}
            className="opacity-80 hover:opacity-100"
          >
            {t.theme}
          </span>
        ))}
      </div>
    </Section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 3. Sentiment line chart — average mood per day, drawn as an SVG path with
// a smoothed (3-day rolling mean) overlay so a noisy daily signal still
// shows the trend.
// ──────────────────────────────────────────────────────────────────────────

function SentimentChart({ data }: { data: SentimentPoint[] }) {
  const chart = useMemo(() => {
    if (data.length === 0) return null;
    // Plot only the last 180 days (or all if fewer) so the timeline is
    // legible on a phone.
    const recent = data.slice(-180);
    const w = 700;
    const h = 180;
    const padL = 32;
    const padR = 10;
    const padT = 12;
    const padB = 22;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;

    const xAt = (i: number) =>
      padL + (recent.length === 1 ? innerW / 2 : (i / (recent.length - 1)) * innerW);
    const yAt = (v: number) => padT + innerH * (0.5 - v / 2); // -1..+1 → bottom..top

    const points = recent.map((p, i) => ({
      x: xAt(i),
      y: yAt(p.avg_sentiment),
      date: p.date,
      v: p.avg_sentiment,
      n: p.n,
    }));

    // 3-day rolling mean for the trend line.
    const smoothed: typeof points = recent.map((_, i) => {
      const lo = Math.max(0, i - 1);
      const hi = Math.min(recent.length - 1, i + 1);
      let s = 0;
      let c = 0;
      for (let k = lo; k <= hi; k++) {
        s += recent[k].avg_sentiment;
        c++;
      }
      return {
        x: xAt(i),
        y: yAt(s / c),
        date: recent[i].date,
        v: s / c,
        n: recent[i].n,
      };
    });

    const path = (pts: typeof points) =>
      pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

    return { w, h, padL, padR, padT, padB, innerW, innerH, points, smoothed, path, yAt };
  }, [data]);

  if (data.length === 0) {
    return (
      <Section title="How you've felt">
        <p className="opacity-60 text-sm">
          Run the analyser to see your mood timeline.
        </p>
      </Section>
    );
  }

  if (!chart) return null;

  return (
    <Section
      title="How you've felt"
      subtitle={`Average sentiment per day from your entries. ${data.length} day${data.length === 1 ? "" : "s"} of signal.`}
    >
      <div className="overflow-x-auto -mx-3 px-3">
        <svg
          width="100%"
          viewBox={`0 0 ${chart.w} ${chart.h}`}
          role="img"
          aria-label="Mood over time"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines + axis labels */}
          {[-1, -0.5, 0, 0.5, 1].map((v) => (
            <g key={v}>
              <line
                x1={chart.padL}
                y1={chart.yAt(v)}
                x2={chart.w - chart.padR}
                y2={chart.yAt(v)}
                stroke="currentColor"
                strokeOpacity={v === 0 ? 0.25 : 0.08}
              />
              <text
                x={chart.padL - 6}
                y={chart.yAt(v) + 3}
                fontSize="9"
                textAnchor="end"
                className="fill-stone-500"
              >
                {v > 0 ? "+" : ""}{v}
              </text>
            </g>
          ))}
          {/* Raw daily points */}
          {chart.points.map((p) => (
            <circle
              key={p.date}
              cx={p.x}
              cy={p.y}
              r={2}
              fill={p.v >= 0 ? "rgb(217,119,6)" : "rgb(120,113,108)"}
              opacity={0.4}
            >
              <title>
                {p.date}: {p.v.toFixed(2)} (n={p.n})
              </title>
            </circle>
          ))}
          {/* Smoothed trend */}
          <path
            d={chart.path(chart.smoothed)}
            fill="none"
            stroke="rgb(217,119,6)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Edge dates */}
          <text
            x={chart.padL}
            y={chart.h - 6}
            fontSize="9"
            className="fill-stone-500"
          >
            {data[Math.max(0, data.length - 180)].date}
          </text>
          <text
            x={chart.w - chart.padR}
            y={chart.h - 6}
            fontSize="9"
            textAnchor="end"
            className="fill-stone-500"
          >
            {data[data.length - 1].date}
          </text>
        </svg>
      </div>
    </Section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 4. Embedding map — 2D scatter of every entry, points coloured by sentiment
// when known. Tap a point to see the tooltip.
// ──────────────────────────────────────────────────────────────────────────

function EmbeddingMap({
  data,
  embeddingsEnabled,
}: {
  data: MapPoint[];
  embeddingsEnabled: boolean;
}) {
  const [active, setActive] = useState<MapPoint | null>(null);

  if (!embeddingsEnabled) {
    return (
      <Section title="Map of your mind">
        <p className="opacity-60 text-sm">
          Set <code>VOYAGE_API_KEY</code> in Railway to enable the embedding
          map. Each entry becomes a point; similar entries cluster together.
        </p>
      </Section>
    );
  }
  if (data.length < 2) {
    return (
      <Section title="Map of your mind">
        <p className="opacity-60 text-sm">
          Need at least two entries with embeddings. They&rsquo;re generated
          automatically when notebooks are transcribed.
        </p>
      </Section>
    );
  }

  const w = 700;
  const h = 460;
  const pad = 18;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  // Points come in [-1, +1]; map to inner box.
  const toX = (x: number) => pad + ((x + 1) / 2) * innerW;
  const toY = (y: number) => pad + ((1 - (y + 1) / 2)) * innerH;

  const color = (s: number | null) => {
    if (s == null) return "rgb(120,113,108)"; // stone-500
    if (s > 0) return `rgba(217,119,6,${Math.min(1, 0.35 + s * 0.5)})`;
    return `rgba(70,90,180,${Math.min(1, 0.35 + Math.abs(s) * 0.5)})`;
  };

  return (
    <Section
      title="Map of your mind"
      subtitle={`${data.length} entries projected to 2D (PCA on Voyage embeddings). Closer = more similar in meaning. Colour: orange = positive, blue = negative, grey = un-analysed.`}
    >
      <div className="overflow-x-auto -mx-3 px-3">
        <svg
          width="100%"
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label="Embedding map of diary entries"
          onClick={() => setActive(null)}
          preserveAspectRatio="xMidYMid meet"
        >
          <rect
            x={0}
            y={0}
            width={w}
            height={h}
            fill="currentColor"
            opacity={0.02}
          />
          {data.map((p) => (
            <circle
              key={p.page_id}
              cx={toX(p.x)}
              cy={toY(p.y)}
              r={4}
              fill={color(p.sentiment)}
              stroke={active?.page_id === p.page_id ? "currentColor" : "none"}
              strokeWidth={1.5}
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                setActive(p);
              }}
            >
              <title>
                {p.entry_date || "(no date)"} — {p.notebook_name} · p
                {p.page_index + 1}
                {p.themes.length > 0 ? `\n${p.themes.join(", ")}` : ""}
                {p.summary ? `\n${p.summary}` : ""}
              </title>
            </circle>
          ))}
        </svg>
      </div>
      {active && (
        <div className="mt-2 rounded border border-stone-200 dark:border-stone-800 p-2 text-xs space-y-1">
          <p className="opacity-60">
            {active.entry_date || "(no date)"} · {active.notebook_name} · page{" "}
            {active.page_index + 1}
            {active.sentiment != null && (
              <> · sentiment {active.sentiment.toFixed(2)}</>
            )}
          </p>
          {active.themes.length > 0 && (
            <p className="opacity-90">
              {active.themes.map((t) => (
                <span
                  key={t}
                  className="inline-block mr-1 mb-1 rounded bg-stone-200 dark:bg-stone-800 px-1.5 py-0.5"
                >
                  {t}
                </span>
              ))}
            </p>
          )}
          {active.summary && <p>{active.summary}</p>}
          {!active.summary && active.preview && (
            <p className="opacity-70 whitespace-pre-wrap">{active.preview}…</p>
          )}
        </div>
      )}
    </Section>
  );
}

// Section wrapper — keeps every chart visually consistent.
function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <header>
        <h2 className="text-lg font-medium">{title}</h2>
        {subtitle && <p className="text-xs opacity-60">{subtitle}</p>}
      </header>
      <div className="rounded border border-stone-200 dark:border-stone-800 p-3">
        {children}
      </div>
    </section>
  );
}
