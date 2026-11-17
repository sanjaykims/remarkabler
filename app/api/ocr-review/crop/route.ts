import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { notebooksPinDenied } from "@/lib/notebooksPin";
import { db } from "@/lib/db";
import { cropPng, type Box } from "@/lib/handwritingExamples";
import { anchorPhrase } from "@/lib/ocrFlags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET ?id=<flag id>: a picture of the whole handwritten line around the spot a review card asks
// about (the word outlined in red), cropped from the notebook's stored PDF. Behind the app lock AND the Notebooks PIN
// (it is a piece of the diary). 404 when no picture can be made; the card just hides it.
export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const pinDenied = notebooksPinDenied(req);
  if (pinDenied) return pinDenied;
  const id = req.nextUrl.searchParams.get("id") || "";
  const row = db()
    .prepare(
      `SELECT f.notebook_id, f.page_index, f.page_id, f.box, f.start_offset, f.phrase, p.ocr_text
         FROM ocr_flags f LEFT JOIN pages p ON p.id = f.page_id WHERE f.id = ?`
    )
    .get(id) as
    | {
        notebook_id: string;
        page_index: number;
        page_id: string;
        box: string | null;
        start_offset: number;
        phrase: string;
        ocr_text: string | null;
      }
    | undefined;
  // reMarkable-sync notebooks store per-tablet-page rows whose flags don't map onto the merged PDF.
  if (!row || row.page_id.includes(":rm:")) return NextResponse.json({ error: "No picture" }, { status: 404 });
  let box: Box | null = null;
  try {
    const b = row.box ? JSON.parse(row.box) : null;
    if (Array.isArray(b) && b.length === 4) box = b as Box;
  } catch {
    /* ignore */
  }
  const text = row.ocr_text || "";
  const png = await cropPng(
    row.notebook_id,
    row.page_index,
    box,
    true,
    text ? { text, offset: Math.max(0, anchorPhrase(text, row.phrase, row.start_offset)), len: row.phrase.length } : undefined
  );
  if (!png) return NextResponse.json({ error: "No picture" }, { status: 404 });
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
  });
}
