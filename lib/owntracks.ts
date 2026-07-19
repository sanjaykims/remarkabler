import crypto from "crypto";
import { db } from "./db";
import { TZ_OFFSET_MIN } from "./format";

// OwnTracks background-location ingestion. The app receives raw points, then
// clusters them into "stays" (a place you stayed a while) with arrival/leave
// times and dwell, names each via reverse geocoding (cached), and feeds the
// recent route to chat. Enabled only when OWNTRACKS_TOKEN is set.

const STAY_RADIUS_KM = 0.2;
const MIN_DWELL_SEC = 8 * 60;

export function owntracksConfigured(): boolean {
  return !!process.env.OWNTRACKS_TOKEN;
}

export function checkOwntracksToken(token: string | null): boolean {
  const expected = process.env.OWNTRACKS_TOKEN || "";
  if (!expected || !token) return false;
  // Hash both sides first so the timing-safe compare always runs on
  // fixed-length digests — comparing raw buffer lengths first would leak
  // the expected token's length via response timing.
  const a = crypto.createHash("sha256").update(token).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
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

// Last known position + recency context for chat. This is what answers
// "where am I now?".
//
// CRITICAL: OwnTracks publishes mostly on MOVEMENT (plus a coarse interval),
// so a STATIONARY user — sitting at the office all day — produces no new
// points for hours even though they haven't moved. An old newest-point is
// therefore usually POSITIVE evidence they're still there, not evidence the
// position is unreliable. So we do NOT drop the point just because it's a few
// hours old (the previous 6h hard cutoff did exactly that, and made chat
// answer "where am I now?" with last night's stay — the bug this fixes).
// Instead we return the last known point up to a full stationary day+night
// (36h) and mark it `stale` when it's old enough to be "last known" rather
// than "live", so chat can phrase the age honestly. Beyond 36h we return null
// (don't confidently report last week as "current").
//
// `place` is filled in only when the coords are already in the geocode
// cache — we don't synchronously hit Nominatim on the chat hot path. Same
// background warmer that primes stay-place names will fill this in too.
export type CurrentLocation = {
  lat: number;
  lng: number;
  tst: number;
  /** KST wall-clock formatted as "YYYY-MM-DD HH:MM". */
  atTime: string;
  /** Whole minutes between the point's tst and request time. */
  minutesAgo: number;
  /** Geocoded place name if already cached, otherwise null. */
  place: string | null;
  /**
   * true → this is a "last known" position (older than the live threshold),
   * not a fresh ping. On a movement-published phone that usually still means
   * "they're there and haven't moved", so chat should report it (with the
   * age) rather than say "no current location".
   */
  stale: boolean;
};
// Under this, the point is "live"; above it (but within the max), it's a
// still-useful "last known" position that we flag stale.
const CURRENT_LOCATION_LIVE_SEC = 45 * 60; // 45 minutes
// Beyond this we stop calling the newest point "current" at all — a full
// stationary day + overnight without any ping is where "last known" stops
// being a safe assumption.
const CURRENT_LOCATION_MAX_AGE_SEC = 36 * 60 * 60; // 36 hours

export function currentLocation(): CurrentLocation | null {
  const row = db()
    .prepare(`SELECT lat, lng, tst FROM location_points ORDER BY tst DESC LIMIT 1`)
    .get() as { lat: number; lng: number; tst: number } | undefined;
  if (!row) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  const ageSec = nowSec - row.tst;
  if (ageSec > CURRENT_LOCATION_MAX_AGE_SEC) return null;
  const local = fmtLocal(row.tst);
  return {
    lat: row.lat,
    lng: row.lng,
    tst: row.tst,
    atTime: `${local.date} ${local.time}`,
    minutesAgo: Math.max(0, Math.round(ageSec / 60)),
    place: cachedPlace(row.lat, row.lng),
    stale: ageSec > CURRENT_LOCATION_LIVE_SEC,
  };
}

// Inter-point gap analysis. The server stores every point OwnTracks POSTs
// (addPoint has no throttle/dedup), so a gap in this series means the PHONE
// stopped publishing — Android Doze suspending the app, or a Significant-mode
// monitoring setting that only fires on movement. This is the tool that tells
// a "why is there a 92-minute hole?" question apart from a server bug: if the
// gaps are here, the data never reached us. Pure + exported for unit tests;
// carries only timestamps (no coordinates), so it's safe to screenshot.
export type LocationGap = { startTst: number; endTst: number; minutes: number };
export type GapStats = {
  windowHours: number;
  pointCount: number;
  /** first→last point span, in minutes. */
  spanMinutes: number;
  /** points ÷ span; null when fewer than 2 points. */
  pointsPerHour: number | null;
  /** median consecutive-point gap; null when fewer than 2 points. */
  medianGapMinutes: number | null;
  /** largest consecutive-point gap in the window. */
  maxGap: LocationGap | null;
  /** how many consecutive gaps exceeded 30 minutes. */
  gapsOver30Min: number;
  /** the 5 longest consecutive gaps, descending. */
  longestGaps: LocationGap[];
  /** now − newest point, minutes; the still-open "we've heard nothing" gap. */
  trailingGapMinutes: number;
};

export function analyzeGaps(
  tsts: number[],
  nowSec: number,
  windowHours: number
): GapStats {
  const sorted = [...tsts].sort((a, b) => a - b);
  const n = sorted.length;
  const round1 = (x: number) => Math.round(x * 10) / 10;
  const gaps: LocationGap[] = [];
  for (let i = 1; i < n; i++) {
    gaps.push({
      startTst: sorted[i - 1],
      endTst: sorted[i],
      minutes: round1((sorted[i] - sorted[i - 1]) / 60),
    });
  }
  const sortedMins = gaps.map((g) => g.minutes).sort((a, b) => a - b);
  let median: number | null = null;
  if (sortedMins.length) {
    const mid = Math.floor(sortedMins.length / 2);
    median =
      sortedMins.length % 2
        ? sortedMins[mid]
        : round1((sortedMins[mid - 1] + sortedMins[mid]) / 2);
  }
  const span = n >= 2 ? sorted[n - 1] - sorted[0] : 0;
  const longest = [...gaps].sort((a, b) => b.minutes - a.minutes).slice(0, 5);
  return {
    windowHours,
    pointCount: n,
    spanMinutes: Math.round(span / 60),
    pointsPerHour: span > 0 ? round1(n / (span / 3600)) : null,
    medianGapMinutes: median,
    maxGap: longest[0] ?? null,
    gapsOver30Min: gaps.filter((g) => g.minutes > 30).length,
    longestGaps: longest,
    trailingGapMinutes: n ? Math.round((nowSec - sorted[n - 1]) / 60) : 0,
  };
}

// The last-24h gap summary, computed from the raw point series. Cheap (one
// bounded query) so it can ride on owntracksStatus() and render inline on the
// Memory page without the debug button.
export function gapStatsForWindow(windowHours: number): GapStats {
  const nowSec = Math.floor(Date.now() / 1000);
  const since = nowSec - windowHours * 3600;
  const rows = db()
    .prepare(`SELECT tst FROM location_points WHERE tst >= ? ORDER BY tst ASC`)
    .all(since) as Array<{ tst: number }>;
  return analyzeGaps(
    rows.map((r) => r.tst),
    nowSec,
    windowHours
  );
}

export function owntracksStatus(): {
  configured: boolean;
  points: number;
  lastTst: number | null;
  gaps24h: GapStats;
} {
  const row = db()
    .prepare(`SELECT COUNT(*) AS c, MAX(tst) AS last FROM location_points`)
    .get() as { c: number; last: number | null };
  return {
    configured: owntracksConfigured(),
    points: row.c,
    lastTst: row.last,
    gaps24h: gapStatsForWindow(24),
  };
}

// Diagnostic snapshot for the Memory page. Bounded, sanitised — exposes
// what the chat tool would see, so a user (or a future agent) can tell at
// a glance whether the chat-side "no location data" complaint is a query
// bug, a clustering bug, an empty-DB bug, or a clock issue.
//
// Added after a real outage in which the OwnTracks ingestion was working
// (175k+ points, last point recent) but the chat tool reported empty —
// turned out to be impossible to diagnose without DB access. Now anyone
// can hit /api/owntracks?debug=1 and see exactly what the chat tool sees.
export function owntracksDebug(): {
  serverEpochSec: number;
  serverTimeUtc: string;
  totalPoints: number;
  lastTst: number | null;
  lastTstFormattedKst: string | null;
  current: {
    lat: number;
    lng: number;
    tst: number;
    atTime: string;
    minutesAgo: number;
    place: string | null;
    stale: boolean;
  } | null;
  windows: Array<{
    days: number;
    sinceEpochSec: number;
    pointCount: number;
    firstTstInWindow: number | null;
    lastTstInWindow: number | null;
    stays: Array<{
      lat: number;
      lng: number;
      start: number;
      end: number;
      dwellMinutes: number;
    }>;
    samplePoints: Array<{ lat: number; lng: number; tst: number }>;
    gaps: GapStats;
  }>;
} {
  const status = owntracksStatus();
  const nowSec = Math.floor(Date.now() / 1000);
  const lastTstFormattedKst = status.lastTst
    ? new Date((status.lastTst + TZ_OFFSET_MIN * 60) * 1000)
        .toISOString()
        .replace("T", " ")
        .slice(0, 19) + " KST"
    : null;

  const summarise = (days: number) => {
    const since = nowSec - days * 86400;
    const pts = db()
      .prepare(
        `SELECT lat, lng, tst FROM location_points WHERE tst >= ? ORDER BY tst ASC`
      )
      .all(since) as Array<{ lat: number; lng: number; tst: number }>;
    const stays = recentStays(days).slice(-40).map((s) => ({
      // Stay centroids are also rounded — same screenshot-leak reasoning
      // as samplePoints. The dwell + time fields are exact (they're not
      // location-revealing).
      lat: Math.round(s.lat * 1000) / 1000,
      lng: Math.round(s.lng * 1000) / 1000,
      start: s.start,
      end: s.end,
      dwellMinutes: Math.round((s.end - s.start) / 60),
    }));
    // First 3 + last 3 raw points so the user can see whether sparse or dense
    // data is the issue without leaking an unbounded list. Coordinates
    // ROUNDED to 3 decimal places (~110m precision) — enough to debug a
    // "sparse vs dense vs misclustered" question without leaking the
    // user's home or office address if they screenshot the diagnostic to
    // share with me. The aggregated counts are exact.
    const head = pts.slice(0, 3);
    const tail = pts.length > 6 ? pts.slice(-3) : pts.slice(3);
    const blur = (p: { lat: number; lng: number; tst: number }) => ({
      lat: Math.round(p.lat * 1000) / 1000,
      lng: Math.round(p.lng * 1000) / 1000,
      tst: p.tst,
    });
    return {
      days,
      sinceEpochSec: since,
      pointCount: pts.length,
      firstTstInWindow: pts[0]?.tst ?? null,
      lastTstInWindow: pts[pts.length - 1]?.tst ?? null,
      stays,
      samplePoints: [...head, ...tail].map(blur),
      gaps: analyzeGaps(pts.map((p) => p.tst), nowSec, days * 24),
    };
  };

  // Mirror exactly what the chat tool sees: route (covered by windows.stays)
  // AND current (covered here). Coordinates of `current` are also blurred
  // for the same screenshot-leak reason as samplePoints / stays.
  const cur = currentLocation();
  const currentBlurred = cur
    ? {
        lat: Math.round(cur.lat * 1000) / 1000,
        lng: Math.round(cur.lng * 1000) / 1000,
        tst: cur.tst,
        atTime: cur.atTime,
        minutesAgo: cur.minutesAgo,
        place: cur.place,
        stale: cur.stale,
      }
    : null;
  return {
    serverEpochSec: nowSec,
    serverTimeUtc: new Date(nowSec * 1000).toISOString(),
    totalPoints: status.points,
    lastTst: status.lastTst,
    lastTstFormattedKst,
    current: currentBlurred,
    windows: [summarise(1), summarise(7)],
  };
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

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

function cachedPlace(lat: number, lng: number): string | null {
  const row = db()
    .prepare(`SELECT place FROM geocode_cache WHERE key = ?`)
    .get(cacheKey(lat, lng)) as { place: string } | undefined;
  return row?.place ?? null;
}

async function geocode(lat: number, lng: number): Promise<string> {
  const key = cacheKey(lat, lng);
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
  const d = new Date((tst + TZ_OFFSET_MIN * 60) * 1000);
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

/**
 * Recent route (stays with dwell) for the chat context. Cached-only by
 * default: uncached stays appear as raw lat/lng for one cycle, and a
 * background warm pass (warmOwntracksGeocodes) refills them so they
 * resolve to real place names next time. This avoids serialising up to
 * 40 Nominatim fetches before every chat reply.
 *
 * Pass { allowNetwork: true } to do the synchronous geocoding fallback
 * (used by maybeDistillLocation, which runs in the background anyway).
 */
export async function owntracksRouteContext(
  days = 3,
  opts: { allowNetwork?: boolean } = {}
): Promise<string> {
  const stays = recentStays(days).slice(-40);
  if (stays.length === 0) return "";
  const lines: string[] = [];
  let day = "";
  for (const s of stays) {
    const place = opts.allowNetwork
      ? await geocode(s.lat, s.lng)
      : cachedPlace(s.lat, s.lng) ?? `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`;
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

let warmingGeocodes = false;
// Separate flag so the current-location warmer doesn't block / get blocked
// by the stays warmer. They poke different rows in the same cache table,
// so running concurrently is safe.
let warmingCurrent = false;

/**
 * Fire-and-forget background pass that resolves the LATEST point's
 * coordinates into a place name. Called from chat after currentLocation()
 * is read, so a moving / just-arrived user — who never produces a stay
 * the existing warmer would cover — still graduates from raw coordinates
 * to "Yeoksam-dong, Teheran-ro" on the next interaction.
 */
export function warmCurrentLocationGeocode(): void {
  if (warmingCurrent) return;
  const current = currentLocation();
  if (!current || current.place !== null) return;
  warmingCurrent = true;
  (async () => {
    try {
      await geocode(current.lat, current.lng);
    } catch {
      // best-effort
    } finally {
      warmingCurrent = false;
    }
  })();
}

/**
 * Fire-and-forget background pass that resolves any uncached stays from
 * the last few days. Designed to be called from the chat hot path; the
 * actual Nominatim fetches happen off the request thread, so the next
 * chat sees the labels filled in.
 */
export function warmOwntracksGeocodes(days = 3): void {
  if (warmingGeocodes) return;
  const stays = recentStays(days).slice(-40);
  const uncached = stays.filter((s) => cachedPlace(s.lat, s.lng) === null);
  if (uncached.length === 0) return;
  warmingGeocodes = true;
  (async () => {
    try {
      // Nominatim asks for ~1 req/s. Serial loop, but it's off the user's
      // chat path now so the latency is invisible.
      for (const s of uncached) {
        try {
          await geocode(s.lat, s.lng);
        } catch {
          // best-effort, keep going
        }
      }
    } finally {
      warmingGeocodes = false;
    }
  })();
}
