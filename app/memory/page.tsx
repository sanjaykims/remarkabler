"use client";

import { useEffect, useRef, useState } from "react";
import { formatLocalTime } from "@/lib/format";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function MemoryPage() {
  const [content, setContent] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [hasNotes, setHasNotes] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "save" | "rebuild">(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [disc, setDisc] = useState<{
    configured: boolean;
    repo: string | null;
    files: number;
    lastSynced: string | null;
    fileList?: string[];
  } | null>(null);
  const [discBusy, setDiscBusy] = useState(false);
  const [discMsg, setDiscMsg] = useState<string | null>(null);

  const [locs, setLocs] = useState<Array<{ place: string; local_time: string }>>([]);
  const [locBusy, setLocBusy] = useState(false);
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const [ot, setOt] = useState<{
    configured: boolean;
    points: number;
    lastTst: number | null;
  } | null>(null);
  const [locEnabled, setLocEnabled] = useState<boolean | null>(null);
  const [locTogBusy, setLocTogBusy] = useState(false);
  const [discEnabled, setDiscEnabled] = useState<boolean | null>(null);
  const [discTogBusy, setDiscTogBusy] = useState(false);

  type ModelInfo = { value: string; source: "db" | "env" | "default" };
  const [models, setModels] = useState<{
    main: ModelInfo;
    chat: ModelInfo;
    fallback: ModelInfo;
  } | null>(null);
  const [modelsBusy, setModelsBusy] = useState(false);

  const [bookBusy, setBookBusy] = useState(false);
  const [bookMsg, setBookMsg] = useState<string | null>(null);

  type BackupStatus = {
    configured: boolean;
    repo: string | null;
    lastAt: string | null;
    lastError: string | null;
    lastSizeBytes: number | null;
  };
  const [backup, setBackup] = useState<BackupStatus | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);

  type DropboxStatus = {
    configured: boolean;
    connected: boolean;
    folder: string;
    account: string | null;
    lastSyncAt: string | null;
    lastAttemptAt: string | null;
    lastError: string | null;
    ingestedCount: number;
    lastSeenFileCount: number | null;
    lastSkipped: string | null;
    lastRevokeWarning: string | null;
    exportEnabled: boolean;
    exportPath: string;
    exportLastAt: string | null;
    exportLastError: string | null;
  };
  const [dropbox, setDropbox] = useState<DropboxStatus | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [dropboxBusy, setDropboxBusy] = useState(false);

  type EmbedStatus = {
    enabled: boolean;
    model: string;
    embeddedPages: number;
    totalPages: number;
    lastCallAt: string | null;
  };
  const [embed, setEmbed] = useState<EmbedStatus | null>(null);
  const [embedBusy, setEmbedBusy] = useState(false);
  const [embedMsg, setEmbedMsg] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

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

  async function loadDisc() {
    try {
      setDisc(await fetch("/api/discipline").then((r) => r.json()));
    } catch {
      setDisc(null);
    }
  }

  async function loadLocs() {
    try {
      const d = await fetch("/api/location").then((r) => r.json());
      setLocs(d.locations || []);
    } catch {
      setLocs([]);
    }
  }

  async function loadOt() {
    try {
      setOt(await fetch("/api/owntracks").then((r) => r.json()));
    } catch {
      setOt(null);
    }
  }

  async function loadLocSettings() {
    try {
      const d = await fetch("/api/location/settings").then((r) => r.json());
      setLocEnabled(!!d.enabled);
    } catch {
      setLocEnabled(true);
    }
  }

  async function toggleLocation() {
    if (locEnabled === null || locTogBusy) return;
    const next = !locEnabled;
    setLocTogBusy(true);
    try {
      const r = await fetch("/api/location/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const d = await r.json();
      if (r.ok) setLocEnabled(!!d.enabled);
    } catch {
      // leave state as-is
    } finally {
      setLocTogBusy(false);
    }
  }

  async function loadDiscSettings() {
    try {
      const d = await fetch("/api/discipline/settings").then((r) => r.json());
      setDiscEnabled(!!d.enabled);
    } catch {
      setDiscEnabled(true);
    }
  }

  async function toggleDiscipline() {
    if (discEnabled === null || discTogBusy) return;
    const next = !discEnabled;
    setDiscTogBusy(true);
    try {
      const r = await fetch("/api/discipline/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const d = await r.json();
      if (r.ok) setDiscEnabled(!!d.enabled);
    } catch {
      // leave state as-is
    } finally {
      setDiscTogBusy(false);
    }
  }

  async function loadModels() {
    try {
      const d = await fetch("/api/settings/models").then((r) => r.json());
      setModels(d);
    } catch {
      setModels(null);
    }
  }

  async function composeBookDraft() {
    if (bookBusy) return;
    setBookBusy(true);
    setBookMsg("Composing… this can take a minute or two.");
    try {
      const r = await fetch("/api/export/book");
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "Compose failed");
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `remarkabler-book-${date}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBookMsg("Done — check your downloads for the composed book.");
    } catch (e) {
      setBookMsg((e as Error).message || "Couldn't compose the book.");
    } finally {
      setBookBusy(false);
    }
  }

  async function loadBackup() {
    try {
      setBackup(await fetch("/api/backup").then((r) => r.json()));
    } catch {
      setBackup(null);
    }
  }

  async function loadDropbox() {
    try {
      setDropbox(await fetch("/api/dropbox/status").then((r) => r.json()));
    } catch {
      setDropbox(null);
    }
  }

  async function disconnectDropbox() {
    if (
      !confirm(
        "Disconnect Dropbox? The watcher stops; previously-ingested notebooks stay. You can reconnect any time."
      )
    ) {
      return;
    }
    setDropboxBusy(true);
    try {
      await fetch("/api/dropbox/disconnect", { method: "POST" });
      await loadDropbox();
    } finally {
      setDropboxBusy(false);
    }
  }

  // Toggle auto-export and (when turning it on) immediately run one export so
  // the user sees right away whether write access works.
  async function toggleDropboxExport(enable: boolean) {
    if (exportBusy) return;
    setExportBusy(true);
    setExportMsg(null);
    try {
      const r = await fetch("/api/dropbox/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: enable, runNow: enable }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't update export setting.");
      if (enable) {
        if (d.ran?.ok) setExportMsg("Saved to Dropbox ✓");
        else if (d.ran?.error) setExportMsg(d.ran.error);
      }
      await loadDropbox();
    } catch (e) {
      setExportMsg((e as Error).message);
    } finally {
      setExportBusy(false);
    }
  }

  async function runDropboxExportNow() {
    if (exportBusy) return;
    setExportBusy(true);
    setExportMsg(null);
    try {
      const r = await fetch("/api/dropbox/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runNow: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Export failed.");
      if (d.ran?.ok) setExportMsg("Saved to Dropbox ✓");
      else if (d.ran?.error) setExportMsg(d.ran.error);
      else if (d.ran?.skipped) setExportMsg(`Skipped: ${d.ran.skipped}`);
      await loadDropbox();
    } catch (e) {
      setExportMsg((e as Error).message);
    } finally {
      setExportBusy(false);
    }
  }

  async function loadEmbed() {
    try {
      setEmbed(await fetch("/api/embeddings/status").then((r) => r.json()));
    } catch {
      setEmbed(null);
    }
  }

  async function runEmbedBackfill() {
    if (embedBusy) return;
    setEmbedBusy(true);
    setEmbedMsg("Embedding remaining pages — this can take a minute…");
    try {
      const r = await fetch("/api/embeddings/status", { method: "POST" });
      const d = await r.json();
      const parts: string[] = [];
      if (typeof d.embedded === "number") parts.push(`Embedded ${d.embedded} this pass`);
      if (d.skipped) parts.push(`${d.skipped} skipped`);
      if (d.remaining) parts.push(`${d.remaining} still missing`);
      if (d.error) parts.push(`Error: ${d.error}`);
      const main = parts.length ? parts.join(" · ") : "Done.";
      // Show the first real Voyage error so the user knows whether it was
      // a rate limit, an oversized page, or something else.
      const samples =
        Array.isArray(d.skippedSamples) && d.skippedSamples.length > 0
          ? `\nFirst skip: ${d.skippedSamples[0]}`
          : "";
      setEmbedMsg(main + samples);
      await loadEmbed();
    } catch (e) {
      setEmbedMsg((e as Error).message || "Backfill failed.");
    } finally {
      setEmbedBusy(false);
    }
  }

  async function runManualBackup() {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const r = await fetch("/api/backup", { method: "POST" });
      await r.json().catch(() => ({}));
      await loadBackup();
    } catch {
      // surfaced via lastError on the loaded status
    } finally {
      setBackupBusy(false);
    }
  }

  async function setModel(slot: "main" | "chat" | "fallback", value: string) {
    if (modelsBusy) return;
    setModelsBusy(true);
    try {
      const r = await fetch("/api/settings/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [slot]: value }),
      });
      const d = await r.json();
      if (r.ok) {
        setModels({ main: d.main, chat: d.chat, fallback: d.fallback });
      }
    } catch {
      // leave state as-is
    } finally {
      setModelsBusy(false);
    }
  }

  useEffect(() => {
    load();
    loadDisc();
    loadLocs();
    loadOt();
    loadLocSettings();
    loadDiscSettings();
    loadModels();
    loadBackup();
    loadEmbed();
    loadDropbox();
  }, []);

  function getPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location isn't available on this device."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
      });
    });
  }

  async function logLocation() {
    setLocBusy(true);
    setLocMsg(null);
    try {
      const pos = await getPosition();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      let place = "";
      try {
        const g = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
        ).then((r) => r.json());
        place = [g.locality || g.city, g.principalSubdivision, g.countryName]
          .filter(Boolean)
          .join(", ");
      } catch {
        // no place name — coords still saved
      }
      const r = await fetch("/api/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, place, localTime: new Date().toLocaleString() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Couldn't save location");
      setLocMsg(place ? `Logged: ${place}` : "Location logged.");
      await loadLocs();
    } catch (e) {
      setLocMsg(
        (e as Error).message ||
          "Couldn't get your location. Allow location access and try again."
      );
    } finally {
      setLocBusy(false);
    }
  }

  async function syncDiscipline() {
    setDiscBusy(true);
    setDiscMsg(null);
    try {
      const r = await fetch("/api/discipline", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Sync failed");
      setDiscMsg(`Synced ${d.files} file${d.files === 1 ? "" : "s"} into your memory.`);
      await Promise.all([loadDisc(), load()]);
    } catch (e) {
      setDiscMsg((e as Error).message);
    } finally {
      setDiscBusy(false);
    }
  }

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
        // Skeleton matching the textarea's footprint so the page chrome
        // doesn't lurch when the profile fetch resolves a moment later.
        <div className="h-72 rounded border border-stone-200 dark:border-stone-800 animate-pulse opacity-30" />
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
              className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent p-3 text-base leading-relaxed whitespace-pre-wrap"
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

      <section className="rounded border border-stone-200 dark:border-stone-800 p-4 space-y-2">
        <h2 className="font-medium">Discipline (GitHub)</h2>
        {disc?.configured ? (
          <>
            <p className="text-xs opacity-70">
              Connected to <span className="font-medium">{disc.repo}</span>.
              {disc.files > 0
                ? ` ${disc.files} file${disc.files === 1 ? "" : "s"} in your memory${disc.lastSynced ? `, synced ${formatLocalTime(disc.lastSynced)}` : ""}.`
                : " Not synced yet."}
            </p>

            <div className="flex items-start justify-between gap-3 pb-2 border-b border-stone-200 dark:border-stone-800">
              <div className="text-xs">
                <p className="font-medium">Share discipline notes with Remarkabler</p>
                <p className="opacity-70">
                  When off, these notes are not fed to Claude and Sync is
                  disabled. Past entries stay saved.
                </p>
              </div>
              <button
                onClick={toggleDiscipline}
                disabled={discEnabled === null || discTogBusy}
                aria-pressed={discEnabled === true}
                className={
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50 " +
                  (discEnabled
                    ? "bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900"
                    : "border border-stone-300 dark:border-stone-700")
                }
              >
                {discEnabled === null ? "…" : discEnabled ? "On" : "Off"}
              </button>
            </div>

            <button
              onClick={syncDiscipline}
              disabled={discBusy || discEnabled === false}
              className="rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-4 py-2 text-sm disabled:opacity-50"
            >
              {discBusy ? "Syncing…" : "Sync now"}
            </button>
            {disc.fileList && disc.fileList.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer opacity-70">
                  Show files ({disc.fileList.length})
                </summary>
                <ul className="mt-1 space-y-0.5 opacity-80">
                  {disc.fileList.map((f, i) => (
                    <li key={i} className="truncate">{f}</li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : (
          <p className="text-xs opacity-70">
            To connect a GitHub repo of discipline notes, set{" "}
            <code>DISCIPLINE_REPO</code> and <code>DISCIPLINE_GITHUB_TOKEN</code>{" "}
            in Railway, then redeploy. A “Sync now” button will appear here.
          </p>
        )}
        {discMsg && <p className="text-sm opacity-70">{discMsg}</p>}
      </section>

      <section className="rounded border border-stone-200 dark:border-stone-800 p-4 space-y-3">
        <h2 className="font-medium">Location</h2>

        <div className="flex items-start justify-between gap-3 pb-2 border-b border-stone-200 dark:border-stone-800">
          <div className="text-xs">
            <p className="font-medium">Share location with Remarkabler</p>
            <p className="opacity-70">
              When off, no location is logged, ingested, or fed to Claude.
              Past entries stay saved but are not used.
            </p>
          </div>
          <button
            onClick={toggleLocation}
            disabled={locEnabled === null || locTogBusy}
            aria-pressed={locEnabled === true}
            className={
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50 " +
              (locEnabled
                ? "bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900"
                : "border border-stone-300 dark:border-stone-700")
            }
          >
            {locEnabled === null ? "…" : locEnabled ? "On" : "Off"}
          </button>
        </div>

        <p className="text-xs opacity-70">
          Tap to log where you are now (with the time). Each tap saves one
          place — tap once a day, or at each spot you want remembered. Your
          recent places are fed to chat. The app can&rsquo;t track you in the
          background, so nothing is recorded unless you tap.
        </p>
        <button
          onClick={logLocation}
          disabled={locBusy || locEnabled === false}
          className="rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-4 py-2 text-sm disabled:opacity-50"
        >
          {locBusy ? "Getting location…" : "Log my location"}
        </button>
        {locMsg && <p className="text-sm opacity-70">{locMsg}</p>}
        {locs.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer opacity-70">
              Recent places ({locs.length})
            </summary>
            <ul className="mt-1 space-y-0.5 opacity-80">
              {locs.map((l, i) => (
                <li key={i} className="truncate">
                  {l.place || "(unnamed)"} — {l.local_time}
                </li>
              ))}
            </ul>
          </details>
        )}

      </section>

      <section className="rounded border border-stone-200 dark:border-stone-800 p-4 space-y-2">
        <h2 className="font-medium">Auto route (OwnTracks)</h2>
        {locEnabled === false && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Location sharing is off — incoming points are rejected. Turn it on
            in the Location section above to use this.
          </p>
        )}
        {ot?.configured ? (
          <>
            <p className="text-xs opacity-70">
              Connected. {ot.points} location point{ot.points === 1 ? "" : "s"}{" "}
              received
              {ot.lastTst
                ? `, last ${new Date(ot.lastTst * 1000).toLocaleString()}`
                : " — none yet (open OwnTracks and wait for it to send)"}
              . Your route (places + how long you stayed) is fed to chat
              automatically — no taps.
            </p>
            <p className="text-xs opacity-70 break-all">
              OwnTracks URL:{" "}
              <code>{origin}/api/owntracks?token=YOUR_TOKEN</code>
            </p>
            <OwnTracksDiagnoseButton />
          </>
        ) : (
          <p className="text-xs opacity-70 break-words">
            Fully automatic background route. One-time setup: (1) set{" "}
            <code>OWNTRACKS_TOKEN</code> to a secret in Railway; (2) install the
            free OwnTracks app, set Mode to “HTTP”, and point its URL at{" "}
            <code>{origin}/api/owntracks?token=YOUR_TOKEN</code>. After that it
            sends your location all day, with nothing to tap.
          </p>
        )}
      </section>

      <section className="rounded border border-stone-200 dark:border-stone-800 p-4 space-y-3">
        <h2 className="font-medium">Claude models</h2>
        <p className="text-xs opacity-70">
          Pick which Claude model runs each task. You only pay per call — switch
          anytime. Your in-app choice overrides anything set on Railway; pick
          the first option to fall back to the Railway / built-in default.
        </p>

        {models ? (
          <>
            {(
              [
                {
                  slot: "chat" as const,
                  label: "Chat",
                  hint:
                    "Answers your daily questions. Sonnet is the balanced everyday pick.",
                  info: models.chat,
                },
                {
                  slot: "main" as const,
                  label: "OCR & memory",
                  hint:
                    "Transcribes your handwriting and updates your evolving memory. Opus is most accurate; this is the worst place to cheap out.",
                  info: models.main,
                },
                {
                  slot: "fallback" as const,
                  label: "Chat fallback",
                  hint:
                    "Used briefly when the chat model is busy. A cheaper tier here means a busy chat still gets an answer.",
                  info: models.fallback,
                },
              ] as const
            ).map(({ slot, label, hint, info }) => {
              const STANDARD = [
                { value: "claude-opus-4-8", label: "Opus 4.8 — strongest, most expensive" },
                { value: "claude-sonnet-4-6", label: "Sonnet 4.6 — balanced" },
                { value: "claude-haiku-4-5", label: "Haiku 4.5 — cheapest, fastest" },
              ];
              const options = STANDARD.slice();
              if (
                info.source === "db" &&
                !STANDARD.some((o) => o.value === info.value)
              ) {
                options.push({ value: info.value, label: `${info.value} (custom)` });
              }
              const sourceLabel =
                info.source === "env"
                  ? `from Railway: ${info.value}`
                  : info.source === "db"
                    ? `your choice: ${info.value}`
                    : `default: ${info.value}`;
              return (
                <div
                  key={slot}
                  className="space-y-1 pt-2 border-t border-stone-100 dark:border-stone-900 first:border-t-0 first:pt-0"
                >
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs opacity-70">{hint}</p>
                  <p className="text-[11px] opacity-60">Currently using {sourceLabel}.</p>
                  <select
                    value={info.source === "db" ? info.value : ""}
                    onChange={(e) => setModel(slot, e.target.value)}
                    disabled={modelsBusy}
                    className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent p-2 text-sm disabled:opacity-50"
                  >
                    <option value="">— Use Railway / default</option>
                    {options.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </>
        ) : (
          <p className="text-xs opacity-60">Loading…</p>
        )}
      </section>

      <section className="rounded border border-stone-200 dark:border-stone-800 p-4 space-y-2">
        <h2 className="font-medium">Semantic search (Voyage)</h2>
        {embed === null ? (
          <p className="text-xs opacity-60">Loading…</p>
        ) : embed.enabled ? (
          <>
            <p className="text-xs opacity-70">
              On — chat finds entries by meaning, not just keywords.{" "}
              <span className="font-medium">
                {embed.embeddedPages}/{embed.totalPages}
              </span>{" "}
              pages embedded ({embed.model}).
              {embed.lastCallAt
                ? ` Last call ${formatLocalTime(embed.lastCallAt)}.`
                : " No calls yet — uploads run this in the background."}
            </p>
            {embed.embeddedPages < embed.totalPages && (
              <>
                <p className="text-xs opacity-60">
                  Remaining pages get embedded automatically the next time the
                  background sweep runs (triggered by chat or upload). If the
                  count looks stuck, tap below to run it now.
                </p>
                <button
                  onClick={runEmbedBackfill}
                  disabled={embedBusy}
                  className="rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-4 py-2 text-sm disabled:opacity-50"
                >
                  {embedBusy ? "Embedding…" : "Backfill now"}
                </button>
              </>
            )}
            {embedMsg && (
              <p className="text-sm opacity-70 whitespace-pre-wrap break-words">
                {embedMsg}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs opacity-70 break-words">
            Off — chat is using keyword (FTS) search only. To turn on, set{" "}
            <code>VOYAGE_API_KEY</code> in Railway and redeploy. Embedding
            costs are tiny (cents per thousand pages).
          </p>
        )}
      </section>

      <section className="rounded border border-stone-200 dark:border-stone-800 p-4 space-y-3">
        <h2 className="font-medium">Auto-ingest from Dropbox</h2>
        {/* lastRevokeWarning lives outside the connected/disconnected
            branches because the most important time to see it is right
            AFTER a disconnect with a failed Dropbox-side revoke — at which
            point dropbox.connected is false and the connected-state block
            never renders. Hoisting it here keeps the message visible
            independent of connection state, so the user knows the token
            may still be live at Dropbox and can revoke it manually. */}
        {dropbox?.lastRevokeWarning && (
          <p className="text-xs text-amber-600 dark:text-amber-400 break-words">
            Heads up: {dropbox.lastRevokeWarning}
          </p>
        )}
        {dropbox === null ? (
          <p className="text-xs opacity-60">Loading…</p>
        ) : !dropbox.configured ? (
          <p className="text-xs opacity-70 break-words">
            Not configured. Set <code>DROPBOX_APP_KEY</code> and{" "}
            <code>DROPBOX_APP_SECRET</code> in Railway and redeploy. This
            section will switch on automatically.
          </p>
        ) : !dropbox.connected ? (
          <>
            <p className="text-xs opacity-70">
              When you tap <strong>Share → Export to integration → Dropbox</strong>
              {" "}on your reMarkable, the PDF lands in{" "}
              <code>{dropbox.folder}</code>. This watcher polls that folder
              every few minutes and ingests new PDFs automatically — same
              pipeline as a manual upload, no extra work after the device-side
              tap.
            </p>
            {dropbox.lastError && (
              <p className="text-xs text-red-600 break-words">
                Last error: {dropbox.lastError}
              </p>
            )}
            <a
              href="/api/dropbox/connect"
              className="inline-block rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-4 py-2 text-sm"
            >
              Connect Dropbox
            </a>
          </>
        ) : (
          <>
            <p className="text-xs opacity-70">
              Connected
              {dropbox.account ? (
                <> as <code>{dropbox.account}</code></>
              ) : null}
              . Watching <code>{dropbox.folder}</code>.{" "}
              {dropbox.ingestedCount === 0
                ? "No notebooks ingested yet — the next one you export from your reMarkable will show up here within a few minutes."
                : `${dropbox.ingestedCount} notebook${dropbox.ingestedCount === 1 ? "" : "s"} ingested so far.`}
            </p>
            <p className="text-xs opacity-70">
              {dropbox.lastSyncAt ? (
                <>Last poll: {formatLocalTime(dropbox.lastSyncAt)}</>
              ) : (
                <>No poll yet — the next maintenance sweep will run one.</>
              )}
              {dropbox.lastSeenFileCount !== null && (
                <> · {dropbox.lastSeenFileCount} file{dropbox.lastSeenFileCount === 1 ? "" : "s"} in folder</>
              )}
            </p>
            {dropbox.lastError && (
              <p className="text-xs text-red-600 break-words">
                Last error: {dropbox.lastError}
              </p>
            )}
            {dropbox.lastSkipped && (
              <p className="text-xs text-amber-600 dark:text-amber-400 break-words">
                Skipped: {dropbox.lastSkipped}
              </p>
            )}
            {/* lastRevokeWarning is rendered above the conditional
                branches so it remains visible after disconnect. */}

            {/* Auto-save the diary Markdown back to Dropbox after each
                ingest. Opt-in: needs the files.content.write scope added to
                the Dropbox app + a reconnect. */}
            <div className="rounded border border-stone-200 dark:border-stone-800 p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Auto-save diary Markdown</p>
                  <p className="text-xs opacity-70">
                    After each diary is transcribed, write a fresh
                    <code className="mx-1">{dropbox.exportPath}</code>
                    into your Dropbox — a portable text copy for Obsidian,
                    NotebookLM, or offline backup. Needs write access:
                    in the Dropbox app console enable
                    <code className="mx-1">files.content.write</code>, then
                    Disconnect + Connect again.
                  </p>
                </div>
                <button
                  onClick={() => toggleDropboxExport(!dropbox.exportEnabled)}
                  disabled={exportBusy}
                  className={
                    "shrink-0 rounded px-3 py-1.5 text-xs disabled:opacity-50 " +
                    (dropbox.exportEnabled
                      ? "bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900"
                      : "border border-stone-300 dark:border-stone-700")
                  }
                >
                  {exportBusy
                    ? "Working…"
                    : dropbox.exportEnabled
                      ? "On"
                      : "Turn on"}
                </button>
              </div>
              {dropbox.exportEnabled && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={runDropboxExportNow}
                    disabled={exportBusy}
                    className="rounded border border-stone-300 dark:border-stone-700 px-3 py-1 text-xs disabled:opacity-50"
                  >
                    Export now
                  </button>
                  {dropbox.exportLastAt && (
                    <span className="text-[11px] opacity-60">
                      Last saved {formatLocalTime(dropbox.exportLastAt)}
                    </span>
                  )}
                </div>
              )}
              {exportMsg && (
                <p className="text-xs opacity-80 break-words">{exportMsg}</p>
              )}
              {dropbox.exportLastError && !exportMsg && (
                <p className="text-xs text-red-600 break-words">
                  {dropbox.exportLastError}
                </p>
              )}
            </div>

            <button
              onClick={disconnectDropbox}
              disabled={dropboxBusy}
              className="rounded border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm disabled:opacity-50"
            >
              {dropboxBusy ? "Disconnecting…" : "Disconnect Dropbox"}
            </button>
          </>
        )}
      </section>

      <section className="rounded border border-stone-200 dark:border-stone-800 p-4 space-y-3">
        <h2 className="font-medium">Backup to GitHub</h2>
        {backup === null ? (
          <p className="text-xs opacity-60">Loading…</p>
        ) : backup.configured ? (
          <>
            <p className="text-xs opacity-70">
              Connected to <code>{backup.repo}</code>. A full snapshot of
              your database, PDFs, and chat attachments is pushed there
              automatically about once a week. The repo keeps the latest
              12 snapshots (~3 months); older ones are pruned so storage
              doesn&rsquo;t balloon forever. The repo is yours; even if
              Remarkabler or its host disappears, the record survives.
            </p>
            <p className="text-xs opacity-70">
              {backup.lastAt ? (
                <>Last backup: {formatLocalTime(backup.lastAt)}</>
              ) : (
                <>No backup yet — tap below to run the first one now.</>
              )}
              {backup.lastSizeBytes !== null && backup.lastAt && (
                <> · {formatBytes(backup.lastSizeBytes)}</>
              )}
            </p>
            {backup.lastError && (
              <p className="text-xs text-red-600">
                Last error: {backup.lastError}
              </p>
            )}
            <button
              onClick={runManualBackup}
              disabled={backupBusy}
              className="rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-4 py-2 text-sm disabled:opacity-50"
            >
              {backupBusy ? "Backing up…" : "Backup now"}
            </button>
          </>
        ) : (
          <p className="text-xs opacity-70 break-words">
            Not configured. Off-site auto-backup needs two env vars in
            Railway: <code>BACKUP_REPO</code> (e.g.{" "}
            <code>you/remarkabler-backup</code>) and a fine-grained{" "}
            <code>BACKUP_GITHUB_TOKEN</code> with write access to just that
            repo. Add them and redeploy; this section will switch on.
          </p>
        )}
      </section>

      <ChatMemorySection />

      <section className="rounded border border-stone-200 dark:border-stone-800 p-4 space-y-3">
        <h2 className="font-medium">Export</h2>

        <div className="space-y-1.5">
          <p className="text-xs opacity-70">
            <strong>Diary as Markdown.</strong> Just your transcribed diary,
            one entry per day (oldest first), as plain text you own. A
            portable backup that outlives this app — drop it into Obsidian,
            upload it to Google NotebookLM for an audio &ldquo;podcast&rdquo;
            of your month, or keep it as offline insurance. Instant download,
            zero cost.
          </p>
          <a
            href="/api/export/diary"
            download
            className="inline-block rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-4 py-2 text-sm"
          >
            Download diary (Markdown)
          </a>
        </div>

        <div className="space-y-1.5 pt-3 border-t border-stone-200 dark:border-stone-800">
          <p className="text-xs opacity-70">
            <strong>Raw bundle.</strong> Everything in one Markdown file:
            profile, every diary (chronological), every chat (including
            cleared ones — they&rsquo;re never deleted, only hidden), all
            insights. Instant download, zero cost.
          </p>
          <a
            href="/api/export"
            download
            className="inline-block rounded border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm"
          >
            Download raw bundle
          </a>
        </div>

        <div className="space-y-1.5 pt-3 border-t border-stone-200 dark:border-stone-800">
          <p className="text-xs opacity-70">
            <strong>Composed by Claude.</strong> An editor pass on Opus that
            turns the raw bundle into a real chaptered book — prologue,
            chronological chapters with quoted diary excerpts, a &ldquo;what
            I&rsquo;ve noticed&rdquo; reflection, and a closing on the present.
            Takes a minute or two; costs about <strong>$1–2</strong> per
            run on Opus (visible on the Cost tab).
          </p>
          <button
            onClick={composeBookDraft}
            disabled={bookBusy}
            className="rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-4 py-2 text-sm disabled:opacity-50"
          >
            {bookBusy ? "Composing…" : "Compose with Claude"}
          </button>
          {bookMsg && <p className="text-sm opacity-70">{bookMsg}</p>}
        </div>
      </section>
    </div>
  );
}

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

function ChatMemorySection() {
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
    <section className="rounded border border-stone-200 dark:border-stone-800 p-4 space-y-3">
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
            <div className="rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-2 space-y-1.5">
              <p className="text-xs text-amber-800 dark:text-amber-300">
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
                className="rounded border border-amber-400 dark:border-amber-700 px-3 py-1 text-xs text-amber-800 dark:text-amber-300 disabled:opacity-50"
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
              <button
                onClick={retryStuck}
                disabled={retryBusy}
                className="rounded border border-red-300 dark:border-red-800 px-3 py-1 text-xs text-red-700 dark:text-red-300 disabled:opacity-50"
              >
                {retryBusy ? "Retrying…" : "Retry stuck batches"}
              </button>
              {retryMsg && (
                <p className="text-xs opacity-70">{retryMsg}</p>
              )}
            </div>
          )}
          <div className="space-y-1.5 pt-1">
            <button
              onClick={backfillAll}
              disabled={backfillBusy}
              className="rounded border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {backfillBusy
                ? "Processing…"
                : "Re-process all chat history (clean)"}
            </button>
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
                  ? "bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900"
                  : "border border-stone-300 dark:border-stone-700 opacity-80")
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
              className="rounded border border-stone-200 dark:border-stone-800 p-2.5 space-y-1.5"
            >
              <div className="flex items-start gap-2">
                <span className="shrink-0 rounded-full bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-[10px] uppercase tracking-wide opacity-80">
                  {m.category}
                </span>
                <p className="text-sm leading-snug flex-1 min-w-0 break-words">{m.text}</p>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] opacity-60">
                <span>{formatLocalTime(m.created_at)}</span>
                {m.missing_embedding === 1 && (
                  <span className="text-amber-600 dark:text-amber-400">
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

// Inline diagnostic button + result for the OwnTracks ingestion. Fetches
// /api/owntracks?debug=1 and dumps the raw JSON below the button. Visible
// only when OwnTracks is configured. Used when the chat reports "no
// location data" while the ingestion status looks healthy — the JSON
// shows exactly what the chat tool sees (point counts, stay counts,
// sample raw points, server clock).
function OwnTracksDiagnoseButton() {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/owntracks?debug=1");
      if (!r.ok) throw new Error(`Failed: ${r.status}`);
      setData(await r.json());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (data === null) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopyMsg("Copied to clipboard.");
      setTimeout(() => setCopyMsg(null), 2000);
    } catch {
      setCopyMsg("Copy failed — long-press to select the JSON manually.");
    }
  }
  // Pull out the summary fields so a glance is enough — no need to expand
  // the raw JSON to see whether ingestion is healthy. Coordinates are
  // never shown in the summary; they're behind the `<details>` toggle.
  type Summary = {
    serverTimeUtc?: string;
    totalPoints?: number;
    lastTstFormattedKst?: string | null;
    current?: { minutesAgo?: number; place?: string | null } | null;
    windows?: Array<{
      days?: number;
      pointCount?: number;
      stays?: unknown[];
    }>;
  };
  const summary: Summary | null = (data as Summary) ?? null;
  return (
    <div className="space-y-2">
      <button
        onClick={run}
        disabled={busy}
        className="rounded border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-xs opacity-80 hover:opacity-100 disabled:opacity-40"
      >
        {busy ? "Diagnosing…" : "Diagnose location pipeline"}
      </button>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {data !== null && summary && (
        <div className="space-y-1 text-xs opacity-80">
          <p>
            Server clock:{" "}
            <span className="font-mono">{summary.serverTimeUtc}</span>
            {" · "}
            Total points:{" "}
            <span className="font-mono">{summary.totalPoints}</span>
            {" · "}
            Latest: {summary.lastTstFormattedKst ?? "—"}
          </p>
          {summary.current && (
            <p>
              Current position: {summary.current.minutesAgo} min ago
              {summary.current.place ? ` · ${summary.current.place}` : ""}
            </p>
          )}
          {summary.windows?.map((w, i) => (
            <p key={i}>
              {w.days}d window: {w.pointCount} points · {w.stays?.length ?? 0}{" "}
              stay{(w.stays?.length ?? 0) === 1 ? "" : "s"}
            </p>
          ))}
        </div>
      )}
      {data !== null && (
        <details className="text-xs opacity-80">
          <summary className="cursor-pointer">
            Raw JSON — contains approximate coordinates (rounded to ~100m).
            Don&rsquo;t screenshot this for sharing if you&rsquo;re privacy-
            cautious; use Copy instead.
          </summary>
          <div className="space-y-1 pt-2">
            <button
              onClick={copy}
              className="rounded border border-stone-300 dark:border-stone-700 px-2 py-1 text-[11px]"
            >
              Copy raw JSON
            </button>
            {copyMsg && <span className="text-[11px] opacity-70 ml-2">{copyMsg}</span>}
            <pre className="text-[10px] leading-relaxed whitespace-pre-wrap break-words bg-stone-100 dark:bg-stone-900 rounded p-2 max-h-96 overflow-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
}
