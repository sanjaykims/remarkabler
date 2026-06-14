import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/notebooks/<id>/pages
// Returns every page of one notebook with its OCR'd text. Fetched lazily
// when the user expands a notebook on the Notebooks page so the main list
// stays light.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: "Missing notebook id" }, { status: 400 });
  }

  const pages = db()
    .prepare(
      `SELECT id, page_index, ocr_text, entry_date
         FROM pages
         WHERE notebook_id = ?
         ORDER BY page_index ASC`
    )
    .all(id) as Array<{
    id: string;
    page_index: number;
    ocr_text: string | null;
    entry_date: string | null;
  }>;

  return NextResponse.json({ pages });
}
