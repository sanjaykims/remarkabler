"use client";

import { useCallback, useEffect, useState } from "react";

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
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </section>
  );
}
