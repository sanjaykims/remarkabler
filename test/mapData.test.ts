import { describe, expect, it } from "vitest";
import { clampMapDays, thinRoute, MAP_MAX_DAYS } from "../lib/mapData";

describe("clampMapDays", () => {
  it("defaults and clamps", () => {
    expect(clampMapDays(null)).toBe(1);
    expect(clampMapDays("abc")).toBe(1);
    expect(clampMapDays("0")).toBe(1);
    expect(clampMapDays("7")).toBe(7);
    expect(clampMapDays("9999")).toBe(MAP_MAX_DAYS);
  });
});

describe("thinRoute", () => {
  const p = (i: number, lat: number) => ({ lat, lng: 127, tst: i });
  it("keeps first and last and drops near-duplicates", () => {
    const pts = [p(0, 37), p(1, 37.00001), p(2, 37.00002), p(3, 37.01)];
    const out = thinRoute(pts, 25);
    expect(out[0]).toBe(pts[0]);
    expect(out[out.length - 1]).toBe(pts[3]);
    expect(out.length).toBe(2);
  });
  it("caps the number of points, keeping endpoints", () => {
    const pts = Array.from({ length: 5000 }, (_, i) => p(i, 37 + i * 0.001));
    const out = thinRoute(pts, 0, 100);
    expect(out.length).toBe(100);
    expect(out[0]).toBe(pts[0]);
    expect(out[99]).toBe(pts[4999]);
  });
  it("handles tiny inputs", () => {
    expect(thinRoute([])).toEqual([]);
    expect(thinRoute([p(0, 37)])).toHaveLength(1);
  });
});
