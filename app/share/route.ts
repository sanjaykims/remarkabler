import { NextRequest } from "next/server";
import { createNotebook, processNotebook } from "@/lib/notes";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Web Share Target endpoint. When the installed PWA is picked from the
 * phone's share sheet, the browser POSTs the shared PDF here as multipart
 * form data (field name "file", per the share_target config in
 * public/manifest.json).
 *
 * The PDF is saved and the response returns immediately; transcription runs
 * in the background so the phone is never left on a frozen screen.
 *
 * This endpoint is intentionally NOT gated by the app lock: it is write-only
 * (it accepts a PDF and starts transcription, returning none of the user's
 * notes), and the lock clears the session whenever the app is backgrounded —
 * so requiring auth here would reject every share from the reMarkable app and
 * lose the file. Reading (notebooks list, chat, insights) stays locked.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const files = form
    ? form
        .getAll("file")
        .filter((f): f is File => f instanceof File && f.size > 0)
    : [];

  if (files.length === 0) {
    return page(
      "Couldn't add that notebook",
      "No file was shared. Share a notebook PDF from the reMarkable app.",
      false
    );
  }

  const added: string[] = [];
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
      // Transcribe in the background; each notebook runs on its own.
      void processNotebook(nb.id).catch(() => {});
      added.push(nb.name);
    } catch (err) {
      skipped.push(`${file.name || "file"} (${(err as Error).message})`);
    }
  }

  if (added.length === 0) {
    return page(
      "Couldn't add the notebooks",
      skipped.join("; ") || "No PDFs were added.",
      false
    );
  }

  const title = added.length === 1 ? "Added ✓" : `Added ${added.length} ✓`;
  const parts =
    added.length === 1
      ? [`"${added[0]}" is transcribing in the background.`]
      : [`${added.length} notebooks are transcribing in the background.`];
  if (skipped.length) parts.push(`Skipped: ${skipped.join("; ")}.`);
  parts.push("Open Remarkabler (unlock as usual) to see them.");
  return page(title, parts.join(" "), true);
}

// A direct visit to /share (GET) just lands on the notebooks page.
export async function GET() {
  return page("Remarkabler", "Opening your notebooks…", true);
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
<title>Remarkabler</title>
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
