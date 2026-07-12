"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { EntityRank } from "@/lib/mind";
import { Section } from "@/components/Section";

// The 3D map uses three.js / react-three-fiber which need `window`, so it
// must be client-only. next/dynamic with ssr:false defers the chunk load
// until this page is open — no cost to other tabs in the app.
const Map3D = dynamic(() => import("./Map3D"), {
  ssr: false,
  loading: () => (
    <div
      className="h-[480px] rounded border border-slate-200 dark:border-slate-800 animate-pulse opacity-30"
      role="status"
      aria-label="Loading 3D map"
    />
  ),
});

// All four visualisations on one page. Each section is self-contained so a
// failure in one (e.g. embeddings disabled) doesn't blank the rest.

type HeatmapBucket = { date: string; pages: number; chars: number };
type ThemeBucket = { theme: string; count: number; sample_page_ids: string[] };
type SentimentPoint = { date: string; avg_sentiment: number; n: number };
type MapPoint = {
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

type AxisLabels = {
  pc1: { positive: string; negative: string };
  pc2: { positive: string; negative: string };
  pc3: { positive: string; negative: string };
};

type MindData = {
  heatmap: HeatmapBucket[];
  themes: ThemeBucket[];
  sentiment: SentimentPoint[];
  embeddingMap: MapPoint[];
  axisLabels: AxisLabels | null;
  entities: { people: EntityRank[]; places: EntityRank[]; projects: EntityRank[] };
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
      if (d.skipped === "in-flight") {
        setAnalyzeMsg(
          "Another analysis is already running (probably from a recent upload). Try again in a moment."
        );
      } else {
        setAnalyzeMsg(
          `Analysed ${d.analyzed} entries${
            d.failed ? ` (${d.failed} failed)` : ""
          }. ${d.remaining} pending.`
        );
      }
      await load();
    } catch (e) {
      setAnalyzeMsg((e as Error).message || "Analyse failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  const [labelling, setLabelling] = useState(false);
  // Last-attempt label result, surfaced so the user can see exactly what
  // came back instead of guessing why nothing rendered.
  const [labelDebug, setLabelDebug] = useState<{
    labels?: AxisLabels | null;
    raw?: string;
    error?: string;
  } | null>(null);
  async function labelAxes() {
    setLabelling(true);
    setAnalyzeMsg(null);
    setLabelDebug(null);
    try {
      const r = await fetch("/api/mind/axis-labels", { method: "POST" });
      const d = await r.json();
      // Stash whatever came back so we can render it below the buttons.
      setLabelDebug({ labels: d.labels, raw: d.raw, error: d.error });
      if (!r.ok) throw new Error(d.error || "Failed");
      if (d.skipped === "in-flight") {
        setAnalyzeMsg("Labelling is already running. Try again in a moment.");
      } else if (d.error) {
        setAnalyzeMsg(d.error);
      } else if (d.labels) {
        // Show the six labels directly in the message — no map navigation
        // needed to confirm Claude actually answered.
        const fmt = (k: "pc1" | "pc2" | "pc3", axis: string) =>
          `${axis}: ${d.labels[k].positive} ↔ ${d.labels[k].negative}`;
        setAnalyzeMsg(
          `Labelled ${d.n_entries} entries · ${fmt("pc1", "X")} · ${fmt("pc2", "Y")} · ${fmt("pc3", "Z")}`
        );
      } else {
        setAnalyzeMsg("Labelling returned no labels — see details below.");
      }
      await load();
    } catch (e) {
      setAnalyzeMsg((e as Error).message || "Labelling failed.");
    } finally {
      setLabelling(false);
    }
  }

  const [reparsing, setReparsing] = useState(false);
  async function reparseDates() {
    setReparsing(true);
    setAnalyzeMsg(null);
    try {
      const r = await fetch("/api/mind/reparse-dates", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setAnalyzeMsg(
        `Re-parsed entry dates: ${d.updated} of ${d.total} pages updated.`
      );
      await load();
    } catch (e) {
      setAnalyzeMsg((e as Error).message || "Re-parse failed.");
    } finally {
      setReparsing(false);
    }
  }

  const [reanalyzing, setReanalyzing] = useState(false);
  async function reanalyzeAll() {
    if (
      !confirm(
        "Re-analyse all entries in English? This clears the cached themes / mood / summaries and re-runs Claude on every entry. Roughly $0.10–0.30 in total. Continue?"
      )
    ) {
      return;
    }
    setReanalyzing(true);
    setAnalyzeMsg(null);
    try {
      const r = await fetch("/api/mind/reanalyze", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setAnalyzeMsg(
        d.message ||
          "Re-analysis started in the background. Refresh in a minute or two."
      );
      await load();
    } catch (e) {
      setAnalyzeMsg((e as Error).message || "Re-analyse failed.");
    } finally {
      setReanalyzing(false);
    }
  }

  const [merging, setMerging] = useState(false);
  async function mergeDuplicates() {
    if (
      !confirm(
        "Ask Claude to find and merge duplicate names (e.g. 야오팡 = Yaofang) across your people, places, and projects? It merges only clear duplicates and remembers them for future entries. Costs a few cents. Continue?"
      )
    ) {
      return;
    }
    setMerging(true);
    setAnalyzeMsg(null);
    try {
      const r = await fetch("/api/mind/merge-entities", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      if (!d.merged) {
        setAnalyzeMsg("No duplicate names found — nothing to merge.");
      } else {
        const detail = (d.groups || [])
          .map(
            (g: { canonical: string; aliases: string[] }) =>
              `${g.aliases.join(", ")} → ${g.canonical}`
          )
          .slice(0, 12)
          .join(" · ");
        setAnalyzeMsg(`Merged ${d.merged} duplicate name(s): ${detail}`);
      }
      await load();
    } catch (e) {
      setAnalyzeMsg((e as Error).message || "Merge failed.");
    } finally {
      setMerging(false);
    }
  }

  // Manual merge: fold explicit variant spellings into one canonical name
  // (for OCR variants / cross-script pairs Claude's conservative auto-merge
  // won't risk).
  const [manualOpen, setManualOpen] = useState(false);
  const [manualKind, setManualKind] = useState<"person" | "place" | "project">(
    "person"
  );
  const [manualCanonical, setManualCanonical] = useState("");
  const [manualVariants, setManualVariants] = useState("");
  const [manualMakeCanonical, setManualMakeCanonical] = useState(true);
  const [manualBusy, setManualBusy] = useState(false);
  async function mergeManual() {
    const canonical = manualCanonical.trim();
    const variants = manualVariants
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!canonical) {
      setAnalyzeMsg("Enter a canonical name.");
      return;
    }
    // With no variants, this is only meaningful as a canonical-only promotion
    // (checkbox on) — otherwise there's nothing to do.
    if (variants.length === 0 && !manualMakeCanonical) {
      setAnalyzeMsg("Add at least one variant to merge, or check “make canonical”.");
      return;
    }
    const confirmMsg =
      variants.length === 0
        ? `Promote "${canonical}" to the canonical ${manualKind} name (folding in whatever it was previously merged into)?`
        : `Merge ${variants.join(", ")} → "${canonical}" (as ${manualKind})? This rewrites them everywhere and remembers it for future entries.`;
    if (!confirm(confirmMsg)) {
      return;
    }
    setManualBusy(true);
    setAnalyzeMsg(null);
    try {
      const r = await fetch("/api/mind/merge-entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manual: {
            kind: manualKind,
            canonical,
            variants,
            makeCanonical: manualMakeCanonical,
          },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setAnalyzeMsg(
        `Merged ${d.merged} name(s) → "${d.canonical}"${
          d.rewritten ? ` (${d.rewritten} entity rows rewritten)` : ""
        }.`
      );
      setManualCanonical("");
      setManualVariants("");
      await load();
    } catch (e) {
      setAnalyzeMsg((e as Error).message || "Manual merge failed.");
    } finally {
      setManualBusy(false);
    }
  }

  const [buildingWiki, setBuildingWiki] = useState(false);
  async function buildWiki() {
    if (
      !confirm(
        "Build your 'life wiki' — a deep, Claude-written profile for each person, place, and project, read from your ENTIRE diary history (who they are, the relationship, how it evolved), saved into your Obsidian export. First full build costs roughly $3–8; after that only entities touched by new/edited entries are rewritten. It processes a batch per tap — keep tapping until it says 'up to date'. Continue?"
      )
    ) {
      return;
    }
    setBuildingWiki(true);
    setAnalyzeMsg(null);
    try {
      const r = await fetch("/api/mind/build-wiki", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      if (d.skipped === "in-flight") {
        setAnalyzeMsg("A wiki build is already running — try again in a moment.");
      } else if (!d.generated && !d.remaining) {
        setAnalyzeMsg("Life wiki is up to date — every entity profile is current.");
      } else {
        const more =
          d.remaining > 0
            ? ` ${d.remaining} still to go — tap “Build life wiki” again.`
            : " All entities done.";
        setAnalyzeMsg(`Wrote ${d.generated} entity profile(s).${more}`);
      }
      await load();
    } catch (e) {
      setAnalyzeMsg((e as Error).message || "Wiki build failed.");
    } finally {
      setBuildingWiki(false);
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

      <section className="rounded border border-slate-200 dark:border-slate-800 p-3 space-y-2">
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
                className="rounded bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900 px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {analyzing ? "Analysing…" : `Analyse next ${Math.min(25, data.counts.pending)}`}
              </button>
              {data.counts.pending > 25 && (
                <button
                  disabled={analyzing}
                  onClick={() => analyze(Math.min(200, data.counts.pending))}
                  className="rounded border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Analyse up to 200
                </button>
              )}
            </>
          )}
          {data && data.counts.pending === 0 && data.counts.analyzed > 0 && (
            <span className="text-[11px] opacity-50">All caught up.</span>
          )}
          <button
            disabled={reparsing || analyzing}
            onClick={reparseDates}
            title="Re-runs the YYYY-MM-DD-HH-MM-KST regex over every page and carries dates forward within each notebook."
            className="rounded border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs opacity-80 hover:opacity-100 disabled:opacity-40"
          >
            {reparsing ? "Re-parsing…" : "Re-parse dates"}
          </button>
          <button
            disabled={reanalyzing || analyzing}
            onClick={reanalyzeAll}
            title="Wipes the cached themes / mood / summaries and re-analyses every entry from scratch with English-only prompts. Costs roughly $0.10–0.30 in total. Runs in the background."
            className="rounded border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs opacity-80 hover:opacity-100 disabled:opacity-40"
          >
            {reanalyzing ? "Re-analysing…" : "Re-analyse in English"}
          </button>
          <button
            disabled={merging || analyzing}
            onClick={mergeDuplicates}
            title="Claude finds duplicate spellings of the same person/place/project (e.g. a Korean name and its romanization) and merges them into one name everywhere — graph, chat, and this page. Remembers each merge for future entries."
            className="rounded border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs opacity-80 hover:opacity-100 disabled:opacity-40"
          >
            {merging ? "Merging…" : "Merge duplicate names"}
          </button>
          <button
            disabled={buildingWiki || analyzing}
            onClick={buildWiki}
            title="Claude reads your ENTIRE diary history for each person, place, and project and writes a deep profile (who they are, the relationship, how it evolved) — a self-updating 'wiki of your life' in your Obsidian export. First build ~$3–8; then only entities touched by new/edited entries are rewritten."
            className="rounded border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs opacity-80 hover:opacity-100 disabled:opacity-40"
          >
            {buildingWiki ? "Building…" : "Build life wiki"}
          </button>
          <button
            onClick={() => setManualOpen((v) => !v)}
            title="Manually fold specific spellings (e.g. OCR variants of one name) into a single canonical name, for cases Claude's automatic merge won't catch."
            className="rounded border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs opacity-80 hover:opacity-100"
          >
            {manualOpen ? "Close manual merge" : "Merge specific names"}
          </button>
        </div>
        {manualOpen && (
          <div className="rounded border border-slate-200 dark:border-slate-800 p-3 space-y-2">
            <p className="text-xs opacity-70">
              Fold specific spellings into one canonical name — for OCR variants
              or cross-script pairs the automatic merge won&rsquo;t risk. It
              rewrites them everywhere and remembers each for future entries.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={manualKind}
                onChange={(e) =>
                  setManualKind(e.target.value as "person" | "place" | "project")
                }
                className="rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 text-xs"
              >
                <option value="person">person</option>
                <option value="place">place</option>
                <option value="project">project / subject</option>
              </select>
              <input
                type="text"
                value={manualCanonical}
                onChange={(e) => setManualCanonical(e.target.value)}
                placeholder="Canonical name (e.g. 야오팡)"
                spellCheck={false}
                className="min-w-0 flex-1 rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 text-xs"
              />
            </div>
            <input
              type="text"
              value={manualVariants}
              onChange={(e) => setManualVariants(e.target.value)}
              placeholder="Variants to merge in, comma-separated (e.g. 마오핑, 미오팡, 아오팡, 야오펑, Yaofang)"
              spellCheck={false}
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 text-xs"
            />
            <label className="flex items-start gap-2 text-[11px] opacity-70">
              <input
                type="checkbox"
                checked={manualMakeCanonical}
                onChange={(e) => setManualMakeCanonical(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Make the canonical name above the winning spelling — even if it
                was already merged into another name. Uncheck to fold into
                whatever is already the canonical instead.
              </span>
            </label>
            <button
              onClick={mergeManual}
              disabled={manualBusy}
              className="rounded bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900 px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {manualBusy ? "Merging…" : "Merge these"}
            </button>
          </div>
        )}
        {labelDebug && (labelDebug.labels || labelDebug.raw || labelDebug.error) && (
          <details className="rounded border border-slate-200 dark:border-slate-800 p-2 text-[11px] space-y-1">
            <summary className="cursor-pointer opacity-70">
              Last label attempt — tap to inspect
            </summary>
            {labelDebug.labels && (
              <div className="pt-1 space-y-0.5">
                <p className="opacity-60">Parsed labels:</p>
                {(["pc1", "pc2", "pc3"] as const).map((k, i) =>
                  labelDebug.labels?.[k] ? (
                    <p key={k}>
                      <span className="font-mono opacity-50">{["X", "Y", "Z"][i]}</span>{" "}
                      <span className="text-sky-600 dark:text-sky-400">
                        {labelDebug.labels[k].positive}
                      </span>{" "}
                      ↔{" "}
                      <span className="text-blue-600 dark:text-blue-400">
                        {labelDebug.labels[k].negative}
                      </span>
                    </p>
                  ) : null
                )}
              </div>
            )}
            {labelDebug.error && (
              <p className="text-red-600 dark:text-red-400 pt-1">
                Error: {labelDebug.error}
              </p>
            )}
            {labelDebug.raw && (
              <div className="pt-1">
                <p className="opacity-60">Raw Claude response:</p>
                <pre className="whitespace-pre-wrap break-words opacity-80 bg-slate-100 dark:bg-slate-900 p-2 rounded">
                  {labelDebug.raw}
                </pre>
              </div>
            )}
          </details>
        )}
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
              className="h-32 rounded border border-slate-200 dark:border-slate-800 animate-pulse opacity-30"
            />
          ))}
        </div>
      )}

      {data && (
        <>
          <Heatmap data={data.heatmap} />
          <ThemeCloud data={data.themes} />
          <EntityRankings data={data.entities} />
          <SentimentChart data={data.sentiment} />
          <EmbeddingMap
            data={data.embeddingMap}
            embeddingsEnabled={data.embeddingsEnabled}
            axisLabels={data.axisLabels}
            labelling={labelling}
            onLabelAxes={labelAxes}
          />
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 1. Calendar heatmap — last 26 weeks (~6 months), GitHub-style. The window
// is anchored on `new Date()` at render time, so as days pass the grid
// scrolls forward automatically. Mobile-first: horizontal scroll, week
// columns of 7-day rows.
// ──────────────────────────────────────────────────────────────────────────

function Heatmap({ data }: { data: HeatmapBucket[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 26 weeks (~6 months) back to today. `today` is recomputed on every
  // render, so the rightmost column is always the current week and the
  // leftmost is always 26 weeks ago — no manual rollover needed.
  const weeks = 26;
  const days = weeks * 7;
  const start = new Date(today);
  start.setDate(start.getDate() - days + 1);
  // Snap start back to a Sunday so the grid aligns.
  start.setDate(start.getDate() - start.getDay());

  const byDate = new Map(data.map((d) => [d.date, d]));

  // Build the ISO date from LOCAL components (not toISOString, which would
  // convert to UTC and shift the cell by a day for users away from UTC).
  // The diary's entry_date strings are themselves wall-clock dates (parsed
  // from KST timestamps the user writes), so matching against the local
  // calendar date is what makes the grid line up with how the user thinks
  // about "today".
  const localIso = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
      dt.getDate()
    ).padStart(2, "0")}`;

  // Restrict counts + shade scale to entries inside the visible window —
  // otherwise a noisy day from a year ago would dominate the colour ramp
  // and the "N days" footer would advertise data the user can't actually
  // see on the grid.
  const startIso = localIso(start);
  const endIso = localIso(today);
  const inWindow = data.filter((d) => d.date >= startIso && d.date <= endIso);
  const maxPages = inWindow.reduce((m, d) => Math.max(m, d.pages), 0) || 1;
  const inWindowCount = inWindow.length;

  const cells: Array<{ date: string; pages: number; row: number; col: number }> = [];
  for (let i = 0; i < weeks * 7; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    const iso = localIso(dt);
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
    if (pages === 0) return "rgb(231, 229, 228)"; // slate-200
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
          No entries to plot yet. Upload a notebook and they&rsquo;ll appear
          here on either the diary date you wrote at the top of the page, or
          the day you uploaded it.
        </p>
      </Section>
    );
  }

  return (
    <Section
      title="When you write"
      subtitle={`Last 6 months. Each cell is one day; darker = more pages. ${inWindowCount} day${inWindowCount === 1 ? "" : "s"} with entries in this window. (Uses your diary date when present, else the day you uploaded.)`}
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
              className="fill-slate-500 dark:fill-slate-400"
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
                className="fill-slate-500"
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
            className="fill-slate-500"
          >
            {data[Math.max(0, data.length - 180)].date}
          </text>
          <text
            x={chart.w - chart.padR}
            y={chart.h - 6}
            fontSize="9"
            textAnchor="end"
            className="fill-slate-500"
          >
            {data[data.length - 1].date}
          </text>
        </svg>
      </div>
    </Section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 4. Embedding map — 3D scatter of every entry. The actual three.js scene is
// in ./Map3D.tsx (loaded via next/dynamic). This wrapper handles the empty /
// disabled states so we don't pull in the three.js bundle when there's
// nothing to render.
// ──────────────────────────────────────────────────────────────────────────

function EmbeddingMap({
  data,
  embeddingsEnabled,
  axisLabels,
  labelling,
  onLabelAxes,
}: {
  data: MapPoint[];
  embeddingsEnabled: boolean;
  axisLabels: AxisLabels | null;
  labelling: boolean;
  onLabelAxes: () => void;
}) {
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

  return (
    <Section
      title="Map of your mind"
      subtitle={`${data.length} entries projected to 3D (PCA on Voyage embeddings). Drag to rotate, pinch to zoom. Closer = more similar in meaning. ${
        axisLabels
          ? "Axis labels are short summaries Claude wrote for the extreme entries at each end."
          : "Tap 'Label axes' below to have Claude name what each direction represents."
      } Orange = positive, blue = negative, grey = un-analysed.`}
    >
      <div className="flex justify-end pb-2">
        <button
          disabled={labelling}
          onClick={onLabelAxes}
          title="Sends a few extreme entries from each axis of the 3D map to Claude for short labels (e.g. 'family life ↔ business'). One Claude call total."
          className="rounded border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs opacity-80 hover:opacity-100 disabled:opacity-40"
        >
          {labelling
            ? "Labelling…"
            : axisLabels
            ? "Re-label axes"
            : "Label axes"}
        </button>
      </div>
      <Map3D data={data} axisLabels={axisLabels} />
    </Section>
  );
}

// Section wrapper — keeps every chart visually consistent.
function EntityRankings({
  data,
}: {
  data: { people: EntityRank[]; places: EntityRank[]; projects: EntityRank[] };
}) {
  const allEmpty =
    data.people.length === 0 &&
    data.places.length === 0 &&
    data.projects.length === 0;
  if (allEmpty) {
    return (
      <Section title="Who, where, what">
        <p className="opacity-60 text-sm">
          Once you re-analyse your entries, the people, places, and projects
          you mention most will surface here.
        </p>
      </Section>
    );
  }
  const Column = ({
    label,
    items,
  }: {
    label: string;
    items: EntityRank[];
  }) => (
    <div className="space-y-1.5 min-w-0">
      <h3 className="text-xs font-medium opacity-70">{label}</h3>
      {items.length === 0 ? (
        <p className="text-xs opacity-40">—</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((it) => (
            <li
              key={it.name}
              className="flex justify-between gap-2"
              title={`${it.pages} page${it.pages === 1 ? "" : "s"}`}
            >
              <span className="truncate">{it.name}</span>
              <span className="opacity-50 text-xs tabular-nums shrink-0">
                {it.pages}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  return (
    <Section
      title="Who, where, what"
      subtitle="Top 10 people, places, and projects from your entries. Ranked by pages they appear on."
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Column label="People" items={data.people} />
        <Column label="Places" items={data.places} />
        <Column label="Projects" items={data.projects} />
      </div>
    </Section>
  );
}

