"use client";

import { useEffect, useRef, useState } from "react";
import { formatLocalTime } from "@/lib/format";
import { setPickingFile } from "../lockState";

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
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const timelineRef = useRef<HTMLInputElement>(null);
  const [ot, setOt] = useState<{
    configured: boolean;
    points: number;
    lastTst: number | null;
  } | null>(null);

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

  useEffect(() => {
    load();
    loadDisc();
    loadLocs();
    loadOt();
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

  function openTimelinePicker() {
    setPickingFile(true);
    const done = () => {
      window.removeEventListener("focus", done);
      setTimeout(() => setPickingFile(false), 300);
    };
    window.addEventListener("focus", done);
    timelineRef.current?.click();
  }

  async function importTimeline(file: File | null) {
    if (!file) return;
    setImportBusy(true);
    setImportMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/location/import", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Import failed");
      setImportMsg(
        `Imported ${d.added} new stop${d.added === 1 ? "" : "s"} (${d.total} total) into your route.`
      );
    } catch (e) {
      setImportMsg((e as Error).message);
    } finally {
      setImportBusy(false);
    }
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
            <button
              onClick={syncDiscipline}
              disabled={discBusy}
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

      <section className="rounded border border-stone-200 dark:border-stone-800 p-4 space-y-2">
        <h2 className="font-medium">Location</h2>
        <p className="text-xs opacity-70">
          Tap to log where you are now (with the time). Each tap saves one
          place — tap once a day, or at each spot you want remembered. Your
          recent places are fed to chat. The app can&rsquo;t track you in the
          background, so nothing is recorded unless you tap.
        </p>
        <button
          onClick={logLocation}
          disabled={locBusy}
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

        <div className="pt-3 mt-1 border-t border-stone-200 dark:border-stone-800 space-y-2">
          <p className="text-xs opacity-70">
            Full daily route: in Google Maps, open your Timeline → Settings →{" "}
            <em>Export Timeline data</em>, then upload that file here. I read each
            place with its arrival/leave time and how long you stayed, and feed
            it to chat.
          </p>
          <input
            ref={timelineRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              importTimeline(e.target.files?.[0] || null);
              e.target.value = "";
            }}
          />
          <button
            onClick={openTimelinePicker}
            disabled={importBusy}
            className="rounded border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm disabled:opacity-50"
          >
            {importBusy ? "Importing…" : "Upload location timeline"}
          </button>
          {importMsg && <p className="text-sm opacity-70">{importMsg}</p>}
        </div>
      </section>

      <section className="rounded border border-stone-200 dark:border-stone-800 p-4 space-y-2">
        <h2 className="font-medium">Auto route (OwnTracks)</h2>
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
    </div>
  );
}
