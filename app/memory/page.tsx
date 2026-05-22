"use client";

import { useEffect, useState } from "react";
import { formatLocalTime } from "@/lib/format";

export default function MemoryPage() {
  const [content, setContent] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [hasNotes, setHasNotes] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "save" | "rebuild">(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const d = await fetch("/api/memory").then((r) => r.json());
      setContent(d.content || "");
      setUpdatedAt(d.updatedAt || null);
      setHasNotes(!!d.hasNotes);
      setDirty(false);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setBusy("save");
    setError(null);
    setStatus(null);
    try {
      const r = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", content }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Save failed");
      setStatus("Saved.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function rebuild() {
    if (
      !window.confirm(
        "Rebuild the memory from scratch using all your notes? This replaces the current memory and uses one Opus call."
      )
    )
      return;
    setBusy("rebuild");
    setError(null);
    setStatus(null);
    try {
      const r = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rebuild" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Rebuild failed");
      setContent(d.content || "");
      setStatus("Rebuilt from your notes.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold">Memory</h1>
        <p className="opacity-70 text-sm">
          What Remarkabler understands about you, built from your diary. It
          updates on its own as you feed new entries — edit here to correct it.
        </p>
      </section>

      {loading ? (
        <p className="text-sm opacity-60">Loading…</p>
      ) : (
        <>
          {content || dirty ? (
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setDirty(true);
              }}
              rows={18}
              className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent p-3 text-sm leading-relaxed whitespace-pre-wrap"
            />
          ) : (
            <p className="text-sm opacity-70 rounded border border-stone-200 dark:border-stone-800 p-4">
              {hasNotes
                ? "No memory yet. Tap “Rebuild from notes” to build it now, or it builds itself the next time you feed a diary."
                : "No notes yet — add a notebook and the memory will start building itself."}
            </p>
          )}

          {updatedAt && (
            <p className="text-xs opacity-50">
              Last updated {formatLocalTime(updatedAt)}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={save}
              disabled={busy !== null || !dirty || !content.trim()}
              className="rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-4 py-2 text-sm disabled:opacity-50"
            >
              {busy === "save" ? "Saving…" : "Save edits"}
            </button>
            <button
              onClick={rebuild}
              disabled={busy !== null || !hasNotes}
              className="rounded border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm disabled:opacity-50"
            >
              {busy === "rebuild" ? "Rebuilding…" : "Rebuild from notes"}
            </button>
          </div>

          {status && <p className="text-sm opacity-70">{status}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}
