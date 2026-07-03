import { createHash } from "crypto";
import { db, getSetting, setSetting, clearSetting } from "./db";
import {
  listRemarkableNotebooks,
  downloadNotebook,
  remarkableRootHash,
  remarkablePaired,
  type RemarkableNotebook,
} from "./remarkableCloud";
import { renderNotebookToPdf, renderersAvailable } from "./rmRender";
import { importRemarkableNotebook } from "./remarkableImport";
import { ocrNotebookPdf, updateSelfModel } from "./claude";
import { getCurrentProfile, saveProfile } from "./profile";
import { embedBatch, embeddingsEnabled, encodeEmbedding } from "./embeddings";
import { extractEntryDate, reparseAllEntryDates } from "./notes";

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
const FAILURE_BACKOFF_MS = 30 * 60 * 1000;
// Don't ingest a notebook edited in the last N minutes — the user may still
// be writing. The next sweep picks it up once it settles.
const QUIESCE_MS = 30 * 60 * 1000;
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

export function syncFolders(): string[] {
  const raw = getSetting(SYNC_FOLDERS_KEY);
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function setSyncFolder(parent: string, enabled: boolean): string[] {
  const current = new Set(syncFolders());
  if (enabled) current.add(parent);
  else current.delete(parent);
  const next = Array.from(current);
  if (next.length === 0) clearSetting(SYNC_FOLDERS_KEY);
  else setSetting(SYNC_FOLDERS_KEY, JSON.stringify(next));
  return next;
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
  const folders = syncFolders();
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
      throw new Error(list.error || "Couldn't list notebooks.");
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
      const row = byDocId.get(nb.id);
      try {
        if (!row) {
          // New notebook in an auto-synced folder → first full import.
          const res = await importRemarkableNotebook(nb.id, nb.hash, nb.name);
          if (!res.ok) throw new Error(res.error || "import failed");
          if (res.status !== "unchanged") {
            notes.push(`imported "${nb.name}" (${res.rendered ?? 0} pages)`);
            ocrBudget -= res.rendered ?? 1;
          }
          continue;
        }
        if (row.remarkable_doc_hash === nb.hash) continue; // unchanged
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

    // ── Phase 2: one atomic DB swap ──
    const upsert = db().prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text, entry_date,
                         remarkable_page_id, remarkable_page_hash)
       VALUES(?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         ocr_text = excluded.ocr_text,
         entry_date = excluded.entry_date,
         remarkable_page_hash = excluded.remarkable_page_hash,
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
          hashById.get(r.pageId) || ""
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
    // owns first creation).
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

    // Refresh the per-day Dropbox markdown for the days this touched.
    try {
      const { maybeExportDiaryToDropbox } = (await import("./dropbox")) as {
        maybeExportDiaryToDropbox: (opts?: { notebookId?: string }) => Promise<unknown>;
      };
      await maybeExportDiaryToDropbox({ notebookId: row.id });
    } catch (e) {
      console.warn("[remarkableSync] diary export failed:", (e as Error).message);
    }

    return { attempted: batch.length, ocred: newTexts.length, partial: !clean };
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
