import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestPdf, deleteNotebook } from "@/lib/notes";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 20 * 1024 * 1024;

export async function GET() {
  const notebooks = db()
    .prepare(
      `SELECT n.id, n.name, n.synced_at,
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
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return NextResponse.json(
      { error: "Please upload a PDF file (export your notebook as PDF on the reMarkable)." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "PDF is too large (max 20 MB)." },
      { status: 400 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const result = await ingestPdf(file.name, bytes);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: `OCR failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  deleteNotebook(id);
  return NextResponse.json({ ok: true });
}
