import { describe, it, expect } from "vitest";
import { analyzeGaps } from "@/lib/owntracks";

// analyzeGaps turns the raw OwnTracks point series into a gap summary — the
// tool that tells "the phone stopped publishing" apart from "the server /
// chat lost the data". addPoint() stores every POST with no throttle, so a
// gap in this series is unambiguously phone-side. These pins lock the shape
// chat and the Memory page read.

const MIN = 60; // seconds per minute

describe("analyzeGaps", () => {
  it("returns empty-ish stats for zero or one point", () => {
    const now = 1_000_000;
    const empty = analyzeGaps([], now, 24);
    expect(empty.pointCount).toBe(0);
    expect(empty.medianGapMinutes).toBeNull();
    expect(empty.maxGap).toBeNull();
    expect(empty.gapsOver30Min).toBe(0);
    expect(empty.pointsPerHour).toBeNull();
    expect(empty.trailingGapMinutes).toBe(0);

    const one = analyzeGaps([now - 5 * MIN], now, 24);
    expect(one.pointCount).toBe(1);
    expect(one.medianGapMinutes).toBeNull();
    expect(one.maxGap).toBeNull();
    // now − the single point = 5 min still-open gap.
    expect(one.trailingGapMinutes).toBe(5);
  });

  it("computes median and max over consecutive gaps", () => {
    const now = 1_000_000;
    // Gaps of 20, 20, 92, 20 minutes.
    const t0 = now - 200 * MIN;
    const tsts = [
      t0,
      t0 + 20 * MIN,
      t0 + 40 * MIN,
      t0 + (40 + 92) * MIN,
      t0 + (40 + 92 + 20) * MIN,
    ];
    const g = analyzeGaps(tsts, now, 24);
    expect(g.pointCount).toBe(5);
    // gaps sorted: 20, 20, 20, 92 → median of 4 = (20+20)/2 = 20
    expect(g.medianGapMinutes).toBe(20);
    expect(g.maxGap?.minutes).toBe(92);
    expect(g.gapsOver30Min).toBe(1);
    expect(g.longestGaps[0].minutes).toBe(92);
  });

  it("counts every gap over 30 minutes and ranks the longest first", () => {
    const now = 2_000_000;
    const t0 = now - 500 * MIN;
    // gaps: 45, 10, 92, 10, 33
    const tsts = [
      t0,
      t0 + 45 * MIN,
      t0 + 55 * MIN,
      t0 + 147 * MIN,
      t0 + 157 * MIN,
      t0 + 190 * MIN,
    ];
    const g = analyzeGaps(tsts, now, 24);
    expect(g.gapsOver30Min).toBe(3); // 45, 92, 33
    expect(g.longestGaps.map((x) => x.minutes)).toEqual([92, 45, 33, 10, 10]);
    // longestGaps is capped at 5.
    expect(g.longestGaps.length).toBeLessThanOrEqual(5);
  });

  it("reports the still-open trailing gap (now − newest point)", () => {
    const now = 3_000_000;
    const tsts = [now - 120 * MIN, now - 92 * MIN];
    const g = analyzeGaps(tsts, now, 24);
    // The user's exact case: last point 92 min ago.
    expect(g.trailingGapMinutes).toBe(92);
  });

  it("sorts unordered input before analysing", () => {
    const now = 4_000_000;
    const t0 = now - 100 * MIN;
    const g = analyzeGaps(
      [t0 + 60 * MIN, t0, t0 + 20 * MIN],
      now,
      24
    );
    // Sorted gaps: 20, 40 → max 40, median (20+40)/2 = 30
    expect(g.maxGap?.minutes).toBe(40);
    expect(g.medianGapMinutes).toBe(30);
  });
});
