"use client";

import { useEffect, useState, useCallback } from "react";

type Entry = {
  page_id: string;
  notebook_id: string;
  notebook_name: string;
  page_index: number;
  entry_date: string | null;
  ocr_text: string;
};

type Response = {
  entries: Entry[];
  total: { pages: number; days: number };
  returned: number;
  limit: number;
  offset: number;
};

// Group entries by entry_date for the date-bucketed view. Entries with no
// parsed date land in a "(no date)" bucket at the end.
function groupByDate(entries: Entry[]): Array<{ date: string; items: Entry[] }> {
  const map = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = e.entry_date || "(no date)";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  // Keys are already sorted by the SQL ORDER BY; preserve insertion order.
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

export default function DiaryPage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (from) params.set("from", from);
      if (to) {
        // SQL "to" is exclusive — the user thinks inclusive. Bump by one day.
        const d = new Date(to + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + 1);
        params.set("to", d.toISOString().slice(0, 10));
      }
      params.set("limit", "200");
      const r = await fetch(`/api/diary?${params.toString()}`);
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `Lookup failed (${r.status})`);
      }
      setData(await r.json());
    } catch (e) {
      setError((e as Error).message || "Couldn't load the diary.");
    } finally {
      setLoading(false);
    }
  }, [q, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  function clearFilters() {
    setQ("");
    setFrom("");
    setTo("");
  }

  const grouped = data ? groupByDate(data.entries) : [];

  return (
    <div className="space-y-4">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold">Diary</h1>
        <p className="opacity-70 text-sm">
          Every transcribed page, browsable by date. Search is free — no Claude
          calls, just a direct lookup on your notes.
        </p>
        {data && (
          <p className="text-xs opacity-50">
            {data.total.days} day{data.total.days === 1 ? "" : "s"} ·{" "}
            {data.total.pages} page{data.total.pages === 1 ? "" : "s"} total
          </p>
        )}
      </section>

      <section className="space-y-2 rounded border border-stone-200 dark:border-stone-800 p-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Search your diary (words / phrases)"
          className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-xs opacity-70 flex items-center gap-1">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded border border-stone-300 dark:border-stone-700 bg-transparent px-2 py-1 text-xs"
            />
          </label>
          <label className="text-xs opacity-70 flex items-center gap-1">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded border border-stone-300 dark:border-stone-700 bg-transparent px-2 py-1 text-xs"
            />
          </label>
          <button
            onClick={load}
            disabled={loading}
            className="rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {loading ? "…" : "Search"}
          </button>
          {(q || from || to) && (
            <button
              onClick={() => {
                clearFilters();
                // load fires from the useEffect when state changes
              }}
              className="rounded border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-xs"
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading && !data && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-24 rounded border border-stone-200 dark:border-stone-800 animate-pulse opacity-30"
            />
          ))}
        </div>
      )}

      {!loading && data && data.entries.length === 0 && (
        <p className="opacity-60 text-sm">
          No entries match. Clear the filters or try a different search.
        </p>
      )}

      {data && data.entries.length > 0 && (
        <div className="space-y-3">
          {grouped.map(({ date, items }) => (
            <details
              key={date}
              open={grouped.length <= 7}
              className="rounded border border-stone-200 dark:border-stone-800"
            >
              <summary className="cursor-pointer px-3 py-2 list-none flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{date}</span>
                <span className="text-[11px] opacity-60">
                  {items.length} page{items.length === 1 ? "" : "s"}
                </span>
              </summary>
              <div className="px-3 pb-3 border-t border-stone-200 dark:border-stone-800 pt-2 space-y-3">
                {items.map((e) => (
                  <div key={e.page_id} className="space-y-1">
                    <p className="text-[11px] opacity-50">
                      {e.notebook_name} · page {e.page_index + 1}
                    </p>
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
                      {e.ocr_text}
                    </pre>
                  </div>
                ))}
              </div>
            </details>
          ))}
          {data.returned >= data.limit && (
            <p className="text-xs opacity-60 text-center pt-2">
              Showing the first {data.limit} results — narrow the search or
              date range to see more.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
