import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "fs";
import os from "os";
import path from "path";

type DbModule = typeof import("@/lib/db");
type SavedModule = typeof import("@/lib/savedPlaces");
type OwnTracksModule = typeof import("@/lib/owntracks");

let dbModule: DbModule;
let saved: SavedModule;
let owntracks: OwnTracksModule;

// 카공족 쌍문역1호점 area, as logged on 2026-11-13.
const CAFE = { lat: 37.6489327, lng: 127.0345558 };

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "saved-places-"));
  dbModule = await import("@/lib/db");
  saved = await import("@/lib/savedPlaces");
  owntracks = await import("@/lib/owntracks");
});

beforeEach(() => {
  const d = dbModule.db();
  d.prepare("DELETE FROM saved_places").run();
  d.prepare("DELETE FROM geocode_cache").run();
  d.prepare("DELETE FROM location_points").run();
  vi.restoreAllMocks();
});

describe("nearestSavedPlace (pure)", () => {
  const places = [
    { id: 1, name: "Cafe", lat: CAFE.lat, lng: CAFE.lng, radius_m: 75 },
    { id: 2, name: "Next door", lat: CAFE.lat + 0.0004, lng: CAFE.lng, radius_m: 75 },
  ];

  it("returns the place whose radius contains the point", () => {
    expect(saved.nearestSavedPlace(CAFE.lat, CAFE.lng, places)?.name).toBe("Cafe");
  });

  it("returns null outside every radius", () => {
    expect(saved.nearestSavedPlace(CAFE.lat + 0.01, CAFE.lng, places)).toBeNull();
  });

  it("prefers the nearer centre when two radii overlap", () => {
    // ~44 m north of Cafe, ~0 m from Next door.
    expect(
      saved.nearestSavedPlace(CAFE.lat + 0.0004, CAFE.lng, places)?.name
    ).toBe("Next door");
  });

  it("respects each place's own radius", () => {
    const tight = [{ id: 3, name: "Tight", lat: CAFE.lat, lng: CAFE.lng, radius_m: 25 }];
    // ~44 m away: inside a 75 m radius, outside 25 m.
    expect(saved.nearestSavedPlace(CAFE.lat + 0.0004, CAFE.lng, tight)).toBeNull();
  });
});

describe("addSavedPlace validation", () => {
  it("rejects empty and over-long names, and bad coordinates", () => {
    expect(saved.addSavedPlace({ name: "  ", ...CAFE }).ok).toBe(false);
    expect(saved.addSavedPlace({ name: "x".repeat(81), ...CAFE }).ok).toBe(false);
    expect(saved.addSavedPlace({ name: "A", lat: 91, lng: 0 }).ok).toBe(false);
    expect(saved.addSavedPlace({ name: "A", lat: "1", lng: 0 }).ok).toBe(false);
    expect(saved.addSavedPlace({ name: "A", lat: NaN, lng: 0 }).ok).toBe(false);
    expect(saved.listSavedPlaces()).toHaveLength(0);
  });

  it("rejects an out-of-range radius", () => {
    expect(saved.addSavedPlace({ name: "A", ...CAFE, radius_m: 5 }).ok).toBe(false);
    expect(saved.addSavedPlace({ name: "A", ...CAFE, radius_m: 5000 }).ok).toBe(false);
  });

  it("trims the name and applies the default radius", () => {
    const r = saved.addSavedPlace({ name: "  카공족 쌍문역1호점  ", ...CAFE });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.place.name).toBe("카공족 쌍문역1호점");
      expect(r.place.radius_m).toBe(saved.DEFAULT_RADIUS_M);
    }
  });

  it("deletes by id", () => {
    const r = saved.addSavedPlace({ name: "A", ...CAFE });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(saved.deleteSavedPlace(r.place.id)).toBe(true);
      expect(saved.deleteSavedPlace(r.place.id)).toBe(false);
    }
    expect(saved.listSavedPlaces()).toHaveLength(0);
  });
});

describe("integration with OwnTracks", () => {
  function insertPoint(lat: number, lng: number, tst: number) {
    dbModule
      .db()
      .prepare(`INSERT INTO location_points(lat, lng, tst) VALUES(?, ?, ?)`)
      .run(lat, lng, tst);
  }

  it("currentLocation uses the saved name over a cached street guess", () => {
    const now = Math.floor(Date.now() / 1000);
    insertPoint(CAFE.lat, CAFE.lng, now - 60);
    dbModule
      .db()
      .prepare(`INSERT INTO geocode_cache(key, place) VALUES(?, ?)`)
      .run(`${CAFE.lat.toFixed(3)},${CAFE.lng.toFixed(3)}`, "Street guess, Seoul");

    expect(owntracks.currentLocation()?.place).toBe("Street guess, Seoul");

    saved.addSavedPlace({ name: "카공족 쌍문역1호점", ...CAFE });
    expect(owntracks.currentLocation()?.place).toBe("카공족 쌍문역1호점");
  });

  it("falls back to the cached/uncached behaviour away from saved places", () => {
    const now = Math.floor(Date.now() / 1000);
    saved.addSavedPlace({ name: "Cafe", ...CAFE });
    insertPoint(CAFE.lat + 0.01, CAFE.lng, now - 60);
    expect(owntracks.currentLocation()?.place).toBeNull();
  });

  it("never calls the external geocoder for a point inside a saved place", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const now = Math.floor(Date.now() / 1000);
    saved.addSavedPlace({ name: "Cafe", ...CAFE });
    // A 40-minute stay at the cafe, pinged every 5 minutes.
    for (let i = 0; i <= 8; i++) insertPoint(CAFE.lat, CAFE.lng, now - 3600 + i * 300);

    const ctx = await owntracks.owntracksRouteContext(1, { allowNetwork: true });
    expect(ctx).toContain("Cafe");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
