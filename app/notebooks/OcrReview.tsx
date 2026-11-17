"use client";

import { useCallback, useEffect, useState } from "react";

type Card = {
  id: string;
  notebookId: string;
  notebookName: string;
  pageId: string;
  pageIndex: number;
  phrase: string;
  candidates: string[];
  reason: string;
  context: { before: string; match: string; after: string };
};

// "Needs your eye": spots Claude wasn't sure how to read. The page text is
// already saved with Claude's best guess; tapping an option confirms or fixes
// it. The server enforces the Notebooks PIN — a 403 sends us back to the PIN.
type Stats = {
  totals: { flagged: number; corrected: number; kept: number; pending: number };
  weeks: Array<{ week: string; flagged: number; corrected: number; kept: number }>;
  learnedTerms: number;
  learnedFixes: number;
  autoFixed?: number;
  hasNotes?: boolean;
};

export default function OcrReview({ onLocked }: { onLocked: () => void }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [typing, setTyping] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/ocr-review");
      if (r.status === 403) return onLocked();
      if (!r.ok) return;
      const d = await r.json();
      setCards(d.cards || []);
      setTotal(d.total || 0);
      setStats(d.stats || null);
    } catch {
      /* best-effort: the notebook list still works without it */
    }
  }, [onLocked]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(card: Card, body: Record<string, unknown>) {
    if (busyId) return;
    setBusyId(card.id);
    setError(null);
    try {
      const r = await fetch("/api/ocr-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: card.id, ...body }),
      });
      if (r.status === 403) return onLocked();
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error || `Couldn't save (${r.status})`);
      setTyping(null);
      await load();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusyId(null);
    }
  }

  const progress =
    stats && stats.totals.flagged > 0 ? (
      <div className="text-xs opacity-60 space-y-0.5">
        <p>
          Proofreading so far: {stats.totals.flagged} flagged, {stats.totals.corrected} fixed,{" "}
          {stats.totals.kept} kept. Learned {stats.learnedTerms} confirmed words and{" "}
          {stats.learnedFixes} corrections.
          {stats.autoFixed ? ` Auto-fixed ${stats.autoFixed} words you had confirmed 3+ times.` : ""}
          {stats.hasNotes ? " Handwriting notes written." : ""}
        </p>
        {stats.weeks.map((w) => (
          <p key={w.week}>
            {w.week}: {w.flagged} flagged, {w.corrected} fixed, {w.kept} kept
          </p>
        ))}
      </div>
    ) : null;

  if (cards.length === 0) return progress;

  const btn =
    "rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-left disabled:opacity-50";

  return (
    <section className="rounded border border-amber-300 dark:border-amber-800 p-4 space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Needs your eye ({total})</h2>
        <p className="text-xs opacity-70">
          Claude wasn&apos;t sure how to read these. Tap the right one.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {cards.map((c) => (
        <div key={c.id} className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
          <p className="text-xs opacity-60">
            {c.notebookName} · page {c.pageIndex + 1}
            {!c.pageId.includes(":rm:") && (
              <>
                {" · "}
                <a
                  className="underline"
                  href={`/api/notebooks/${encodeURIComponent(c.notebookId)}/pdf#page=${c.pageIndex + 1}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  open PDF
                </a>
              </>
            )}
          </p>
          <p className="text-sm leading-relaxed break-words">
            {c.context.before}
            <mark className="bg-amber-200 dark:bg-amber-900 text-inherit rounded px-0.5">
              {c.context.match}
            </mark>
            {c.context.after}
          </p>
          {c.reason && <p className="text-xs opacity-60">{c.reason}</p>}
          <div className="flex flex-col gap-2">
            {c.candidates.map((alt, i) => (
              <button
                key={i}
                type="button"
                disabled={busyId === c.id}
                onClick={() => act(c, { action: "choose", index: i })}
                className={btn}
              >
                {alt}
              </button>
            ))}
            <button
              type="button"
              disabled={busyId === c.id}
              onClick={() => act(c, { action: "keep" })}
              className={btn}
            >
              Keep &ldquo;{c.phrase}&rdquo; as written
            </button>
            {typing === c.id ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={custom[c.id] ?? ""}
                  onChange={(e) => setCustom((s) => ({ ...s, [c.id]: e.target.value }))}
                  placeholder="Type it"
                  maxLength={200}
                  className="flex-1 min-w-0 rounded border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={busyId === c.id || !(custom[c.id] ?? "").trim()}
                  onClick={() => act(c, { action: "custom", text: custom[c.id] })}
                  className={btn}
                >
                  Use
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setTyping(c.id)} className={btn}>
                Type it myself
              </button>
            )}
          </div>
        </div>
      ))}
      {total > cards.length && (
        <p className="text-xs opacity-60">{total - cards.length} more waiting.</p>
      )}
      {progress}
    </section>
  );
}
