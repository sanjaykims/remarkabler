import { db } from "./db";

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export function cachedPlace(lat: number, lng: number): string | null {
  const row = db()
    .prepare(`SELECT place FROM geocode_cache WHERE key = ?`)
    .get(cacheKey(lat, lng)) as { place: string } | undefined;
  return row?.place ?? null;
}

/**
 * Resolve a location through the shared Nominatim cache. Only coordinates
 * rounded to roughly 110 m are disclosed to the external geocoder; callers
 * can still persist their original coordinates locally.
 */
export async function reverseGeocodePlace(
  lat: number,
  lng: number
): Promise<string> {
  const key = cacheKey(lat, lng);
  const cached = db()
    .prepare(`SELECT place FROM geocode_cache WHERE key = ?`)
    .get(key) as { place: string } | undefined;
  if (cached) return cached.place;

  let place = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  const publicLat = lat.toFixed(3);
  const publicLng = lng.toFixed(3);
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: publicLat,
      lon: publicLng,
      zoom: "16",
      "accept-language": "en",
    });
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params}`,
      { headers: { "User-Agent": "Remarkabler/1.0 (personal journaling app)" } }
    );
    if (response.ok) {
      const result = (await response.json()) as {
        name?: string;
        display_name?: string;
        address?: Record<string, string | undefined>;
      };
      const address = result.address || {};
      const label = [
        result.name || address.amenity || address.shop || address.building,
        address.suburb || address.neighbourhood || address.city_district,
        address.city || address.town || address.village,
      ]
        .filter(Boolean)
        .join(", ");
      place = label || result.display_name || place;
    }
  } catch {
    // Keep the local coordinate fallback when reverse geocoding is unavailable.
  }

  db().prepare(`INSERT OR IGNORE INTO geocode_cache(key, place) VALUES(?, ?)`).run(key, place);
  return place;
}
