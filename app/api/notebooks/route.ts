import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createNotebook, processNotebook, deleteNotebook } from "@/lib/notes";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;

const LOCKED = () =>
  NextResponse.json({ error: "Locked" }, { status: 401 });

export async function GET() {
  if (!isAuthenticated()) return LOCKED();
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
  if (!isAuthenticated()) return LOCKED();
  const form = await req.formData().catch(() => null);
  const files = form
    ? form
        .getAll("file")
        .filter((f): f is File => f instanceof File && f.size > 0)
    : [];
  if (files.length === 0) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const added: Array<{ id: string; name: string }> = [];
  const skipped: string[] = [];
  for (const file of files) {
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      skipped.push(`${file.name || "file"} (not a PDF)`);
      continue;
    }
    if (file.size > MAX_BYTES) {
      skipped.push(`${file.name || "file"} (too large — max 20 MB)`);
      continue;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const nb = createNotebook(file.name, bytes);
      void processNotebook(nb.id).catch(() => {});
      added.push({ id: nb.id, name: nb.name });
    } catch (err) {
      skipped.push(`${file.name || "file"} (${(err as Error).message})`);
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
  if (!isAuthenticated()) return LOCKED();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  deleteNotebook(id);
  return NextResponse.json({ ok: true });
}
