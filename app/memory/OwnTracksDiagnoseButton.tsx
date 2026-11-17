"use client";

import { useState } from "react";
import { Button } from "@/components/Button";

// Inline diagnostic button + result for the OwnTracks ingestion. Fetches
// /api/owntracks?debug=1 and dumps the raw JSON below the button. Visible
// only when OwnTracks is configured. Used when the chat reports "no
// location data" while the ingestion status looks healthy — the JSON
// shows exactly what the chat tool sees (point counts, stay counts,
// sample raw points, server clock).
export function OwnTracksDiagnoseButton() {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/owntracks?debug=1");
      if (!r.ok) throw new Error(`Failed: ${r.status}`);
      setData(await r.json());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (data === null) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopyMsg("Copied to clipboard.");
      setTimeout(() => setCopyMsg(null), 2000);
    } catch {
      setCopyMsg("Copy failed — long-press to select the JSON manually.");
    }
  }
  // Pull out the summary fields so a glance is enough — no need to expand
  // the raw JSON to see whether ingestion is healthy. Coordinates are
  // never shown in the summary; they're behind the `<details>` toggle.
  type Summary = {
    serverTimeUtc?: string;
    totalPoints?: number;
    lastTstFormattedKst?: string | null;
    current?: { minutesAgo?: number; place?: string | null } | null;
    windows?: Array<{
      days?: number;
      pointCount?: number;
      stays?: unknown[];
    }>;
  };
  const summary: Summary | null = (data as Summary) ?? null;
  return (
    <div className="space-y-2">
      <Button
        onClick={run}
        disabled={busy}
        variant="secondary"
        size="xs"
        className="opacity-80 hover:opacity-100"
      >
        {busy ? "Diagnosing…" : "Diagnose location pipeline"}
      </Button>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {data !== null && summary && (
        <div className="space-y-1 text-xs opacity-80">
          <p>
            Server clock:{" "}
            <span className="font-mono">{summary.serverTimeUtc}</span>
            {" · "}
            Total points:{" "}
            <span className="font-mono">{summary.totalPoints}</span>
            {" · "}
            Latest: {summary.lastTstFormattedKst ?? "—"}
          </p>
          {summary.current && (
            <p>
              Current position: {summary.current.minutesAgo} min ago
              {summary.current.place ? ` · ${summary.current.place}` : ""}
            </p>
          )}
          {summary.windows?.map((w, i) => (
            <p key={i}>
              {w.days}d window: {w.pointCount} points · {w.stays?.length ?? 0}{" "}
              stay{(w.stays?.length ?? 0) === 1 ? "" : "s"}
            </p>
          ))}
        </div>
      )}
      {data !== null && (
        <details className="text-xs opacity-80">
          <summary className="cursor-pointer">
            Raw JSON — contains approximate coordinates (rounded to ~100m).
            Don&rsquo;t screenshot this for sharing if you&rsquo;re privacy-
            cautious; use Copy instead.
          </summary>
          <div className="space-y-1 pt-2">
            <button
              onClick={copy}
              className="rounded border border-slate-300 dark:border-slate-700 px-2 py-1 text-[11px]"
            >
              Copy raw JSON
            </button>
            {copyMsg && <span className="text-[11px] opacity-70 ml-2">{copyMsg}</span>}
            <pre className="text-[10px] leading-relaxed whitespace-pre-wrap break-words bg-slate-100 dark:bg-slate-900 rounded p-2 max-h-96 overflow-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
}
