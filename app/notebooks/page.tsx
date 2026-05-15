"use client";

import { useEffect, useState } from "react";

type Notebook = {
  id: string;
  name: string;
  parent: string | null;
  last_modified: string | null;
  synced_at: string | null;
  page_count: number;
  ocr_count: number;
};

export default function NotebooksPage() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);

  async function load() {
    const r = await fetch("/api/notebooks");
    const d = await r.json();
    setNotebooks(d.notebooks);
  }

  useEffect(() => {
    load();
  }, []);

  async function sync(ocr: boolean) {
    setSyncing(true);
    setProgress([]);
    const r = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ocr }),
    });
    if (!r.ok || !r.body) {
      setSyncing(false);
      setProgress((p) => [...p, "Sync request failed"]);
      return;
    }
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const evt = JSON.parse(line);
          setProgress((p) => [...p, evt.message || evt.stage]);
        } catch {
          setProgress((p) => [...p, line]);
        }
      }
    }
    setSyncing(false);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notebooks</h1>
        <div className="flex gap-2">
          <button
            onClick={() => sync(false)}
            disabled={syncing}
            className="rounded border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Sync (no OCR)
          </button>
          <button
            onClick={() => sync(true)}
            disabled={syncing}
            className="rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync + OCR"}
          </button>
        </div>
      </div>

      {progress.length > 0 && (
        <div className="rounded border border-stone-200 dark:border-stone-800 p-3 text-xs font-mono space-y-0.5 max-h-48 overflow-auto">
          {progress.map((p, i) => (
            <div key={i}>{p}</div>
          ))}
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="text-left opacity-70">
          <tr>
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Pages</th>
            <th className="py-2 pr-4">OCR&apos;d</th>
            <th className="py-2 pr-4">Last synced</th>
          </tr>
        </thead>
        <tbody>
          {notebooks.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center opacity-60">
                No notebooks yet. Click <em>Sync</em> after connecting your reMarkable.
              </td>
            </tr>
          )}
          {notebooks.map((n) => (
            <tr key={n.id} className="border-t border-stone-200 dark:border-stone-800">
              <td className="py-2 pr-4">{n.name}</td>
              <td className="py-2 pr-4">{n.page_count}</td>
              <td className="py-2 pr-4">{n.ocr_count}</td>
              <td className="py-2 pr-4 opacity-70">
                {n.synced_at ? new Date(n.synced_at).toLocaleString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
