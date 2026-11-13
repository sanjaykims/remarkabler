"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Eyebrow } from "@/components/Eyebrow";
import type { MapStayDto, RoutePointDto } from "./MapView";
import PinGate from "./PinGate";
import { movementWindow, timeColor } from "@/lib/mapData";

// Leaflet touches `window`, so it must only load in the browser.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-[55vh] rounded border border-slate-200 dark:border-slate-800" />,
});

const RANGES = [
  { days: 1, label: "Today" },
  { days: 2, label: "2 days" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
];

type Data = { tzOffsetMin: number; stays: MapStayDto[]; route: RoutePointDto[]; latest: RoutePointDto | null };

function fmt(tst: number, offMin: number): string {
  const iso = new Date((tst + offMin * 60) * 1000).toISOString();
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}`;
}

type Gate = { configured: boolean; unlocked: boolean; lockedMs: number; attemptsLeft: number };

export default function MapPage() {
  const [gate, setGate] = useState<Gate | null>(null);
  const [days, setDays] = useState(1);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<number | null>(null);

  // Ask the server whether the PIN is already satisfied.
  useEffect(() => {
    fetch("/api/map/pin")
      .then((r) => r.json())
      .then((g) => setGate(g))
      .catch(() => setError("Couldn't reach the server."));
  }, []);

  // Re-lock whenever you leave the tab or the page goes to the background, so
  // opening the Map always asks for the PIN again.
  useEffect(() => {
    const lock = () => {
      fetch("/api/map/pin", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lock" }),
      }).catch(() => {});
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        lock();
        setData(null);
        setGate((g) => (g ? { ...g, unlocked: false } : g));
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", lock);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", lock);
      lock();
    };
  }, []);

  useEffect(() => {
    if (!gate?.unlocked) return;
    let cancelled = false;
    setData(null);
    setError(null);
    setFocus(null);
    fetch(`/api/map?days=${days}`)
      .then((r) => {
        if (r.status === 403) {
          setGate((g) => (g ? { ...g, unlocked: false } : g));
          return Promise.reject(new Error("PIN required"));
        }
        return r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`));
      })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(String(e.message || e)));
    return () => {
      cancelled = true;
    };
  }, [days, gate?.unlocked]);

  const stays = data?.stays ?? [];

  return (
    <div className="space-y-5">
      <section className="space-y-2 pt-1">
        <Eyebrow>Where I&apos;ve been</Eyebrow>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">Map</h1>
        <p className="opacity-70 text-sm leading-relaxed max-w-prose">
          Your OwnTracks trail. The line goes from blue (first move of the day) to orange (last arrival). Round dots are places you stayed, coloured by when you arrived; the red-ringed dot is your latest position.
        </p>
      </section>

      {gate && !gate.unlocked && (
        <PinGate
          configured={gate.configured}
          lockedMs={gate.lockedMs}
          attemptsLeft={gate.attemptsLeft}
          onUnlocked={() => setGate({ ...gate, configured: true, unlocked: true, lockedMs: 0 })}
        />
      )}

      {gate?.unlocked && (<>
      <div className="flex gap-2 flex-wrap">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            aria-pressed={days === r.days}
            className={`px-3 py-1.5 rounded border text-sm ${
              days === r.days
                ? "border-sky-600 bg-sky-600 text-white"
                : "border-slate-300 dark:border-slate-700"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">Couldn&apos;t load the map data ({error}).</p>}

      <MapView
        stays={stays}
        route={data?.route ?? []}
        latest={data?.latest ?? null}
        focus={focus}
      />

      {data && data.route.length > 1 && (
        <div className="space-y-1">
          <div
            aria-hidden
            className="h-2.5 rounded"
            style={{
              background: `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1].map(timeColor).join(", ")})`,
            }}
          />
          <div className="flex justify-between text-xs opacity-70">
            <span>First move · {fmt(movementWindow(data.route).from, data.tzOffsetMin)}</span>
            <span>Last arrival · {fmt(movementWindow(data.route).to, data.tzOffsetMin)}</span>
          </div>
        </div>
      )}

      {data && stays.length === 0 && (
        <p className="text-sm opacity-70">
          No stays recorded in this range yet. A stay needs about 8 minutes in one spot.
        </p>
      )}

      <ul className="space-y-2">
        {stays
          .map((s, i) => ({ s, i }))
          .reverse()
          .map(({ s, i }) => (
            <li key={i}>
              <button
                onClick={() => setFocus(i)}
                className="w-full text-left rounded border border-slate-200 dark:border-slate-800 p-3"
              >
                <div className="text-sm font-medium">
                  {s.place ?? `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`}
                </div>
                <div className="text-xs opacity-70">
                  {s.date} · {s.startTime}–{s.endTime}
                </div>
              </button>
            </li>
          ))}
      </ul>

      </>)}

      <p className="text-xs opacity-60 leading-relaxed">
        Privacy: the map background is loaded from OpenStreetMap&apos;s tile server, which can see the
        area you are viewing. Your OwnTracks data itself never leaves this app.
      </p>
    </div>
  );
}
