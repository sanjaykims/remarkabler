"use client";

import { useEffect, useState } from "react";
import { formatLocalTime } from "@/lib/format";

type Session = {
  id: number;
  feedback: string;
  exercise: string | null;
  pages: number;
  first_date: string | null;
  last_date: string | null;
  created_at: string;
};

// Writing coach: craft feedback on recent diary entries, generated automatically after
// they are transcribed and their "Needs your eye" cards are answered.
export default function WritingCoach() {
  const [sessions, setSessions] = useState<Session[] | null>(null);

  useEffect(() => {
    fetch("/api/writing-coach")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSessions(d?.sessions || []))
      .catch(() => setSessions([]));
  }, []);

  if (sessions === null) return null;
  const latest = sessions[0];
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">Writing coach</h2>
      <p className="opacity-70 text-sm">
        After new diary pages are transcribed and their &ldquo;Needs your eye&rdquo; cards are answered,
        Claude reads them as personal essays and coaches the writing itself: sentences, paragraphs,
        structure. It runs by itself.
      </p>
      {!latest && (
        <p className="opacity-60 text-sm">
          No session yet. One appears a few minutes after recent pages have no cards waiting.
        </p>
      )}
      {latest?.exercise && (
        <div className="rounded border border-sky-300 dark:border-sky-800 p-3 space-y-1">
          <p className="text-[11px] opacity-60">Try this in your next entry</p>
          <p className="text-sm leading-relaxed">{latest.exercise}</p>
        </div>
      )}
      {sessions.length > 0 && (
        <div className="space-y-1">
          {sessions.map((s, i) => (
            <details key={s.id} open={i === 0} className="rounded border border-slate-200 dark:border-slate-800">
              <summary className="cursor-pointer px-3 py-2 list-none flex flex-col gap-0.5">
                <span className="text-[11px] opacity-60">
                  {i === 0 && "Latest · "}
                  {formatLocalTime(s.created_at)}
                </span>
                <span className="text-xs opacity-80">
                  {s.pages} page{s.pages === 1 ? "" : "s"}
                  {s.first_date ? `, ${s.first_date}${s.last_date && s.last_date !== s.first_date ? ` to ${s.last_date}` : ""}` : ""}
                </span>
              </summary>
              <div className="px-3 pb-3 text-sm whitespace-pre-wrap border-t border-slate-200 dark:border-slate-800 pt-2 leading-relaxed">
                {s.feedback}
                {s.exercise ? `\n\nEXERCISE: ${s.exercise}` : ""}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
