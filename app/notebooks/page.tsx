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

export default function NotebooksPage() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const r = await fetch("/api/notebooks");
    const d = await r.json();
    setNotebooks(d.notebooks || []);
  }

  useEffect(() => {
    load();
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
    const file = fileRef.current?.files?.[0];
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    setStatus(null);

    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch("/api/notebooks", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Upload failed");
      track("notebook_uploaded");
      setStatus(`Uploaded "${d.name}" — transcribing in the background. It will appear below.`);
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

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete "${name}" and its transcription?`)) return;
    await fetch(`/api/notebooks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    track("notebook_deleted");
    await load();
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
            disabled={uploading}
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
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

      {notebooks.length === 0 && (
        <p className="opacity-60 text-sm">
          No notebooks yet. Upload a PDF exported from your reMarkable.
        </p>
      )}

      {notebooks.length > 0 && (
        <div className="space-y-1">
          {notebooks.map((n) => (
            <details
              key={n.id}
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
              <div className="px-3 pb-3 border-t border-stone-200 dark:border-stone-800 pt-2 space-y-2">
                {n.status === "error" && n.error && (
                  <p className="text-xs text-red-600">{n.error}</p>
                )}
                <p className="text-xs opacity-60">
                  Uploaded {formatLocalTime(n.synced_at)}
                </p>
                <button
                  onClick={() => remove(n.id, n.name)}
                  className="text-xs opacity-60 hover:opacity-100 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
