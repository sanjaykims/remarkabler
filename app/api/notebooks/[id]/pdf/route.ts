import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { db, DATA_DIR } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// GET — serve a notebook's stored source PDF inline. Added as a diagnostic
// for the reMarkable cloud quality gate: seeing the actual rendered pages
// tells apart "the renderer dropped this content" from "the render is fine
// but OCR misread it". Works for any notebook (uploaded/Dropbox/cloud).
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await isAuthenticated())) return LOCKED();
  const id = params.id;
  // Only serve ids that exist as notebooks — never arbitrary paths.
  const row = db()
    .prepare(`SELECT id, name FROM notebooks WHERE id = ?`)
    .get(id) as { id: string; name: string } | undefined;
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const pdfPath = path.join(DATA_DIR, "files", row.id, "notebook.pdf");
  if (!fs.existsSync(pdfPath)) {
    return NextResponse.json({ error: "PDF file missing" }, { status: 404 });
  }
  const bytes = fs.readFileSync(pdfPath);
  const safeName = (row.name || "notebook").replace(/[^\w.-]+/g, "_");
  return new NextResponse(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
