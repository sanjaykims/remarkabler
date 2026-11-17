import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const coach = vi.fn();
vi.mock("../lib/claude", () => ({ coachWriting: (...a: unknown[]) => coach(...a) }));

let W: typeof import("../lib/writingCoach");
let dbMod: typeof import("../lib/db");
const long = (s: string) => s.repeat(700);

beforeAll(async () => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "coach-"));
  dbMod = await import("../lib/db");
  W = await import("../lib/writingCoach");
  dbMod.db();
});

function page(nb: string, idx: number, text: string, syncedDaysAgo = 0) {
  const d = dbMod.db();
  d.prepare(`INSERT OR IGNORE INTO notebooks(id,name,synced_at,status) VALUES(?,?,datetime('now', ?),'done')`).run(
    nb, nb, `-${syncedDaysAgo} days`
  );
  d.prepare(`INSERT INTO pages(id,notebook_id,page_index,ocr_text) VALUES(?,?,?,?)`).run(`${nb}:${idx}`, nb, idx, text);
}

beforeEach(() => {
  coach.mockReset();
  const d = dbMod.db();
  for (const t of ["writing_coach_pages", "writing_coach", "ocr_flags", "pages", "notebooks"]) d.prepare(`DELETE FROM ${t}`).run();
});

describe("writing coach", () => {
  it("splits the exercise line off", () => {
    expect(W.splitExercise("WHAT WORKS: x\nEXERCISE: open with a scene")).toEqual({
      feedback: "WHAT WORKS: x",
      exercise: "open with a scene",
    });
    expect(W.splitExercise("no line").exercise).toBeNull();
  });

  it("skips old, short, non-diary and card-pending pages", () => {
    page("a", 0, long("a"));
    page("a", 1, "short");
    page("old", 0, long("b"), 40);
    page("chat-diary", 0, long("c"));
    page("b", 0, long("d"));
    dbMod.db()
      .prepare(`INSERT INTO ocr_flags(id,notebook_id,page_id,page_index,start_offset,phrase,candidates) VALUES('f','b','b:0',0,0,'d','[]')`)
      .run();
    expect(W.coachablePages().map((r) => r.id)).toEqual(["a:0"]);
  });

  it("makes one session, marks pages, and passes the last exercise on", async () => {
    page("a", 0, long("a"));
    coach.mockResolvedValue("WHAT WORKS: good\nEXERCISE: shorter sentences");
    expect((await W.maybeCoachWriting()).ran).toBe(true);
    expect(W.listCoachSessions()[0].exercise).toBe("shorter sentences");
    expect((await W.maybeCoachWriting()).ran).toBe(false); // nothing new
    page("a", 1, long("e"));
    coach.mockResolvedValue("WHAT WORKS: better\nEXERCISE: end on an image");
    await W.maybeCoachWriting();
    expect(coach.mock.calls[1][0].lastExercise).toBe("shorter sentences");
    expect(W.listCoachSessions().length).toBe(2);
  });
});
