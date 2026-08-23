import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createNotebook,
  queueNotebookProcessing,
  deleteNotebook,
  runMaintenanceSweep,
} from "@/lib/notes";
import { isAuthenticated } from "@/lib/auth";
import {
  FileLike,
  isFileLike,
  isPdfFile,
  looksLikePdf,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  MAX_UPLOAD_TOTAL_BYTES,
} from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () =>
  NextResponse.json({ error: "Locked" }, { status: 401 });

export async function GET() {
  if (!(await isAuthenticated())) return LOCKED();
  // Fire-and-forget the background sweep — gated internally to ≤ once per
  // 5 min, so visiting /notebooks repeatedly is safe. Picks up any new
  // Dropbox exports, runs the daily/weekly background work, etc.
  runMaintenanceSweep();
  const notebooks = db()
    .prepare(
      `SELECT n.id, n.name, n.synced_at,
              COALESCE(n.status, 'done') AS status, n.error,
              COUNT(p.id) AS page_count,
              SUM(CASE WHEN p.ocr_text IS NOT NULL AND p.ocr_text != '' THEN 1 ELSE 0 END) AS ocr_count
       FROM notebooks n
       LEFT JOIN pages p ON p.notebook_id = n.id
       GROUP BY n.id
       ORDER BY n.synced_at DESC NULLS LAST, n.name`
    )
    .all();
  return NextResponse.json({ notebooks });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
  const form = await req.formData().catch(() => null);
  const raw: unknown[] = form ? form.getAll("file") : [];
  const files: FileLike[] = raw.filter(
    (f): f is FileLike => isFileLike(f) && f.size > 0
  );
  if (files.length === 0) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (files.length > MAX_UPLOAD_FILES) {
    return NextResponse.json(
      { error: `Upload at most ${MAX_UPLOAD_FILES} PDFs at a time.` },
      { status: 400 }
    );
  }
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_UPLOAD_TOTAL_BYTES) {
    return NextResponse.json(
      { error: "The combined PDF limit is 40 MB." },
      { status: 400 }
    );
  }

  const added: Array<{ id: string; name: string }> = [];
  const skipped: string[] = [];
  for (const file of files) {
    const name = file.name || "uploaded.pdf";
    if (!isPdfFile({ name, type: file.type })) {
      skipped.push(`${name} (not a PDF)`);
      continue;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      skipped.push(`${name} (too large — max 20 MB)`);
      continue;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!looksLikePdf(bytes)) {
        skipped.push(`${name} (not a valid PDF)`);
        continue;
      }
      const nb = createNotebook(name, bytes);
      queueNotebookProcessing(nb.id);
      added.push({ id: nb.id, name: nb.name });
    } catch (err) {
      skipped.push(`${name} (${(err as Error).message})`);
    }
  }

  if (added.length === 0) {
    return NextResponse.json(
      { error: skipped.join("; ") || "Nothing uploaded." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, added: added.length, skipped, items: added });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  deleteNotebook(id);
  return NextResponse.json({ ok: true });
}
