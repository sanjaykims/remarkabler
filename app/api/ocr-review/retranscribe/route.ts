import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { notebooksPinDenied } from "@/lib/notebooksPin";
import { estimateRetranscribe, queueRetranscribe, resetRetranscribed, setAutoRetranscribe } from "@/lib/retranscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// GET: how many notebooks could be re-transcribed + a rough cost estimate.
export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
  const pinDenied = notebooksPinDenied(req);
  if (pinDenied) return pinDenied;
  return NextResponse.json(estimateRetranscribe());
}

// POST {limit?: 1-5}: queue the next notebooks for a full re-transcription. This REPLACES
// page text (old text is kept in ocr_text_backup).
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
  const pinDenied = notebooksPinDenied(req);
  if (pinDenied) return pinDenied;
  const body = (await req.json().catch(() => null)) as { limit?: unknown; auto?: unknown; reset?: unknown } | null;
  if (body?.reset === true) {
    resetRetranscribed();
    return NextResponse.json({ reset: true, left: estimateRetranscribe() });
  }
  if (typeof body?.auto === "boolean") return NextResponse.json(setAutoRetranscribe(body.auto));
  return NextResponse.json(queueRetranscribe(typeof body?.limit === "number" ? body.limit : 1));
}
