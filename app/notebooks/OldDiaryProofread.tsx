"use client";

import { useCallback, useEffect, useState } from "react";

type Estimate = {
  notebooks: number;
  pages: number;
  estimatedUsd: number;
  pendingCards: number;
  next: { name: string; pages: number } | null;
};

// Proofread diary transcribed before proofreading existed. It only adds
// "Needs your eye" cards above; it never changes your text.
export default function OldDiaryProofread({
  onLocked,
  onDone,
}: {
  onLocked: () => void;
  onDone: () => void;
}) {
  const [est, setEst] = useState<Estimate | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/ocr-review/backfill");
      if (r.status === 403) return onLocked();
      if (r.ok) setEst(await r.json());
    } catch {
      /* leave as is */
    }
  }, [onLocked]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(limit: number) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/ocr-review/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      if (r.status === 403) return onLocked();
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(d.error || `Couldn't run (${r.status})`);
      } else {
        setMsg(
          `Checked ${d.done} notebook${d.done === 1 ? "" : "s"}, found ${d.flags} spot${d.flags === 1 ? "" : "s"} to review.` +
            (d.stopped === "queue-full"
              ? " Answer some cards first, then continue."
              : d.stopped
                ? ` Stopped: ${d.stopped}`
                : "")
        );
        onDone();
      }
    } catch {
      setMsg("Couldn't reach the server.");
    } finally {
      setBusy(false);
      void load();
    }
  }

  if (!est || est.notebooks === 0) return null;
  const btn =
    "rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm disabled:opacity-50";
  return (
    <section className="rounded border border-slate-300 dark:border-slate-700 p-4 space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Proofread older diary</h2>
        <p className="text-xs opacity-70">
          {est.notebooks} older notebooks ({est.pages} pages) haven&apos;t been proofread yet. Estimated
          cost for all: about ${est.estimatedUsd.toFixed(2)}. This only adds review cards above; it never
          changes your text. Newest first{est.next ? `, starting with “${est.next.name}”` : ""}.
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button className={btn} disabled={busy} onClick={() => run(1)}>
          {busy ? "Working…" : "Test on 1 notebook"}
        </button>
        <button className={btn} disabled={busy} onClick={() => run(3)}>
          Do next 3
        </button>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </section>
  );
}
