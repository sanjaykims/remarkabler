"use client";

import { useEffect, useState } from "react";

export default function ConnectPage() {
  const [code, setCode] = useState("");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/connect")
      .then((r) => r.json())
      .then((d) => setConnected(d.connected));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch("/api/auth/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setError(d.error || "Failed to connect");
      return;
    }
    setConnected(true);
    setCode("");
  }

  async function disconnect() {
    setBusy(true);
    await fetch("/api/auth/connect", { method: "DELETE" });
    setConnected(false);
    setBusy(false);
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-semibold">Connect reMarkable</h1>

      {connected === true ? (
        <div className="space-y-4">
          <p>✓ Your reMarkable is connected.</p>
          <button
            onClick={disconnect}
            disabled={busy}
            className="rounded border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-sm"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <ol className="text-sm opacity-80 space-y-1 list-decimal list-inside">
            <li>
              Open{" "}
              <a
                className="underline"
                href="https://my.remarkable.com/device/desktop/connect"
                target="_blank"
                rel="noreferrer"
              >
                my.remarkable.com/device/desktop/connect
              </a>{" "}
              and sign in.
            </li>
            <li>Copy the 8-character one-time code.</li>
            <li>Paste it below.</li>
          </ol>

          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toLowerCase())}
            placeholder="xxxxxxxx"
            maxLength={8}
            className="w-full font-mono uppercase rounded border border-stone-300 dark:border-stone-700 px-3 py-2 bg-transparent"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || code.length !== 8}
            className="rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {busy ? "Connecting…" : "Connect"}
          </button>
        </form>
      )}
    </div>
  );
}
