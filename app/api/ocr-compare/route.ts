import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/db";
import { FILES_DIR } from "@/lib/notes";
import { ocrNotebookPdf } from "@/lib/claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Up to 8 sequential OCR calls (4 runs × 2 models) on a multi-page PDF
// can take several minutes; give the platform 10.
export const maxDuration = 600;

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// GET — list of notebooks the user can pick to test on. Lean payload:
// just enough for a dropdown plus a rough cost estimate.
export async function GET() {
  if (!isAuthenticated()) return LOCKED();
  const rows = db()
    .prepare(
      `SELECT n.id, n.name, n.status,
              (SELECT COUNT(*) FROM pages p WHERE p.notebook_id = n.id) AS page_count
       FROM notebooks n
       WHERE n.status = 'done'
       ORDER BY n.synced_at DESC
       LIMIT 50`
    )
    .all() as Array<{ id: string; name: string; status: string; page_count: number }>;
  return NextResponse.json({ notebooks: rows });
}

// POST — run OCR with one or more model names against the same notebook,
// optionally multiple times per model. Returns every run so the UI can
// show inter-model AND intra-model variance.
export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return LOCKED();
  const body = (await req.json().catch(() => ({}))) as {
    notebookId?: unknown;
    models?: unknown;
    runsPerModel?: unknown;
  };

  const notebookId = String(body.notebookId || "").trim();
  if (!notebookId) {
    return NextResponse.json({ error: "notebookId is required." }, { status: 400 });
  }

  const models = Array.isArray(body.models)
    ? body.models.map((m) => String(m)).filter(Boolean)
    : ["claude-opus-4-7", "claude-sonnet-4-6"];
  if (models.length === 0 || models.length > 4) {
    return NextResponse.json(
      { error: "Pick between 1 and 4 models." },
      { status: 400 }
    );
  }

  const runsPerModel = Math.max(
    1,
    Math.min(3, Number(body.runsPerModel) || 2)
  );

  const row = db()
    .prepare(`SELECT name FROM notebooks WHERE id = ? AND status = 'done'`)
    .get(notebookId) as { name: string } | undefined;
  if (!row) {
    return NextResponse.json(
      { error: "Notebook not found, or it hasn't finished transcribing yet." },
      { status: 404 }
    );
  }

  const pdfPath = path.join(FILES_DIR, notebookId, "notebook.pdf");
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = fs.readFileSync(pdfPath);
  } catch (e) {
    return NextResponse.json(
      { error: `Couldn't read the PDF for this notebook: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  // Run sequentially. Parallel would be faster but a model-comparison can
  // easily fan out to 6+ concurrent Anthropic calls, and the user is
  // already paying for every call — better to keep cost predictable and
  // visible per step than to risk a rate-limit cascade.
  type RunResult = {
    model: string;
    run: number;
    durationMs: number;
    pages?: Array<{ pageIndex: number; text: string }>;
    error?: string;
  };
  const runs: RunResult[] = [];
  for (const model of models) {
    for (let r = 1; r <= runsPerModel; r++) {
      const startedAt = Date.now();
      try {
        const pages = await ocrNotebookPdf(pdfBytes, {
          modelOverride: model,
          usageFeature: "ocr_compare",
        });
        runs.push({
          model,
          run: r,
          durationMs: Date.now() - startedAt,
          pages,
        });
      } catch (e) {
        runs.push({
          model,
          run: r,
          durationMs: Date.now() - startedAt,
          error: (e as Error).message,
        });
      }
    }
  }

  return NextResponse.json({
    notebook: { id: notebookId, name: row.name },
    runs,
  });
}
