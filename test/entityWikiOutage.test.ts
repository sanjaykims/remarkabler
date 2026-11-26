import { describe, it, expect, beforeAll, vi } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// During an API outage the wiki pass must stop after two failures in a row,
// not call Claude once per stale entity.
describe("refreshEntityWiki during an outage", () => {
  it("stops after two consecutive failures and reports the rest as remaining", async () => {
    process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "entity-wiki-outage-"));
    process.env.ANTHROPIC_API_KEY = "test-key";
    const { db } = await import("@/lib/db");
    const ew = await import("@/lib/entityWiki");
    const claude = await import("@/lib/claude");
    db()
      .prepare(`INSERT INTO notebooks(id, name, synced_at) VALUES('n', 'n', datetime('now'))`)
      .run();
    for (let i = 0; i < 5; i++) {
      db()
        .prepare(`INSERT INTO pages(id, notebook_id, page_index, ocr_text) VALUES(?, 'n', ?, 'text')`)
        .run("p" + i, i);
      db()
        .prepare(`INSERT INTO entry_entities(page_id, kind, name, name_norm) VALUES(?, 'person', ?, ?)`)
        .run("p" + i, "Person" + i, "person" + i);
    }
    const spy = vi.spyOn(claude, "composeEntityWiki").mockRejectedValue(new Error("overloaded"));
    const r = await ew.refreshEntityWiki();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(r.failed).toBe(2);
    expect(r.remaining).toBe(3);
  });
});
