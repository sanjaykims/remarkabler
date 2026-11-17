import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { db } from "./db";
import { pickPdfPage, type PageMap } from "./pdfPageMap";

// Visual learning: every word the owner confirms is saved as a small crop of
// their own handwriting plus the confirmed text, and a few of those crops are
// shown to the transcriber as examples ("this scrawl says Elin"). Claude is not
// retrained; it just gets reference pictures. Everything here is best-effort and
// fail-open: no renderer, no box, a page-count mismatch or any error = no example,
// never a failure. Local data only (never the repo, never MCP).

const execFileAsync = promisify(execFile);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const FILES_DIR = path.join(DATA_DIR, "files");
const PYTHON = process.env.RENDERER_PYTHON || "/opt/renderer/bin/python";
const CROP = process.env.CROPWORD_BIN || "/usr/local/bin/cropword";

// Storage is unlimited (the owner asked for no cap). Only the number sent with ONE request is
// bounded, because the API limits images per request and a failed request would cost a transcription.
export const MAX_PER_TEXT = 5;
export const PROMPT_EXAMPLES = 60;
const MAX_PNG_BYTES = 40_000;
const MAX_WIDE_PNG_BYTES = 400_000;
const MAX_TEXT = 40;

export function examplesAvailable(): boolean {
  try {
    return fs.existsSync(PYTHON) && fs.existsSync(CROP);
  } catch {
    return false;
  }
}

export type Box = [number, number, number, number];

/** Crop one word out of a notebook's stored PDF as a small PNG. Resolves null (never throws)
 *  when the renderer, the PDF, the box or the page mapping isn't usable. */
export type Locate = { text: string; offset: number; len: number };

/** UTF-16 index/length (JS) -> code-point index/length (what the Python locator counts). */
function toCodePoints(l: Locate): Locate {
  const offset = [...l.text.slice(0, l.offset)].length;
  const len = [...l.text.slice(l.offset, l.offset + l.len)].length || 1;
  return { text: l.text, offset, len };
}

const MAX_PAGE_JPEG_BYTES = 900_000;

/** Run docker/cropword on any PDF file. mode "tight" = the word, "wide" = its line with a
 *  marker, "page" = the whole page as a JPEG. Resolves null (never throws) on any problem. */
export async function cropFile(
  pdf: string,
  pageNo: number,
  expectPages: number,
  box: Box | null | undefined,
  mode: "tight" | "wide" | "page",
  locate?: Locate
): Promise<Buffer | null> {
  try {
    if (!examplesAvailable() || !fs.existsSync(pdf)) return null;
    if (mode !== "page" && !box && !locate) return null;
    const tmpDir = path.join(DATA_DIR, "tmp");
    fs.mkdirSync(tmpDir, { recursive: true });
    const out = path.join(tmpDir, `crop-${crypto.randomUUID()}.${mode === "page" ? "jpg" : "png"}`);
    const textFile = path.join(tmpDir, `crop-${crypto.randomUUID()}.txt`);
    try {
      const args = [CROP, pdf, String(pageNo), ...(box ?? [0, 0, 1, 1]).map(String), out, String(expectPages)];
      if (mode !== "tight") args.push(mode);
      if (locate && mode !== "page") {
        const cp = toCodePoints(locate);
        fs.writeFileSync(textFile, cp.text, { encoding: "utf8", mode: 0o600 });
        args.push("--text", textFile, "--offset", String(cp.offset), "--len", String(cp.len));
      }
      await execFileAsync(PYTHON, args, { timeout: 30_000 });
      const img = fs.readFileSync(out);
      const max = mode === "page" ? MAX_PAGE_JPEG_BYTES : mode === "wide" ? MAX_WIDE_PNG_BYTES : MAX_PNG_BYTES;
      return img.length === 0 || img.length > max ? null : img;
    } finally {
      fs.rmSync(out, { force: true });
      fs.rmSync(textFile, { force: true });
    }
  } catch (e) {
    console.warn("[handwritingExamples] crop failed:", (e as Error).message);
    return null;
  }
}

export async function cropPng(
  notebookId: string,
  pageIndex: number,
  box: Box | null | undefined,
  wide = false,
  locate?: Locate,
  /** the page row id; needed for reMarkable-cloud pages, whose PDF page comes from the page map */
  pageRowId?: string
): Promise<Buffer | null> {
  try {
    const dir = path.join(FILES_DIR, notebookId);
    const rows = (
      db().prepare(`SELECT COUNT(*) AS n FROM pages WHERE notebook_id = ?`).get(notebookId) as { n: number }
    ).n;
    const row = pageRowId
      ? (db().prepare(`SELECT page_index, remarkable_page_id FROM pages WHERE id = ?`).get(pageRowId) as
          | { page_index: number; remarkable_page_id: string | null }
          | undefined)
      : undefined;
    let map: PageMap | null = null;
    if (row?.remarkable_page_id) {
      try {
        map = JSON.parse(fs.readFileSync(path.join(dir, "pagemap.json"), "utf8")) as PageMap;
      } catch {
        map = null;
      }
    }
    // The crop only lands on the right page when the PDF has the page count we expect
    // (the script checks it and refuses otherwise).
    const at = pickPdfPage({
      rmPageId: row?.remarkable_page_id,
      flagPageIndex: pageIndex,
      rowPageIndex: row?.page_index ?? pageIndex,
      rows,
      map,
    });
    if (!at) return null;
    return await cropFile(path.join(dir, "notebook.pdf"), at.pageNo, at.expect, box, wide ? "wide" : "tight", locate);
  } catch {
    return null;
  }
}

export type CaptureArgs = {
  notebookId: string;
  /** 0-based page row index; the PDF page is pageIndex + 1 */
  pageIndex: number;
  box: Box | null | undefined;
  /** the page transcript and the word's place in it, for locating it from the line structure */
  locate?: Locate;
  pageRowId?: string;
  /** what the owner confirmed the handwriting says */
  text: string;
  /** what it was first read as (same as text when simply confirmed) */
  wrong?: string;
};

/** Crop and store one example. Resolves false (never throws) when anything is missing. */
export async function captureExample(a: CaptureArgs): Promise<boolean> {
  try {
    const text = a.text.replace(/\s+/g, " ").trim();
    if ((!a.box && !a.locate) || !text || text.length > MAX_TEXT) return false;
    const have = db()
      .prepare(`SELECT COUNT(*) AS n FROM ocr_examples WHERE text = ?`)
      .get(text) as { n: number };
    if (have.n >= MAX_PER_TEXT) return false;
    const png = await cropPng(a.notebookId, a.pageIndex, a.box, false, a.locate, a.pageRowId);
    if (!png) return false;
    db()
      .prepare(`INSERT INTO ocr_examples(id, text, wrong, notebook_id, png) VALUES(?,?,?,?,?)`)
      .run(crypto.randomUUID(), text, a.wrong && a.wrong !== text ? a.wrong : null, a.notebookId, png);
    return true;
  } catch (e) {
    console.warn("[handwritingExamples] capture failed:", (e as Error).message);
    return false;
  }
}

export type Example = { text: string; png: Buffer };

/** Hard words first (the ones that were misread), then confirmed ones; one per text, newest first. */
export function pickExamples(limit = PROMPT_EXAMPLES): Example[] {
  try {
    const rows = db()
      .prepare(
        `SELECT text, png, (wrong IS NOT NULL) AS hard FROM ocr_examples
          ORDER BY hard DESC, created_at DESC, rowid DESC LIMIT 5000`
      )
      .all() as Array<{ text: string; png: Buffer }>;
    const seen = new Set<string>();
    const out: Example[] = [];
    for (const r of rows) {
      if (seen.has(r.text)) continue;
      seen.add(r.text);
      out.push({ text: r.text, png: r.png });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

export type Block =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: "image/png" | "image/jpeg"; data: string } };

export const imageBlock = (buf: Buffer, media: "image/png" | "image/jpeg" = "image/png"): Block => ({
  type: "image",
  source: { type: "base64", media_type: media, data: buf.toString("base64") },
});

/** Prompt blocks: an intro, then each image followed by what it says. Empty when none. */
export function exampleBlocks(examples: Example[] = pickExamples()): Block[] {
  if (!examples.length) return [];
  const out: Block[] = [
    {
      type: "text",
      text:
        "Examples of THIS writer's own handwriting, each image followed by what it says " +
        "(crops can include a little neighbouring writing). Use them to learn their letter shapes:",
    },
  ];
  for (const e of examples) {
    out.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: e.png.toString("base64") },
    });
    out.push({ type: "text", text: `-> ${e.text}` });
  }
  return out;
}

/** Saved pictures for each of the given words (exact text match), newest first. */
export function examplesForTexts(texts: string[], perText = 3): Map<string, Buffer[]> {
  const out = new Map<string, Buffer[]>();
  try {
    const q = db().prepare(`SELECT png FROM ocr_examples WHERE text = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`);
    for (const t of new Set(texts)) {
      const rows = q.all(t, perText) as Array<{ png: Buffer }>;
      if (rows.length) out.set(t, rows.map((r) => r.png));
    }
  } catch {
    /* none */
  }
  return out;
}

// Whole-page examples: pages whose every card the owner answered (and whose answers are still
// in the text), sent as page image + verified transcription so the transcriber sees how this
// writer forms whole sentences. Rendered pages are cached in memory.
export const PAGE_EXAMPLES = 2;
const pageCache = new Map<string, Buffer>();

export async function pageExampleBlocks(limit = PAGE_EXAMPLES): Promise<Block[]> {
  try {
    if (!examplesAvailable()) return [];
    const cands = db()
      .prepare(
        `SELECT f.page_id, f.notebook_id, f.page_index, COUNT(*) AS answered
           FROM ocr_flags f
          WHERE f.status IN ('resolved','kept') AND f.page_id NOT LIKE '%:rm:%'
            AND NOT EXISTS (SELECT 1 FROM ocr_flags g WHERE g.page_id = f.page_id AND g.status = 'pending')
          GROUP BY f.page_id HAVING answered >= 2
          ORDER BY answered DESC, MAX(f.resolved_at) DESC LIMIT 8`
      )
      .all() as Array<{ page_id: string; notebook_id: string; page_index: number }>;
    const out: Block[] = [];
    let used = 0;
    for (const c of cands) {
      if (used >= limit) break;
      const text = (
        db().prepare(`SELECT ocr_text FROM pages WHERE id = ?`).get(c.page_id) as { ocr_text: string | null } | undefined
      )?.ocr_text;
      if (!text || text.length < 200 || text.length > 6000) continue;
      // The owner's answers must still be in the text (a re-transcription would have replaced them).
      const answers = db()
        .prepare(`SELECT resolved_text FROM ocr_flags WHERE page_id = ? AND status IN ('resolved','kept')`)
        .all(c.page_id) as Array<{ resolved_text: string | null }>;
      if (!answers.every((a) => a.resolved_text && text.includes(a.resolved_text))) continue;
      const key = `${c.page_id}:${crypto.createHash("sha1").update(text).digest("hex")}`;
      let jpg = pageCache.get(key) ?? null;
      if (!jpg) {
        const rows = (
          db().prepare(`SELECT COUNT(*) AS n FROM pages WHERE notebook_id = ?`).get(c.notebook_id) as { n: number }
        ).n;
        jpg = await cropFile(path.join(FILES_DIR, c.notebook_id, "notebook.pdf"), c.page_index + 1, rows, null, "page");
        if (jpg) {
          if (pageCache.size > 8) pageCache.clear();
          pageCache.set(key, jpg);
        }
      }
      if (!jpg) continue;
      if (!used) {
        out.push({
          type: "text",
          text: "Worked examples: full pages by THIS writer, each followed by its transcription, which the writer has checked.",
        });
      }
      out.push(imageBlock(jpg, "image/jpeg"));
      out.push({ type: "text", text: `Checked transcription of the page above:\n${text}` });
      used++;
    }
    return out;
  } catch (e) {
    console.warn("[handwritingExamples] page examples failed:", (e as Error).message);
    return [];
  }
}
