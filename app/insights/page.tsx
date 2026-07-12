"use client";

import { Eyebrow } from "@/components/Eyebrow";

import { useEffect, useState } from "react";
import { formatLocalTime } from "@/lib/format";
import { track } from "../analytics";

type Insight = {
  id: number;
  title?: string | null;
  content: string;
  created_at: string;
};

// A short plain-text label for a collapsed older entry: a few words, or a
// short first sentence — kept brief so it shows in full with nothing cut off.
function summarize(content: string): string {
  const clean = content
    .replace(/-{2,}[^-\n]*-{2,}/g, " ")
    .replace(/[#*_`>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const firstSentence = clean.split(/(?<=[.!?])\s/)[0] || clean;
  const words = firstSentence.split(" ").filter(Boolean);
  return words.length <= 8 ? firstSentence : words.slice(0, 8).join(" ");
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [weeklyEnabled, setWeeklyEnabled] = useState<boolean | null>(null);
  const [togglingWeekly, setTogglingWeekly] = useState(false);

  async function load() {
    const r = await fetch("/api/insights");
    const d = await r.json();
    setInsights(d.insights || []);
    if (typeof d.weeklyEnabled === "boolean") setWeeklyEnabled(d.weeklyEnabled);
  }

  async function toggleWeekly() {
    if (togglingWeekly || weeklyEnabled === null) return;
    setTogglingWeekly(true);
    try {
      const r = await fetch("/api/insights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeklyEnabled: !weeklyEnabled }),
      });
      const d = await r.json();
      if (r.ok && typeof d.weeklyEnabled === "boolean") {
        setWeeklyEnabled(d.weeklyEnabled);
      }
    } finally {
      setTogglingWeekly(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function generate() {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const r = await fetch("/api/insights", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to generate insights");
      track("insight_generated");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  function exportText(): string {
    return insights
      .map(
        (it) =>
          `## ${formatLocalTime(it.created_at)}\n\n${it.content}\n`
      )
      .join("\n---\n\n");
  }

  function download() {
    track("insights_exported");
    const blob = new Blob([exportText()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "remarkabler-insights.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(exportText());
      track("insights_copied");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy to the clipboard on this browser.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 pt-1">
        <Eyebrow>What Claude sees</Eyebrow>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">Insights</h1>
        <div className="flex gap-2">
          {insights.length > 0 && (
            <>
              <button
                onClick={copy}
                className="rounded border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={download}
                className="rounded border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm"
              >
                Export
              </button>
            </>
          )}
          <button
            onClick={generate}
            disabled={generating}
            className="rounded bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {generating ? "Reflecting…" : "Generate insights"}
          </button>
          </div>
        </div>
      </div>

      <p className="opacity-70 text-sm">
        Claude reads everything in your notebooks and records what it notices
        about you. Each entry builds on the last, so the newest reflection is
        your full current record. Use <strong>Export</strong> to save it
        whenever you like.
      </p>

      {weeklyEnabled !== null && (
        <div className="flex items-start gap-2">
          <button
            onClick={toggleWeekly}
            disabled={togglingWeekly}
            className={`shrink-0 rounded border px-2.5 py-1.5 text-xs disabled:opacity-50 ${
              weeklyEnabled
                ? "border-slate-900 bg-slate-900 text-slate-50 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                : "border-slate-300 dark:border-slate-700"
            }`}
          >
            {weeklyEnabled ? "Weekly auto-insight: ON" : "Weekly auto-insight: OFF"}
          </button>
          <span className="text-xs opacity-60">
            {weeklyEnabled
              ? "A fresh reflection is generated automatically about once a week (this is one of the pricier calls)."
              : "No automatic reflections — tap Generate insights above whenever you want one."}
          </span>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {generating && (
        <p className="text-sm opacity-70">
          Reading your notes and reflecting — this takes a few seconds…
        </p>
      )}

      {insights.length === 0 && !generating && (
        <p className="opacity-60 text-sm">
          No insights yet. Add some notebooks, then tap{" "}
          <strong>Generate insights</strong>.
        </p>
      )}

      {insights.length > 0 && (
        <div className="space-y-1">
          {insights.map((it, i) => (
            <details
              key={it.id}
              className="rounded border border-slate-200 dark:border-slate-800"
            >
              <summary className="cursor-pointer px-3 py-2 list-none flex flex-col gap-0.5">
                <span className="text-[11px] opacity-60">
                  {i === 0 && "Latest · "}
                  {formatLocalTime(it.created_at)}
                </span>
                <span className="text-xs opacity-80">
                  {it.title || summarize(it.content)}
                </span>
              </summary>
              <div className="px-3 pb-3 text-sm whitespace-pre-wrap border-t border-slate-200 dark:border-slate-800 pt-2 leading-relaxed">
                {it.content}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
