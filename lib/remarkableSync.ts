import fs from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
import { db, DATA_DIR, getSetting, setSetting, clearSetting } from "./db";
import {
  listRemarkableNotebooks,
  downloadNotebook,
  remarkableRootHash,
  remarkablePaired,
  type RemarkableNotebook,
} from "./remarkableCloud";
import { renderNotebookToPdf, renderersAvailable } from "./rmRender";
import {
  lockRemarkableImport,
  unlockRemarkableImport,
} from "./remarkableImport";
import { ocrNotebookPdf, updateSelfModel } from "./claude";
import { getCurrentProfile, saveProfile } from "./profile";
import { embedBatch, embeddingsEnabled, encodeEmbedding } from "./embeddings";
import { extractEntryDate, reparseAllEntryDates } from "./notes";
import { affectedDayFileNames } from "./diaryExportDb";

// ── reMarkable cloud zero-tap sync (Phase 2) ────────────────────────────────
//
// The sweep-driven loop that removes the last tap: write on the tablet →
// close the cover → the tablet syncs to reMarkable's cloud → this module
// notices, transcribes ONLY the new/changed pages, and the diary flows into
// the app (and the per-day Dropbox markdown) automatically.
//
// Scope control — what gets synced (never "all 134 notebooks"):
//   • every notebook that was imported once via the Import button (its
//     `notebooks.remarkable_doc_id` row is the subscription), plus
//   • every notebook whose folder the user enabled for auto-sync
//     (`remarkable_sync_folders` setting; new notebooks there are imported
//     automatically on first sight).
//
// Cost control — page-level diffing: each ingested page stores the sha256 of
// its raw `.rm` bytes. On change, only pages whose bytes are new/different
// get rendered + OCR'd (a daily diary session = 1-2 pages, not the whole
// notebook). Ordering (`page_index`) is re-synced for the WHOLE notebook from
// the cloud page order on every sync — inserts/reorders shift positions
// without changing content hashes (Codex, PR #76). Pages deleted on the
// tablet are KEPT (the diary is an append-only record) and ordered after the
// live pages.
//
// Guards mirror the Dropbox watcher: module-level in-flight flag, minimum
// interval, failure backoff, and a quiesce window so a mid-writing session
// isn't OCR'd repeatedly. The account-wide rootHash is a cheap fast-path:
// unchanged root → nothing anywhere → skip listing entirely.

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
// After a failed sweep, wait this long before trying again. Kept moderate:
// transient network blips already get in-call retries (withNetRetry in
// remarkableCloud), so by the time a failure surfaces here it's either real
// or rare — and a 30-min stall on a diary the user is waiting to chat about
// is worse than one extra attempt.
const FAILURE_BACKOFF_MS = 10 * 60 * 1000;
// Don't ingest a notebook edited in the last N minutes — the user may still
// be writing. The next sweep picks it up once it settles. Kept short at the
// owner's request (write → chat in ~5-10 min): page diffing makes a premature
// pass cheap (the still-growing page just re-OCRs once more when it settles,
// a few cents), and the tablet itself takes a minute or two to upload after
// the cover closes, which acts as a natural extra buffer.
const QUIESCE_MS = 5 * 60 * 1000;
// The PROFILE fold, however, waits longer. Page text is self-correcting
// (a later re-OCR replaces it wholesale) but updateSelfModel is append-only —
// a half-written sentence folded into the long-lived profile can't be
// unfolded by the corrected pass (Codex, PR #92). Pages ingested before this
// settling period are marked profile_fold_pending and folded by a later
// sweep once the notebook has been quiet this long.
const PROFILE_SETTLE_MS = 30 * 60 * 1000;
// Upper bound on OCR calls per sweep across all notebooks — a runaway guard,
// not a normal-operation limit (a normal day is 1-3 changed pages).
const MAX_PAGES_PER_SWEEP = 30;

const ROOT_HASH_KEY = "remarkable_root_hash";
const SYNC_FOLDERS_KEY = "remarkable_sync_folders";
const LAST_SYNC_AT_KEY = "remarkable_last_sync_at";
const SYNC_ERROR_KEY = "remarkable_sync_error";
const SYNC_NOTE_KEY = "remarkable_last_sync_note";

let inFlight = false;
let lastAttemptAt = 0;
let lastFailureAt = 0;

// Enabled folders are stored as { parentId: enabledAtISO }. The timestamp is
// load-bearing: a folder can hold YEARS of historical notebooks (the owner's
// Diary folder has 38), and enabling auto-sync must mean "pick up my writing
// FROM NOW ON" — not "re-transcribe the whole archive" (a surprise OCR bill
// plus mass duplication of notebooks already ingested via Dropbox). Only
// not-yet-imported notebooks edited AFTER the enable time are auto-imported;
// older ones stay out unless the user taps Import on them deliberately.
// (Already-imported notebooks are followed regardless — their row is the
// subscription.)
function syncFolderMap(): Record<string, string> {
  const raw = getSetting(SYNC_FOLDERS_KEY);
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) {
      // Legacy array shape (pre-timestamp) — treat as enabled "now" so no
      // archive backfill fires, and PERSIST the conversion immediately: a
      // freshly computed timestamp on every read would be a perpetually
      // moving cutoff that skips every new notebook forever (Codex, PR #90).
      const now = new Date().toISOString();
      const map = Object.fromEntries(
        v.filter((x): x is string => typeof x === "string").map((p) => [p, now])
      );
      setSetting(SYNC_FOLDERS_KEY, JSON.stringify(map));
      return map;
    }
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).filter(
          (e): e is [string, string] => typeof e[1] === "string"
        )
      );
    }
    return {};
  } catch {
    return {};
  }
}

export function syncFolders(): string[] {
  return Object.keys(syncFolderMap());
}

export function setSyncFolder(parent: string, enabled: boolean): string[] {
  const map = syncFolderMap();
  if (enabled && !map[parent]) map[parent] = new Date().toISOString();
  if (!enabled) delete map[parent];
  const keys = Object.keys(map);
  if (keys.length === 0) clearSetting(SYNC_FOLDERS_KEY);
  else setSetting(SYNC_FOLDERS_KEY, JSON.stringify(map));
  // Invalidate the account cursor: the fast-path compares against the CLOUD's
  // change counter, which knows nothing about LOCAL subscription changes — a
  // freshly enabled folder must get a full list/diff pass even though nothing
  // changed on the reMarkable side (Codex, PR #87).
  clearSetting(ROOT_HASH_KEY);
  return keys;
}

export type SyncStatus = {
  folders: string[];
  lastSyncAt: string | null;
  lastError: string | null;
  lastNote: string | null;
};

export function remarkableSyncStatus(): SyncStatus {
  return {
    folders: syncFolders(),
    lastSyncAt: getSetting(LAST_SYNC_AT_KEY),
    lastError: getSetting(SYNC_ERROR_KEY),
    lastNote: getSetting(SYNC_NOTE_KEY),
  };
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// ── Pure helpers (unit-tested) ──────────────────────────────────────────────

export type PageHash = { pageId: string; hash: string };

/**
 * Which incoming pages need OCR? New page ids, plus ids whose content hash
 * changed. Unchanged pages are never re-OCR'd. `removed` = ids we have that
 * the cloud no longer lists (kept, but callers may want to know).
 */
export function diffRmPages(
  existing: PageHash[],
  incoming: PageHash[]
): { toOcr: string[]; unchanged: string[]; removed: string[] } {
  const have = new Map(existing.map((p) => [p.pageId, p.hash]));
  const incomingIds = new Set(incoming.map((p) => p.pageId));
  const toOcr: string[] = [];
  const unchanged: string[] = [];
  for (const p of incoming) {
    if (have.get(p.pageId) === p.hash) unchanged.push(p.pageId);
    else toOcr.push(p.pageId);
  }
  const removed = existing
    .filter((p) => !incomingIds.has(p.pageId))
    .map((p) => p.pageId);
  return { toOcr, unchanged, removed };
}

/**
 * Final page order: the cloud's live order first, then pages deleted on the
 * tablet (kept — the diary is append-only) in their previous relative order.
 */
export function orderPagesKeepStale(
  liveIdsInOrder: string[],
  existingIdsInOrder: string[]
): string[] {
  const live = new Set(liveIdsInOrder);
  const stale = existingIdsInOrder.filter((id) => !live.has(id));
  return [...liveIdsInOrder, ...stale];
}

// ── Sync engine ─────────────────────────────────────────────────────────────

type NotebookRow = {
  id: string;
  remarkable_doc_id: string;
  remarkable_doc_hash: string | null;
  status: string | null;
};

type PageRow = {
  id: string;
  remarkable_page_id: string | null;
  remarkable_page_hash: string | null;
};

function quiesced(nb: RemarkableNotebook, now: number): boolean {
  if (!nb.lastModified) return false;
  const t = Date.parse(nb.lastModified);
  return Number.isFinite(t) && now - t < QUIESCE_MS;
}

// Long-settled: safe to fold into the append-only profile.
function profileSettled(nb: RemarkableNotebook, now: number): boolean {
  if (!nb.lastModified) return true; // no signal — don't block forever
  const t = Date.parse(nb.lastModified);
  return !Number.isFinite(t) || now - t >= PROFILE_SETTLE_MS;
}

/**
 * Fold any profile_fold_pending pages of a notebook into the profile (their
 * CURRENT text — by fold time a premature OCR has been replaced by the
 * settled re-OCR). Returns false when a fold was attempted and failed, so
 * the sweep keeps its cursor open and retries.
 */
async function foldPendingProfile(notebookId: string): Promise<boolean> {
  const pending = db()
    .prepare(
      `SELECT id, ocr_text FROM pages
       WHERE notebook_id = ? AND profile_fold_pending = 1
       ORDER BY page_index`
    )
    .all(notebookId) as Array<{ id: string; ocr_text: string | null }>;
  if (pending.length === 0) return true;
  const entryText = pending
    .map((p) => p.ocr_text || "")
    .filter(Boolean)
    .join("\n\n");
  try {
    const current = getCurrentProfile();
    if (entryText.trim() && current) {
      saveProfile(
        await updateSelfModel({ currentProfile: current, newContent: entryText })
      );
    }
    const clear = db().prepare(
      `UPDATE pages SET profile_fold_pending = 0 WHERE id = ?`
    );
    db().transaction(() => {
      for (const p of pending) clear.run(p.id);
    })();
    return true;
  } catch (e) {
    console.warn("[remarkableSync] pending profile fold failed:", (e as Error).message);
    return false;
  }
}

/**
 * The sweep entry point. Fire-and-forget from runMaintenanceSweep; never
 * throws. All state (cursor, errors, notes) lands in settings so /memory can
 * show it.
 */
export async function maybeSyncRemarkable(): Promise<void> {
  const now = Date.now();
  if (inFlight) return;
  if (now - lastAttemptAt < SYNC_INTERVAL_MS) return;
  if (now - lastFailureAt < FAILURE_BACKOFF_MS) return;
  if (!remarkablePaired()) return;
  if (!renderersAvailable()) return; // never in local dev / CI
  const folderMap = syncFolderMap();
  const folders = Object.keys(folderMap);
  const subscribed = db()
    .prepare(
      `SELECT id, remarkable_doc_id, remarkable_doc_hash, status
       FROM notebooks WHERE remarkable_doc_id IS NOT NULL`
    )
    .all() as NotebookRow[];
  if (folders.length === 0 && subscribed.length === 0) return;

  inFlight = true;
  lastAttemptAt = now;
  try {
    // Fast-path: account-wide cursor unchanged → nothing changed anywhere.
    const root = await remarkableRootHash();
    if (root && root === getSetting(ROOT_HASH_KEY)) {
      setSetting(LAST_SYNC_AT_KEY, new Date().toISOString());
      clearSetting(SYNC_ERROR_KEY);
      return;
    }

    const list = await listRemarkableNotebooks();
    if (!list.ok || !list.notebooks) {
      throw new Error(`listing notebooks failed: ${list.error || "unknown"}`);
    }

    const byDocId = new Map(subscribed.map((r) => [r.remarkable_doc_id, r]));
    const candidates = list.notebooks.filter(
      (nb) => byDocId.has(nb.id) || folders.includes(nb.parent)
    );

    let ocrBudget = MAX_PAGES_PER_SWEEP;
    let allSettled = true;
    const notes: string[] = [];
    for (const nb of candidates) {
      if (ocrBudget <= 0) {
        allSettled = false;
        break;
      }
      if (quiesced(nb, Date.now())) {
        // Probably mid-writing — retry on a later sweep.
        allSettled = false;
        continue;
      }
      let row = byDocId.get(nb.id);
      try {
        if (!row) {
          // Not-yet-imported notebook in an auto-synced folder: only pick it
          // up if it was edited AFTER the folder was enabled — "from now on",
          // never a silent archive backfill (see syncFolderMap).
          const enabledAt = folderMap[nb.parent];
          if (!enabledAt || !nb.lastModified || nb.lastModified <= enabledAt) {
            continue;
          }
          // Create its row and ingest through the SAME per-page incremental
          // engine — NOT the whole-PDF import path, whose rows lack per-page
          // hashes and would force a full re-OCR restructure on the first
          // later edit (Codex, PR #87). The import lock keeps a concurrent
          // user Import tap from creating a duplicate row for the same doc.
          if (!lockRemarkableImport(nb.id)) {
            allSettled = false;
            continue;
          }
          try {
            const stillMissing = !(db()
              .prepare(`SELECT id FROM notebooks WHERE remarkable_doc_id = ?`)
              .get(nb.id) as { id: string } | undefined);
            if (!stillMissing) continue; // a user import won the race
            const newId = randomUUID();
            db()
              .prepare(
                `INSERT INTO notebooks(id, name, synced_at, status, remarkable_doc_id)
                 VALUES(?,?,datetime('now'),'processing',?)`
              )
              .run(newId, nb.name || "reMarkable notebook", nb.id);
            row = {
              id: newId,
              remarkable_doc_id: nb.id,
              remarkable_doc_hash: null,
              status: "processing",
            };
          } finally {
            unlockRemarkableImport(nb.id);
          }
          const r = await incrementalSyncNotebook(row, nb, ocrBudget);
          ocrBudget -= r.attempted;
          if (r.partial) allSettled = false;
          if (r.ocred > 0) {
            notes.push(`imported "${nb.name}" (${r.ocred} pages)`);
          }
          continue;
        }
        // "Unchanged" requires a hash match AND a healthy row: an errored
        // notebook carries the same stamped hash but no usable transcription
        // — skipping it would strand it forever (Codex, PR #87). Let it fall
        // through to a fresh incremental pass. Before skipping, settle any
        // deferred profile folds (pages ingested while the notebook was
        // still being written; the fold waited for it to go quiet).
        if (row.remarkable_doc_hash === nb.hash && row.status !== "error") {
          if (profileSettled(nb, Date.now())) {
            if (!(await foldPendingProfile(row.id))) allSettled = false;
          } else {
            const hasPending = db()
              .prepare(
                `SELECT 1 FROM pages WHERE notebook_id = ? AND profile_fold_pending = 1 LIMIT 1`
              )
              .get(row.id);
            if (hasPending) allSettled = false; // keep the cursor open
          }
          continue;
        }
        if (row.status === "processing") {
          allSettled = false;
          continue;
        }
        const r = await incrementalSyncNotebook(row, nb, ocrBudget);
        ocrBudget -= r.attempted;
        if (r.partial) allSettled = false;
        if (r.ocred > 0) {
          notes.push(
            `${r.ocred} page${r.ocred === 1 ? "" : "s"} transcribed from "${nb.name}"`
          );
        }
      } catch (e) {
        allSettled = false;
        console.warn(
          `[remarkableSync] sync of "${nb.name}" failed:`,
          (e as Error).message
        );
        setSetting(
          SYNC_ERROR_KEY,
          `"${nb.name}": ${((e as Error).message || "sync failed").slice(0, 160)}`
        );
      }
    }

    // Advance the cursor only when every candidate settled — a quiesced or
    // failed notebook must be retried on a later sweep, which requires the
    // fast-path NOT to short-circuit it away.
    if (root && allSettled) setSetting(ROOT_HASH_KEY, root);
    setSetting(LAST_SYNC_AT_KEY, new Date().toISOString());
    if (allSettled) clearSetting(SYNC_ERROR_KEY);
    if (notes.length > 0) {
      setSetting(SYNC_NOTE_KEY, `${new Date().toISOString()}: ${notes.join("; ")}`);
    }
  } catch (e) {
    lastFailureAt = Date.now();
    // Record the attempt time too — otherwise the UI's "last check" freezes
    // at the last SUCCESS and reads as if the sync stopped running.
    setSetting(LAST_SYNC_AT_KEY, new Date().toISOString());
    setSetting(
      SYNC_ERROR_KEY,
      ((e as Error).message || "sync failed").slice(0, 200)
    );
  } finally {
    inFlight = false;
  }
}

type IncrementalResult = {
  // OCR calls attempted this pass (budget accounting — includes failures).
  attempted: number;
  // Pages whose new text actually landed.
  ocred: number;
  // True when this notebook needs another pass (budget slice, failures,
  // or a deferred legacy restructure) — keeps the rootHash cursor open.
  partial: boolean;
};

// A legacy restructure re-OCRs the whole notebook once; it deliberately
// bypasses the per-sweep budget (it's a one-time migration) but not without
// a ceiling.
const LEGACY_RESTRUCTURE_MAX_PAGES = 150;

/**
 * Incrementally ingest ONE changed notebook: download, hash pages, OCR only
 * new/changed ones, re-sync ordering for all, refresh FTS/embeddings/dates,
 * fold new text into the profile.
 *
 * Ordering of the phases is load-bearing:
 *   1. ALL slow network work (render + OCR) happens first, into memory.
 *   2. The DB mutation is ONE transaction (insert/upsert + FTS + stale
 *      analysis cleanup + legacy-row removal). A crash mid-OCR therefore
 *      never leaves the notebook half-deleted — the previous content
 *      survives until the swap commits.
 *   3. The stored doc hash advances ONLY on a fully-clean pass (no failed
 *      pages, no budget slice) so anything missed is retried next sweep.
 *
 * A notebook imported before Phase 2 has pages without `remarkable_page_id`
 * (whole-PDF import, where a tall tablet page may span several OCR pages).
 * Its FIRST incremental sync restructures it: every cloud page counts as
 * changed and the old rows are atomically replaced by one row per tablet
 * page — but only after every page OCR'd cleanly; any failure keeps the old
 * rows intact for a retry.
 */
async function incrementalSyncNotebook(
  row: NotebookRow,
  nb: RemarkableNotebook,
  ocrBudget: number
): Promise<IncrementalResult> {
  // Mark busy BEFORE the slow download so a concurrent user force-re-import
  // sees "processing" and backs off instead of deleting the row under us.
  db()
    .prepare(`UPDATE notebooks SET status='processing', error=NULL WHERE id = ?`)
    .run(row.id);

  try {
    const dl = await downloadNotebook(nb.id, nb.hash);
    if (!dl.ok || !dl.pages) throw new Error(dl.error || "download failed");
    if (dl.pages.length === 0) {
      db().prepare(`UPDATE notebooks SET status='done' WHERE id = ?`).run(row.id);
      return { attempted: 0, ocred: 0, partial: false };
    }

    const incoming: PageHash[] = dl.pages.map((p) => ({
      pageId: p.pageId,
      hash: sha256Hex(p.rmBytes),
    }));
    const bytesById = new Map(dl.pages.map((p) => [p.pageId, p.rmBytes]));

    const pageRows = db()
      .prepare(
        `SELECT id, remarkable_page_id, remarkable_page_hash FROM pages
         WHERE notebook_id = ? ORDER BY page_index`
      )
      .all(row.id) as PageRow[];
    const mapped = pageRows.filter((p) => p.remarkable_page_id);
    const legacy = mapped.length === 0 && pageRows.length > 0;

    const existing: PageHash[] = mapped.map((p) => ({
      pageId: p.remarkable_page_id as string,
      hash: p.remarkable_page_hash || "",
    }));
    const { toOcr } = legacy
      ? { toOcr: incoming.map((p) => p.pageId) }
      : diffRmPages(existing, incoming);

    if (toOcr.length === 0) {
      // Content unchanged — still refresh ordering + the stored doc hash.
      resyncOrder(row.id, incoming.map((p) => p.pageId));
      db()
        .prepare(`UPDATE notebooks SET status='done', remarkable_doc_hash = ? WHERE id = ?`)
        .run(nb.hash, row.id);
      return { attempted: 0, ocred: 0, partial: false };
    }

    let batch: string[];
    if (legacy) {
      if (incoming.length > LEGACY_RESTRUCTURE_MAX_PAGES) {
        throw new Error(
          `notebook has ${incoming.length} pages — too large for the one-time restructure`
        );
      }
      batch = toOcr; // all-or-nothing migration, atomically swapped below
    } else {
      batch = toOcr.slice(0, Math.max(0, ocrBudget));
      if (batch.length === 0) {
        // Sweep budget exhausted — nothing attempted; retry next sweep.
        db().prepare(`UPDATE notebooks SET status='done' WHERE id = ?`).run(row.id);
        return { attempted: 0, ocred: 0, partial: true };
      }
    }
    const budgetSliced = batch.length < toOcr.length;

    const nbName = (db()
      .prepare(`SELECT name FROM notebooks WHERE id = ?`)
      .get(row.id) as { name: string }).name;

    // ── Phase 1: all network work, no DB writes ──
    const hashById = new Map(incoming.map((p) => [p.pageId, p.hash]));
    const results: Array<{ pageId: string; pageRowId: string; text: string }> = [];
    const failed: string[] = [];
    for (const pageId of batch) {
      const rmBytes = bytesById.get(pageId);
      if (!rmBytes) continue;
      try {
        // One tablet page → its slices PDF → one OCR call → joined text.
        const render = await renderNotebookToPdf([{ pageId, rmBytes }]);
        const ocrPages = await ocrNotebookPdf(Buffer.from(render.pdf));
        const text = ocrPages
          .map((p) => p.text)
          .filter(Boolean)
          .join("\n\n")
          .trim();
        results.push({ pageId, pageRowId: `${row.id}:rm:${pageId}`, text });
      } catch (e) {
        failed.push(pageId);
        console.warn(
          `[remarkableSync] page ${pageId} of "${nbName}" failed:`,
          (e as Error).message
        );
      }
    }

    if (results.length === 0 && failed.length > 0) {
      throw new Error(`all ${failed.length} changed pages failed to ingest`);
    }
    if (legacy && failed.length > 0) {
      // Never swap out old rows for an incomplete restructure — the old
      // content must survive until a fully-clean pass.
      throw new Error(
        `restructure incomplete (${failed.length} of ${batch.length} pages failed) — old content kept, will retry`
      );
    }

    // Snapshot the notebook's date footprint BEFORE the swap. Two staleness
    // fixes hang off it: cached daily summaries for any day whose content
    // changes must be invalidated (chat's get_day_summary would otherwise
    // serve the OLD text forever — the generator only fills days with no
    // cached row), and if a page's parsed date MOVES from day A to day B,
    // A's Dropbox markdown must be rewritten even though A is no longer in
    // the notebook's affected set.
    const oldDayFiles = affectedDayFileNames(row.id);
    const datedRows = (sql: string, ...args: unknown[]) =>
      new Set(
        (db().prepare(sql).all(...args) as Array<{ entry_date: string | null }>)
          .map((r) => r.entry_date)
          .filter((d): d is string => !!d && d !== "none")
      );
    const upsertIds = results.map((r) => r.pageRowId);
    const idPlaceholders = upsertIds.map(() => "?").join(",");
    const datesBefore = datedRows(
      `SELECT DISTINCT entry_date FROM pages WHERE notebook_id = ?`,
      row.id
    );
    const upsertedDatesBefore = upsertIds.length
      ? datedRows(
          `SELECT entry_date FROM pages WHERE id IN (${idPlaceholders})`,
          ...upsertIds
        )
      : new Set<string>();

    // ── Phase 2: one atomic DB swap ──
    // Fold into the profile now only if the notebook has been quiet long
    // enough that this text is final; otherwise mark the pages pending and a
    // later sweep folds their (by then settled) text.
    const settledNow = profileSettled(nb, Date.now());
    const upsert = db().prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text, entry_date,
                         remarkable_page_id, remarkable_page_hash,
                         profile_fold_pending)
       VALUES(?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         ocr_text = excluded.ocr_text,
         entry_date = excluded.entry_date,
         remarkable_page_hash = excluded.remarkable_page_hash,
         profile_fold_pending = excluded.profile_fold_pending,
         embedding = NULL`
    );
    const delFts = db().prepare(`DELETE FROM pages_fts WHERE page_id = ?`);
    const insFts = db().prepare(
      `INSERT INTO pages_fts(ocr_text, notebook_name, page_id, notebook_id)
       VALUES(?,?,?,?)`
    );
    // A re-OCR'd page's cached /mind analysis + entities describe the OLD
    // text; clear them so analyzePending / the entity tool see fresh truth.
    const delAnalysis = db().prepare(`DELETE FROM entry_analysis WHERE page_id = ?`);
    const delEntities = db().prepare(`DELETE FROM entry_entities WHERE page_id = ?`);

    db().transaction(() => {
      if (legacy) {
        // Replace whole-PDF rows with per-tablet-page rows in one commit.
        // (pages FK cascade cleans entry_analysis/entry_entities; FTS is a
        // virtual table so it's cleared explicitly.)
        db().prepare(`DELETE FROM pages_fts WHERE notebook_id = ?`).run(row.id);
        db().prepare(`DELETE FROM pages WHERE notebook_id = ?`).run(row.id);
      }
      for (const r of results) {
        upsert.run(
          r.pageRowId,
          row.id,
          0, // real index set by resyncOrder below
          r.text,
          extractEntryDate(r.text) || "none",
          r.pageId,
          hashById.get(r.pageId) || "",
          settledNow ? 0 : 1
        );
        delFts.run(r.pageRowId);
        delAnalysis.run(r.pageRowId);
        delEntities.run(r.pageRowId);
        if (r.text) insFts.run(r.text, nbName, r.pageRowId, row.id);
      }
    })();

    const newTexts = results
      .filter((r) => r.text)
      .map((r) => ({ pageRowId: r.pageRowId, text: r.text }));

    resyncOrder(row.id, incoming.map((p) => p.pageId));
    // Carry dates forward across the whole corpus (cheap; same sweep the
    // /mind reparse uses) so continuation pages inherit their session date.
    try {
      reparseAllEntryDates();
    } catch {
      /* best-effort */
    }

    // Invalidate cached daily summaries for every day this pass touched:
    // days whose page set changed (before/after symmetric difference) plus
    // the old+new dates of every re-OCR'd page. The maintenance sweep
    // regenerates them (it only fills days with no cached row). Bounded to
    // the delta so an edit doesn't re-bill summarizeDay for the whole month.
    try {
      const datesAfter = datedRows(
        `SELECT DISTINCT entry_date FROM pages WHERE notebook_id = ?`,
        row.id
      );
      const upsertedDatesAfter = upsertIds.length
        ? datedRows(
            `SELECT entry_date FROM pages WHERE id IN (${idPlaceholders})`,
            ...upsertIds
          )
        : new Set<string>();
      const affected = new Set<string>([
        ...upsertedDatesBefore,
        ...upsertedDatesAfter,
      ]);
      for (const d of datesBefore) if (!datesAfter.has(d)) affected.add(d);
      for (const d of datesAfter) if (!datesBefore.has(d)) affected.add(d);
      if (affected.size > 0) {
        const del = db().prepare(`DELETE FROM daily_summaries WHERE date = ?`);
        db().transaction(() => {
          for (const d of affected) del.run(d);
        })();
      }
    } catch (e) {
      console.warn(
        "[remarkableSync] day-summary invalidation failed:",
        (e as Error).message
      );
    }

    // Embeddings for the new/changed pages (best-effort, like processNotebook).
    if (embeddingsEnabled() && newTexts.length > 0) {
      try {
        const vecs = await embedBatch(newTexts.map((t) => t.text), "document");
        if (vecs) {
          const upd = db().prepare(`UPDATE pages SET embedding = ? WHERE id = ?`);
          for (let i = 0; i < newTexts.length; i++) {
            upd.run(encodeEmbedding(vecs[i]), newTexts[i].pageRowId);
          }
        }
      } catch (e) {
        console.warn("[remarkableSync] embed failed:", (e as Error).message);
      }
    }

    // Fold ONLY the new text into the evolving profile (mirrors
    // processNotebook; skipped when no profile exists yet — the seed sweep
    // owns first creation). Deferred when the notebook isn't settled: the
    // upsert marked those pages profile_fold_pending and a later sweep folds
    // their final text instead (Codex, PR #92 — the fold is append-only, so
    // half-written OCR must never reach it).
    if (settledNow) {
      try {
        const entryText = newTexts.map((t) => t.text).join("\n\n");
        const current = getCurrentProfile();
        if (entryText.trim() && current) {
          saveProfile(
            await updateSelfModel({ currentProfile: current, newContent: entryText })
          );
        }
      } catch (e) {
        console.warn("[remarkableSync] profile fold failed:", (e as Error).message);
      }
    }
    // Settle any pending folds from EARLIER premature passes whose pages
    // didn't change again (their rows still carry profile_fold_pending=1).
    let leftoverFoldsOk = true;
    if (settledNow) leftoverFoldsOk = await foldPendingProfile(row.id);

    // /mind per-entry analysis for the fresh pages (bounded, best-effort).
    try {
      const { analyzePending } = await import("./mind");
      if (newTexts.length > 0) await analyzePending(Math.min(50, newTexts.length));
    } catch (e) {
      console.warn("[remarkableSync] mind analysis failed:", (e as Error).message);
    }

    // Advance the doc hash ONLY on a fully-clean pass. A failed page or a
    // budget slice leaves the old hash in place, so the next sweep re-diffs
    // and retries exactly what's missing (already-succeeded pages now match
    // by page hash and are skipped).
    const clean = failed.length === 0 && !budgetSliced;
    if (clean) {
      db()
        .prepare(
          `UPDATE notebooks
           SET status='done', error=NULL, synced_at=datetime('now'),
               remarkable_doc_hash = ?
           WHERE id = ?`
        )
        .run(nb.hash, row.id);
    } else {
      db()
        .prepare(
          `UPDATE notebooks
           SET status='done', synced_at=datetime('now'),
               error='some pages pending — auto-sync will retry'
           WHERE id = ?`
        )
        .run(row.id);
    }

    // Keep a viewable whole-notebook PDF on disk (the /notebooks "View PDF"
    // diagnostic + any future re-import read it). Sweep-created notebooks
    // never went through createNotebook, so the file may not exist; refresh
    // it after any content change. Local render only — no OCR cost.
    try {
      const pdfDir = path.join(DATA_DIR, "files", row.id);
      const merged = await renderNotebookToPdf(dl.pages);
      fs.mkdirSync(pdfDir, { recursive: true });
      fs.writeFileSync(path.join(pdfDir, "notebook.pdf"), merged.pdf);
    } catch (e) {
      console.warn("[remarkableSync] notebook.pdf refresh failed:", (e as Error).message);
    }

    // Refresh the per-day Dropbox markdown for the days this touched —
    // including the PRE-update day files, so a page whose date moved leaves
    // its old day rewritten (not stale) in Dropbox.
    try {
      const { maybeExportDiaryToDropbox } = (await import("./dropbox")) as {
        maybeExportDiaryToDropbox: (opts?: {
          notebookId?: string;
          extraDayFiles?: string[];
        }) => Promise<unknown>;
      };
      await maybeExportDiaryToDropbox({
        notebookId: row.id,
        extraDayFiles: oldDayFiles,
      });
    } catch (e) {
      console.warn("[remarkableSync] diary export failed:", (e as Error).message);
    }

    // A failed leftover fold keeps the cursor open (retry next sweep) but
    // doesn't block the doc-hash advance — the content itself is ingested.
    return {
      attempted: batch.length,
      ocred: newTexts.length,
      partial: !clean || !leftoverFoldsOk,
    };
  } catch (e) {
    db()
      .prepare(`UPDATE notebooks SET status='error', error=? WHERE id = ?`)
      .run(((e as Error).message || "sync failed").slice(0, 300), row.id);
    throw e;
  }
}

// Rewrite page_index for a notebook from the cloud's live page order; pages
// deleted on the tablet keep their rows, ordered after the live ones.
function resyncOrder(notebookId: string, liveIdsInOrder: string[]): void {
  const rows = db()
    .prepare(
      `SELECT id, remarkable_page_id FROM pages
       WHERE notebook_id = ? ORDER BY page_index`
    )
    .all(notebookId) as Array<{ id: string; remarkable_page_id: string | null }>;
  const rowByPageId = new Map(
    rows.filter((r) => r.remarkable_page_id).map((r) => [r.remarkable_page_id as string, r.id])
  );
  const existingOrder = rows
    .filter((r) => r.remarkable_page_id)
    .map((r) => r.remarkable_page_id as string);
  const finalOrder = orderPagesKeepStale(
    liveIdsInOrder.filter((id) => rowByPageId.has(id)),
    existingOrder
  );
  const upd = db().prepare(`UPDATE pages SET page_index = ? WHERE id = ?`);
  db().transaction(() => {
    finalOrder.forEach((pageId, i) => {
      const rowId = rowByPageId.get(pageId);
      if (rowId) upd.run(i, rowId);
    });
  })();
}
