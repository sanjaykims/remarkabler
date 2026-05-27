import crypto from "crypto";
import { db } from "./db";

// OwnTracks background-location ingestion. The app receives raw points, then
// clusters them into "stays" (a place you stayed a while) with arrival/leave
// times and dwell, names each via reverse geocoding (cached), and feeds the
// recent route to chat. Enabled only when OWNTRACKS_TOKEN is set.

// Minutes to add to UTC for display (default Seoul, UTC+9). Override with
// LOCATION_TZ_OFFSET.
const TZ_OFFSET = Number(process.env.LOCATION_TZ_OFFSET || "540");
const STAY_RADIUS_KM = 0.2;
const MIN_DWELL_SEC = 8 * 60;

export function owntracksConfigured(): boolean {
  return !!process.env.OWNTRACKS_TOKEN;
}

export function checkOwntracksToken(token: string | null): boolean {
  const expected = process.env.OWNTRACKS_TOKEN || "";
  if (!expected || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function addPoint(p: {
  lat: number;
  lng: number;
  tst: number;
  acc?: number | null;
}): void {
  db()
    .prepare(`INSERT INTO location_points(lat, lng, tst, acc) VALUES(?,?,?,?)`)
    .run(p.lat, p.lng, p.tst, p.acc ?? null);
}

export function owntracksStatus(): {
  configured: boolean;
  points: number;
  lastTst: number | null;
} {
  const row = db()
    .prepare(`SELECT COUNT(*) AS c, MAX(tst) AS last FROM location_points`)
    .get() as { c: number; last: number | null };
  return { configured: owntracksConfigured(), points: row.c, lastTst: row.last };
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

type Stay = { lat: number; lng: number; start: number; end: number };

function recentStays(days: number): Stay[] {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const pts = db()
    .prepare(
      `SELECT lat, lng, tst FROM location_points WHERE tst >= ? ORDER BY tst ASC`
    )
    .all(since) as Array<{ lat: number; lng: number; tst: number }>;

  const stays: Stay[] = [];
  let i = 0;
  while (i < pts.length) {
    let j = i + 1;
    while (
      j < pts.length &&
      haversineKm(pts[i].lat, pts[i].lng, pts[j].lat, pts[j].lng) <= STAY_RADIUS_KM
    ) {
      j++;
    }
    const dwell = pts[j - 1].tst - pts[i].tst;
    if (dwell >= MIN_DWELL_SEC) {
      let sLat = 0;
      let sLng = 0;
      for (let k = i; k < j; k++) {
        sLat += pts[k].lat;
        sLng += pts[k].lng;
      }
      const n = j - i;
      stays.push({ lat: sLat / n, lng: sLng / n, start: pts[i].tst, end: pts[j - 1].tst });
    }
    i = j > i ? j : i + 1;
  }
  return stays;
}

async function geocode(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = db()
    .prepare(`SELECT place FROM geocode_cache WHERE key = ?`)
    .get(key) as { place: string } | undefined;
  if (cached) return cached.place;

  let place = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&accept-language=en`,
      { headers: { "User-Agent": "Remarkabler/1.0 (personal journaling app)" } }
    );
    if (r.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = (await r.json()) as any;
      const a = j.address || {};
      const label = [
        j.name || a.amenity || a.shop || a.building,
        a.suburb || a.neighbourhood || a.city_district,
        a.city || a.town || a.village,
      ]
        .filter(Boolean)
        .join(", ");
      place = label || j.display_name || place;
    }
  } catch {
    // keep coordinates
  }
  db().prepare(`INSERT OR IGNORE INTO geocode_cache(key, place) VALUES(?, ?)`).run(key, place);
  return place;
}

function fmtLocal(tst: number): { date: string; time: string } {
  const d = new Date((tst + TZ_OFFSET * 60) * 1000);
  const iso = d.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

function durationLabel(startTst: number, endTst: number): string {
  const min = Math.round((endTst - startTst) / 60);
  if (min <= 0) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** Recent route (stays with dwell) from OwnTracks points, for the chat context. */
export async function owntracksRouteContext(days = 3): Promise<string> {
  const stays = recentStays(days).slice(-40);
  if (stays.length === 0) return "";
  const lines: string[] = [];
  let day = "";
  for (const s of stays) {
    const place = await geocode(s.lat, s.lng);
    const sf = fmtLocal(s.start);
    const ef = fmtLocal(s.end);
    if (sf.date !== day) {
      day = sf.date;
      lines.push(`${day}:`);
    }
    const dur = durationLabel(s.start, s.end);
    lines.push(`  - ${place} (${sf.time}–${ef.time}${dur ? `, ${dur}` : ""})`);
  }
  return lines.join("\n");
}
