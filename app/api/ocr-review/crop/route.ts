import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { notebooksPinDenied } from "@/lib/notebooksPin";
import { db } from "@/lib/db";
import { cropPng, type Box } from "@/lib/handwritingExamples";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET ?id=<flag id>: a small picture of the handwritten word a review card asks about,
// cropped from the notebook's stored PDF. Behind the app lock AND the Notebooks PIN
// (it is a piece of the diary). 404 when no picture can be made; the card just hides it.
export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const pinDenied = notebooksPinDenied(req);
  if (pinDenied) return pinDenied;
  const id = req.nextUrl.searchParams.get("id") || "";
  const row = db()
    .prepare(`SELECT notebook_id, page_index, box FROM ocr_flags WHERE id = ?`)
    .get(id) as { notebook_id: string; page_index: number; box: string | null } | undefined;
  if (!row?.box) return NextResponse.json({ error: "No picture" }, { status: 404 });
  let box: Box | null = null;
  try {
    const b = JSON.parse(row.box);
    if (Array.isArray(b) && b.length === 4) box = b as Box;
  } catch {
    /* ignore */
  }
  const png = await cropPng(row.notebook_id, row.page_index, box);
  if (!png) return NextResponse.json({ error: "No picture" }, { status: 404 });
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" },
  });
}
