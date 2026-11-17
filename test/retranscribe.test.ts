import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const queued = vi.fn();
vi.mock("../lib/notes", () => ({ queueNotebookProcessing: (...a: unknown[]) => queued(...a) }));
vi.mock("../lib/claude", () => ({ modelMain: () => "claude-opus-4-7" }));

let dir: string;
let R: typeof import("../lib/retranscribe");
let dbMod: typeof import("../lib/db");

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "retx-"));
  process.env.DATA_DIR = dir;
  dbMod = await import("../lib/db");
  R = await import("../lib/retranscribe");
  dbMod.db();
});

function add(id: string, syncedAt: string, rmPage = false) {
  const d = dbMod.db();
  d.prepare(`INSERT INTO notebooks(id,name,synced_at,status) VALUES(?,?,?,'done')`).run(id, id, syncedAt);
  d.prepare(`INSERT INTO pages(id,notebook_id,page_index,ocr_text,remarkable_page_id) VALUES(?,?,0,'text',?)`).run(
    `${id}:0`, id, rmPage ? "rm1" : null
  );
  fs.mkdirSync(path.join(dir, "files", id), { recursive: true });
  fs.writeFileSync(path.join(dir, "files", id, "notebook.pdf"), "%PDF");
}

beforeEach(() => {
  queued.mockReset();
  const d = dbMod.db();
  for (const t of ["pages", "notebooks"]) d.prepare(`DELETE FROM ${t}`).run();
});

describe("re-transcribe whole notebooks", () => {
  it("skips page-synced notebooks and queues newest first, capped", () => {
    add("old", "2026-01-01");
    add("new", "2026-02-01");
    add("synced", "2026-03-01", true);
    expect(R.retranscribeCandidates().map((c) => c.id)).toEqual(["new", "old"]);
    const r = R.queueRetranscribe(1);
    expect(r.queued).toBe(1);
    const row = dbMod.db().prepare(`SELECT status, retranscribe FROM notebooks WHERE id='new'`).get();
    expect(row).toEqual({ status: "queued", retranscribe: 1 });
    expect(queued).toHaveBeenCalledTimes(1);
    expect(R.retranscribeCandidates().map((c) => c.id)).toEqual(["old"]);
  });
});
