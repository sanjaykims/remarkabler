/**
 * Format a stored timestamp for display in the viewer's local timezone,
 * with the timezone shown so it's clear "when and where".
 *
 * Timestamps are stored in UTC. SQLite's CURRENT_TIMESTAMP / datetime('now')
 * produce `YYYY-MM-DD HH:MM:SS` with no timezone marker, which browsers parse
 * as *local* time — wrong by the UTC offset. Normalize such strings to
 * explicit UTC first, then render in local time with the zone appended.
 *
 * The locale is fixed to English ("en-US") so the date reads in English
 * regardless of the device's language; only the timezone follows the device.
 */
export function formatLocalTime(raw: string | null | undefined): string {
  if (!raw) return "—";
  let iso = raw.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(iso)) {
    iso = iso.replace(" ", "T") + "Z";
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleString("en-US", { timeZoneName: "short" });
}
