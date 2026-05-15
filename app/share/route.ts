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
    return page("Couldn't add that notebook", "No file was shared. Share a notebook PDF from the reMarkable app.", false);
  }
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return page("Couldn't add that notebook", "That wasn't a PDF. On the reMarkable, export/share the notebook as a PDF.", false);
  }
  if (file.size > MAX_BYTES) {
    return page("Couldn't add that notebook", "That PDF is too large (max 20 MB).", false);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const result = await ingestPdf(file.name, bytes);
    return page(
      "Transcribed ✓",
      `Added "${result.name}" — ${result.pageCount} page(s). Opening your notebooks…`,
      true
    );
  } catch (err) {
    return page("Couldn't add that notebook", `Transcription failed: ${(err as Error).message}`, false);
  }
}

// A direct visit to /share (GET) just lands on the notebooks page.
export async function GET() {
  return page("Feed Claude", "Opening your notebooks…", true);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string
  );
}

/**
 * Returns an HTML page that, when autoRedirect is set, sends the browser to
 * /notebooks via client-side navigation.
 *
 * We deliberately avoid an HTTP redirect (Location header): Next resolves a
 * Location against the request URL, which behind Railway's proxy is the
 * internal "localhost:8080" address — sending the phone to a dead address.
 * A client-side navigation resolves "/notebooks" against the browser's real
 * URL instead.
 */
function page(title: string, message: string, autoRedirect: boolean): Response {
  const head = autoRedirect
    ? `<meta http-equiv="refresh" content="2; url=/notebooks" />
<script>setTimeout(function(){location.href="/notebooks";},900);</script>`
    : "";
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Feed Claude</title>
${head}
<style>
  body { font-family: system-ui, sans-serif; background: #0c0a09; color: #fafaf9;
         margin: 0; min-height: 100vh; display: flex; align-items: center;
         justify-content: center; padding: 24px; }
  div { max-width: 420px; text-align: center; }
  h1 { font-size: 1.25rem; }
  a { color: #fafaf9; }
</style>
</head>
<body>
<div>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(message)}</p>
  <p><a href="/notebooks">Open your notebooks &rarr;</a></p>
</div>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
