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

import { timeColor, timeFraction } from "../lib/mapData";
describe("time colours", () => {
  it("runs from blue to orange and clamps", () => {
    expect(timeColor(0)).toBe("hsl(215 85% 50%)");
    expect(timeColor(1)).toBe("hsl(25 85% 50%)");
    expect(timeColor(-5)).toBe(timeColor(0));
    expect(timeColor(9)).toBe(timeColor(1));
    expect(timeColor(NaN)).toBe(timeColor(0));
    expect(timeColor(0.5)).not.toBe(timeColor(0));
  });
  it("fraction handles empty span", () => {
    expect(timeFraction(5, 5, 5)).toBe(0);
    expect(timeFraction(15, 10, 20)).toBe(0.5);
  });
});

import { localDayStart, mapWindowStart } from "../lib/mapData";
describe("calendar-day window", () => {
  // 2026-11-13 18:03 KST = 09:03 UTC
  const now = Date.UTC(2026, 10, 13, 9, 3) / 1000;
  const kstMidnight = Date.UTC(2026, 10, 12, 15, 0) / 1000; // 11-13 00:00 KST
  it("today starts at local midnight, not 24h ago", () => {
    expect(localDayStart(now, 540)).toBe(kstMidnight);
    expect(mapWindowStart(now, 540, 1)).toBe(kstMidnight);
    expect(mapWindowStart(now, 540, 1)).toBeGreaterThan(now - 86400);
  });
  it("N days includes the earlier calendar days", () => {
    expect(mapWindowStart(now, 540, 2)).toBe(kstMidnight - 86400);
    expect(mapWindowStart(now, 540, 7)).toBe(kstMidnight - 6 * 86400);
  });
  it("works in UTC and west of UTC", () => {
    expect(localDayStart(now, 0)).toBe(Date.UTC(2026, 10, 13) / 1000);
    expect(localDayStart(now, -300)).toBe(Date.UTC(2026, 10, 13, 5) / 1000);
  });
});
