import { NextRequest } from "next/server";
import { ingestPdf } from "@/lib/notes";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Web Share Target endpoint. When the installed PWA is picked from the
 * phone's share sheet, the browser POSTs the shared PDF here as multipart
 * form data (field name "file", per the share_target config in
 * public/manifest.json).
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return errorPage("No file was shared. Share a notebook PDF from the reMarkable app.");
  }
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return errorPage("That wasn't a PDF. On the reMarkable, export/share the notebook as a PDF.");
  }
  if (file.size > MAX_BYTES) {
    return errorPage("That PDF is too large (max 20 MB).");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    await ingestPdf(file.name, bytes);
  } catch (err) {
    return errorPage(`Transcription failed: ${(err as Error).message}`);
  }

  return Response.redirect(new URL("/notebooks", req.url), 303);
}

// A direct visit to /share (GET) just lands on the notebooks page.
export async function GET(req: NextRequest) {
  return Response.redirect(new URL("/notebooks", req.url), 303);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string
  );
}

function errorPage(message: string): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Feed Claude</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0c0a09; color: #fafaf9;
         margin: 0; min-height: 100vh; display: flex; align-items: center;
         justify-content: center; padding: 24px; }
  div { max-width: 420px; }
  a { color: #fafaf9; }
</style>
</head>
<body>
<div>
  <h1>Couldn't add that notebook</h1>
  <p>${escapeHtml(message)}</p>
  <p><a href="/notebooks">&larr; Back to Notebooks</a></p>
</div>
</body>
</html>`;
  return new Response(html, {
    status: 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
