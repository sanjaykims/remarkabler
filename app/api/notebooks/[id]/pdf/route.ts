import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { notebooksPinDenied } from "@/lib/notebooksPin";
import { db, DATA_DIR } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

/** This route is opened in a new browser tab ("open PDF"), so a failure used to show raw JSON
 *  like {"error":"Notebooks PIN required"} (the 10-minute PIN unlock had usually just expired).
 *  For a browser navigation, show a plain page that says what to do; API callers still get JSON.
 *  The checks themselves are unchanged. */
function friendly(req: NextRequest, res: NextResponse): NextResponse {
  if (!(req.headers.get("accept") || "").includes("text/html")) return res;
  const msg: Record<number, string> = {
    401: "The app is locked. Open Remarkabler, unlock it, then tap open PDF again.",
    403: "The Notebooks PIN unlock has expired (it lasts 10 minutes). Open the Notebooks tab, enter your PIN, then tap open PDF again.",
    404: "This notebook's PDF is not stored on the server, so there is nothing to open.",
  };
  const text = msg[res.status] ?? "Could not open the PDF.";
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Open PDF</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5"><h1 style="font-size:1.2rem">Can't open the PDF</h1><p>${text}</p><p><a href="/notebooks">Go to Notebooks</a></p></body>`;
  return new NextResponse(html, {
    status: res.status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}

// GET — serve a notebook's stored source PDF inline. Added as a diagnostic
// for the reMarkable cloud quality gate: seeing the actual rendered pages
// tells apart "the renderer dropped this content" from "the render is fine
// but OCR misread it". Works for any notebook (uploaded/Dropbox/cloud).
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await isAuthenticated())) return friendly(req, LOCKED());
  const pinDenied = notebooksPinDenied(req);
  if (pinDenied) return friendly(req, pinDenied);
  const id = params.id;
  // Only serve ids that exist as notebooks — never arbitrary paths.
  const row = db()
    .prepare(`SELECT id, name FROM notebooks WHERE id = ?`)
    .get(id) as { id: string; name: string } | undefined;
  if (!row) {
    return friendly(req, NextResponse.json({ error: "Not found" }, { status: 404 }));
  }
  const pdfPath = path.join(DATA_DIR, "files", row.id, "notebook.pdf");
  if (!fs.existsSync(pdfPath)) {
    return friendly(req, NextResponse.json({ error: "PDF file missing" }, { status: 404 }));
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
