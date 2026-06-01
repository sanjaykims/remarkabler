import { NextRequest } from "next/server";
import { createNotebook, processNotebook } from "@/lib/notes";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;

// File-shaped values arriving via PWA Web Share Target on Android Chrome
// come from a *different* File constructor than the one this module sees,
// so `value instanceof File` returns false even though the value is plainly
// a File. Duck-type the check instead — anything with a numeric `size` and
// an `arrayBuffer` method is treated as a file for our purposes.
type FileLike = {
  name?: string;
  type?: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};
function isFileLike(v: unknown): v is FileLike {
  if (v === null || typeof v !== "object") return false;
  const o = v as { size?: unknown; arrayBuffer?: unknown };
  return (
    typeof o.size === "number" && typeof o.arrayBuffer === "function"
  );
}

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

  // Walk every entry, not just "file". The reMarkable mobile app's plain
  // Share sometimes posts a link/title/text without an actual PDF, in which
  // case the manifest's PDF filter strips the file content from the
  // multipart body and we see no file at all. Capturing the rest lets us
  // surface what was received instead of a generic "no file" message.
  const usableFiles: FileLike[] = [];
  const emptyFiles: Array<{ field: string; name: string; type: string; size: number }> = [];
  const textEntries: Array<{ field: string; value: string }> = [];

  if (form) {
    for (const [key, value] of form.entries()) {
      if (isFileLike(value)) {
        if (value.size > 0) usableFiles.push(value);
        else
          emptyFiles.push({
            field: key,
            name: value.name || "(no name)",
            type: value.type || "(no type)",
            size: value.size,
          });
      } else {
        const str = String(value);
        textEntries.push({
          field: key,
          value: str.length > 200 ? str.slice(0, 200) + "…" : str,
        });
      }
    }
  }

  if (usableFiles.length === 0) {
    const parts: string[] = ["No PDF came through in that share."];
    if (emptyFiles.length > 0) {
      parts.push("", "Empty / zero-byte file fields received:");
      for (const f of emptyFiles) {
        parts.push(
          `• ${f.field}: "${f.name}" — ${f.type || "no MIME"}, ${f.size} bytes`
        );
      }
    }
    if (textEntries.length > 0) {
      parts.push("", "Other fields the share sent:");
      for (const t of textEntries) parts.push(`• ${t.field}: ${t.value}`);
    }
    if (emptyFiles.length === 0 && textEntries.length === 0) {
      parts.push("", "The share request reached Remarkabler but was empty.");
    }
    parts.push(
      "",
      "From the reMarkable mobile app: open the notebook → menu → Export as PDF, then share the exported PDF here. The plain Share button on a notebook tends to share a link or the original file format, not a PDF — Remarkabler can only read PDFs."
    );
    return page("Couldn't add that notebook", parts.join("\n"), false);
  }

  const added: string[] = [];
  const skipped: string[] = [];
  for (const file of usableFiles) {
    const name = file.name || "shared.pdf";
    const isPdf =
      file.type === "application/pdf" || name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      skipped.push(`${name} (not a PDF — ${file.type || "no MIME"})`);
      continue;
    }
    if (file.size > MAX_BYTES) {
      skipped.push(`${name} (too large — max 20 MB)`);
      continue;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const nb = createNotebook(name, bytes);
      // Transcribe in the background; each notebook runs on its own.
      void processNotebook(nb.id).catch(() => {});
      added.push(nb.name);
    } catch (err) {
      skipped.push(`${name} (${(err as Error).message})`);
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
  const partsOk =
    added.length === 1
      ? [`"${added[0]}" is transcribing in the background.`]
      : [`${added.length} notebooks are transcribing in the background.`];
  if (skipped.length) partsOk.push(`Skipped: ${skipped.join("; ")}.`);
  partsOk.push("Open Remarkabler (unlock as usual) to see them.");
  return page(title, partsOk.join(" "), true);
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
  div.wrap { max-width: 520px; text-align: center; }
  h1 { font-size: 1.25rem; }
  p.msg { white-space: pre-wrap; text-align: left; font-size: 0.95rem;
          line-height: 1.45; opacity: 0.92; }
  a { color: #fafaf9; }
</style>
</head>
<body>
<div class="wrap">
  <h1>${escapeHtml(title)}</h1>
  <p class="msg">${escapeHtml(message)}</p>
  <p><a href="/notebooks">Open your notebooks &rarr;</a></p>
</div>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
