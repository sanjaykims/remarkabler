import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { db } from "./db";

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

export const MAX_EXAMPLES_TOTAL = 150;
export const MAX_PER_TEXT = 2;
export const PROMPT_EXAMPLES = 8;
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
export async function cropPng(
  notebookId: string,
  pageIndex: number,
  box: Box | null | undefined,
  wide = false
): Promise<Buffer | null> {
  try {
    if (!box || !examplesAvailable()) return null;
    const pdf = path.join(FILES_DIR, notebookId, "notebook.pdf");
    if (!fs.existsSync(pdf)) return null;
    // The crop only lands on the right page when the PDF has one page per page row
    // (a sliced tall reMarkable page would shift the numbering), so the script checks it.
    const rows = (
      db().prepare(`SELECT COUNT(*) AS n FROM pages WHERE notebook_id = ?`).get(notebookId) as { n: number }
    ).n;
    const tmpDir = path.join(DATA_DIR, "tmp");
    fs.mkdirSync(tmpDir, { recursive: true });
    const out = path.join(tmpDir, `crop-${crypto.randomUUID()}.png`);
    try {
      await execFileAsync(PYTHON, [CROP, pdf, String(pageIndex + 1), ...box.map(String), out, String(rows), ...(wide ? ["wide"] : [])], {
        timeout: 30_000,
      });
      const png = fs.readFileSync(out);
      return png.length === 0 || png.length > (wide ? MAX_WIDE_PNG_BYTES : MAX_PNG_BYTES) ? null : png;
    } finally {
      fs.rmSync(out, { force: true });
    }
  } catch (e) {
    console.warn("[handwritingExamples] crop failed:", (e as Error).message);
    return null;
  }
}

export type CaptureArgs = {
  notebookId: string;
  /** 0-based page row index; the PDF page is pageIndex + 1 */
  pageIndex: number;
  box: Box | null | undefined;
  /** what the owner confirmed the handwriting says */
  text: string;
  /** what it was first read as (same as text when simply confirmed) */
  wrong?: string;
};

/** Crop and store one example. Resolves false (never throws) when anything is missing. */
export async function captureExample(a: CaptureArgs): Promise<boolean> {
  try {
    const text = a.text.replace(/\s+/g, " ").trim();
    if (!a.box || !text || text.length > MAX_TEXT) return false;
    const have = db()
      .prepare(`SELECT COUNT(*) AS n FROM ocr_examples WHERE text = ?`)
      .get(text) as { n: number };
    if (have.n >= MAX_PER_TEXT) return false;
    const png = await cropPng(a.notebookId, a.pageIndex, a.box);
    if (!png) return false;
    db()
      .prepare(`INSERT INTO ocr_examples(id, text, wrong, notebook_id, png) VALUES(?,?,?,?,?)`)
      .run(crypto.randomUUID(), text, a.wrong && a.wrong !== text ? a.wrong : null, a.notebookId, png);
    db()
      .prepare(
        `DELETE FROM ocr_examples WHERE id IN (
           SELECT id FROM ocr_examples ORDER BY created_at DESC, rowid DESC LIMIT -1 OFFSET ?)`
      )
      .run(MAX_EXAMPLES_TOTAL);
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
          ORDER BY hard DESC, created_at DESC, rowid DESC LIMIT 100`
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

type Block =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: "image/png"; data: string } };

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
