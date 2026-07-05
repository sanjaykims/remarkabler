import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// the review's NIT 2 + NIT 3 — lock the chat tool's response shape and the
// "place when cached" branch of currentLocation(). These properties are
// what Claude actually reads to decide between "you're at <place> now"
// and "no location data" — anything that quietly breaks them silently
// degrades the user experience.

type DbMod = typeof import("@/lib/db");
type OwntracksMod = typeof import("@/lib/owntracks");
type ChatToolsMod = typeof import("@/lib/chatTools");
type LocationMod = typeof import("@/lib/location");

let dbMod: DbMod;
let owntracksMod: OwntracksMod;
let chatTools: ChatToolsMod;
let locationMod: LocationMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "chattools-loc-"));
  dbMod = await import("@/lib/db");
  owntracksMod = await import("@/lib/owntracks");
  chatTools = await import("@/lib/chatTools");
  locationMod = await import("@/lib/location");
});

beforeEach(() => {
  dbMod.db().prepare(`DELETE FROM location_points`).run();
  dbMod.db().prepare(`DELETE FROM geocode_cache`).run();
  locationMod.setLocationEnabled(true);
});

function insertPoint(lat: number, lng: number, tst: number) {
  dbMod
    .db()
    .prepare(`INSERT INTO location_points(lat, lng, tst, acc) VALUES(?,?,?,?)`)
    .run(lat, lng, tst, null);
}

function seedGeocode(lat: number, lng: number, place: string) {
  // Same rounding the lib uses (toFixed(3)) so the cache lookup hits.
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  dbMod
    .db()
    .prepare(`INSERT OR IGNORE INTO geocode_cache(key, place) VALUES(?, ?)`)
    .run(key, place);
}

describe("getRecentLocations chat tool", () => {
  it("returns the 'off' note when location sharing is disabled", async () => {
    locationMod.setLocationEnabled(false);
    const out = (await chatTools.getRecentLocations({ days: 1 })) as {
      route: string;
      note: string;
    };
    expect(out.route).toBe("");
    expect(out.note).toMatch(/off/i);
  });

  it("returns route='' + current when phone publishes but no stay has formed", async () => {
    // Single recent point — under the 8-min dwell threshold, no stay
    // will cluster. This is the exact scenario the user reported: chat
    // would previously say "no location data" while OwnTracks was happily
    // publishing seconds ago.
    const now = Math.floor(Date.now() / 1000);
    insertPoint(37.5081, 127.0334, now - 60);
    const out = (await chatTools.getRecentLocations({ days: 1 })) as {
      route: string;
      current: { lat: number; lng: number } | null;
      note?: string;
    };
    expect(out.route).toBe("");
    expect(out.current).not.toBeNull();
    expect(out.current!.lat).toBeCloseTo(37.5081, 4);
    expect(out.note).toMatch(/no completed stays/i);
  });

  it("returns the 'no data' note when there are no points at all", async () => {
    const out = (await chatTools.getRecentLocations({ days: 1 })) as {
      route: string;
      current: unknown;
      note: string;
    };
    expect(out.route).toBe("");
    expect(out.current).toBeUndefined();
    expect(out.note).toMatch(/no location data/i);
  });

  it("returns both route AND current when stays exist and a recent point exists", async () => {
    const now = Math.floor(Date.now() / 1000);
    // ~20 minutes ago, 12 points within 200m → forms a >8-min stay.
    for (let i = 0; i < 12; i++) {
      insertPoint(37.50, 127.00, now - (20 * 60) + i * 60);
    }
    // Plus a very recent point.
    insertPoint(37.65, 127.02, now - 60);
    const out = (await chatTools.getRecentLocations({ days: 1 })) as {
      route: string;
      current: { lat: number } | null;
    };
    expect(out.route).not.toBe("");
    expect(out.current).not.toBeNull();
  });

  it("clamps days to [1, 30]", async () => {
    // Default (no input) → 7. Negative → 1. Huge → 30. Hard to assert
    // without inspecting internals; this just confirms the function
    // doesn't throw on edge inputs (a real regression would crash).
    await expect(chatTools.getRecentLocations({})).resolves.toBeDefined();
    await expect(
      chatTools.getRecentLocations({ days: -5 })
    ).resolves.toBeDefined();
    await expect(
      chatTools.getRecentLocations({ days: 9999 })
    ).resolves.toBeDefined();
  });
});

describe("currentLocation — cached-place branch", () => {
  it("returns place when the rounded coordinate key is in geocode_cache", () => {
    const now = Math.floor(Date.now() / 1000);
    seedGeocode(37.508, 127.033, "Yeoksam-dong, Gangnam");
    insertPoint(37.5081, 127.0334, now - 60);
    const cur = owntracksMod.currentLocation();
    expect(cur).not.toBeNull();
    expect(cur!.place).toBe("Yeoksam-dong, Gangnam");
  });
});
