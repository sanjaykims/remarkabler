import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// The "Chat diary" (lib/chatDiary.ts) is a diary entry composed by talking to
// Claude. Unlike conversations/reflections/decisions, it's a REAL diary
// notebook that fully counts. These pins lock the load-bearing behaviour:
//   - saveChatDiaryEntry writes a real page (with entry_date + FTS) into the
//     CHAT_DIARY notebook, appending by default;
//   - an entry_id upserts (edit, not duplicate);
//   - a bad/absent date falls back to today, never a garbage entry_date;
//   - the entry is INCLUDED (not excluded) by the diary read surfaces —
//     search_diary / get_entries_by_date see it, and /mind counts it —
//     which is the whole point of it being a real notebook.

type DbMod = typeof import("@/lib/db");
type CdMod = typeof import("@/lib/chatDiary");
type NotesMod = typeof import("@/lib/notes");
type MindMod = typeof import("@/lib/mind");

let dbMod: DbMod;
let cd: CdMod;
let notesMod: NotesMod;
let mindMod: MindMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "chat-diary-"));
  delete process.env.VOYAGE_API_KEY; // no embeddings in the test
  process.env.ANTHROPIC_API_KEY = "test-key";
  dbMod = await import("@/lib/db");
  cd = await import("@/lib/chatDiary");
  notesMod = await import("@/lib/notes");
  mindMod = await import("@/lib/mind");
  dbMod.db();
});

beforeEach(() => {
  const d = dbMod.db();
  d.prepare("DELETE FROM entry_entities").run();
  d.prepare("DELETE FROM entry_analysis").run();
  d.prepare("DELETE FROM pages_fts").run();
  d.prepare("DELETE FROM pages").run();
  d.prepare("DELETE FROM notebooks").run();
});

const NB = "chat-diary";

describe("saveChatDiaryEntry (real diary notebook)", () => {
  it("creates the Chat diary notebook and appends a dated page", () => {
    const { pageId, date } = cd.saveChatDiaryEntry({
      content: "Today I shipped the diary feature and felt good about it.",
      date: "2026-07-20",
    });
    expect(pageId.startsWith(`${NB}:`)).toBe(true);
    expect(date).toBe("2026-07-20");

    const nb = dbMod.db().prepare("SELECT id, name FROM notebooks WHERE id = ?").get(NB) as
      | { id: string; name: string }
      | undefined;
    expect(nb?.name).toBe("Chat diary");

    const page = dbMod
      .db()
      .prepare("SELECT ocr_text, entry_date, notebook_id FROM pages WHERE id = ?")
      .get(pageId) as { ocr_text: string; entry_date: string; notebook_id: string };
    expect(page.notebook_id).toBe(NB);
    expect(page.entry_date).toBe("2026-07-20");
    expect(page.ocr_text).toContain("shipped the diary feature");

    // It's searchable via FTS (search_diary path).
    const fts = dbMod
      .db()
      .prepare("SELECT COUNT(*) AS c FROM pages_fts WHERE page_id = ?")
      .get(pageId) as { c: number };
    expect(fts.c).toBe(1);
  });

  it("appends a second entry (new page_index), not overwrites", () => {
    cd.saveChatDiaryEntry({ content: "entry one", date: "2026-07-20" });
    cd.saveChatDiaryEntry({ content: "entry two", date: "2026-07-21" });
    const count = (
      dbMod.db().prepare("SELECT COUNT(*) AS c FROM pages WHERE notebook_id = ?").get(NB) as {
        c: number;
      }
    ).c;
    expect(count).toBe(2);
    const idxs = dbMod
      .db()
      .prepare("SELECT page_index FROM pages WHERE notebook_id = ? ORDER BY page_index")
      .all(NB) as Array<{ page_index: number }>;
    expect(idxs.map((r) => r.page_index)).toEqual([0, 1]);
  });

  it("an entry_id UPSERTS the same page (edit, not duplicate)", () => {
    cd.saveChatDiaryEntry({ content: "draft", date: "2026-07-20", entryId: "mon" });
    cd.saveChatDiaryEntry({ content: "revised", date: "2026-07-20", entryId: "mon" });
    const rows = dbMod
      .db()
      .prepare("SELECT ocr_text FROM pages WHERE notebook_id = ?")
      .all(NB) as Array<{ ocr_text: string }>;
    expect(rows.length).toBe(1);
    expect(rows[0].ocr_text).toBe("revised");
    // FTS was kept in sync (one row, latest text).
    const fts = dbMod
      .db()
      .prepare("SELECT COUNT(*) AS c FROM pages_fts WHERE page_id = ?")
      .get(`${NB}:mon`) as { c: number };
    expect(fts.c).toBe(1);
  });

  it("falls back to today (KST) for a missing or malformed date", () => {
    const today = notesMod.todayLocalDate();
    expect(cd.saveChatDiaryEntry({ content: "no date" }).date).toBe(today);
    expect(cd.saveChatDiaryEntry({ content: "bad date", date: "not-a-date" }).date).toBe(today);
  });
});

describe("chat-diary entries are INCLUDED as real diary (not excluded)", () => {
  it("counts on the /mind heatmap and pending analysis", () => {
    cd.saveChatDiaryEntry({ content: "a talked diary day", date: "2026-07-20" });
    // Real notebook → shows up as a writing day.
    expect(mindMod.getHeatmap().map((b) => b.date)).toContain("2026-07-20");
    // Real notebook → its page is pending /mind analysis (would be analyzed).
    expect(mindMod.countPending()).toBeGreaterThanOrEqual(1);
  });

  it("is NOT in the exclusion set the diary read surfaces use", () => {
    cd.saveChatDiaryEntry({ content: "went to Suwon with Jin today", date: "2026-07-20" });
    // The chat-tool read surfaces (get_entries_by_date etc.) exclude only
    // discipline + the three synthetic notebooks; chat-diary is deliberately
    // NOT among them, so a real diary read counts it.
    const c = (
      dbMod
        .db()
        .prepare(
          `SELECT COUNT(*) AS c FROM pages p
           WHERE p.entry_date = ? AND p.notebook_id NOT IN (?, ?, ?, ?)`
        )
        .get(
          "2026-07-20",
          notesMod.DISCIPLINE_ID,
          notesMod.CONVERSATIONS_NOTEBOOK_ID,
          notesMod.REFLECTIONS_NOTEBOOK_ID,
          notesMod.DECISIONS_NOTEBOOK_ID
        ) as { c: number }
    ).c;
    expect(c).toBe(1);
  });
});
