import { db } from "@/lib/db";
import { cropPng, pagePicture, type Box } from "@/lib/handwritingExamples";
import { anchorPhrase } from "@/lib/ocrFlags";

// MCP tool `get_page_image`: lets a connected Claude LOOK at a handwritten page (and at the
// picture a proofreading card shows, marker included) so the marker locator can be debugged
// against the real page. Read-only, but it exposes raw handwriting images the endpoint never
// returned before, so — like get_conversation — it is OFF unless MCP_ALLOW_PAGE_IMAGES=true.

export const PAGE_IMAGE_TOOL_NAME = "get_page_image";

export function pageImagesEnabled(): boolean {
  return process.env.MCP_ALLOW_PAGE_IMAGES === "true";
}

export const PAGE_IMAGE_TOOL = {
  name: PAGE_IMAGE_TOOL_NAME,
  description:
    "Return the picture of one handwritten diary page (JPEG), plus the ids and phrases of its " +
    "proofreading cards. Give `notebook` (its id or exact name, e.g. a diary date) and `page` " +
    "(1-based, default 1). Optionally give `flag_id` to get instead the card's own picture — " +
    "the handwritten line with the marker drawn where the app thinks the word is — which is " +
    "what to check when a marker looks misplaced.",
  inputSchema: {
    type: "object",
    properties: {
      notebook: { type: "string", description: "Notebook id or exact name." },
      page: { type: "number", description: "1-based page number (default 1)." },
      flag_id: { type: "string", description: "A proofreading card id, for its marker picture." },
    },
    required: ["notebook"],
  },
} as const;

export type McpContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

const err = (m: string): McpContent[] => [{ type: "text", text: JSON.stringify({ error: m }) }];

/** Never throws; returns MCP content parts (an error is a JSON text part with an "error" key). */
export async function callPageImageTool(args: unknown): Promise<McpContent[]> {
  if (!pageImagesEnabled()) return err(`Tool not available: ${PAGE_IMAGE_TOOL_NAME}`);
  try {
    const a = (args ?? {}) as Record<string, unknown>;
    const key = typeof a.notebook === "string" ? a.notebook.trim() : "";
    if (!key) return err("notebook is required (id or exact name).");
    const pageNo = Math.max(1, Math.floor(typeof a.page === "number" ? a.page : 1));
    const nb = db()
      .prepare(`SELECT id, name FROM notebooks WHERE id = ? OR name = ? ORDER BY id = ? DESC LIMIT 1`)
      .get(key, key, key) as { id: string; name: string } | undefined;
    if (!nb) return err(`Unknown notebook: ${key}`);
    const page = db()
      .prepare(`SELECT id, page_index FROM pages WHERE notebook_id = ? ORDER BY page_index LIMIT 1 OFFSET ?`)
      .get(nb.id, pageNo - 1) as { id: string; page_index: number } | undefined;
    if (!page) return err(`Notebook "${nb.name}" has no page ${pageNo}.`);

    const flags = db()
      .prepare(`SELECT id, phrase, status, start_offset FROM ocr_flags WHERE page_id = ? ORDER BY start_offset`)
      .all(page.id) as { id: string; phrase: string; status: string; start_offset: number }[];

    const flagId = typeof a.flag_id === "string" ? a.flag_id : "";
    let jpegOrPng: Buffer | null;
    let mime: string;
    if (flagId) {
      const f = db()
        .prepare(
          `SELECT f.notebook_id, f.page_index, f.page_id, f.box, f.start_offset, f.phrase, p.ocr_text
             FROM ocr_flags f LEFT JOIN pages p ON p.id = f.page_id WHERE f.id = ?`
        )
        .get(flagId) as
        | { notebook_id: string; page_index: number; page_id: string; box: string | null; start_offset: number; phrase: string; ocr_text: string | null }
        | undefined;
      if (!f) return err(`Unknown flag_id: ${flagId}`);
      let box: Box | null = null;
      try {
        const b = f.box ? JSON.parse(f.box) : null;
        if (Array.isArray(b) && b.length === 4) box = b as Box;
      } catch {
        /* ignore */
      }
      const text = f.ocr_text || "";
      jpegOrPng = await cropPng(
        f.notebook_id,
        f.page_index,
        box,
        true,
        text ? { text, offset: Math.max(0, anchorPhrase(text, f.phrase, f.start_offset)), len: f.phrase.length } : undefined,
        f.page_id
      );
      mime = "image/png";
    } else {
      jpegOrPng = await pagePicture(nb.id, page.page_index, page.id);
      mime = "image/jpeg";
    }
    if (!jpegOrPng) {
      return err("No picture could be made (needs the stored PDF and the renderer image on the server).");
    }
    return [
      {
        type: "text",
        text: JSON.stringify({ notebook: nb.name, notebook_id: nb.id, page: pageNo, flags }),
      },
      { type: "image", data: jpegOrPng.toString("base64"), mimeType: mime },
    ];
  } catch (e) {
    return err(`Could not make the picture: ${(e as Error).message}`);
  }
}
