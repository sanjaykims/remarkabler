import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { db } from "./db";
import { ocrNotebookPdf } from "./claude";

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
