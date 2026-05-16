"use client";

import { useEffect, useState } from "react";

type Insight = { id: number; content: string; created_at: string };

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    const r = await fetch("/api/insights");
    const d = await r.json();
    setInsights(d.insights || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const r = await fetch("/api/insights", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to generate insights");
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
          `## ${new Date(it.created_at).toLocaleString()}\n\n${it.content}\n`
      )
      .join("\n---\n\n");
  }

  function download() {
    const blob = new Blob([exportText()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "feed-claude-insights.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(exportText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy to the clipboard on this browser.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">Insights</h1>
        <div className="flex gap-2">
          {insights.length > 0 && (
            <>
              <button
                onClick={copy}
                className="rounded border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-sm"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={download}
                className="rounded border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-sm"
              >
                Export
              </button>
            </>
          )}
          <button
            onClick={generate}
            disabled={generating}
            className="rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {generating ? "Reflecting…" : "Generate insights"}
          </button>
        </div>
      </div>

      <p className="opacity-70 text-sm">
        Claude reads everything in your notebooks and records what it notices
        about you. Each entry builds on the last, so this becomes a growing
        record over time. Use <strong>Export</strong> to save it whenever you
        like.
      </p>

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

      <div className="space-y-4">
        {insights.map((it) => (
          <div
            key={it.id}
            className="rounded border border-stone-200 dark:border-stone-800 p-4"
          >
            <div className="text-xs opacity-60 mb-2">
              {new Date(it.created_at).toLocaleString()}
            </div>
            <div className="text-sm whitespace-pre-wrap">{it.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
