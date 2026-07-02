import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { DATA_DIR } from "./db";

// Async (non-blocking) subprocess exec. execFileSync would block Node's single
// event loop for the ENTIRE render — minutes for a many-page notebook — freezing
// every other request. execFile spawns and yields, so the app stays responsive
// while pages render. Rejects on non-zero exit AND on timeout (SIGTERM).
const execFileAsync = promisify(execFile);

// ── reMarkable .rm → PDF rendering (Phase 1b) ───────────────────────────────
//
// Turns a cloud notebook's raw v6 `.rm` page files into ONE PDF that then
// flows through the exact same createNotebook/processNotebook OCR pipeline as
// a Dropbox-exported or manually-uploaded PDF.
//
// The actual rendering is done by the Python toolchain baked into the Docker
// image (see Dockerfile): the `rm2pdf INPUT.rm OUTPUT.pdf` wrapper on PATH
// (rmc → SVG → cairosvg/svglib) plus `pypdf` in the /opt/renderer venv for
// merging per-page PDFs. Neither exists outside that image, so this module
// degrades gracefully: `renderersAvailable()` is false in local dev / CI and
// the caller surfaces an actionable "renderer not deployed" error instead of
// crashing. This is why `npm run build` and the test suite never touch a real
// render.
//
// Per-page failure isolation: one page that fails to render is skipped and
// reported in `failed`, never aborting the whole notebook — a single bad
// stroke record shouldn't lose the rest of a diary.

// Where the image puts things (Dockerfile: COPY rm2pdf → /usr/local/bin,
// venv at /opt/renderer). Overridable via env for tests / alternate images.
const RM2PDF_BIN = process.env.RM2PDF_BIN || "/usr/local/bin/rm2pdf";
const RENDERER_PYTHON = process.env.RENDERER_PYTHON || "/opt/renderer/bin/python";

// Bounded so a pathological page can't hang the import request forever.
const PER_PAGE_TIMEOUT_MS = 60_000;
const MERGE_TIMEOUT_MS = 60_000;

// Merge N single-page PDFs (given as argv paths) into one, in order, via
// pypdf. Kept as a tiny inline script so no extra file has to ship in the
// image beyond what the renderer venv already provides.
const MERGE_PY = `
import sys
from pypdf import PdfWriter
out = sys.argv[1]
ins = sys.argv[2:]
w = PdfWriter()
for p in ins:
    w.append(p)
with open(out, "wb") as f:
    w.write(f)
`;

export class RendererUnavailableError extends Error {
  constructor() {
    super(
      "The reMarkable page renderer isn't available in this deployment. " +
        "It ships only in the Docker image on Railway — redeploy there to import from the cloud."
    );
    this.name = "RendererUnavailableError";
  }
}

/**
 * True only where the bundled renderer toolchain is present (the Railway
 * Docker image). False in local dev / CI, so callers can fail soft.
 */
export function renderersAvailable(): boolean {
  try {
    return fs.existsSync(RM2PDF_BIN) && fs.existsSync(RENDERER_PYTHON);
  } catch {
    return false;
  }
}

export type RenderResult = {
  // The merged notebook PDF.
  pdf: Uint8Array;
  // How many pages rendered successfully (== pages in the PDF).
  rendered: number;
  // Page ids that failed to render and were skipped.
  failed: string[];
};

/**
 * Render an ordered list of `.rm` pages to one merged PDF.
 *
 * Throws {@link RendererUnavailableError} when the toolchain isn't deployed,
 * and a plain Error when EVERY page failed to render (nothing to OCR). A
 * partial success (some pages failed) still returns a PDF of the good pages
 * with the failures listed.
 */
export async function renderNotebookToPdf(
  pages: Array<{ pageId: string; rmBytes: Uint8Array }>
): Promise<RenderResult> {
  if (!renderersAvailable()) throw new RendererUnavailableError();
  if (pages.length === 0) throw new Error("Notebook has no pages to render.");

  const workDir = path.join(DATA_DIR, "tmp", `rmrender-${randomUUID()}`);
  fs.mkdirSync(workDir, { recursive: true });

  const okPdfs: string[] = [];
  const failed: string[] = [];
  try {
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const inRm = path.join(workDir, `page-${i}.rm`);
      const outPdf = path.join(workDir, `page-${i}.pdf`);
      try {
        fs.writeFileSync(inRm, page.rmBytes);
        await execFileAsync(RM2PDF_BIN, [inRm, outPdf], {
          timeout: PER_PAGE_TIMEOUT_MS,
        });
        // A silent success that produced no/empty file still counts as a
        // failure — don't feed an empty page to the merger.
        if (fs.existsSync(outPdf) && fs.statSync(outPdf).size > 0) {
          okPdfs.push(outPdf);
        } else {
          failed.push(page.pageId);
        }
      } catch {
        failed.push(page.pageId);
      }
    }

    if (okPdfs.length === 0) {
      throw new Error(
        `Every page failed to render (${pages.length} page${pages.length === 1 ? "" : "s"}).`
      );
    }

    const mergedPath = path.join(workDir, "merged.pdf");
    await execFileAsync(RENDERER_PYTHON, ["-c", MERGE_PY, mergedPath, ...okPdfs], {
      timeout: MERGE_TIMEOUT_MS,
    });
    const pdf = fs.readFileSync(mergedPath);
    return { pdf, rendered: okPdfs.length, failed };
  } finally {
    // Always clean the scratch dir — these are throwaway per-import temp files.
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
}
