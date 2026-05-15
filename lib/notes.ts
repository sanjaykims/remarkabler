import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { db } from "./db";
import { ocrNotebookPdf } from "./claude";

const FILES_DIR = path.join(
  process.env.DATA_DIR || path.join(process.cwd(), "data"),
  "files"
);

export type IngestResult = {
  id: string;
  name: string;
  pageCount: number;
};

/**
 * OCR an uploaded notebook PDF with Claude and persist the results.
 *
 * OCR runs first; nothing is written to disk or the database unless it
 * succeeds, so a failed upload leaves no orphan files or rows.
 */
export async function ingestPdf(
  fileName: string,
  pdfBytes: Uint8Array
): Promise<IngestResult> {
  const pages = await ocrNotebookPdf(pdfBytes);

  const id = randomUUID();
  const name = fileName.replace(/\.pdf$/i, "").trim() || "Untitled notebook";

  const notebookDir = path.join(FILES_DIR, id);
  fs.mkdirSync(notebookDir, { recursive: true });
  const pdfPath = path.join(notebookDir, "notebook.pdf");
  fs.writeFileSync(pdfPath, pdfBytes);

  const ocrModel = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
  const ocrAt = new Date().toISOString();

  db()
    .prepare(
      `INSERT INTO notebooks(id,name,parent,last_modified,hash,synced_at)
       VALUES(?,?,NULL,NULL,NULL,datetime('now'))`
    )
    .run(id, name);

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
    if (p.text) {
      insertFts.run(p.text, p.summary, name, pageId, id);
    }
  }

  return { id, name, pageCount: pages.length };
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
