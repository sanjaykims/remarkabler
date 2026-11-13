// Pure helpers for the /map tab. No DB, no network — unit-tested.

export type RoutePoint = { lat: number; lng: number; tst: number };

export const MAP_MAX_DAYS = 30;
export const MAP_MAX_ROUTE_POINTS = 1500;

/** Clamp a user-supplied day count to 1..MAP_MAX_DAYS (default 1). */
export function clampMapDays(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAP_MAX_DAYS);
}

function metres(a: RoutePoint, b: RoutePoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * Thin a time-ordered point list for drawing: drop points closer than
 * `minMetres` to the last kept one, then, if still over `max`, take an even
 * stride (always keeping first and last). Keeps the polyline light on a phone.
 */
export function thinRoute(
  points: RoutePoint[],
  minMetres = 25,
  max = MAP_MAX_ROUTE_POINTS
): RoutePoint[] {
  if (points.length <= 2) return points.slice();
  const kept: RoutePoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    if (metres(kept[kept.length - 1], points[i]) >= minMetres) kept.push(points[i]);
  }
  kept.push(points[points.length - 1]);
  if (kept.length <= max) return kept;
  const stride = (kept.length - 1) / (max - 1);
  const out: RoutePoint[] = [];
  for (let k = 0; k < max - 1; k++) out.push(kept[Math.round(k * stride)]);
  out.push(kept[kept.length - 1]);
  return out;
}

/**
 * Colour for position `f` (0 = earliest, 1 = latest) along the trail.
 * Blue → violet → red → orange: opposite ends of the wheel, and the middle
 * stays vivid (a straight RGB blend would go grey). Returns a CSS hsl().
 */
export function timeColor(f: number): string {
  const t = Math.min(1, Math.max(0, Number.isFinite(f) ? f : 0));
  const hue = 215 + 170 * t; // 215 (blue) → 385 ≡ 25 (orange)
  return `hsl(${Math.round(hue) % 360} 85% 50%)`;
}

/** Fraction of `tst` between `from` and `to`; 0 when the span is empty. */
export function timeFraction(tst: number, from: number, to: number): number {
  return to > from ? Math.min(1, Math.max(0, (tst - from) / (to - from))) : 0;
}

/**
 * Unix seconds of local midnight for the day containing `nowSec`, in a zone
 * `offMin` minutes ahead of UTC. "Today" on the map means since this, not
 * "the last 24 hours" (which would drag in last night's trip home).
 */
export function localDayStart(nowSec: number, offMin: number): number {
  const shifted = nowSec + offMin * 60;
  return shifted - (((shifted % 86400) + 86400) % 86400) - offMin * 60;
}

/** Start of the window for "last N calendar days, including today". */
export function mapWindowStart(nowSec: number, offMin: number, days: number): number {
  return localDayStart(nowSec, offMin) - (Math.max(1, days) - 1) * 86400;
}

/**
 * The span of the trail that is actually movement: from the first point that
 * is clearly away from where the range started, to the last point that is
 * still clearly away from where it ended. Colours are spread over this span
 * (blue at first move, orange at final arrival) so overnight dwell at home
 * doesn't eat the colour range. Falls back to first/last when nothing moved.
 */
export function movementWindow(
  route: RoutePoint[],
  thresholdM = 200
): { from: number; to: number } {
  if (route.length === 0) return { from: 0, to: 0 };
  const first = route[0];
  const last = route[route.length - 1];
  let from = first.tst;
  for (const p of route) {
    if (metres(first, p) > thresholdM) {
      from = p.tst;
      break;
    }
  }
  let to = last.tst;
  for (let i = route.length - 1; i >= 0; i--) {
    if (metres(last, route[i]) > thresholdM) {
      to = route[i].tst;
      break;
    }
  }
  return to > from ? { from, to } : { from: first.tst, to: last.tst };
}
