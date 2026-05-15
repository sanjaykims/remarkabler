"use client";

import { useEffect, useRef, useState } from "react";

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
      setStatus(`Uploaded "${d.name}" — transcribing in the background. It will appear below.`);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete "${name}" and its transcription?`)) return;
    await fetch(`/api/notebooks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
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
            className="text-sm"
          />
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

      <table className="w-full text-sm">
        <thead className="text-left opacity-70">
          <tr>
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Uploaded</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {notebooks.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center opacity-60">
                No notebooks yet. Upload a PDF exported from your reMarkable.
              </td>
            </tr>
          )}
          {notebooks.map((n) => (
            <tr key={n.id} className="border-t border-stone-200 dark:border-stone-800 align-top">
              <td className="py-2 pr-4">
                {n.name}
                {n.status === "error" && n.error && (
                  <div className="text-xs text-red-600 mt-0.5">{n.error}</div>
                )}
              </td>
              <td className="py-2 pr-4">
                {n.status === "processing" && (
                  <span className="opacity-70">Transcribing…</span>
                )}
                {n.status === "done" && (
                  <span>
                    ✓ {n.ocr_count} page{n.ocr_count === 1 ? "" : "s"}
                  </span>
                )}
                {n.status === "error" && (
                  <span className="text-red-600">Failed</span>
                )}
              </td>
              <td className="py-2 pr-4 opacity-70">
                {n.synced_at ? new Date(n.synced_at).toLocaleString() : "—"}
              </td>
              <td className="py-2 text-right">
                <button
                  onClick={() => remove(n.id, n.name)}
                  className="text-xs opacity-60 hover:opacity-100 hover:text-red-600"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
