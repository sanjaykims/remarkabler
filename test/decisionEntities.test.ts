import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Entity-tagging for Decision Records (lib/decisionEntities.ts) — a trimmed
// mirror of lib/reflectionEntities.ts (see test/reflectionEntities.test.ts).

type DwMod = typeof import("@/lib/decisionWiki");
type DeMod = typeof import("@/lib/decisionEntities");
type DbMod = typeof import("@/lib/db");
let dw: DwMod;
let de: DeMod;
let dbMod: DbMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "decision-entities-"));
  dw = await import("@/lib/decisionWiki");
  de = await import("@/lib/decisionEntities");
  dbMod = await import("@/lib/db");
  dbMod.db();
});

beforeEach(() => {
  dbMod.db().prepare("DELETE FROM mcp_decisions").run();
  dbMod.db().prepare("DELETE FROM entry_entities").run();
  dbMod.db().prepare("DELETE FROM pages").run();
  dbMod.db().prepare("DELETE FROM notebooks").run();
  dbMod.db().prepare("DELETE FROM entity_aliases").run();
});

describe("ensureDecisionPage", () => {
  it("returns null for an unknown decision_key", () => {
    expect(de.ensureDecisionPage("nope")).toBeNull();
  });

  it("creates a deterministic page under the decisions notebook", () => {
    dw.saveDecision({ content: "decided X", title: "Defer ETF", decisionId: "k1" });
    const page = de.ensureDecisionPage("k1");
    expect(page!.pageId).toBe("mcp-decisions:k1");
    const row = dbMod
      .db()
      .prepare("SELECT ocr_text, notebook_id FROM pages WHERE id = ?")
      .get(page!.pageId) as { ocr_text: string; notebook_id: string };
    expect(row.notebook_id).toBe("mcp-decisions");
    expect(row.ocr_text).toContain("Defer ETF");
    expect(row.ocr_text).not.toContain("decided X");
  });
});

describe("tagDecisionEntities", () => {
  it("errors on an unknown decision_key", () => {
    const r = de.tagDecisionEntities({
      decisionKey: "missing",
      entities: [{ kind: "project", name: "ETF" }],
    });
    expect("error" in r).toBe(true);
  });

  it("tags entities, marks the decision linked, empty list is a valid completing call", () => {
    dw.saveDecision({ content: "a", decisionId: "k1" });
    const r = de.tagDecisionEntities({
      decisionKey: "k1",
      entities: [{ kind: "project", name: "ETF" }],
    });
    expect((r as { tagged: number }).tagged).toBe(1);
    const linked = dbMod
      .db()
      .prepare("SELECT linked_at FROM mcp_decisions WHERE decision_key='k1'")
      .get() as { linked_at: string | null };
    expect(linked.linked_at).not.toBeNull();

    const second = de.tagDecisionEntities({ decisionKey: "k1", entities: [] });
    expect((second as { tagged: number }).tagged).toBe(0);
    const count = (
      dbMod
        .db()
        .prepare("SELECT COUNT(*) AS c FROM entry_entities WHERE page_id='mcp-decisions:k1'")
        .get() as { c: number }
    ).c;
    expect(count).toBe(0);
  });
});
