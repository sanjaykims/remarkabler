"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { timeColor, timeFraction } from "@/lib/mapData";

export type MapStayDto = {
  lat: number;
  lng: number;
  start: number;
  place: string | null;
  date: string;
  startTime: string;
  endTime: string;
};
export type RoutePointDto = { lat: number; lng: number; tst: number };

// Leaflet map. Uses only vector layers (polyline + circleMarker) so no marker
// image assets are needed. Tiles are OpenStreetMap's public tile server.
export default function MapView({
  stays,
  route,
  latest,
  focus,
}: {
  stays: MapStayDto[];
  route: RoutePointDto[];
  latest: RoutePointDto | null;
  focus: number | null;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true }).setView([37.5665, 126.978], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const bounds: L.LatLngTuple[] = [];
    // Colour = time. Earliest point of the range is blue, latest is orange.
    const t0 = route.length ? route[0].tst : 0;
    const t1 = route.length ? route[route.length - 1].tst : 0;
    if (route.length > 1) {
      for (let i = 1; i < route.length; i++) {
        const a = route[i - 1];
        const b = route[i];
        L.polyline(
          [
            [a.lat, a.lng],
            [b.lat, b.lng],
          ],
          { color: timeColor(timeFraction(b.tst, t0, t1)), weight: 4, opacity: 0.9, lineCap: "round" }
        ).addTo(g);
        bounds.push([a.lat, a.lng]);
      }
      bounds.push([route[route.length - 1].lat, route[route.length - 1].lng]);
    }
    stays.forEach((s) => {
      const label = `${s.place ?? `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`}<br>${s.date} ${s.startTime}–${s.endTime}`;
      L.circleMarker([s.lat, s.lng], {
        radius: 8,
        color: "#ffffff",
        weight: 3,
        fillColor: timeColor(timeFraction(s.start, t0, t1)),
        fillOpacity: 0.95,
      })
        .bindPopup(label)
        .addTo(g);
      bounds.push([s.lat, s.lng]);
    });
    if (latest) {
      L.circleMarker([latest.lat, latest.lng], {
        radius: 6,
        color: "#fff",
        weight: 2,
        fillColor: "#dc2626",
        fillOpacity: 1,
      })
        .bindPopup("Latest position")
        .addTo(g);
      bounds.push([latest.lat, latest.lng]);
    }
    if (bounds.length) m.fitBounds(L.latLngBounds(bounds), { padding: [24, 24], maxZoom: 16 });
  }, [stays, route, latest]);

  useEffect(() => {
    const m = map.current;
    if (!m || focus === null || !stays[focus]) return;
    m.flyTo([stays[focus].lat, stays[focus].lng], 17, { duration: 0.6 });
  }, [focus, stays]);

  return <div ref={el} className="h-[55vh] w-full rounded border border-slate-200 dark:border-slate-800 z-0" />;
}
