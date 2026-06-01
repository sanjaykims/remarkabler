import { db, getSetting, setSetting } from "./db";

// A simple daily location log: the user taps "Log my location" and the app
// stores where they were and when. Fed into chat so Claude knows where they've
// been recently. Not background tracking — one point per tap.

// User-controllable opt-in switch. Defaults to ON when the setting has never
// been touched, to preserve behavior for existing deployments — but the
// Memory page surfaces the toggle so non-developers can flip it off in-app.
export function isLocationEnabled(): boolean {
  const v = getSetting("location_enabled");
  return v === null ? true : v === "1";
}

export function setLocationEnabled(enabled: boolean): void {
  setSetting("location_enabled", enabled ? "1" : "0");
}

export function addLocation(opts: {
  lat: number;
  lng: number;
  place: string;
  localTime: string;
}): void {
  db()
    .prepare(
      `INSERT INTO locations(lat, lng, place, local_time) VALUES(?,?,?,?)`
    )
    .run(opts.lat, opts.lng, opts.place || "", opts.localTime || "");
}

export function listRecentLocations(
  limit = 30
): Array<{ place: string; local_time: string }> {
  return db()
    .prepare(
      `SELECT place, local_time FROM locations ORDER BY id DESC LIMIT ?`
    )
    .all(limit) as Array<{ place: string; local_time: string }>;
}

/** A compact, chronological list of recent places for the chat context. */
export function recentLocationsContext(limit = 30): string {
  const rows = listRecentLocations(limit);
  if (rows.length === 0) return "";
  return rows
    .map((r) => `- ${r.place || "(unnamed place)"} — ${r.local_time}`)
    .reverse()
    .join("\n");
}
