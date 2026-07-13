import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// `currentLocation()` is the "where are you NOW" answer chat relies on.
// OwnTracks publishes mostly on MOVEMENT, so a stationary user (office all
// day) stops producing points while staying put — an old newest-point is
// usually "still there", not bad data. So we return the last-known point up
// to 36h, flag it `stale` past a 45-min "live" window (so chat can phrase the
// age), and only return null past 36h (don't report last week as "now").
// This pins the fix for the "chat kept reporting last night's stay" bug.

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
    expect(cur!.stale).toBe(false); // fresh point (< 45 min) is live
  });

  it("keeps a stationary point PAST the old 6h cutoff, flagged stale (the bug fix)", () => {
    const now = Math.floor(Date.now() / 1000);
    // 8 hours old — the office-all-day case. Must still be reported (with the
    // age), NOT dropped, so chat says "office, ~8h ago, likely still there".
    insertPoint(37.5, 127.0, now - 8 * 60 * 60);
    const cur = owntracksMod.currentLocation();
    expect(cur).not.toBeNull();
    expect(cur!.lat).toBe(37.5);
    expect(cur!.stale).toBe(true);
    expect(cur!.minutesAgo).toBeCloseTo(8 * 60, -1);
  });

  it("flags stale just past the 45-minute live window", () => {
    const now = Math.floor(Date.now() / 1000);
    insertPoint(37.5, 127.0, now - 46 * 60); // 46 min ago
    const cur = owntracksMod.currentLocation();
    expect(cur).not.toBeNull();
    expect(cur!.stale).toBe(true);
  });

  it("returns null only past the 36-hour max age", () => {
    const now = Math.floor(Date.now() / 1000);
    insertPoint(37.5, 127.0, now - 37 * 60 * 60); // 37h — beyond "last known"
    expect(owntracksMod.currentLocation()).toBeNull();
  });

  it("returns place=null when the coordinates are not in the geocode cache", () => {
    const now = Math.floor(Date.now() / 1000);
    insertPoint(48.8, 2.3, now - 60); // Paris — not in cache for this test DB
    const cur = owntracksMod.currentLocation();
    expect(cur).not.toBeNull();
    expect(cur!.place).toBeNull();
  });
});
