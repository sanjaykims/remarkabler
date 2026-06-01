import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { db, getSetting, setSetting } from "./db";
import { ocrNotebookPdf, buildSelfModel, updateSelfModel } from "./claude";
import { getCurrentProfile, hasProfile, saveProfile } from "./profile";
import { owntracksRouteContext } from "./owntracks";
import { recentRouteContext } from "./timeline";
import { recentLocationsContext, isLocationEnabled } from "./location";

const FILES_DIR = path.join(
  process.env.DATA_DIR || path.join(process.cwd(), "data"),
  "files"
);

export type NotebookSummary = {
  id: string;
  name: string;
};

/**
 * Persist an uploaded PDF and create a notebook row in the "processing"
 * state. This is fast — it does NOT call Claude. The actual transcription
 * happens in processNotebook, which is meant to run in the background so
 * the upload/share request can return immediately.
 */
export function createNotebook(
  fileName: string,
  pdfBytes: Uint8Array
): NotebookSummary {
  const id = randomUUID();
  const name = fileName.replace(/\.pdf$/i, "").trim() || "Untitled notebook";

  const notebookDir = path.join(FILES_DIR, id);
  fs.mkdirSync(notebookDir, { recursive: true });
  fs.writeFileSync(path.join(notebookDir, "notebook.pdf"), pdfBytes);

  db()
    .prepare(
      `INSERT INTO notebooks(id,name,parent,last_modified,hash,synced_at,status)
       VALUES(?,?,NULL,NULL,NULL,datetime('now'),'processing')`
    )
    .run(id, name);

  return { id, name };
}

/**
 * Transcribe a notebook's stored PDF with Claude and record the pages, then
 * mark the notebook "done" (or "error"). Designed to be called WITHOUT being
 * awaited — it never throws; failures are written to the notebook's status.
 */
export async function processNotebook(id: string): Promise<void> {
  try {
    const row = db()
      .prepare(`SELECT name FROM notebooks WHERE id = ?`)
      .get(id) as { name: string } | undefined;
    if (!row) return;

    const pdfPath = path.join(FILES_DIR, id, "notebook.pdf");
    const pdfBytes = fs.readFileSync(pdfPath);
    const pages = await ocrNotebookPdf(pdfBytes);

    const ocrModel = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
    const ocrAt = new Date().toISOString();

    const insertPage = db().prepare(
      `INSERT INTO pages(id,notebook_id,page_index,image_path,ocr_text,ocr_summary,ocr_model,ocr_at)
       VALUES(?,?,?,?,?,?,?,?)`
    );
    const insertFts = db().prepare(
      `INSERT INTO pages_fts(ocr_text,ocr_summary,notebook_name,page_id,notebook_id)
       VALUES(?,?,?,?,?)`
    );

    for (const p of pages) {
      const pageId = `${id}:${p.pageIndex}`;
      insertPage.run(pageId, id, p.pageIndex, pdfPath, p.text, p.summary, ocrModel, ocrAt);
      if (p.text) insertFts.run(p.text, p.summary, row.name, pageId, id);
    }

    db()
      .prepare(`UPDATE notebooks SET status='done', error=NULL WHERE id = ?`)
      .run(id);

    // Fold this notebook into the evolving profile of the person. Best-effort
    // and already in the background, so a failure never affects the upload.
    try {
      const entryText = pages
        .map((p) => p.text)
        .filter(Boolean)
        .join("\n\n");
      if (entryText.trim()) {
        const current = getCurrentProfile();
        const updated = current
          ? await updateSelfModel({ currentProfile: current, newContent: entryText })
          : await buildSelfModel({ notesContext: buildNotesContext() });
        saveProfile(updated, current ? "update" : "seed");
      }
    } catch {
      // profile update is best-effort
    }
  } catch (err) {
    try {
      db()
        .prepare(`UPDATE notebooks SET status='error', error=? WHERE id = ?`)
        .run((err as Error).message, id);
    } catch {
      // give up silently — the startup sweep will flag a stuck notebook
    }
  }
}

export function deleteNotebook(id: string): void {
  db().prepare(`DELETE FROM pages_fts WHERE notebook_id = ?`).run(id);
  db().prepare(`DELETE FROM pages WHERE notebook_id = ?`).run(id);
  db().prepare(`DELETE FROM notebooks WHERE id = ?`).run(id);
  const dir = path.join(FILES_DIR, id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Concatenate every OCR'd page into a single context block for the chat
 * model. Truncates at `maxChars`; for very large note collections, swap this
 * for a retrieval step that queries the `pages_fts` table per message.
 */
export function buildNotesContext(opts: { maxChars?: number } = {}): string {
  const limit = opts.maxChars ?? 150_000;
  const rows = db()
    .prepare(
      `SELECT n.name as notebook_name, p.page_index, p.ocr_text
       FROM pages p JOIN notebooks n ON n.id = p.notebook_id
       WHERE p.ocr_text IS NOT NULL AND p.ocr_text != ''
       ORDER BY n.name, p.page_index`
    )
    .all() as Array<{
    notebook_name: string;
    page_index: number;
    ocr_text: string;
  }>;

  let out = "";
  let truncated = false;
  for (const r of rows) {
    const block = `\n## ${r.notebook_name} — page ${r.page_index + 1}\n${r.ocr_text}\n`;
    if (out.length + block.length > limit) {
      truncated = true;
      break;
    }
    out += block;
  }
  if (truncated) {
    out += `\n[...truncated to ${limit} chars; switch to retrieval over pages_fts for full coverage]\n`;
  }
  return out || "(no notebooks have been uploaded yet)";
}

// Turn a free-text question into a safe FTS5 query: keep word-ish tokens,
// quote each (so punctuation can't be read as an operator), OR them together.
function ftsQuery(message: string): string {
  const terms = message
    .toLowerCase()
    .replace(/["'()*:^{}[\]~+\-.,!?]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 24);
  if (terms.length === 0) return "";
  return terms.map((t) => `"${t}"`).join(" OR ");
}

/**
 * Find the diary pages most relevant to a question via the `pages_fts`
 * full-text index, for grounding the chat in specific entries. Best-effort:
 * returns "" if nothing matches or the query can't be built.
 */
export function retrieveRelevantNotes(query: string, limit = 8): string {
  const q = ftsQuery(query);
  if (!q) return "";
  let rows: Array<{ notebook_name: string; ocr_text: string; page_id: string }>;
  try {
    rows = db()
      .prepare(
        `SELECT notebook_name, ocr_text, page_id FROM pages_fts
         WHERE pages_fts MATCH ? ORDER BY rank LIMIT ?`
      )
      .all(q, limit) as Array<{
      notebook_name: string;
      ocr_text: string;
      page_id: string;
    }>;
  } catch {
    return "";
  }
  if (rows.length === 0) return "";
  const out = rows
    .map((r) => {
      const pageNum = Number(r.page_id.split(":")[1] || 0) + 1;
      return `## ${r.notebook_name} — page ${pageNum}\n${r.ocr_text}`;
    })
    .join("\n\n");
  return out.length > 12000 ? out.slice(0, 12000) : out;
}

let seedingProfile = false;
/**
 * If there is no profile yet but notes exist (e.g. notes predate this
 * feature), build the first profile in the background. Returns immediately;
 * chat falls back to a capped notes context until the profile is ready.
 */
export function ensureProfileSeed(): void {
  if (seedingProfile || hasProfile()) return;
  const notes = db()
    .prepare(
      `SELECT COUNT(*) AS c FROM pages WHERE ocr_text IS NOT NULL AND ocr_text != ''`
    )
    .get() as { c: number };
  if (notes.c === 0) return;
  seedingProfile = true;
  (async () => {
    try {
      const profile = await buildSelfModel({ notesContext: buildNotesContext() });
      saveProfile(profile, "seed");
    } catch {
      // best-effort; will retry on the next chat
    } finally {
      seedingProfile = false;
    }
  })();
}

let distillingLocation = false;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Once a week, fold where the person has been into the evolving profile —
 * patterns and routines, NOT raw stops (which would just be noise). Best-effort
 * and fired un-awaited from chat, like ensureProfileSeed. Uses the Opus model
 * via updateSelfModel. Requires an existing profile (seeded from notebooks);
 * the weekly timestamp is set after each attempt so it never runs per-message.
 */
export function maybeDistillLocation(): void {
  if (distillingLocation) return;
  if (!isLocationEnabled()) return; // user has opted out of location sharing
  const last = getSetting("location_distill_at");
  if (last && Date.now() - Date.parse(last) < WEEK_MS) return;
  const profile = getCurrentProfile();
  if (!profile) return; // nothing to fold into yet

  distillingLocation = true;
  (async () => {
    try {
      const week =
        (await owntracksRouteContext(7)) ||
        recentRouteContext() ||
        recentLocationsContext();
      if (week.trim()) {
        const framed = [
          "Below is a summary of where I went over roughly the past week — my",
          "location route (places, times, and how long I stayed). Integrate only",
          "the meaningful patterns into your understanding of me: my routines,",
          "where I spend most of my time, and any notable change from before.",
          "Ignore one-off, incidental stops. Keep the profile compact.",
          "",
          week,
        ].join("\n");
        const updated = await updateSelfModel({
          currentProfile: profile,
          newContent: framed,
        });
        saveProfile(updated, "location-distill");
      }
      // Mark the weekly cadence even when there's no route, so we don't
      // recompute the (geocoding-heavy) week summary on every chat.
      setSetting("location_distill_at", new Date().toISOString());
    } catch {
      // best-effort
    } finally {
      distillingLocation = false;
    }
  })();
}

/**
 * Build a transcript of the user's chat history with Claude, most recent
 * messages first-bounded by `maxChars`. Used to feed the insights with what
 * the user has actually been asking and discussing.
 */
export function buildChatContext(opts: { maxChars?: number } = {}): string {
  const limit = opts.maxChars ?? 50_000;
  const rows = db()
    .prepare(`SELECT role, content FROM chat_messages ORDER BY id ASC`)
    .all() as Array<{ role: string; content: string }>;

  let out = "";
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    const who = r.role === "user" ? "Me" : "Claude";
    const block = `${who}: ${r.content}\n\n`;
    if (out.length + block.length > limit) break;
    out = block + out;
  }
  return out.trim();
}

// The synced GitHub "discipline" repo is stored as a single notebook so it
// flows through chat, retrieval, and the profile like any other notes.
export const DISCIPLINE_ID = "github-discipline";

/** Replace the discipline notebook with the freshly fetched repo files.
 *  Returns the concatenated text for folding into the profile. */
export function replaceDisciplineNotebook(
  files: Array<{ path: string; content: string }>
): string {
  db().prepare(`DELETE FROM pages_fts WHERE notebook_id = ?`).run(DISCIPLINE_ID);
  db().prepare(`DELETE FROM pages WHERE notebook_id = ?`).run(DISCIPLINE_ID);
  db().prepare(`DELETE FROM notebooks WHERE id = ?`).run(DISCIPLINE_ID);
  if (files.length === 0) return "";

  const name = "Discipline (GitHub)";
  db()
    .prepare(
      `INSERT INTO notebooks(id,name,parent,last_modified,hash,synced_at,status)
       VALUES(?,?,NULL,NULL,NULL,datetime('now'),'done')`
    )
    .run(DISCIPLINE_ID, name);

  const insertPage = db().prepare(
    `INSERT INTO pages(id,notebook_id,page_index,image_path,ocr_text,ocr_summary,ocr_model,ocr_at)
     VALUES(?,?,?,?,?,?,?,?)`
  );
  const insertFts = db().prepare(
    `INSERT INTO pages_fts(ocr_text,ocr_summary,notebook_name,page_id,notebook_id)
     VALUES(?,?,?,?,?)`
  );
  const now = new Date().toISOString();
  files.forEach((f, i) => {
    const pageId = `${DISCIPLINE_ID}:${i}`;
    const text = `# ${f.path}\n${f.content}`;
    insertPage.run(pageId, DISCIPLINE_ID, i, null, text, "", "github", now);
    insertFts.run(text, "", name, pageId, DISCIPLINE_ID);
  });

  return files.map((f) => `## ${f.path}\n${f.content}`).join("\n\n");
}

export function disciplineStatus(): { files: number; lastSynced: string | null } {
  const row = db()
    .prepare(
      `SELECT synced_at,
              (SELECT COUNT(*) FROM pages WHERE notebook_id = ?) AS files
       FROM notebooks WHERE id = ?`
    )
    .get(DISCIPLINE_ID, DISCIPLINE_ID) as
    | { synced_at: string | null; files: number }
    | undefined;
  return { files: row?.files ?? 0, lastSynced: row?.synced_at ?? null };
}

/** The file paths pulled from the discipline repo (for showing what synced). */
export function disciplineFiles(): string[] {
  const rows = db()
    .prepare(
      `SELECT ocr_text FROM pages WHERE notebook_id = ? ORDER BY page_index`
    )
    .all(DISCIPLINE_ID) as Array<{ ocr_text: string }>;
  return rows
    .map((r) => ((r.ocr_text || "").split("\n")[0] || "").replace(/^#\s*/, "").trim())
    .filter(Boolean);
}
