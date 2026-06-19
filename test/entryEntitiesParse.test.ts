import { describe, it, expect } from "vitest";
import { parseAnalyzeEntryContent } from "@/lib/claude";

// analyzeEntryContent now returns entities alongside themes/sentiment/summary.
// These tests lock the parser shape so a chat-tier model returning a slightly
// off-spec object doesn't quietly drop the new field. We mirror the
// parseAxisLabels / parseChatMemories test posture: lenient where possible,
// strict on category enumerables.

const cleanRaw = JSON.stringify({
  themes: ["family dinner", "work stress"],
  sentiment: 0.2,
  summary: "They had dinner with their family and felt better about work.",
  entities: [
    { kind: "person", name: "Pastor Kim" },
    { kind: "place", name: "Seoul Iris Garden" },
    { kind: "project", name: "Sermorizer" },
  ],
});

describe("parseAnalyzeEntryContent", () => {
  it("parses themes, sentiment, summary, and entities together", () => {
    const r = parseAnalyzeEntryContent(cleanRaw)!;
    expect(r.themes).toEqual(["family dinner", "work stress"]);
    expect(r.sentiment).toBe(0.2);
    expect(r.summary).toMatch(/family/);
    expect(r.entities.length).toBe(3);
    expect(r.entities[0]).toEqual({ kind: "person", name: "Pastor Kim" });
    expect(r.entities[1]).toEqual({ kind: "place", name: "Seoul Iris Garden" });
    expect(r.entities[2]).toEqual({ kind: "project", name: "Sermorizer" });
  });

  it("strips a ```json fence around the JSON object", () => {
    const r = parseAnalyzeEntryContent("```json\n" + cleanRaw + "\n```")!;
    expect(r.entities.length).toBe(3);
  });

  it("drops entities whose kind isn't person/place/project", () => {
    const raw = JSON.stringify({
      themes: [],
      sentiment: 0,
      summary: "",
      entities: [
        { kind: "person", name: "Real Person" },
        { kind: "concept", name: "Discarded" },
        { kind: "thing", name: "Also Discarded" },
      ],
    });
    const r = parseAnalyzeEntryContent(raw)!;
    expect(r.entities).toEqual([{ kind: "person", name: "Real Person" }]);
  });

  it("normalises kind case (PERSON / Place) into the canonical enum", () => {
    const raw = JSON.stringify({
      themes: [],
      sentiment: 0,
      summary: "",
      entities: [
        { kind: "PERSON", name: "Loud Casing" },
        { kind: "Place", name: "Mixed Casing" },
      ],
    });
    const r = parseAnalyzeEntryContent(raw)!;
    expect(r.entities).toEqual([
      { kind: "person", name: "Loud Casing" },
      { kind: "place", name: "Mixed Casing" },
    ]);
  });

  it("drops entities with empty name", () => {
    const raw = JSON.stringify({
      themes: [],
      sentiment: 0,
      summary: "",
      entities: [
        { kind: "person", name: "" },
        { kind: "person", name: "   " },
        { kind: "person", name: "Real" },
      ],
    });
    const r = parseAnalyzeEntryContent(raw)!;
    expect(r.entities.map((e) => e.name)).toEqual(["Real"]);
  });

  it("drops entities whose name exceeds 60 chars", () => {
    const tooLong = "X".repeat(61);
    const raw = JSON.stringify({
      themes: [],
      sentiment: 0,
      summary: "",
      entities: [
        { kind: "person", name: tooLong },
        { kind: "person", name: "OK Name" },
      ],
    });
    const r = parseAnalyzeEntryContent(raw)!;
    expect(r.entities).toEqual([{ kind: "person", name: "OK Name" }]);
  });

  it("drops pronoun/generic stopwords ('me', 'today', 'home')", () => {
    const raw = JSON.stringify({
      themes: [],
      sentiment: 0,
      summary: "",
      entities: [
        { kind: "person", name: "me" },
        { kind: "person", name: "I" },
        { kind: "place", name: "home" },
        { kind: "place", name: "today" },
        { kind: "person", name: "Sanjay" },
      ],
    });
    const r = parseAnalyzeEntryContent(raw)!;
    expect(r.entities).toEqual([{ kind: "person", name: "Sanjay" }]);
  });

  it("caps entities at 12 even when the model returns more", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      kind: "person",
      name: `Person ${i}`,
    }));
    const raw = JSON.stringify({
      themes: [],
      sentiment: 0,
      summary: "",
      entities: many,
    });
    const r = parseAnalyzeEntryContent(raw)!;
    expect(r.entities.length).toBe(12);
    expect(r.entities[0].name).toBe("Person 0");
    expect(r.entities[11].name).toBe("Person 11");
  });

  it("returns empty entities[] when entities key is missing", () => {
    const raw = JSON.stringify({
      themes: ["solo theme"],
      sentiment: 0.5,
      summary: "no entities here",
    });
    const r = parseAnalyzeEntryContent(raw)!;
    expect(r.entities).toEqual([]);
    expect(r.themes).toEqual(["solo theme"]);
  });

  it("returns empty entities[] when entities is the wrong shape", () => {
    const raw = JSON.stringify({
      themes: [],
      sentiment: 0,
      summary: "",
      entities: "not an array",
    });
    const r = parseAnalyzeEntryContent(raw)!;
    expect(r.entities).toEqual([]);
  });

  it("returns null on non-JSON input", () => {
    expect(parseAnalyzeEntryContent("not json at all")).toBeNull();
  });

  it("preserves original casing of the name (does NOT lowercase)", () => {
    const raw = JSON.stringify({
      themes: [],
      sentiment: 0,
      summary: "",
      entities: [{ kind: "project", name: "Sermorizer" }],
    });
    const r = parseAnalyzeEntryContent(raw)!;
    expect(r.entities[0].name).toBe("Sermorizer");
  });
});
