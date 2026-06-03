// Display timezone for "today / yesterday / this week" math and for
// "export this in KST" rendering. Defaults to Seoul (UTC+9). Override
// with LOCATION_TZ_OFFSET (minutes from UTC).
export const TZ_OFFSET_MIN = Number(process.env.LOCATION_TZ_OFFSET || "540");

/**
 * Parse a SQLite-stored UTC timestamp string into a real Date.
 *
 * SQLite's CURRENT_TIMESTAMP / datetime('now') produce
 * `YYYY-MM-DD HH:MM:SS` with no timezone marker, which browsers parse
 * as *local* time — wrong by the UTC offset. Treat it as explicit UTC.
 *
 * Returns null for empty input or a malformed string, so callers can
 * branch without throwing.
 */
export function parseSqliteUtc(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)
    ? trimmed.replace(" ", "T") + "Z"
    : trimmed;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a stored timestamp for display in the viewer's local timezone,
 * with the timezone shown so it's clear "when and where". Locale is fixed
 * to English so the date reads in English regardless of the device's
 * language; only the timezone follows the device.
 */
export function formatLocalTime(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = parseSqliteUtc(raw);
  if (!d) return raw;
  return d.toLocaleString("en-US", { timeZoneName: "short" });
}
