import { describe, it, expect } from "vitest";
import { floorOpus } from "@/lib/claude";

describe("floorOpus", () => {
  it("lifts older Opus models to 5.5 and leaves others alone", () => {
    for (const m of ["claude-opus-4-7", "claude-opus-4-5", "claude-opus-4-1-20250805", "claude-3-opus-20240229"])
      expect(floorOpus(m)).toBe("claude-opus-5-5");
    for (const m of ["claude-opus-5-5", "claude-opus-5-6", "claude-fable-5-2", "claude-sonnet-5-5"])
      expect(floorOpus(m)).toBe(m);
  });
});
