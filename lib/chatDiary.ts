import { randomBytes } from "crypto";
import { db } from "./db";
import {
  CHAT_DIARY_NOTEBOOK_ID,
  todayLocalDate,
  buildNotesContext,
} from "./notes";
import { getCurrentProfile, saveProfile } from "./profile";
import { updateSelfModel, buildSelfModel } from "./claude";
import { embeddingsEnabled, embedBatch, encodeEmbedding } from "./embeddings";

// "Chat diary": a diary entry composed by talking to subscription-Claude
// instead of handwriting it. The calling Claude drafts a first-person entry
// (in the user's voice, and — per the tool description — only after the user
// approves the draft) and calls the save_diary_entry MCP tool, which lands
// here.
//
// This is DELIBERATELY different from conversations/reflections/decisions:
// those file into synthetic notebooks EXCLUDED from the diary's analytics.
// A chat diary entry is the person's own diary content (just dictated), so it
// goes into a REAL notebook (CHAT_DIARY_NOTEBOOK_ID, not excluded anywhere)
// and runs the SAME post-ingest pipeline a handwritten notebook does —
// embeddings, profile fold, /mind analysis, day-file export — so it fully
// counts as diary. It's kept as its own notebook only so handwritten vs
// talked entries stay distinguishable.

export const CHAT_DIARY_NOTEBOOK_NAME = "Chat diary";
// A single entry is a day's worth of talking, not a transcript — keep it
// bounded but generous (well above a normal diary page).
export const MAX_DIARY_ENTRY_CHARS = 40_000;

function ensureChatDiaryNotebook(): void {
  db()
    .prepare(
      `INSERT OR IGNORE INTO notebooks(id, name, synced_at, status)
       VALUES (?, ?, datetime('now'), 'done')`
    )
    .run(CHAT_DIARY_NOTEBOOK_ID, CHAT_DIARY_NOTEBOOK_NAME);
  // Keep synced_at current so the notebook orders as "recent" in day-file
  // assembly and the notebook list, like a freshly ingested notebook.
  db()
    .prepare(`UPDATE notebooks SET synced_at = datetime('now') WHERE id = ?`)
    .run(CHAT_DIARY_NOTEBOOK_ID);
}

function nextPageIndex(): number {
  const row = db()
    .prepare(
      `SELECT COALESCE(MAX(page_index), -1) AS m FROM pages WHERE notebook_id = ?`
    )
    .get(CHAT_DIARY_NOTEBOOK_ID) as { m: number };
  return row.m + 1;
}

// Normalise a YYYY-MM-DD date, or fall back to today (KST). Anything that
// isn't a clean date string becomes today, so a bad `date` arg can never
// produce a garbage entry_date.
function normaliseDate(date?: string): string {
  const d = (date || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayLocalDate();
}

// --- Store (the synchronous write path) ------------------------------------
// Appends one diary page (or, if `entryId` is given, upserts that one page so
// a retry/edit doesn't duplicate). Returns the page id + resolved date. The
// heavy post-ingest work (embed/fold/analyse/export) is fired separately via
// processChatDiaryEntry, so the MCP tool can return immediately — the same
// createNotebook → processNotebook split handwritten uploads use.
export function saveChatDiaryEntry(input: {
  content: string;
  date?: string;
  entryId?: string;
}): { pageId: string; date: string } {
  ensureChatDiaryNotebook();
  const entryDate = normaliseDate(input.date);
  const content = input.content;
  const givenId = (input.entryId || "").trim().slice(0, 200);

  if (givenId) {
    // Upsert this specific entry (idempotent retry / edit).
    const pageId = `${CHAT_DIARY_NOTEBOOK_ID}:${givenId}`;
    const existing = db()
      .prepare(`SELECT page_index FROM pages WHERE id = ?`)
      .get(pageId) as { page_index: number } | undefined;
    const pageIndex = existing ? existing.page_index : nextPageIndex();
    db()
      .prepare(
        `INSERT INTO pages(id, notebook_id, page_index, ocr_text, entry_date, embedding)
         VALUES (?, ?, ?, ?, ?, NULL)
         ON CONFLICT(id) DO UPDATE SET
           ocr_text = excluded.ocr_text,
           entry_date = excluded.entry_date,
           embedding = NULL`
      )
      .run(pageId, CHAT_DIARY_NOTEBOOK_ID, pageIndex, content, entryDate);
    // Keep FTS in sync (delete any prior row for this page, then insert).
    db().prepare(`DELETE FROM pages_fts WHERE page_id = ?`).run(pageId);
    db()
      .prepare(
        `INSERT INTO pages_fts(ocr_text, notebook_name, page_id, notebook_id)
         VALUES (?, ?, ?, ?)`
      )
      .run(content, CHAT_DIARY_NOTEBOOK_NAME, pageId, CHAT_DIARY_NOTEBOOK_ID);
    return { pageId, date: entryDate };
  }

  // Append a brand-new entry.
  const key = randomBytes(8).toString("hex");
  const pageId = `${CHAT_DIARY_NOTEBOOK_ID}:${key}`;
  const pageIndex = nextPageIndex();
  db()
    .prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text, entry_date)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(pageId, CHAT_DIARY_NOTEBOOK_ID, pageIndex, content, entryDate);
  db()
    .prepare(
      `INSERT INTO pages_fts(ocr_text, notebook_name, page_id, notebook_id)
       VALUES (?, ?, ?, ?)`
    )
    .run(content, CHAT_DIARY_NOTEBOOK_NAME, pageId, CHAT_DIARY_NOTEBOOK_ID);
  return { pageId, date: entryDate };
}

// --- Post-ingest processing (the async, best-effort path) ------------------
// Mirrors processNotebook's post-OCR steps for a single text entry: embed,
// fold into the profile, run /mind analysis, and re-export the affected day
// file. Every step is independently guarded — a Claude/Voyage hiccup never
// loses the entry (it's already durably saved by saveChatDiaryEntry).
export async function processChatDiaryEntry(pageId: string, text: string): Promise<void> {
  const trimmed = (text || "").trim();
  if (!trimmed) return;

  // 1. Embed the entry (semantic diary search + the /mind map).
  if (embeddingsEnabled()) {
    try {
      const vecs = await embedBatch([trimmed], "document");
      if (vecs && vecs[0]) {
        db()
          .prepare(`UPDATE pages SET embedding = ? WHERE id = ?`)
          .run(encodeEmbedding(vecs[0]), pageId);
      }
    } catch (e) {
      console.warn("[chatDiary] embed failed:", (e as Error).message);
    }
  }

  // 2. Fold into the evolving "profile of you" — same as a handwritten entry.
  try {
    const current = getCurrentProfile();
    const updated = current
      ? await updateSelfModel({ currentProfile: current, newContent: trimmed })
      : await buildSelfModel({ notesContext: buildNotesContext() });
    saveProfile(updated);
  } catch (e) {
    console.warn("[chatDiary] profile fold failed:", (e as Error).message);
  }

  // 3. Per-entry /mind analysis (themes/sentiment/summary + entities). The
  //    chat-diary notebook is NOT excluded, so analyzePending picks up this
  //    fresh page automatically; a small cap keeps it cheap.
  try {
    const { analyzePending } = await import("./mind");
    await analyzePending(2);
  } catch (e) {
    console.warn("[chatDiary] mind analysis failed:", (e as Error).message);
  }

  // 4. Re-export the day file this entry touches (if Dropbox export is on).
  try {
    const { maybeExportDiaryToDropbox } = await import("./dropbox");
    await maybeExportDiaryToDropbox({ notebookId: CHAT_DIARY_NOTEBOOK_ID });
  } catch (e) {
    console.warn("[chatDiary] diary export failed:", (e as Error).message);
  }
}
