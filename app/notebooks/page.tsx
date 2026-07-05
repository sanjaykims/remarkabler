"use client";

import { useEffect, useRef, useState } from "react";
import { formatLocalTime } from "@/lib/format";
import { setPickingFile } from "../lockState";
import { track } from "../analytics";

type Notebook = {
  id: string;
  name: string;
  status: "processing" | "done" | "error";
  error: string | null;
  synced_at: string | null;
  page_count: number;
  ocr_count: number;
};

type Page = {
  id: string;
  page_index: number;
  ocr_text: string | null;
  entry_date: string | null;
};

type DuplicateCandidate = {
  id: string;
  name: string;
  pageCount: number;
  dates: string[];
  classification: "full" | "partial";
  coveringNotebooks: Array<{ id: string; name: string }>;
  uncoveredDates: string[];
};

export default function NotebooksPage() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Lazy-loaded page text per notebook. Fetched only when a notebook
  // is expanded so the list view stays cheap.
  const [pagesById, setPagesById] = useState<Record<string, Page[] | "loading" | "error">>({});
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadPages(id: string) {
    if (pagesById[id] && pagesById[id] !== "error") return; // already loaded / loading
    setPagesById((s) => ({ ...s, [id]: "loading" }));
    try {
      const r = await fetch(`/api/notebooks/${encodeURIComponent(id)}/pages`);
      if (!r.ok) throw new Error(`Failed (${r.status})`);
      const d = await r.json();
      setPagesById((s) => ({ ...s, [id]: d.pages || [] }));
    } catch {
      setPagesById((s) => ({ ...s, [id]: "error" }));
    }
  }

  async function load() {
    try {
      const r = await fetch("/api/notebooks");
      if (!r.ok) throw new Error(`Couldn't load notebooks (${r.status})`);
      const d = await r.json();
      setNotebooks(d.notebooks || []);
    } catch (e) {
      setError((e as Error).message || "Couldn't load notebooks.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDuplicates() {
    try {
      const r = await fetch("/api/notebooks/duplicates");
      if (!r.ok) return; // best-effort — doesn't block the main list
      const d = await r.json();
      setDuplicates(d.candidates || []);
    } catch {
      // best-effort
    }
  }

  useEffect(() => {
    load();
    loadDuplicates();
  }, []);

  // While any notebook is still transcribing, refresh the list periodically
  // so it updates on its own when the background OCR finishes.
  useEffect(() => {
    if (!notebooks.some((n) => n.status === "processing")) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [notebooks]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const fs = fileRef.current?.files;
    if (!fs || fs.length === 0 || uploading) return;
    setUploading(true);
    setError(null);
    setStatus(null);

    const fd = new FormData();
    for (const f of Array.from(fs)) fd.append("file", f);
    try {
      const r = await fetch("/api/notebooks", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Upload failed");
      const n: number = d.added ?? 1;
      track("notebook_uploaded", { count: n });
      let msg =
        n === 1
          ? `Uploaded — transcribing in the background. It will appear below.`
          : `Uploaded ${n} notebooks — transcribing in the background. They'll appear below.`;
      if (Array.isArray(d.skipped) && d.skipped.length) {
        msg += ` Skipped: ${d.skipped.join("; ")}.`;
      }
      setStatus(msg);
      if (fileRef.current) fileRef.current.value = "";
      setFileName(null);
      await load();
    } catch (err) {
      track("notebook_upload_failed");
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  // Open the file picker. It backgrounds the app on Android, so suppress the
  // auto-lock until the picker closes — otherwise the unlock reload discards
  // the chosen PDF before it can be uploaded.
  function openFilePicker() {
    setPickingFile(true);
    const done = () => {
      window.removeEventListener("focus", done);
      setTimeout(() => setPickingFile(false), 300);
    };
    window.addEventListener("focus", done);
    fileRef.current?.click();
  }

  async function remove(id: string, name: string, confirmText?: string) {
    if (deletingId) return;
    if (!window.confirm(confirmText || `Delete "${name}" and its transcription?`))
      return;
    setDeletingId(id);
    setError(null);
    try {
      const r = await fetch(`/api/notebooks?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `Delete failed (${r.status})`);
      }
      track("notebook_deleted");
      await load();
      await loadDuplicates();
    } catch (e) {
      setError((e as Error).message || "Couldn't delete.");
    } finally {
      setDeletingId(null);
    }
  }

  function removeDuplicate(c: DuplicateCandidate) {
    const coveredBy = c.coveringNotebooks.map((n) => n.name).join(", ");
    const confirmText =
      c.classification === "full"
        ? `Delete "${c.name}"? All ${c.dates.length} of its dates are already covered by: ${coveredBy}.`
        : `Delete "${c.name}"? ${c.uncoveredDates.length} date(s) (${c.uncoveredDates.join(", ")}) are NOT covered by any other notebook and will be lost permanently.`;
    void remove(c.id, c.name, confirmText);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Notebooks</h1>

      <form
        onSubmit={upload}
        className="rounded border border-stone-200 dark:border-stone-800 p-4 space-y-3"
      >
        <p className="text-sm opacity-80">
          Export a notebook as PDF on your reMarkable, then upload it here.
          Claude transcribes every page in the background.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            disabled={uploading}
            onChange={(e) => {
              const fs = e.target.files;
              if (!fs || fs.length === 0) setFileName(null);
              else if (fs.length === 1) setFileName(fs[0].name);
              else setFileName(`${fs.length} files chosen`);
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={openFilePicker}
            disabled={uploading}
            className="rounded border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Choose file
          </button>
          <span className="text-sm opacity-70">
            {fileName ?? "No file chosen"}
          </span>
          <button
            type="submit"
            disabled={uploading}
            className="rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-4 py-1.5 text-sm disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
        {status && <p className="text-sm opacity-80">{status}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      {duplicates.length > 0 && (
        <div className="rounded border border-amber-300 dark:border-amber-800 p-4 space-y-3">
          <h2 className="text-sm font-semibold">Possible duplicates</h2>
          <p className="text-xs opacity-70">
            These notebooks look like they cover the same dates as content
            already imported from your reMarkable cloud account. Review
            before deleting — nothing here is removed automatically.
          </p>
          <div className="space-y-2">
            {duplicates.map((c) => (
              <div
                key={c.id}
                className="rounded border border-stone-200 dark:border-stone-800 px-3 py-2 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">{c.name}</span>
                  <span
                    className={
                      "text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 " +
                      (c.classification === "full"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200")
                    }
                  >
                    {c.classification}
                  </span>
                </div>
                <p className="text-xs opacity-60">
                  {c.pageCount} transcribed page{c.pageCount === 1 ? "" : "s"} ·{" "}
                  {c.dates[0]}
                  {c.dates.length > 1 ? ` – ${c.dates[c.dates.length - 1]}` : ""}
                </p>
                <p className="text-xs opacity-60">
                  Covered by: {c.coveringNotebooks.map((n) => n.name).join(", ")}
                </p>
                {c.classification === "partial" && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {c.uncoveredDates.length} date(s) not covered elsewhere:{" "}
                    {c.uncoveredDates.join(", ")}
                  </p>
                )}
                <button
                  onClick={() => removeDuplicate(c)}
                  disabled={deletingId !== null}
                  className="text-xs opacity-60 hover:opacity-100 hover:text-red-600 disabled:opacity-30"
                >
                  {deletingId === c.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        // Skeleton so the user doesn't see "No notebooks yet" for a flash
        // before the fetch resolves on a slow connection.
        <div className="space-y-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-12 rounded border border-stone-200 dark:border-stone-800 animate-pulse opacity-30"
            />
          ))}
        </div>
      )}
      {!loading && notebooks.length === 0 && (
        <p className="opacity-60 text-sm">
          No notebooks yet. Upload a PDF exported from your reMarkable.
        </p>
      )}

      {notebooks.length > 0 && (
        <div className="space-y-1">
          {notebooks.map((n) => {
            const pages = pagesById[n.id];
            return (
              <details
                key={n.id}
                onToggle={(e) => {
                  if ((e.target as HTMLDetailsElement).open && n.status === "done") {
                    void loadPages(n.id);
                  }
                }}
                className="rounded border border-stone-200 dark:border-stone-800"
              >
                <summary className="cursor-pointer px-3 py-2 list-none flex flex-col gap-0.5">
                  <span className="text-[11px] opacity-60">
                    {n.status === "processing" && "Transcribing…"}
                    {n.status === "done" &&
                      `✓ ${n.page_count} page${n.page_count === 1 ? "" : "s"}`}
                    {n.status === "error" && (
                      <span className="text-red-600">Failed</span>
                    )}
                  </span>
                  <span className="text-xs opacity-80">{n.name}</span>
                </summary>
                <div className="px-3 pb-3 border-t border-stone-200 dark:border-stone-800 pt-2 space-y-3">
                  {n.status === "error" && n.error && (
                    <p className="text-xs text-red-600">{n.error}</p>
                  )}
                  <p className="text-xs opacity-60">
                    Uploaded {formatLocalTime(n.synced_at)}
                  </p>
                  {n.status === "done" && (
                    <div className="space-y-2 pt-1 border-t border-stone-100 dark:border-stone-900">
                      {pages === "loading" && (
                        <p className="text-xs opacity-60 pt-2">Loading pages…</p>
                      )}
                      {pages === "error" && (
                        <p className="text-xs text-red-600 pt-2">
                          Couldn&rsquo;t load pages.{" "}
                          <button
                            onClick={() => loadPages(n.id)}
                            className="underline"
                          >
                            Retry
                          </button>
                        </p>
                      )}
                      {Array.isArray(pages) && pages.length === 0 && (
                        <p className="text-xs opacity-60 pt-2">
                          No transcribed pages.
                        </p>
                      )}
                      {Array.isArray(pages) &&
                        pages.map((p) => (
                          <div key={p.id} className="space-y-1 pt-2">
                            <p className="text-[11px] opacity-50">
                              page {p.page_index + 1}
                              {p.entry_date && p.entry_date !== "none"
                                ? ` · ${p.entry_date}`
                                : ""}
                            </p>
                            <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                              {p.ocr_text || "(blank)"}
                            </pre>
                          </div>
                        ))}
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <a
                      href={`/api/notebooks/${n.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs opacity-60 hover:opacity-100 underline"
                    >
                      View PDF
                    </a>
                    <button
                      onClick={() => remove(n.id, n.name)}
                      disabled={deletingId !== null}
                      className="text-xs opacity-60 hover:opacity-100 hover:text-red-600 disabled:opacity-30"
                    >
                      {deletingId === n.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
