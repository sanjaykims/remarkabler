import { db } from "./db";

// User-named places. Lookup is a plain nearest-within-radius match so a stay
// (cluster centroid) or the latest point resolves to the name the user chose,
// ahead of — and instead of — the reverse-geocoded street guess.

export type SavedPlace = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
};

export const DEFAULT_RADIUS_M = 75;
export const MIN_RADIUS_M = 25;
export const MAX_RADIUS_M = 500;
export const MAX_NAME_LENGTH = 80;
export const MAX_SAVED_PLACES = 200;

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Pure: the saved place whose centre is closest to (lat, lng), provided the
 * point is inside that place's own radius. Ties go to the nearer centre.
 */
export function nearestSavedPlace(
  lat: number,
  lng: number,
  places: SavedPlace[]
): SavedPlace | null {
  let best: SavedPlace | null = null;
  let bestDist = Infinity;
  for (const p of places) {
    const d = haversineM(lat, lng, p.lat, p.lng);
    if (d <= p.radius_m && d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

export function listSavedPlaces(): SavedPlace[] {
  return db()
    .prepare(
      `SELECT id, name, lat, lng, radius_m FROM saved_places ORDER BY name COLLATE NOCASE, id`
    )
    .all() as SavedPlace[];
}

/** The user's name for these coordinates, or null when no saved place covers them. */
export function savedPlaceName(lat: number, lng: number): string | null {
  return nearestSavedPlace(lat, lng, listSavedPlaces())?.name ?? null;
}

export type SavePlaceInput = {
  name: unknown;
  lat: unknown;
  lng: unknown;
  radius_m?: unknown;
};

export type SavePlaceResult =
  | { ok: true; place: SavedPlace }
  | { ok: false; error: string };

/** Validate + insert. Pure input checks first so bad requests never touch the DB. */
export function addSavedPlace(input: SavePlaceInput): SavePlaceResult {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) return { ok: false, error: "Give the place a name." };
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Name is too long (max ${MAX_NAME_LENGTH} characters).` };
  }
  const { lat, lng } = input;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return { ok: false, error: "Invalid coordinates." };
  }
  let radius = DEFAULT_RADIUS_M;
  if (input.radius_m !== undefined && input.radius_m !== null) {
    if (typeof input.radius_m !== "number" || !Number.isFinite(input.radius_m)) {
      return { ok: false, error: "Invalid radius." };
    }
    radius = Math.round(input.radius_m);
    if (radius < MIN_RADIUS_M || radius > MAX_RADIUS_M) {
      return {
        ok: false,
        error: `Radius must be between ${MIN_RADIUS_M} and ${MAX_RADIUS_M} metres.`,
      };
    }
  }
  const count = (
    db().prepare(`SELECT COUNT(*) AS n FROM saved_places`).get() as { n: number }
  ).n;
  if (count >= MAX_SAVED_PLACES) {
    return { ok: false, error: `You already have ${MAX_SAVED_PLACES} saved places.` };
  }
  const info = db()
    .prepare(`INSERT INTO saved_places(name, lat, lng, radius_m) VALUES(?, ?, ?, ?)`)
    .run(name, lat, lng, radius);
  return {
    ok: true,
    place: { id: Number(info.lastInsertRowid), name, lat, lng, radius_m: radius },
  };
}

export function deleteSavedPlace(id: number): boolean {
  return db().prepare(`DELETE FROM saved_places WHERE id = ?`).run(id).changes > 0;
}
