import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "fs";
import os from "os";
import path from "path";

type DbModule = typeof import("@/lib/db");
type GeocodeModule = typeof import("@/lib/geocode");

let dbModule: DbModule;
let geocodeModule: GeocodeModule;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "geocode-privacy-"));
  dbModule = await import("@/lib/db");
  geocodeModule = await import("@/lib/geocode");
});

beforeEach(() => {
  dbModule.db().prepare("DELETE FROM geocode_cache").run();
  vi.restoreAllMocks();
});

describe("reverseGeocodePlace", () => {
  it("sends only three-decimal coordinates to Nominatim", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          name: "City Hall",
          address: { suburb: "Jung-gu", city: "Seoul" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const place = await geocodeModule.reverseGeocodePlace(
      37.56678912,
      126.97832198
    );

    expect(place).toBe("City Hall, Jung-gu, Seoul");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("lat")).toBe("37.567");
    expect(url.searchParams.get("lon")).toBe("126.978");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("37.56678912");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("126.97832198");
  });

  it("reuses the three-decimal cache without another network request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ display_name: "Seoul, South Korea" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const first = await geocodeModule.reverseGeocodePlace(37.56671, 126.97821);
    const second = await geocodeModule.reverseGeocodePlace(37.56674, 126.97824);

    expect(first).toBe("Seoul, South Korea");
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(geocodeModule.cachedPlace(37.56674, 126.97824)).toBe(first);
  });
});
