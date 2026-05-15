import path from "path";
import fs from "fs";
import { db } from "./db";
import { listNotebooks, getNotebookPdf } from "./remarkable";
import { ocrNotebookPdf } from "./claude";

const FILES_DIR = path.join(process.cwd(), "data", "files");

export type SyncProgress = {
  stage: "list" | "download" | "ocr" | "done" | "error";
  notebookId?: string;
  notebookName?: string;
  message?: string;
};

export async function* syncAll(opts: {
  ocr: boolean;
  notebookIds?: string[];
}): AsyncGenerator<SyncProgress> {
  if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });

  yield { stage: "list", message: "Fetching notebook list…" };
  const entries = await listNotebooks();
  const documents = entries.filter((e) => !e.isFolder);

  const upsertNotebook = db().prepare(
    `INSERT INTO notebooks(id,name,parent,last_modified,hash,synced_at)
     VALUES(?,?,?,?,?,datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, parent=excluded.parent,
       last_modified=excluded.last_modified, hash=excluded.hash,
       synced_at=excluded.synced_at`
  );
  const upsertPage = db().prepare(
    `INSERT INTO pages(id,notebook_id,page_index,image_path,ocr_text,ocr_summary,ocr_model,ocr_at)
     VALUES(?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       image_path=excluded.image_path,
       ocr_text=COALESCE(excluded.ocr_text, pages.ocr_text),
       ocr_summary=COALESCE(excluded.ocr_summary, pages.ocr_summary),
       ocr_model=COALESCE(excluded.ocr_model, pages.ocr_model),
       ocr_at=COALESCE(excluded.ocr_at, pages.ocr_at)`
  );

  for (const doc of documents) {
    if (opts.notebookIds && !opts.notebookIds.includes(doc.id)) continue;

    yield {
      stage: "download",
      notebookId: doc.id,
      notebookName: doc.name,
      message: `Downloading ${doc.name}`,
    };

    upsertNotebook.run(doc.id, doc.name, doc.parent, doc.lastModified, doc.hash);

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await getNotebookPdf(doc.id);
    } catch (err) {
      yield {
        stage: "error",
        notebookId: doc.id,
        notebookName: doc.name,
        message: `Download failed: ${(err as Error).message}`,
      };
      continue;
    }

    const notebookDir = path.join(FILES_DIR, doc.id);
    if (!fs.existsSync(notebookDir)) fs.mkdirSync(notebookDir, { recursive: true });
    const pdfPath = path.join(notebookDir, "notebook.pdf");
    fs.writeFileSync(pdfPath, pdfBytes);

    if (!opts.ocr) continue;

    yield {
      stage: "ocr",
      notebookId: doc.id,
      notebookName: doc.name,
      message: `OCR ${doc.name}`,
    };

    let pages: Awaited<ReturnType<typeof ocrNotebookPdf>> = [];
    try {
      pages = await ocrNotebookPdf(pdfBytes);
    } catch (err) {
      yield {
        stage: "error",
        notebookId: doc.id,
        notebookName: doc.name,
        message: `OCR failed: ${(err as Error).message}`,
      };
      continue;
    }

    const ocrModel = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
    const ocrAt = new Date().toISOString();

    db().prepare(`DELETE FROM pages_fts WHERE notebook_id = ?`).run(doc.id);

    for (const p of pages) {
      const pageId = `${doc.id}:${p.pageIndex}`;
      upsertPage.run(
        pageId,
        doc.id,
        p.pageIndex,
        pdfPath,
        p.text,
        p.summary,
        ocrModel,
        ocrAt
      );
      if (p.text) {
        db()
          .prepare(
            `INSERT INTO pages_fts(ocr_text, ocr_summary, notebook_name, page_id, notebook_id)
             VALUES(?,?,?,?,?)`
          )
          .run(p.text, p.summary, doc.name, pageId, doc.id);
      }
    }

    yield {
      stage: "ocr",
      notebookId: doc.id,
      notebookName: doc.name,
      message: `OCR'd ${pages.length} pages of ${doc.name}`,
    };
  }

  yield { stage: "done", message: "Sync complete" };
}

export function buildNotesContext(opts: { maxChars?: number } = {}): string {
  const limit = opts.maxChars ?? 150_000;
  const rows = db()
    .prepare(
      `SELECT n.name as notebook_name, p.page_index, p.ocr_text, p.ocr_summary
       FROM pages p JOIN notebooks n ON n.id = p.notebook_id
       WHERE p.ocr_text IS NOT NULL AND p.ocr_text != ''
       ORDER BY n.name, p.page_index`
    )
    .all() as Array<{
    notebook_name: string;
    page_index: number;
    ocr_text: string;
    ocr_summary: string | null;
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
  if (truncated) out += `\n[...truncated to ${limit} chars; switch to retrieval over pages_fts for full coverage]\n`;
  return out || "(no notes have been synced yet)";
}
