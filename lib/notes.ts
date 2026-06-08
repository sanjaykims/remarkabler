import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { db, getSetting, setSetting } from "./db";
import { ocrNotebookPdf, buildSelfModel, updateSelfModel, generateInsights, generateInsightTitle, summarizeDay } from "./claude";
import { embedBatch, embedBatchOrThrow, embeddingsEnabled, encodeEmbedding } from "./embeddings";
import { getCurrentProfile, hasProfile, saveProfile } from "./profile";
import { owntracksRouteContext } from "./owntracks";
import { recentLocationsContext, isLocationEnabled } from "./location";
import { parseSqliteUtc, TZ_OFFSET_MIN } from "./format";
import {
  disciplineConfig,
  fetchRepoTextFiles,
} from "./github";
import { maybeCleanupOrphanAttachments } from "./cleanup";

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
      `INSERT INTO notebooks(id,name,synced_at,status)
       VALUES(?,?,datetime('now'),'processing')`
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

    const insertPage = db().prepare(
      `INSERT INTO pages(id,notebook_id,page_index,ocr_text) VALUES(?,?,?,?)`
    );
    const insertFts = db().prepare(
      `INSERT INTO pages_fts(ocr_text,notebook_name,page_id,notebook_id)
       VALUES(?,?,?,?)`
    );

    const setEntryDate = db().prepare(`UPDATE pages SET entry_date = ? WHERE id = ?`);
    for (const p of pages) {
      const pageId = `${id}:${p.pageIndex}`;
      insertPage.run(pageId, id, p.pageIndex, p.text);
      if (p.text) {
        insertFts.run(p.text, row.name, pageId, id);
        setEntryDate.run(extractEntryDate(p.text) || "none", pageId);
      }
    }

    db()
      .prepare(`UPDATE notebooks SET status='done', error=NULL WHERE id = ?`)
      .run(id);

    // Embed each page semantically (Voyage). Failures are silent — search
    // falls back to FTS-only for pages without an embedding.
    if (embeddingsEnabled()) {
      try {
        const withText = pages.filter((p) => p.text && p.text.trim().length > 0);
        const vecs = await embedBatch(withText.map((p) => p.text), "document");
        if (vecs) {
          const upd = db().prepare(`UPDATE pages SET embedding = ? WHERE id = ?`);
          for (let i = 0; i < withText.length; i++) {
            upd.run(encodeEmbedding(vecs[i]), `${id}:${withText[i].pageIndex}`);
          }
        }
      } catch (e) {
        console.warn("[notes] post-OCR embed failed:", (e as Error).message);
      }
    }

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
        saveProfile(updated);
      }
    } catch (e) {
      console.warn("[notes] profile fold failed:", (e as Error).message);
    }
  } catch (err) {
    console.error("[notes] processNotebook failed:", (err as Error).message);
    try {
      db()
        .prepare(`UPDATE notebooks SET status='error', error=? WHERE id = ?`)
        .run((err as Error).message, id);
    } catch (e) {
      console.error("[notes] couldn't record processing error:", (e as Error).message);
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
 * Concatenate every OCR'd page into one big context block. Used by the
 * insights generator, the book composer, and the memory rebuild — places
 * that want the full corpus, not just retrieved excerpts. Chat does NOT
 * call this; chat uses tool-calling against pages_fts on demand instead.
 * Truncates at maxChars to stay within the model's input window.
 */
export function buildNotesContext(opts: { maxChars?: number } = {}): string {
  const limit = opts.maxChars ?? 150_000;
  const excludeId = isDisciplineEnabled() ? "__none__" : DISCIPLINE_ID;
  const rows = db()
    .prepare(
      `SELECT n.name as notebook_name, p.page_index, p.ocr_text
       FROM pages p JOIN notebooks n ON n.id = p.notebook_id
       WHERE p.ocr_text IS NOT NULL AND p.ocr_text != ''
         AND p.notebook_id != ?
       ORDER BY n.name, p.page_index`
    )
    .all(excludeId) as Array<{
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
    out += `\n[...truncated to ${limit} chars; older pages omitted]\n`;
  }
  return out || "(no notebooks have been uploaded yet)";
}

// Turn a free-text question into a safe FTS5 query: keep word-ish tokens,
// quote each (so punctuation can't be read as an operator), OR them together.
// The diary entries are timestamped "YYYY-MM-DD-HHMM-KST", so the indexed
// tokens for May 28 look like "2026", "05", "28". A natural query like
// "5/28" or "5/28th" needs to be turned into "05" + "28" for the search
// to actually find that entry — that's what this preprocessor does. Also
// strips ordinal suffixes ("28th" → "28").
export function normaliseDates(msg: string): string {
  let out = msg.replace(/(\d)(st|nd|rd|th)\b/gi, "$1");
  // YYYY-M-D or YYYY/M/D → "YYYY MM DD"  (handled first so the M-D rule
  // below doesn't pick up a substring of it)
  out = out.replace(
    /\b(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\b/g,
    (_, y, m, d) => ` ${y} ${String(m).padStart(2, "0")} ${String(d).padStart(2, "0")} `
  );
  // M/D or M-D → "MM DD"
  out = out.replace(
    /\b(\d{1,2})[\/-](\d{1,2})\b/g,
    (_, m, d) => ` ${String(m).padStart(2, "0")} ${String(d).padStart(2, "0")} `
  );
  return out;
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
      saveProfile(profile);
    } catch {
      // best-effort; will retry on the next chat
    } finally {
      seedingProfile = false;
    }
  })();
}

let distillingLocation = false;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
let generatingWeeklyInsight = false;
let backfillingEmbeddings = false;
let backfillingEntryDates = false;
let generatingDailySummaries = false;
let autoSyncingDiscipline = false;

// Throttle the whole background-maintenance cascade so a chat send isn't
// paying 7+ guard DB reads (each a COUNT or join over `pages`) on every
// request. Once every five minutes is plenty for the kind of work this
// kicks off — embedding backfills, daily summaries, the weekly insight,
// the weekly location distill, weekly backup.
const MAINTENANCE_INTERVAL_MS = 5 * 60 * 1000;
let lastMaintenanceAt = 0;

// Pull the user's own diary timestamp ("YYYY-MM-DD-HHMM-KST") out of a page
// of OCR'd text. Used to group entries by the date the user wrote them, not
// the date they happened to upload the notebook.
export function extractEntryDate(text: string): string | null {
  if (!text) return null;
  const m = text.match(/(\d{4})-(\d{2})-(\d{2})-\d{4}-KST/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * For pages that don't yet have an entry_date, parse it from their text
 * and store it. Cheap, runs in batches in the background. Pages with no
 * timestamp get marked with a sentinel ("none") so we don't keep re-trying.
 */
export function maybeBackfillEntryDates(): void {
  if (backfillingEntryDates) return;
  try {
    const row = db()
      .prepare(
        `SELECT COUNT(*) AS c FROM pages
         WHERE ocr_text IS NOT NULL AND ocr_text != '' AND entry_date IS NULL`
      )
      .get() as { c: number };
    if (row.c === 0) return;
  } catch {
    return;
  }
  backfillingEntryDates = true;
  (async () => {
    try {
      const upd = db().prepare(`UPDATE pages SET entry_date = ? WHERE id = ?`);
      while (true) {
        const rows = db()
          .prepare(
            `SELECT id, ocr_text FROM pages
             WHERE ocr_text IS NOT NULL AND ocr_text != '' AND entry_date IS NULL
             LIMIT 64`
          )
          .all() as Array<{ id: string; ocr_text: string }>;
        if (rows.length === 0) break;
        for (const r of rows) {
          const d = extractEntryDate(r.ocr_text);
          upd.run(d || "none", r.id);
        }
      }
    } catch {
      // best-effort
    } finally {
      backfillingEntryDates = false;
    }
  })();
}

/**
 * For any date that has diary entries but no daily summary yet, generate
 * the summary in the background. Caps at 3 generations per tick so a
 * fresh-out-of-the-box backfill doesn't ramp up cost suddenly — the cap
 * means a heavy backlog will fill in over several chat sessions.
 */
export function maybeGenerateDailySummaries(): void {
  if (generatingDailySummaries) return;
  try {
    const row = db()
      .prepare(
        `SELECT COUNT(DISTINCT p.entry_date) AS c
         FROM pages p
         LEFT JOIN daily_summaries d ON d.date = p.entry_date
         WHERE p.entry_date IS NOT NULL AND p.entry_date != 'none'
           AND p.ocr_text IS NOT NULL AND p.ocr_text != ''
           AND d.id IS NULL`
      )
      .get() as { c: number };
    if (row.c === 0) return;
  } catch {
    return;
  }
  generatingDailySummaries = true;
  (async () => {
    try {
      const PER_TICK = 3;
      const dates = db()
        .prepare(
          `SELECT DISTINCT p.entry_date AS date
           FROM pages p
           LEFT JOIN daily_summaries d ON d.date = p.entry_date
           WHERE p.entry_date IS NOT NULL AND p.entry_date != 'none'
             AND p.ocr_text IS NOT NULL AND p.ocr_text != ''
             AND d.id IS NULL
           ORDER BY p.entry_date DESC
           LIMIT ?`
        )
        .all(PER_TICK) as Array<{ date: string }>;
      for (const { date } of dates) {
        const entryRows = db()
          .prepare(
            `SELECT n.name AS notebook, p.page_index, p.ocr_text AS text
             FROM pages p JOIN notebooks n ON n.id = p.notebook_id
             WHERE p.entry_date = ?
             ORDER BY p.notebook_id, p.page_index`
          )
          .all(date) as Array<{ notebook: string; page_index: number; text: string }>;
        if (entryRows.length === 0) continue;
        const entries = entryRows
          .map(
            (r) =>
              `[${r.notebook} — page ${r.page_index + 1}]\n${r.text.trim()}`
          )
          .join("\n\n---\n\n");
        const summary = await summarizeDay({ date, entries });
        if (summary.trim()) {
          db()
            .prepare(
              `INSERT OR REPLACE INTO daily_summaries(date, summary) VALUES(?, ?)`
            )
            .run(date, summary.trim());
        }
      }
    } catch {
      // best-effort
    } finally {
      generatingDailySummaries = false;
    }
  })();
}

/**
 * Embed any pages that don't yet have a vector — for an existing app whose
 * pages predate the embedding column, this brings them online so semantic
 * search works against the full corpus. Fire-and-forget; safe to call often.
 */
export function maybeBackfillEmbeddings(): void {
  if (backfillingEmbeddings) return;
  if (!embeddingsEnabled()) return;
  // Cheap guard: only run when at least one page is missing an embedding.
  try {
    const row = db()
      .prepare(
        `SELECT COUNT(*) AS c FROM pages
         WHERE ocr_text IS NOT NULL AND ocr_text != '' AND embedding IS NULL`
      )
      .get() as { c: number };
    if (row.c === 0) return;
  } catch {
    return;
  }
  backfillingEmbeddings = true;
  (async () => {
    try {
      await backfillEmbeddingsLoop();
    } finally {
      backfillingEmbeddings = false;
    }
  })();
}

/**
 * Manual backfill: like maybeBackfillEmbeddings but awaits to completion and
 * returns a summary so a UI button can show progress + a real error message
 * when something fails (instead of the background path's silent break-and-retry).
 *
 * Resilience: when a batch fails, falls back to embedding pages one at a
 * time. Individual pages that throw are recorded as skipped and the loop
 * keeps going, so one bad page can't stall the whole corpus.
 */
export async function runEmbeddingBackfillOnce(): Promise<{
  embedded: number;
  skipped: number;
  remaining: number;
  skippedSamples: string[];
  error: string | null;
}> {
  if (!embeddingsEnabled()) {
    return {
      embedded: 0,
      skipped: 0,
      remaining: 0,
      skippedSamples: [],
      error: "VOYAGE_API_KEY is not set",
    };
  }
  if (backfillingEmbeddings) {
    return {
      embedded: 0,
      skipped: 0,
      remaining: countMissingEmbeddings(),
      skippedSamples: [],
      error: "Already running",
    };
  }
  backfillingEmbeddings = true;
  const skippedIds = new Set<string>();
  const skippedSamples: string[] = [];
  let embedded = 0;
  let error: string | null = null;
  try {
    embedded = await backfillEmbeddingsLoop(skippedIds, (sample) => {
      if (skippedSamples.length < 3) skippedSamples.push(sample);
    });
  } catch (e) {
    error = (e as Error).message || "Backfill failed";
  } finally {
    backfillingEmbeddings = false;
  }
  return {
    embedded,
    skipped: skippedIds.size,
    remaining: countMissingEmbeddings(),
    skippedSamples,
    error,
  };
}

function countMissingEmbeddings(): number {
  try {
    return (
      db()
        .prepare(
          `SELECT COUNT(*) AS c FROM pages
           WHERE ocr_text IS NOT NULL AND ocr_text != '' AND embedding IS NULL`
        )
        .get() as { c: number }
    ).c;
  } catch {
    return 0;
  }
}

async function backfillEmbeddingsLoop(
  skippedIds: Set<string> = new Set(),
  onSkip?: (sample: string) => void
): Promise<number> {
  const BATCH = 32;
  let total = 0;
  const upd = db().prepare(`UPDATE pages SET embedding = ? WHERE id = ?`);
  while (true) {
    // Skip rows we've already failed on this run so the SELECT keeps making
    // progress; the placeholders are built dynamically since better-sqlite3
    // doesn't accept arrays in IN(?).
    const skipList = Array.from(skippedIds);
    const placeholders = skipList.map(() => "?").join(",");
    // Shortest pages first so small diary entries embed in big batches up
    // front, and the large discipline-notebook markdown pages either fit
    // when alone or fail in isolation where per-page fallback handles them.
    const sql =
      `SELECT id, ocr_text FROM pages
       WHERE ocr_text IS NOT NULL AND ocr_text != '' AND embedding IS NULL` +
      (skipList.length ? ` AND id NOT IN (${placeholders})` : "") +
      ` ORDER BY LENGTH(ocr_text) ASC
        LIMIT ?`;
    const rows = db()
      .prepare(sql)
      .all(...skipList, BATCH) as Array<{ id: string; ocr_text: string }>;
    if (rows.length === 0) break;

    let vecs: Float32Array[] | null = null;
    try {
      vecs = await embedBatchOrThrow(rows.map((r) => r.ocr_text), "document");
    } catch {
      // Batch failed — fall back to per-page so one bad row doesn't kill the rest.
      vecs = null;
    }

    if (vecs) {
      for (let i = 0; i < rows.length; i++) {
        upd.run(encodeEmbedding(vecs[i]), rows[i].id);
      }
      total += rows.length;
      continue;
    }

    // Per-page fallback.
    for (const row of rows) {
      try {
        const one = await embedBatchOrThrow([row.ocr_text], "document");
        upd.run(encodeEmbedding(one[0]), row.id);
        total += 1;
      } catch (e) {
        skippedIds.add(row.id);
        const msg = (e as Error).message || "unknown";
        onSkip?.(`${row.id}: ${msg.slice(0, 120)}`);
      }
    }
  }
  return total;
}

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
        (await owntracksRouteContext(7, { allowNetwork: true })) ||
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
        saveProfile(updated);
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

// Local-time (KST) date string YYYY-MM-DD for "today" — used to fire the
// daily discipline auto-sync at most once per local day. We anchor on the
// user's display timezone so "every day at 00:00" matches what they see.
function todayLocalDate(): string {
  const now = Date.now() + TZ_OFFSET_MIN * 60 * 1000;
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Auto-pull the discipline (GitHub) repo once per local day. Fires from the
 * 5-minute maintenance sweep, so the first chat/upload/dashboard-load after
 * KST midnight triggers it. Best-effort, fire-and-forget, never throws.
 *
 * Strict 00:00 firing isn't possible without an out-of-process scheduler
 * (Railway has no built-in cron); this gives the same end-user experience
 * — "every day, automatic, no taps" — by piggybacking on existing traffic.
 * If the user doesn't open the app for a day, the sync happens on next use.
 */
export function maybeAutoSyncDiscipline(): void {
  if (autoSyncingDiscipline) return;
  if (!isDisciplineEnabled()) return;
  const cfg = disciplineConfig();
  if (!cfg) return;

  const today = todayLocalDate();
  const lastSyncDay = getSetting("discipline_auto_sync_day") || "";
  if (lastSyncDay === today) return;

  autoSyncingDiscipline = true;
  // Stamp the day BEFORE the actual work so a failing remote (network
  // blip, GitHub 5xx) doesn't cause this to retry on every sweep tick for
  // the rest of the day. Manual "Sync now" remains available as the
  // explicit recovery path.
  setSetting("discipline_auto_sync_day", today);

  (async () => {
    try {
      const files = await fetchRepoTextFiles(cfg);
      if (files.length === 0) {
        console.warn("[discipline] auto-sync: repo had no readable text files");
        return;
      }
      const disciplineText = replaceDisciplineNotebook(files);
      try {
        const current = getCurrentProfile();
        const updated = current
          ? await updateSelfModel({ currentProfile: current, newContent: disciplineText })
          : await buildSelfModel({ notesContext: buildNotesContext() });
        saveProfile(updated);
      } catch (e) {
        console.warn("[discipline] auto-sync: profile fold failed:", (e as Error).message);
      }
    } catch (e) {
      console.warn("[discipline] auto-sync failed:", (e as Error).message);
    } finally {
      autoSyncingDiscipline = false;
    }
  })();
}

/**
 * Once a week, write a fresh on-demand insight in the background so the
 * Insights record grows on its own rather than only when the user remembers
 * to tap. Best-effort, fired un-awaited from chat. Resets whenever the user
 * manually generates one (we use the latest insight's timestamp as the
 * cadence anchor — no separate flag needed).
 */
export function maybeGenerateWeeklyInsight(): void {
  if (generatingWeeklyInsight) return;
  try {
    const last = db()
      .prepare(`SELECT created_at FROM insights ORDER BY id DESC LIMIT 1`)
      .get() as { created_at: string } | undefined;
    if (last) {
      const lastAt = parseSqliteUtc(last.created_at);
      if (lastAt && Date.now() - lastAt.getTime() < WEEK_MS) return;
    }
  } catch {
    return;
  }
  const noteCount = db()
    .prepare(
      `SELECT COUNT(*) AS c FROM pages WHERE ocr_text IS NOT NULL AND ocr_text != ''`
    )
    .get() as { c: number };
  if (noteCount.c === 0) return;

  generatingWeeklyInsight = true;
  (async () => {
    try {
      const notesContext = buildNotesContext();
      const chatContext = buildChatContext();
      const priorRows = db()
        .prepare(`SELECT content FROM insights ORDER BY id DESC LIMIT 3`)
        .all() as Array<{ content: string }>;
      const content = await generateInsights({
        notesContext,
        chatContext,
        priorInsights: priorRows.map((r) => r.content),
      });
      if (!content.trim()) return;
      let title = "";
      try {
        title = await generateInsightTitle(content.trim());
      } catch {
        // a title is optional
      }
      db()
        .prepare(`INSERT INTO insights(content, title) VALUES(?, ?)`)
        .run(content.trim(), title || null);
    } catch {
      // best-effort
    } finally {
      generatingWeeklyInsight = false;
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
  // Only the tail of the conversation matters (the char-budget loop below
  // walks backwards and stops the moment it overflows). Pull the most
  // recent ~500 rows instead of every chat message ever — once chat_messages
  // grows past a few thousand rows the old "ORDER BY id ASC" with no LIMIT
  // becomes the slowest single query in the app.
  const rows = (
    db()
      .prepare(
        `SELECT role, content FROM chat_messages ORDER BY id DESC LIMIT 500`
      )
      .all() as Array<{ role: string; content: string }>
  ).reverse();

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

// User-controllable opt-in: when off, the discipline notebook is not fed to
// chat retrieval or context, and Sync is blocked. Past entries stay in the DB.
export function isDisciplineEnabled(): boolean {
  const v = getSetting("discipline_enabled");
  return v === null ? true : v === "1";
}

export function setDisciplineEnabled(enabled: boolean): void {
  setSetting("discipline_enabled", enabled ? "1" : "0");
}

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
      `INSERT INTO notebooks(id,name,synced_at,status)
       VALUES(?,?,datetime('now'),'done')`
    )
    .run(DISCIPLINE_ID, name);

  const insertPage = db().prepare(
    `INSERT INTO pages(id,notebook_id,page_index,ocr_text) VALUES(?,?,?,?)`
  );
  const insertFts = db().prepare(
    `INSERT INTO pages_fts(ocr_text,notebook_name,page_id,notebook_id)
     VALUES(?,?,?,?)`
  );
  files.forEach((f, i) => {
    const pageId = `${DISCIPLINE_ID}:${i}`;
    const text = `# ${f.path}\n${f.content}`;
    insertPage.run(pageId, DISCIPLINE_ID, i, text);
    insertFts.run(text, name, pageId, DISCIPLINE_ID);
  });

  // Mark today as synced so the daily auto-sync sweep won't re-fire after a
  // manual "Sync now" on the same day.
  setSetting("discipline_auto_sync_day", todayLocalDate());

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

// Need a top-level import for the backup function so the sweep can call it.
// (Local require to avoid a circular import: lib/backup.ts already imports
// from lib/db.ts, and we only need the backup function inside the sweep.)
let _maybeRunWeeklyBackup: (() => void) | null = null;
function getMaybeRunWeeklyBackup(): () => void {
  if (_maybeRunWeeklyBackup) return _maybeRunWeeklyBackup;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("./backup") as { maybeRunWeeklyBackup: () => void };
  _maybeRunWeeklyBackup = mod.maybeRunWeeklyBackup;
  return _maybeRunWeeklyBackup;
}

/**
 * Throttled fire-and-forget background sweep. Used to be a cascade of seven
 * independent maybe* calls on every chat send AND every dashboard render —
 * each one read the database to decide whether to fire. Now: one timestamp
 * check; if more than 5 minutes have passed, run the cascade once. Anything
 * already-flagged (the per-function guards still exist as a second line of
 * defence) is also a quick no-op. The net effect is that a flurry of chat
 * messages or dashboard loads share one sweep instead of paying the cost
 * each time.
 */
export function runMaintenanceSweep(): void {
  const now = Date.now();
  // In-memory check is the cheap fast path; consult the persisted timestamp
  // when the in-memory one looks "fresh" (i.e. just started — Railway can
  // cold-start the process several times a day, which would otherwise reset
  // lastMaintenanceAt to 0 and refire the entire cascade on each restart).
  if (now - lastMaintenanceAt < MAINTENANCE_INTERVAL_MS) return;
  if (lastMaintenanceAt === 0) {
    const stored = Number(getSetting("last_maintenance_at") || "0");
    if (Number.isFinite(stored) && stored > 0) {
      lastMaintenanceAt = stored;
      if (now - lastMaintenanceAt < MAINTENANCE_INTERVAL_MS) return;
    }
  }
  lastMaintenanceAt = now;
  setSetting("last_maintenance_at", String(now));
  ensureProfileSeed();
  maybeDistillLocation();
  maybeGenerateWeeklyInsight();
  maybeBackfillEmbeddings();
  maybeBackfillEntryDates();
  maybeGenerateDailySummaries();
  // Daily-gated: pull the discipline repo once per local-time day.
  maybeAutoSyncDiscipline();
  // Daily-gated sweep: orphan chat_attachment rows + stray files in the
  // chat-attachments directory whose row was already gone.
  maybeCleanupOrphanAttachments();
  try {
    getMaybeRunWeeklyBackup()();
  } catch {
    // best-effort; backup module is optional
  }
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
