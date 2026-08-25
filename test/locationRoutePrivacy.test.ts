import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  isAuthenticated: vi.fn(),
  isLocationEnabled: vi.fn(),
  addLocation: vi.fn(),
  listRecentLocations: vi.fn(),
  reverseGeocodePlace: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ isAuthenticated: mocks.isAuthenticated }));
vi.mock("@/lib/location", () => ({
  addLocation: mocks.addLocation,
  listRecentLocations: mocks.listRecentLocations,
  isLocationEnabled: mocks.isLocationEnabled,
}));
vi.mock("@/lib/geocode", () => ({
  reverseGeocodePlace: mocks.reverseGeocodePlace,
}));

import { POST } from "@/app/api/location/route";

function locationRequest(lat = 37.56678912, lng = 126.97832198): NextRequest {
  return new NextRequest("http://localhost/api/location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, localTime: "8/23/2026, 12:34:56 PM" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAuthenticated.mockReturnValue(true);
  mocks.isLocationEnabled.mockReturnValue(true);
  mocks.reverseGeocodePlace.mockResolvedValue("City Hall, Jung-gu, Seoul");
});

describe("POST /api/location privacy boundary", () => {
  it("does not geocode before authentication", async () => {
    mocks.isAuthenticated.mockReturnValue(false);

    const response = await POST(locationRequest());

    expect(response.status).toBe(401);
    expect(mocks.isLocationEnabled).not.toHaveBeenCalled();
    expect(mocks.reverseGeocodePlace).not.toHaveBeenCalled();
    expect(mocks.addLocation).not.toHaveBeenCalled();
  });

  it("does not geocode while location sharing is disabled", async () => {
    mocks.isLocationEnabled.mockReturnValue(false);

    const response = await POST(locationRequest());

    expect(response.status).toBe(403);
    expect(mocks.reverseGeocodePlace).not.toHaveBeenCalled();
    expect(mocks.addLocation).not.toHaveBeenCalled();
  });

  it("geocodes server-side, stores exact coordinates, and returns the place", async () => {
    const lat = 37.56678912;
    const lng = 126.97832198;

    const response = await POST(locationRequest(lat, lng));

    expect(response.status).toBe(200);
    expect(mocks.reverseGeocodePlace).toHaveBeenCalledWith(lat, lng);
    expect(mocks.addLocation).toHaveBeenCalledWith({
      lat,
      lng,
      place: "City Hall, Jung-gu, Seoul",
      localTime: "8/23/2026, 12:34:56 PM",
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      place: "City Hall, Jung-gu, Seoul",
    });
  });

  it("rejects out-of-range coordinates before geocoding", async () => {
    const response = await POST(locationRequest(91, 181));

    expect(response.status).toBe(400);
    expect(mocks.reverseGeocodePlace).not.toHaveBeenCalled();
    expect(mocks.addLocation).not.toHaveBeenCalled();
  });
});
