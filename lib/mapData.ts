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
