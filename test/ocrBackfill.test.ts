import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const proofread = vi.fn();
vi.mock("../lib/claude", () => ({
  proofreadExistingPdf: (...a: unknown[]) => proofread(...a),
  modelMain: () => "claude-opus-4-7",
}));

let dir: string;
let B: typeof import("../lib/ocrBackfill");
let dbMod: typeof import("../lib/db");

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "backfill-"));
  process.env.DATA_DIR = dir;
  dbMod = await import("../lib/db");
  B = await import("../lib/ocrBackfill");
  dbMod.db();
});

function addNotebook(id: string, syncedAt: string, text: string, withPdf = true) {
  const d = dbMod.db();
  d.prepare(`INSERT INTO notebooks(id,name,synced_at,status) VALUES(?,?,?,'done')`).run(id, id, syncedAt);
  d.prepare(`INSERT INTO pages(id,notebook_id,page_index,ocr_text) VALUES(?,?,0,?)`).run(`${id}:0`, id, text);
  if (withPdf) {
    fs.mkdirSync(path.join(dir, "files", id), { recursive: true });
    fs.writeFileSync(path.join(dir, "files", id, "notebook.pdf"), "%PDF-1.4 fake");
  }
}

beforeEach(() => {
  proofread.mockReset();
  const d = dbMod.db();
  for (const t of ["ocr_flags", "pages", "notebooks"]) d.prepare(`DELETE FROM ${t}`).run();
});

describe("old-diary proofreading (Phase 4)", () => {
  it("lists newest first, skipping notebooks without a PDF, and estimates cost", () => {
    addNotebook("old", "2026-01-01 00:00:00", "hello world");
    addNotebook("new", "2026-11-01 00:00:00", "met Elim today");
    addNotebook("nopdf", "2026-12-01 00:00:00", "text", false);
    expect(B.backfillCandidates().map((c) => c.id)).toEqual(["new", "old"]);
    const e = B.estimateBackfill();
    expect(e).toMatchObject({ notebooks: 2, pages: 2, next: { id: "new" } });
    expect(e.estimatedUsd).toBeGreaterThan(0);
  });

  it("adds anchored cards, never edits text, and marks the notebook done", async () => {
    addNotebook("nb", "2026-11-01 00:00:00", "met Elim today");
    proofread.mockResolvedValue([
      { page: 1, phrase: "Elim", alternatives: ["Elin"], reason: "n vs m" },
      { page: 1, phrase: "not in the text", alternatives: ["x"], reason: "" },
    ]);
    const r = await B.proofreadNotebook("nb");
    expect(r).toEqual({ ok: true, flags: 1 }); // the unanchorable one is dropped
    const d = dbMod.db();
    expect(d.prepare(`SELECT ocr_text FROM pages WHERE id='nb:0'`).get()).toEqual({ ocr_text: "met Elim today" });
    expect(d.prepare(`SELECT phrase, status FROM ocr_flags`).all()).toEqual([{ phrase: "Elim", status: "pending" }]);
    expect(B.backfillCandidates()).toEqual([]);
  });

  it("a failed call leaves the notebook retryable", async () => {
    addNotebook("nb", "2026-11-01 00:00:00", "text here");
    proofread.mockRejectedValue(new Error("overloaded"));
    expect(await B.proofreadNotebook("nb")).toMatchObject({ ok: false, skipped: "error" });
    expect(B.backfillCandidates().map((c) => c.id)).toEqual(["nb"]);
  });

  it("stops feeding the queue once enough cards are waiting", async () => {
    addNotebook("nb", "2026-11-01 00:00:00", "text here");
    const d = dbMod.db();
    for (let i = 0; i < B.PENDING_CAP; i++) {
      d.prepare(
        `INSERT INTO ocr_flags(id,notebook_id,page_id,page_index,start_offset,phrase,candidates,reason,status)
         VALUES(?,?,?,?,?,?,?,?,'pending')`
      ).run(`f${i}`, "nb", "nb:0", 0, 0, "p", "[]", "");
    }
    expect(await B.proofreadNotebook("nb")).toEqual({ ok: false, skipped: "queue-full" });
    expect(proofread).not.toHaveBeenCalled();
  });

  it("runBackfill caps one run at 3 notebooks", async () => {
    for (let i = 0; i < 5; i++) addNotebook(`n${i}`, `2026-11-0${i + 1} 00:00:00`, "text");
    proofread.mockResolvedValue([]);
    const r = await B.runBackfill(99);
    expect(r).toMatchObject({ busy: false, done: 3, flags: 0 });
    expect(proofread).toHaveBeenCalledTimes(3);
  });
});
