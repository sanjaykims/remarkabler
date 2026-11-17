"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Estimate = {
  notebooks: number;
  pages: number;
  estimatedUsd: number;
  inProgress: number;
  next: { name: string; pages: number } | null;
};

// Re-transcribe whole notebooks with the current handwriting learning. Unlike the
// proofreading pass above, this REPLACES the page text.
export default function RetranscribeAll({
  onLocked,
  onDone,
}: {
  onLocked: () => void;
  onDone: () => void;
}) {
  const [est, setEst] = useState<Estimate | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const stopRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/ocr-review/retranscribe");
      if (r.status === 403) return onLocked();
      if (r.ok) setEst(await r.json());
    } catch {
      /* leave as is */
    }
  }, [onLocked]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 20000);
    return () => clearInterval(t);
  }, [load]);

  async function queue(limit: number) {
    if (
      !confirm(
        `Re-transcribe ${limit === 1 ? "the next notebook" : `the next ${limit} notebooks`} from scratch? The page text is replaced (the old text is kept as a backup). Hand corrections on those pages are lost.`
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/ocr-review/retranscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      if (r.status === 403) return onLocked();
      const d = await r.json().catch(() => ({}));
      setMsg(r.ok ? `Queued ${d.queued}. They run in the background; this can take several minutes each.` : "Couldn't queue.");
    } catch {
      setMsg("Couldn't reach the server.");
    } finally {
      setBusy(false);
      onDone();
      void load();
    }
  }

  // "All": queue 5, wait for them to finish, repeat. Stops when none are left, nothing
  // progressed (a notebook keeps failing), or Stop is tapped. Closing the page stops the
  // loop; notebooks already queued still finish on the server.
  async function runAll() {
    if (
      !confirm(
        `Re-transcribe ALL ${est?.notebooks ?? ""} notebooks (about $${est?.estimatedUsd.toFixed(2)})? Page text is replaced (old text kept as a backup) and hand corrections are lost. Keep this page open; it runs 5 at a time.`
      )
    )
      return;
    stopRef.current = false;
    setBusy(true);
    let why = "All done.";
    let left = est?.notebooks ?? 0;
    try {
      for (;;) {
        if (stopRef.current) {
          why = "Stopped. Notebooks already queued will still finish.";
          break;
        }
        const r = await fetch("/api/ocr-review/retranscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 5 }),
        });
        if (r.status === 403) return onLocked();
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.queued) {
          why = d.queued === 0 ? "All done." : "Couldn't queue more.";
          break;
        }
        // wait for this batch to finish
        for (;;) {
          await new Promise((res) => setTimeout(res, 10000));
          const g = await fetch("/api/ocr-review/retranscribe");
          if (g.status === 403) return onLocked();
          const e: Estimate | null = g.ok ? await g.json() : null;
          if (e) {
            setEst(e);
            setMsg(`Working… ${e.notebooks} notebooks left, ${e.inProgress} running now.`);
            if (e.inProgress === 0) {
              if (e.notebooks >= left) why = "Stopped: some notebooks failed to re-transcribe. Tap Test on 1 notebook to see the error.";
              left = e.notebooks;
              break;
            }
          }
          if (stopRef.current) break;
        }
        if (why.startsWith("Stopped:") || left === 0) break;
      }
    } catch {
      why = "Lost the connection. Tap All to continue.";
    } finally {
      setMsg(why);
      setBusy(false);
      onDone();
      void load();
    }
  }

  if (!est || (est.notebooks === 0 && est.inProgress === 0)) return null;
  const btn =
    "rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm disabled:opacity-50";
  return (
    <section className="rounded border border-slate-300 dark:border-slate-700 p-4 space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Re-transcribe whole notebooks</h2>
        <p className="text-xs opacity-70">
          {est.notebooks} notebooks ({est.pages} pages) can be transcribed again with what the app has
          learned about your handwriting. Rough cost for all: about ${est.estimatedUsd.toFixed(2)}. This
          replaces the page text (the old text is kept as a backup), so hand corrections on those pages are
          lost. Newest first{est.next ? `, starting with “${est.next.name}”` : ""}.
          {est.inProgress > 0 ? ` ${est.inProgress} running now.` : ""}
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button className={btn} disabled={busy} onClick={() => queue(1)}>
          Test on 1 notebook
        </button>
        <button className={btn} disabled={busy} onClick={() => queue(5)}>
          Do next 5
        </button>
        <button className={btn} disabled={busy} onClick={runAll}>
          All
        </button>
        {busy && (
          <button className={btn} onClick={() => (stopRef.current = true)}>
            Stop
          </button>
        )}
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </section>
  );
}
