import { register, remarkable, type RemarkableApi } from "rmapi-js";
import { getSetting, setSetting } from "./db";

const DEVICE_TOKEN_KEY = "rm_device_token";

export async function connectWithCode(oneTimeCode: string): Promise<void> {
  const code = oneTimeCode.trim();
  if (code.length !== 8) {
    throw new Error(
      "reMarkable connect codes are 8 characters. Get one at https://my.remarkable.com/device/desktop/connect"
    );
  }
  const deviceToken = await register(code);
  setSetting(DEVICE_TOKEN_KEY, deviceToken);
}

export function isConnected(): boolean {
  return !!getSetting(DEVICE_TOKEN_KEY);
}

export function disconnect(): void {
  setSetting(DEVICE_TOKEN_KEY, "");
}

export async function getClient(): Promise<RemarkableApi> {
  const token = getSetting(DEVICE_TOKEN_KEY);
  if (!token) throw new Error("Not connected to reMarkable. Visit /connect first.");
  return remarkable(token);
}

export type NotebookEntry = {
  id: string;
  hash: string;
  name: string;
  parent: string | null;
  isFolder: boolean;
  lastModified: string | null;
};

export async function listNotebooks(): Promise<NotebookEntry[]> {
  const api = await getClient();
  // rmapi-js' listItems returns the cloud index. Field names follow the
  // upstream API: `id`, `hash`, `visibleName`, `parent`, `type`, `lastModified`.
  const items = (await api.listItems()) as Array<{
    id: string;
    hash: string;
    visibleName: string;
    parent?: string;
    type?: string;
    lastModified?: string;
  }>;
  return items.map((e) => ({
    id: e.id,
    hash: e.hash,
    name: e.visibleName,
    parent: e.parent || null,
    isFolder: e.type === "CollectionType",
    lastModified: e.lastModified ?? null,
  }));
}

/**
 * Returns the rendered notebook as a PDF (bytes).
 *
 * rmapi-js explicitly excludes server-side rendering; the cloud webapp does
 * have an internal render endpoint that the official desktop client uses to
 * produce PDFs ("Save as PDF"), but it is not stable / documented.
 *
 * Strategy used here:
 *   1. If the entry was originally uploaded as a PDF or EPUB, fetch that
 *      directly with the typed accessors (getPdf / getEpub when present).
 *   2. Otherwise fall back to the raw client (`api.raw`) and hit the
 *      internal render endpoint — wrapped in a try/catch with a clear error
 *      so the caller can surface a "rendering not supported for this
 *      notebook type yet" message instead of silently failing.
 *
 * If your rmapi-js version exposes a typed method for native-notebook PDF
 * export, swap it in here.
 */
export async function getNotebookPdf(notebookId: string): Promise<Uint8Array> {
  const api = (await getClient()) as RemarkableApi & {
    getPdf?: (id: string) => Promise<Uint8Array>;
    raw?: { fetch: (url: string, init?: RequestInit) => Promise<Response> };
  };

  if (typeof api.getPdf === "function") {
    return api.getPdf(notebookId);
  }

  if (api.raw && typeof api.raw.fetch === "function") {
    const resp = await api.raw.fetch(
      `/doc/v2/files/${encodeURIComponent(notebookId)}`,
      { headers: { Accept: "application/pdf" } }
    );
    if (!resp.ok) {
      throw new Error(
        `Cloud render failed (${resp.status}). This endpoint is unofficial and may have moved.`
      );
    }
    const buf = await resp.arrayBuffer();
    return new Uint8Array(buf);
  }

  throw new Error(
    "No PDF render path available for this notebook. Implement getNotebookPdf using the export method exposed by your installed rmapi-js version."
  );
}
