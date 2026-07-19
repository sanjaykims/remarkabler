import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { correctPageText } from "@/lib/notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/notebooks/<id>/pages
// Returns every page of one notebook with its OCR'd text. Fetched lazily
// when the user expands a notebook on the Notebooks page so the main list
// stays light.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: "Missing notebook id" }, { status: 400 });
  }

  const pages = db()
    .prepare(
      `SELECT id, page_index, ocr_text, entry_date
         FROM pages
         WHERE notebook_id = ?
         ORDER BY page_index ASC`
    )
    .all(id) as Array<{
    id: string;
    page_index: number;
    ocr_text: string | null;
    entry_date: string | null;
  }>;

  return NextResponse.json({ pages });
}

// PATCH /api/notebooks/<id>/pages   body: { pageId, text }
// Correct a page's transcription (an OCR fix). Updates the stored text, drops
// the cached per-entry analysis so /mind + entities re-derive from the
// correction on the next sweep, and re-exports the affected day file so the
// fix reaches Obsidian/Dropbox. Guarded so the page id must belong to this
// notebook.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: "Missing notebook id" }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as
    | { pageId?: string; text?: unknown }
    | null;
  const pageId = String(body?.pageId || "");
  if (!pageId) {
    return NextResponse.json({ error: "Missing pageId" }, { status: 400 });
  }
  if (typeof body?.text !== "string") {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  const text = body.text;

  // Update ocr_text AND all the derived indexes (FTS, embedding, analysis,
  // entry_date, daily summary) in one transaction so search / semantic recall
  // / date tools / entities / day files all reflect the correction, not just
  // the raw text (review #124).
  const ok = correctPageText(id, pageId, text);
  if (!ok) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  // Push the corrected day file to the Obsidian/Dropbox export (best-effort,
  // no-op unless the export is enabled + connected). The outer try/catch only
  // guards the synchronous dynamic import — .catch() below is what guards the
  // returned promise, so an async failure here can't become an unhandled
  // rejection.
  try {
    const { maybeExportDiaryToDropbox } = (await import("@/lib/dropbox")) as {
      maybeExportDiaryToDropbox: (opts?: {
        notebookId?: string;
      }) => Promise<unknown>;
    };
    void maybeExportDiaryToDropbox({ notebookId: id }).catch((e) =>
      console.warn("[notebooks/pages] dropbox export failed:", (e as Error).message)
    );
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true });
}
