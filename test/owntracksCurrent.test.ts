import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// `currentLocation()` is the "where are you NOW" answer chat falls back on
// when stay-clustering produces nothing (e.g. user just arrived and the
// 8-minute dwell threshold hasn't elapsed yet). The 6-hour recency cap is
// the boundary that prevents "you were at this place last week" being
// confidently reported as your current position when OwnTracks stopped.

type DbMod = typeof import("@/lib/db");
type OwntracksMod = typeof import("@/lib/owntracks");

let dbMod: DbMod;
let owntracksMod: OwntracksMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "owntracks-curr-"));
  dbMod = await import("@/lib/db");
  owntracksMod = await import("@/lib/owntracks");
});

beforeEach(() => {
  dbMod.db().prepare(`DELETE FROM location_points`).run();
});

function insertPoint(lat: number, lng: number, tst: number) {
  dbMod
    .db()
    .prepare(`INSERT INTO location_points(lat, lng, tst, acc) VALUES(?,?,?,?)`)
    .run(lat, lng, tst, null);
}

describe("currentLocation", () => {
  it("returns null when there are no points at all", () => {
    expect(owntracksMod.currentLocation()).toBeNull();
  });

  it("returns the most recent point when it's within the recency cap", () => {
    const now = Math.floor(Date.now() / 1000);
    insertPoint(37.5, 127.0, now - 60); // 1 minute ago
    insertPoint(37.6, 127.1, now - 30); // 30 seconds ago — most recent
    const cur = owntracksMod.currentLocation();
    expect(cur).not.toBeNull();
    expect(cur!.lat).toBe(37.6);
    expect(cur!.lng).toBe(127.1);
    expect(cur!.minutesAgo).toBeGreaterThanOrEqual(0);
    expect(cur!.minutesAgo).toBeLessThanOrEqual(1);
    expect(cur!.atTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("returns null when the most-recent point is older than the 6-hour cap", () => {
    const now = Math.floor(Date.now() / 1000);
    // Older than 6 hours — must NOT be confidently called "current".
    insertPoint(37.5, 127.0, now - 7 * 60 * 60);
    expect(owntracksMod.currentLocation()).toBeNull();
  });

  it("preserves the recency cap exactly at 6 hours", () => {
    const now = Math.floor(Date.now() / 1000);
    // Just under 6 hours: should still report.
    insertPoint(37.5, 127.0, now - 6 * 60 * 60 + 60);
    expect(owntracksMod.currentLocation()).not.toBeNull();
  });

  it("returns place=null when the coordinates are not in the geocode cache", () => {
    const now = Math.floor(Date.now() / 1000);
    insertPoint(48.8, 2.3, now - 60); // Paris — not in cache for this test DB
    const cur = owntracksMod.currentLocation();
    expect(cur).not.toBeNull();
    expect(cur!.place).toBeNull();
  });
});
