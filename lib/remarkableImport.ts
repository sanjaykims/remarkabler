import { db } from "./db";
import { downloadNotebook, listRemarkableNotebooks } from "./remarkableCloud";
import {
  renderNotebookToPdf,
  renderersAvailable,
  RendererUnavailableError,
} from "./rmRender";
import { createNotebook, processNotebook, deleteNotebook } from "./notes";

// ── reMarkable cloud → notebook import (Phase 1b) ───────────────────────────
//
// On-demand import of ONE cloud notebook, behind the human quality gate: pull
// the raw `.rm` pages, render them to a PDF, then hand that PDF to the SAME
// createNotebook/processNotebook OCR pipeline as a Dropbox export. The user
// compares the result to their trusted Dropbox path before we build scheduled
// polling (Phase 2). Whole-notebook render + re-OCR; incremental page-diffing
// is deliberately out of scope here.
//
// Dedupe via the notebooks.remarkable_doc_id / remarkable_doc_hash columns:
//   • same doc id + same hash  → already imported and unchanged → skip.
//   • same doc id + new hash   → the notebook changed on the tablet → replace
//                                (delete the old copy, re-import fresh).
// The destructive replace happens ONLY after a new PDF renders successfully,
// so a failed re-import never destroys the previously-imported copy.

export type ImportStatus = "imported" | "reimported" | "unchanged";

export type ImportResult = {
  ok: boolean;
  status?: ImportStatus;
  notebookId?: string;
  rendered?: number; // pages that rendered into the PDF
  failed?: number; // pages skipped because they failed to render
  error?: string;
};

type ExistingRow = {
  id: string;
  remarkable_doc_hash: string | null;
  status: string | null;
};

// One import per cloud doc at a time, across ALL callers (user tap + the
// Phase 2 sweep). The existing-row check alone can't prevent a duplicate:
// the gap between it and createNotebook spans a fresh list + download +
// render — many seconds — so two concurrent imports would both pass it and
// create two notebook rows for the same doc (double-counted everywhere).
const importsInFlight = new Set<string>();

// The Phase 2 sweep shares this lock when it creates a notebook row for a
// newly discovered doc, so a simultaneous user Import tap can't duplicate it.
export function lockRemarkableImport(docId: string): boolean {
  if (importsInFlight.has(docId)) return false;
  importsInFlight.add(docId);
  return true;
}
export function unlockRemarkableImport(docId: string): void {
  importsInFlight.delete(docId);
}

export async function importRemarkableNotebook(
  id: string,
  hash: string,
  name: string,
  opts: { force?: boolean } = {}
): Promise<ImportResult> {
  if (!id || !hash) {
    return { ok: false, error: "Missing notebook id or hash." };
  }
  if (importsInFlight.has(id)) {
    return {
      ok: false,
      error: "This notebook is already being imported — give it a moment.",
    };
  }
  importsInFlight.add(id);
  try {
    return await importRemarkableNotebookInner(id, hash, name, opts);
  } finally {
    importsInFlight.delete(id);
  }
}

async function importRemarkableNotebookInner(
  id: string,
  hash: string,
  name: string,
  opts: { force?: boolean } = {}
): Promise<ImportResult> {
  // Fail fast where the renderer isn't deployed (local dev / CI) — before any
  // network download.
  if (!renderersAvailable()) {
    return { ok: false, error: new RendererUnavailableError().message };
  }

  // Resolve the CURRENT cloud hash. The hash passed in comes from the persisted
  // notebook list, which is only as fresh as the last "Check again"; trusting it
  // would let an edited-since notebook falsely dedupe as "unchanged" (missing
  // new pages) or import a stale content-addressed version. A fresh list is
  // cheap and also refreshes the UI's persisted list. Fail-soft: if listing is
  // unavailable, fall back to the caller-supplied hash.
  let currentHash = hash;
  const fresh = await listRemarkableNotebooks();
  if (fresh.ok && fresh.notebooks) {
    const match = fresh.notebooks.find((n) => n.id === id);
    if (!match) {
      return {
        ok: false,
        error: "That notebook is no longer in your reMarkable account.",
      };
    }
    currentHash = match.hash;
  }

  const existing = db()
    .prepare(
      `SELECT id, remarkable_doc_hash, status FROM notebooks WHERE remarkable_doc_id = ?`
    )
    .get(id) as ExistingRow | undefined;

  // "Unchanged" only counts when the prior import actually SUCCEEDED. A row
  // whose OCR errored has the same cloud hash but no usable transcription —
  // treating it as unchanged would make it permanently unrecoverable from the
  // UI (PR #78). Let error rows fall through to the replace path.
  // `force` skips the shortcut entirely: after a renderer upgrade the cloud
  // hash is unchanged but a re-render produces a better PDF.
  if (
    !opts.force &&
    existing &&
    existing.remarkable_doc_hash === currentHash &&
    existing.status !== "error"
  ) {
    return { ok: true, status: "unchanged", notebookId: existing.id };
  }
  // Don't replace a prior import whose OCR is still running — deleting it out
  // from under the background processNotebook would orphan its pages/FTS rows
  // and waste the transcription. Ask the user to retry once it settles.
  if (existing && existing.status === "processing") {
    return {
      ok: false,
      error:
        "Still transcribing the previous import of this notebook — try again in a moment.",
    };
  }

  const dl = await downloadNotebook(id, currentHash);
  if (!dl.ok) return { ok: false, error: dl.error || "Download failed." };
  if (!dl.pages || dl.pages.length === 0) {
    return {
      ok: false,
      error: "This notebook has no drawn pages to import yet.",
    };
  }

  let render;
  try {
    render = await renderNotebookToPdf(dl.pages);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // Sanity-check the merged output before ingesting, so a bad render can't
  // become a stuck 'processing' notebook.
  const looksPdf =
    render.pdf.length > 4 &&
    render.pdf[0] === 0x25 && // %
    render.pdf[1] === 0x50 && // P
    render.pdf[2] === 0x44 && // D
    render.pdf[3] === 0x46; // F
  if (!looksPdf) {
    return { ok: false, error: "The rendered notebook wasn't a valid PDF." };
  }

  // Commit. Create the NEW notebook FIRST (writes its PDF + row) so that a
  // createNotebook failure can't destroy the prior import; only then delete the
  // old copy. Invariant: a failed re-import never loses the previous copy.
  const replacing = !!existing;
  const nb = createNotebook(
    `${(name || "reMarkable notebook").trim()}.pdf`,
    render.pdf
  );
  db()
    .prepare(
      `UPDATE notebooks SET remarkable_doc_id = ?, remarkable_doc_hash = ? WHERE id = ?`
    )
    .run(id, currentHash, nb.id);
  if (existing) deleteNotebook(existing.id);
  // Fire-and-forget OCR — same contract as manual upload / Dropbox ingest.
  void processNotebook(nb.id).catch(() => {});

  return {
    ok: true,
    status: replacing ? "reimported" : "imported",
    notebookId: nb.id,
    rendered: render.rendered,
    failed: render.failed.length,
  };
}
