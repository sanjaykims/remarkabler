import { describe, it, expect } from "vitest";
import {
  computeRelatedEntities,
  type DayMembership,
} from "@/lib/entityGraph";

// Pure co-occurrence: given (entity, day) memberships, rank the entities that
// share days with a target. No DB — the DB glue lives in lib/chatTools.ts.

function m(
  day: string,
  kind: DayMembership["kind"],
  name: string
): DayMembership {
  return { day, kind, norm: name.toLowerCase(), name };
}

describe("computeRelatedEntities", () => {
  it("returns [] when the target never appears", () => {
    const rel = computeRelatedEntities(
      [m("2026-06-19", "person", "Jin")],
      { kind: "person", norm: "kim" },
      10
    );
    expect(rel).toEqual([]);
  });

  it("finds entities that share a day, excluding the target itself", () => {
    const rel = computeRelatedEntities(
      [
        m("2026-06-19", "person", "Kim"),
        m("2026-06-19", "person", "Jin"),
        m("2026-06-19", "place", "Seoul"),
      ],
      { kind: "person", norm: "kim" },
      10
    );
    // Kim (the target) is not in its own related list.
    expect(rel.map((r) => r.name).sort()).toEqual(["Jin", "Seoul"]);
    expect(rel.every((r) => r.sharedDays === 1)).toBe(true);
  });

  it("ranks by number of shared days, descending", () => {
    const rel = computeRelatedEntities(
      [
        m("2026-06-19", "person", "Kim"),
        m("2026-06-19", "person", "Jin"),
        m("2026-06-20", "person", "Kim"),
        m("2026-06-20", "person", "Jin"),
        m("2026-06-21", "person", "Kim"),
        m("2026-06-21", "person", "Ben"),
      ],
      { kind: "person", norm: "kim" },
      10
    );
    expect(rel[0]).toMatchObject({ name: "Jin", sharedDays: 2 });
    expect(rel[1]).toMatchObject({ name: "Ben", sharedDays: 1 });
    expect(rel[0].days).toEqual(["2026-06-19", "2026-06-20"]);
  });

  it("does not link entities that only appear on different days", () => {
    const rel = computeRelatedEntities(
      [
        m("2026-06-19", "person", "Kim"),
        m("2026-06-20", "person", "Jin"), // different day → not connected
      ],
      { kind: "person", norm: "kim" },
      10
    );
    expect(rel).toEqual([]);
  });

  it("treats same name across different kinds as distinct nodes", () => {
    const rel = computeRelatedEntities(
      [
        m("2026-06-19", "person", "Han"),
        m("2026-06-19", "person", "Seoul"), // a person named Seoul
        m("2026-06-19", "place", "Seoul"), // the place Seoul
      ],
      { kind: "person", norm: "han" },
      10
    );
    const keys = rel.map((r) => `${r.kind}:${r.name}`).sort();
    expect(keys).toEqual(["person:Seoul", "place:Seoul"]);
  });

  it("respects the limit, keeping the top-N by shared days", () => {
    const rel = computeRelatedEntities(
      [
        m("2026-06-19", "person", "Kim"),
        m("2026-06-19", "person", "A"),
        m("2026-06-20", "person", "Kim"),
        m("2026-06-20", "person", "A"),
        m("2026-06-19", "person", "B"),
      ],
      { kind: "person", norm: "kim" },
      1
    );
    expect(rel).toHaveLength(1);
    expect(rel[0].name).toBe("A"); // 2 shared days beats B's 1
  });
});
