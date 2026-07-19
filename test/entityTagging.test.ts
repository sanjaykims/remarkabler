import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Guaranteed server-side entity-tagging for exported conversations/
// reflections (lib/entityTagging.ts). Mocked at the Claude boundary
// (extractTaggingEntities) so the test runs offline, hits the real DB, and
// exercises the real tagging/linking side effects — mirrors
// test/chatMemoryExtract.test.ts's mocking pattern for compressBatch.
// These pins lock:
//   - sampleForTagging never returns more than maxChars, always keeps the
//     first and last chunk of a long text;
//   - autoTagExportsEnabled requires BOTH MCP_AUTO_TAG_EXPORTS and
//     MCP_ALLOW_WIKI_LINKING (layered, not a peer flag — a user with
//     wiki-linking off gets a safe no-op even if auto-tag is mistakenly on);
//   - autoTagConversation/autoTagReflection actually write entry_entities
//     and mark the row linked;
//   - the sweep functions isolate one failing row from the rest of the batch.

type DbMod = typeof import("@/lib/db");
type CwMod = typeof import("@/lib/conversationWiki");
type RwMod = typeof import("@/lib/reflectionWiki");
type EtMod = typeof import("@/lib/entityTagging");
type ClaudeMod = typeof import("@/lib/claude");

let dbMod: DbMod;
let cw: CwMod;
let rw: RwMod;
let et: EtMod;
let claudeMod: ClaudeMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "entity-tagging-"));
  process.env.ANTHROPIC_API_KEY = "test-key";
  dbMod = await import("@/lib/db");
  cw = await import("@/lib/conversationWiki");
  rw = await import("@/lib/reflectionWiki");
  et = await import("@/lib/entityTagging");
  claudeMod = await import("@/lib/claude");
  dbMod.db();
});

beforeEach(() => {
  dbMod.db().prepare("DELETE FROM mcp_conversations").run();
  dbMod.db().prepare("DELETE FROM mcp_reflections").run();
  dbMod.db().prepare("DELETE FROM entry_entities").run();
  dbMod.db().prepare("DELETE FROM pages").run();
  dbMod.db().prepare("DELETE FROM notebooks").run();
  dbMod.db().prepare("DELETE FROM entity_aliases").run();
  delete process.env.MCP_AUTO_TAG_EXPORTS;
  delete process.env.MCP_ALLOW_WIKI_LINKING;
  vi.restoreAllMocks();
});

describe("sampleForTagging (pure)", () => {
  it("returns short text unchanged", () => {
    expect(et.sampleForTagging("hello", 100, 10)).toBe("hello");
  });

  it("never returns more than maxChars for a long text", () => {
    const long = "x".repeat(50_000);
    const sample = et.sampleForTagging(long, 1_000, 100);
    expect(sample.length).toBeLessThanOrEqual(1_000);
  });

  it("keeps the first and last chunk of a long text", () => {
    const chunks = Array.from({ length: 50 }, (_, i) => `CHUNK${i}`.padEnd(10, "."));
    const long = chunks.join("");
    const sample = et.sampleForTagging(long, 300, 10);
    expect(sample).toContain("CHUNK0");
    expect(sample).toContain("CHUNK49");
  });
});

describe("autoTagExportsEnabled", () => {
  it("is false with neither flag set", () => {
    expect(et.autoTagExportsEnabled()).toBe(false);
  });

  it("is false with only MCP_AUTO_TAG_EXPORTS set (wiki-linking off = safe no-op)", () => {
    process.env.MCP_AUTO_TAG_EXPORTS = "true";
    expect(et.autoTagExportsEnabled()).toBe(false);
  });

  it("is false with only MCP_ALLOW_WIKI_LINKING set", () => {
    process.env.MCP_ALLOW_WIKI_LINKING = "true";
    expect(et.autoTagExportsEnabled()).toBe(false);
  });

  it("is true only when both flags are set", () => {
    process.env.MCP_AUTO_TAG_EXPORTS = "true";
    process.env.MCP_ALLOW_WIKI_LINKING = "true";
    expect(et.autoTagExportsEnabled()).toBe(true);
  });
});

describe("autoTagConversation", () => {
  it("is a no-op ({skipped}) when the flag is off", async () => {
    cw.saveExportedConversation({ content: "hello Jin", conversationId: "k1" });
    const result = await et.autoTagConversation("k1");
    expect(result).toEqual({ skipped: "disabled" });
  });

  it("errors on an unknown conversation_key", async () => {
    process.env.MCP_AUTO_TAG_EXPORTS = "true";
    process.env.MCP_ALLOW_WIKI_LINKING = "true";
    const result = await et.autoTagConversation("missing");
    expect("error" in result).toBe(true);
  });

  it("extracts entities via Claude and writes them to entry_entities", async () => {
    process.env.MCP_AUTO_TAG_EXPORTS = "true";
    process.env.MCP_ALLOW_WIKI_LINKING = "true";
    vi.spyOn(claudeMod, "extractTaggingEntities").mockResolvedValue([
      { kind: "person", name: "Jin" },
    ]);
    cw.saveExportedConversation({ content: "talked with Jin", conversationId: "k1" });
    const result = await et.autoTagConversation("k1");
    expect("tagged" in result && result.tagged).toBe(1);
    const rows = dbMod
      .db()
      .prepare("SELECT name FROM entry_entities WHERE page_id='mcp-conversations:k1'")
      .all() as Array<{ name: string }>;
    expect(rows.map((r) => r.name)).toEqual(["Jin"]);
    const linked = dbMod
      .db()
      .prepare("SELECT linked_at FROM mcp_conversations WHERE conversation_key='k1'")
      .get() as { linked_at: string | null };
    expect(linked.linked_at).not.toBeNull();
  });

  it("a thrown extraction error surfaces as {error}, not a crash", async () => {
    process.env.MCP_AUTO_TAG_EXPORTS = "true";
    process.env.MCP_ALLOW_WIKI_LINKING = "true";
    vi.spyOn(claudeMod, "extractTaggingEntities").mockRejectedValue(new Error("boom"));
    cw.saveExportedConversation({ content: "hello", conversationId: "k1" });
    const result = await et.autoTagConversation("k1");
    expect("error" in result && result.error).toBe("boom");
  });
});

describe("autoTagReflection", () => {
  it("is a no-op ({skipped}) when the flag is off", async () => {
    rw.saveReflection({ content: "hello", reflectionId: "k1" });
    const result = await et.autoTagReflection("k1");
    expect(result).toEqual({ skipped: "disabled" });
  });

  it("extracts entities via Claude and writes them to entry_entities", async () => {
    process.env.MCP_AUTO_TAG_EXPORTS = "true";
    process.env.MCP_ALLOW_WIKI_LINKING = "true";
    vi.spyOn(claudeMod, "extractTaggingEntities").mockResolvedValue([
      { kind: "place", name: "Suwon" },
    ]);
    rw.saveReflection({ content: "thinking about Suwon", reflectionId: "k1" });
    const result = await et.autoTagReflection("k1");
    expect("tagged" in result && result.tagged).toBe(1);
    const rows = dbMod
      .db()
      .prepare("SELECT name FROM entry_entities WHERE page_id='mcp-reflections:k1'")
      .all() as Array<{ name: string }>;
    expect(rows.map((r) => r.name)).toEqual(["Suwon"]);
  });
});

describe("maybeAutoTagUnlinkedConversations / maybeAutoTagUnlinkedReflections (sweep)", () => {
  it("returns {tagged:0, failed:0} when the flag is off, without calling Claude", async () => {
    const spy = vi.spyOn(claudeMod, "extractTaggingEntities");
    cw.saveExportedConversation({ content: "hello", conversationId: "k1" });
    const result = await et.maybeAutoTagUnlinkedConversations();
    expect(result).toEqual({ tagged: 0, failed: 0 });
    expect(spy).not.toHaveBeenCalled();
  });

  it("isolates one failing row from the rest of the batch", async () => {
    process.env.MCP_AUTO_TAG_EXPORTS = "true";
    process.env.MCP_ALLOW_WIKI_LINKING = "true";
    cw.saveExportedConversation({ content: "a", conversationId: "k1" });
    cw.saveExportedConversation({ content: "b", conversationId: "k2" });
    vi.spyOn(claudeMod, "extractTaggingEntities")
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce([{ kind: "person", name: "Jin" }]);
    const result = await et.maybeAutoTagUnlinkedConversations();
    expect(result).toEqual({ tagged: 1, failed: 1 });
  });
});
