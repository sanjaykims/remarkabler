import { db } from "./db";

// Parse a Google Maps Timeline / Location History export into "stops" (a place
// with arrival/departure times), store them, and summarize the recent route
// for the chat context. Supports the two common export shapes; on an
// unrecognized file it returns a structural hint (key names only, never the
// location data) so the format can be added.

export type Stop = {
  place: string;
  lat: number | null;
  lng: number | null;
  start: string;
  end: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseLatLngString(s: string): { lat: number | null; lng: number | null } {
  const m = s.match(/(-?\d+(?:\.\d+)?)[^\d-]+(-?\d+(?:\.\d+)?)/);
  if (!m) return { lat: null, lng: null };
  return { lat: Number(m[1]), lng: Number(m[2]) };
}

export function parseTimeline(json: unknown): { stops: Stop[]; hint: string } {
  const stops: Stop[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = json as any;

  // Format A — Takeout "Semantic Location History": timelineObjects[].placeVisit
  const timelineObjects = root?.timelineObjects;
  if (Array.isArray(timelineObjects)) {
    for (const o of timelineObjects) {
      const v = o?.placeVisit;
      const start = v?.duration?.startTimestamp;
      const end = v?.duration?.endTimestamp;
      if (!start || !end) continue;
      const loc = v?.location || {};
      const lat = typeof loc.latitudeE7 === "number" ? loc.latitudeE7 / 1e7 : null;
      const lng = typeof loc.longitudeE7 === "number" ? loc.longitudeE7 / 1e7 : null;
      const place =
        loc.name ||
        loc.address ||
        (lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "");
      stops.push({ place, lat, lng, start, end });
    }
  }

  // Format B — on-device export: semanticSegments[].visit
  const segments = root?.semanticSegments;
  if (stops.length === 0 && Array.isArray(segments)) {
    for (const s of segments) {
      const v = s?.visit;
      const start = s?.startTime;
      const end = s?.endTime;
      if (!v || !start || !end) continue;
      const latLngStr = v?.topCandidate?.placeLocation?.latLng;
      const { lat, lng } = latLngStr
        ? parseLatLngString(String(latLngStr))
        : { lat: null, lng: null };
      const place =
        v?.topCandidate?.placeName ||
        (lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "");
      stops.push({ place, lat, lng, start, end });
    }
  }

  let hint = "";
  if (stops.length === 0) {
    const keys = root && typeof root === "object" ? Object.keys(root) : [];
    const parts = keys.slice(0, 12).map((k) => {
      const val = root[k];
      if (Array.isArray(val)) return `${k}[${val.length}]`;
      return `${k}:${typeof val}`;
    });
    hint = parts.join(", ") || "no recognizable structure";
  }
  return { stops, hint };
}

export function saveStops(stops: Stop[]): number {
  const ins = db().prepare(
    `INSERT OR IGNORE INTO route_stops(place, lat, lng, start_time, end_time)
     VALUES(?,?,?,?,?)`
  );
  let added = 0;
  const tx = db().transaction((arr: Stop[]) => {
    for (const s of arr) {
      const r = ins.run(s.place || "", s.lat, s.lng, s.start, s.end);
      added += r.changes;
    }
  });
  tx(stops);
  return added;
}

export function routeStopCount(): number {
  const r = db().prepare(`SELECT COUNT(*) AS c FROM route_stops`).get() as {
    c: number;
  };
  return r.c;
}

function durationLabel(start: string, end: string): string {
  const ms = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const min = Math.round(ms / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** Recent route grouped by day for the chat context. */
export function recentRouteContext(maxStops = 60): string {
  const rows = db()
    .prepare(
      `SELECT place, start_time, end_time FROM route_stops
       ORDER BY start_time DESC LIMIT ?`
    )
    .all(maxStops) as Array<{ place: string; start_time: string; end_time: string }>;
  if (rows.length === 0) return "";
  rows.reverse();

  const lines: string[] = [];
  let day = "";
  for (const r of rows) {
    const d = (r.start_time || "").slice(0, 10);
    if (d !== day) {
      day = d;
      lines.push(`${d}:`);
    }
    const from = (r.start_time || "").slice(11, 16);
    const to = (r.end_time || "").slice(11, 16);
    const dur = durationLabel(r.start_time, r.end_time);
    lines.push(`  - ${r.place || "(unknown place)"} (${from}–${to}${dur ? `, ${dur}` : ""})`);
  }
  return lines.join("\n");
}
