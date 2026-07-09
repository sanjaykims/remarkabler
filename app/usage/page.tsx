"use client";

import { useEffect, useState } from "react";
import { Stat } from "@/components/Stat";

type DayCost = { day: string; cost: number; calls: number };
type MonthData = {
  days: DayCost[];
  total: number;
  calls: number;
  allTime: number;
};
type FeatureCost = { feature: string; cost: number; calls: number };
type DayData = { date: string; byFeature: FeatureCost[]; total: number };

const FEATURE_LABEL: Record<string, string> = {
  ocr: "Transcription",
  chat: "Chat",
  insights: "Insights",
  insight_title: "Insight titles",
  memory: "Memory",
  daily_summary: "Daily summaries",
  book: "Book composition",
  embeddings: "Semantic embeddings",
};
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function money(n: number): string {
  if (!n) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return "$" + n.toFixed(2);
}
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export default function UsagePage() {
  const today = new Date();
  const tz = -today.getTimezoneOffset(); // minutes to add to UTC for local time
  const [view, setView] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dayData, setDayData] = useState<DayData | null>(null);

  const monthStr = `${view.year}-${pad(view.month + 1)}`;

  useEffect(() => {
    setMonthData(null);
    fetch(`/api/usage?month=${monthStr}&tz=${tz}`)
      .then((r) => r.json())
      .then(setMonthData)
      .catch(() => setMonthData(null));
  }, [monthStr, tz]);

  function selectDay(day: string) {
    setSelected(day);
    setDayData(null);
    fetch(`/api/usage?date=${day}&tz=${tz}`)
      .then((r) => r.json())
      .then(setDayData)
      .catch(() => setDayData(null));
  }

  // Select today on first load, if the current month is showing.
  useEffect(() => {
    selectDay(ymd(today.getFullYear(), today.getMonth(), today.getDate()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function shiftMonth(delta: number) {
    setSelected(null);
    setDayData(null);
    const m = view.month + delta;
    setView({
      year: view.year + Math.floor(m / 12),
      month: ((m % 12) + 12) % 12,
    });
  }

  const costByDay = new Map<string, DayCost>();
  (monthData?.days || []).forEach((d) => costByDay.set(d.day, d));

  // The month calendar is one snapshot (fetched when the month loads); the
  // per-day breakdown is fetched fresh each time a day is tapped. Background
  // jobs (memory, entity wiki, analysis) keep adding usage, so the two can
  // disagree — the tapped cell would read stale while its breakdown reads
  // current. Reconcile: treat the fresh day fetch as truth for the selected
  // day, so the calendar cell and the breakdown below it always match, and
  // nudge the month total by the same delta.
  const selectedFresh =
    selected && dayData && dayData.date === selected ? dayData.total : null;
  const selectedInView = !!selected && selected.startsWith(monthStr);
  const selectedStale = selected ? costByDay.get(selected)?.cost ?? 0 : 0;
  const monthTotal =
    (monthData?.total ?? 0) +
    (selectedFresh !== null && selectedInView
      ? selectedFresh - selectedStale
      : 0);

  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = new Date(view.year, view.month, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const todayKey = ymd(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold">Cost</h1>
        <p className="opacity-70 text-sm">
          Estimated Claude API spend. Tap a day for the breakdown.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Stat label="This month" value={money(monthTotal)} />
        <Stat label="All time" value={money(monthData?.allTime ?? 0)} />
      </section>

      <section className="rounded border border-stone-200 dark:border-stone-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="w-8 h-8 rounded border border-stone-300 dark:border-stone-700 flex items-center justify-center"
          >
            ‹
          </button>
          <div className="font-medium">{monthLabel}</div>
          <button
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="w-8 h-8 rounded border border-stone-300 dark:border-stone-700 flex items-center justify-center"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="text-[10px] opacity-50 py-1">
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const key = ymd(view.year, view.month, d);
            const dc = costByDay.get(key);
            const isToday = key === todayKey;
            const isSel = key === selected;
            // Show the fresh per-day figure for the tapped cell so it agrees
            // with the breakdown panel below.
            const cellCost =
              isSel && selectedFresh !== null ? selectedFresh : dc?.cost ?? 0;
            return (
              <button
                key={i}
                onClick={() => selectDay(key)}
                className={
                  "rounded p-1 min-h-[46px] flex flex-col items-center justify-start text-xs " +
                  (isSel
                    ? "bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 "
                    : "hover:bg-stone-100 dark:hover:bg-stone-900 ") +
                  (isToday && !isSel ? "ring-1 ring-stone-400 " : "")
                }
              >
                <span>{d}</span>
                {cellCost > 0 && (
                  <span className="text-[9px] mt-0.5 opacity-80">
                    {money(cellCost)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {selected && (
        <section className="rounded border border-stone-200 dark:border-stone-800 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium">{selected}</h2>
            <span className="text-sm">{money(dayData?.total ?? 0)}</span>
          </div>
          {!dayData ? (
            <p className="text-sm opacity-60">Loading…</p>
          ) : dayData.byFeature.length === 0 ? (
            <p className="text-sm opacity-60">No usage on this day.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {dayData.byFeature.map((f) => (
                <li key={f.feature} className="flex justify-between gap-3">
                  <span>
                    {FEATURE_LABEL[f.feature] || f.feature}{" "}
                    <span className="opacity-50">×{f.calls}</span>
                  </span>
                  <span>{money(f.cost)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <p className="text-xs opacity-50">
        Estimated from token counts at Anthropic list prices — your Anthropic
        console invoice is the source of truth. Only usage recorded since this
        feature was added is counted.
      </p>
    </div>
  );
}

