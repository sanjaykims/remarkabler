"use client";

import { useEffect, useState } from "react";
import { formatLocalTime } from "@/lib/format";
import { Button } from "@/components/Button";

// The "Chat memory" section — durable items Claude extracts from cleared
// chats so a fresh conversation can still know what the user has said
// before. List + delete + retry-stuck-batches surface.
type ChatMemoryItem = {
  id: number;
  category: string;
  category_raw: string | null;
  text: string;
  source_excerpt: string | null;
  created_at: string;
  missing_embedding: 0 | 1;
};

type PendingBatchDetail = {
  id: number;
  conversation_id: string;
  archived_at: string;
  message_count: number;
  user_char_count: number;
  failed_attempts: number;
  extraction_error: string | null;
};

type ChatMemoryStatus = {
  total: number;
  last_extracted_at: string | null;
  missing_embedding: number;
  pending_batches: number;
  pending_batch_details: PendingBatchDetail[];
  stuck_batches: number;
  stuck_batch_ids: number[];
  last_extraction_error: string | null;
};

const MEMORY_FILTERS = [
  { value: "all" as const, label: "All" },
  { value: "fact" as const, label: "Fact" },
  { value: "preference" as const, label: "Preference" },
  { value: "intent" as const, label: "Intent" },
  { value: "feeling" as const, label: "Feeling" },
  { value: "unresolved" as const, label: "Unresolved" },
  { value: "other" as const, label: "Other" },
];

export function ChatMemorySection() {
  const [items, setItems] = useState<ChatMemoryItem[] | null>(null);
  const [status, setStatus] = useState<ChatMemoryStatus | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof MEMORY_FILTERS)[number]["value"]>(
    "all"
  );

  async function load() {
    try {
      const d = await fetch("/api/chat/memories").then((r) => r.json());
      setItems(d.memories || []);
      setStatus(d.status || null);
    } catch {
      setItems([]);
      setStatus(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: number) {
    if (
      !window.confirm(
        "Delete this memory? Claude won't carry it into future chats. (The deletion is a soft-delete, so a future extraction of the same fact won't resurface it.)"
      )
    )
      return;
    setBusyId(id);
    try {
      const r = await fetch(`/api/chat/memories/${id}`, { method: "DELETE" });
      if (r.ok) await load();
    } finally {
      setBusyId(null);
    }
  }

  async function retryStuck() {
    if (retryBusy || !status) return;
    setRetryBusy(true);
    setRetryMsg(null);
    try {
      const ids = status.stuck_batch_ids || [];
      if (ids.length === 0) {
        setRetryMsg("No stuck batches.");
        return;
      }
      let ok = 0;
      for (const id of ids) {
        const r = await fetch(`/api/chat/memories/retry/${id}`, {
          method: "POST",
        });
        if (r.ok) ok++;
      }
      setRetryMsg(
        `Reset ${ok}/${ids.length} batch${ids.length === 1 ? "" : "es"} — refresh in a few seconds.`
      );
      await load();
    } finally {
      setRetryBusy(false);
    }
  }

  const [processBusy, setProcessBusy] = useState(false);
  const [processMsg, setProcessMsg] = useState<string | null>(null);

  async function processPending() {
    if (processBusy) return;
    setProcessBusy(true);
    setProcessMsg(null);
    try {
      const r = await fetch("/api/chat/memories/process", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Sweep failed");
      const sw = d.result || {};
      if (sw.inFlight) {
        setProcessMsg(
          "A sweep is already running — give it a few seconds, then refresh."
        );
      } else {
        setProcessMsg(
          `Processed ${sw.processed || 0} batch${(sw.processed || 0) === 1 ? "" : "es"}` +
            ` · ${sw.inserted || 0} memor${(sw.inserted || 0) === 1 ? "y" : "ies"} added` +
            (sw.failed ? ` · ${sw.failed} failed (will retry on next sweep)` : "") +
            (sw.remaining ? ` · ${sw.remaining} still pending` : "")
        );
      }
      await load();
    } catch (e) {
      setProcessMsg((e as Error).message || "Sweep failed.");
    } finally {
      setProcessBusy(false);
    }
  }

  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  async function backfillAll() {
    if (backfillBusy) return;
    if (
      !window.confirm(
        "Re-process all chat history into memory? This DROPS every existing chat memory item and runs extraction again from scratch, splitting your full chat history into char-budget-sized chunks so nothing gets silently truncated. Visible chats stay visible. Soft-deleted items are also wiped — they may resurface."
      )
    )
      return;
    setBackfillBusy(true);
    setBackfillMsg(null);
    try {
      const r = await fetch("/api/chat/memories/backfill-all?reset=true", {
        method: "POST",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Backfill failed");
      const n = d.batchesCreated || 0;
      setBackfillMsg(
        n === 0
          ? "Nothing to process — no chat messages found."
          : `Created ${n} batch${n === 1 ? "" : "es"}. Extraction is running; refresh in ~30–90 seconds.`
      );
      await load();
    } catch (e) {
      setBackfillMsg((e as Error).message || "Backfill failed.");
    } finally {
      setBackfillBusy(false);
    }
  }

  const filtered =
    items === null
      ? null
      : filter === "all"
        ? items
        : items.filter((m) => m.category === filter);

  return (
    <section className="rounded border border-slate-200 dark:border-slate-800 p-4 space-y-3">
      <h2 className="font-medium">Chat memory</h2>
      <p className="text-xs opacity-70">
        Small durable items Claude pulls out of cleared chats — preferences,
        facts, intents, feelings, open threads — so the next conversation
        already knows them. Delete anything that doesn&rsquo;t belong; a
        delete sticks across future extractions.
      </p>

      {status === null ? (
        <p className="text-xs opacity-60">Loading…</p>
      ) : (
        <>
          <p className="text-xs opacity-70">
            {status.total} item{status.total === 1 ? "" : "s"}
            {status.last_extracted_at
              ? ` · last extracted ${formatLocalTime(status.last_extracted_at)}`
              : ""}
            {status.pending_batches > 0
              ? ` · ${status.pending_batches} pending`
              : ""}
            {status.missing_embedding > 0
              ? ` · ${status.missing_embedding} without embedding`
              : ""}
          </p>
          {status.pending_batches > 0 && (
            <div className="rounded border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 p-2 space-y-1.5">
              <p className="text-xs text-sky-800 dark:text-sky-300">
                {status.pending_batches} batch
                {status.pending_batches === 1 ? "" : "es"} waiting for
                extraction. The background sweep is throttled to once every
                5 minutes — tap below to run it now. (Your chat messages are
                safe either way; they&rsquo;re preserved on Clear and only
                hidden from the active chat view.)
              </p>
              {status.pending_batch_details &&
                status.pending_batch_details.length > 0 && (
                  <ul className="text-[11px] opacity-80 space-y-0.5 break-words">
                    {status.pending_batch_details.slice(0, 5).map((b) => (
                      <li key={b.id}>
                        Batch #{b.id} · {b.message_count} message
                        {b.message_count === 1 ? "" : "s"} ·{" "}
                        {b.user_char_count.toLocaleString()} chars ·{" "}
                        {formatLocalTime(b.archived_at)}
                        {b.failed_attempts > 0
                          ? ` · attempt ${b.failed_attempts}/2`
                          : ""}
                        {b.extraction_error
                          ? ` · last error: ${b.extraction_error}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                )}
              <button
                onClick={processPending}
                disabled={processBusy}
                className="rounded border border-sky-400 dark:border-sky-700 px-3 py-1 text-xs text-sky-800 dark:text-sky-300 disabled:opacity-50"
              >
                {processBusy ? "Processing…" : "Process pending now"}
              </button>
              {processMsg && (
                <p className="text-xs opacity-70">{processMsg}</p>
              )}
            </div>
          )}
          {status.stuck_batches > 0 && (
            <div className="rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-2 space-y-1.5">
              <p className="text-xs text-red-700 dark:text-red-300">
                {status.stuck_batches} batch
                {status.stuck_batches === 1 ? "" : "es"} failed extraction.
                {status.last_extraction_error
                  ? ` Last error: ${status.last_extraction_error}`
                  : ""}
              </p>
              <Button onClick={retryStuck} disabled={retryBusy} variant="danger" size="xs">
                {retryBusy ? "Retrying…" : "Retry stuck batches"}
              </Button>
              {retryMsg && (
                <p className="text-xs opacity-70">{retryMsg}</p>
              )}
            </div>
          )}
          <div className="space-y-1.5 pt-1">
            <Button onClick={backfillAll} disabled={backfillBusy} variant="secondary" size="xs">
              {backfillBusy
                ? "Processing…"
                : "Re-process all chat history (clean)"}
            </Button>
            {backfillMsg && (
              <p className="text-xs opacity-70">{backfillMsg}</p>
            )}
          </div>
        </>
      )}

      {items !== null && items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {MEMORY_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={
                "rounded-full px-2.5 py-1 text-[11px] " +
                (filter === f.value
                  ? "bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900"
                  : "border border-slate-300 dark:border-slate-700 opacity-80")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {filtered === null ? null : filtered.length === 0 ? (
        <p className="text-xs opacity-60">
          {items && items.length === 0
            ? "No chat memories yet. Clear a chat with a meaningful conversation and Claude will extract a few durable items."
            : "No items in this category."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => (
            <li
              key={m.id}
              className="rounded border border-slate-200 dark:border-slate-800 p-2.5 space-y-1.5"
            >
              <div className="flex items-start gap-2">
                <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide opacity-80">
                  {m.category}
                </span>
                <p className="text-sm leading-snug flex-1 min-w-0 break-words">{m.text}</p>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] opacity-60">
                <span>{formatLocalTime(m.created_at)}</span>
                {m.missing_embedding === 1 && (
                  <span className="text-sky-700 dark:text-sky-400">
                    no embedding (won&rsquo;t auto-recall)
                  </span>
                )}
              </div>
              {m.source_excerpt && (
                <details className="text-xs opacity-70">
                  <summary className="cursor-pointer">Source excerpt</summary>
                  <p className="mt-1 whitespace-pre-wrap break-words">
                    {m.source_excerpt}
                  </p>
                </details>
              )}
              <div>
                <button
                  onClick={() => remove(m.id)}
                  disabled={busyId === m.id}
                  className="text-[11px] underline opacity-70 disabled:opacity-30"
                >
                  {busyId === m.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
