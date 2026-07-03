import { getSetting, setSetting, clearSetting } from "./db";

// ── reMarkable cloud integration — Phase 0: pair + read-only listing ────────
//
// The tablet auto-syncs every notebook to reMarkable's cloud over WiFi (no
// device tap). This module pairs with that cloud account using rmapi-js
// (erikbrinkman/rmapi-js) and, for now, only LISTS notebooks — proving auth
// + connectivity against the user's real account before we build ingestion.
//
// There is no official reMarkable API; rmapi-js speaks the same
// reverse-engineered sync protocol every third-party tool uses. Tolerated
// historically, but it can break when reMarkable changes the protocol — so
// this is a SECONDARY source. The Dropbox one-tap path stays the reliable
// fallback and is never removed.
//
// rmapi-js is ESM-only, so it's imported dynamically (await import) inside
// each function — that keeps it out of the module graph for CommonJS callers
// and matches how the app lazy-loads other server-only deps.

// Settings keys (all in the `settings` table). The device token is a
// long-lived credential — redacted from off-site backups (see
// lib/backup.ts SENSITIVE_SETTING_KEYS).
const TOKEN_KEY = "remarkable_device_token";
const PAIRED_AT_KEY = "remarkable_paired_at";
const LAST_LIST_AT_KEY = "remarkable_last_list_at";
const LAST_ERROR_KEY = "remarkable_last_error";
const DOC_COUNT_KEY = "remarkable_last_doc_count";
// The last listed notebooks, persisted as JSON so the /memory UI can render a
// row-per-notebook (with an Import button) on page load without forcing a
// live network re-list. Bounded so a huge account can't bloat the settings row.
const LIST_KEY = "remarkable_last_list";
const MAX_PERSISTED_NOTEBOOKS = 300;

export function remarkablePaired(): boolean {
  return !!getSetting(TOKEN_KEY);
}

export type RemarkableNotebook = {
  id: string;
  name: string;
  hash: string;
  lastModified: string;
  parent: string;
  // Display name of the folder the notebook lives in ("" for the root).
  // Resolved from the CollectionType entries in the same listing, so the UI
  // can group/filter by folder (e.g. the user's "Diary" folder).
  folder: string;
};

// rmapi-js Entry shape (only the fields we use). Kept local so the module
// has no compile-time dependency on the ESM package's types.
type RmEntry = {
  id: string;
  hash: string;
  visibleName?: string;
  lastModified?: string;
  pinned?: boolean;
  parent?: string;
  type?: string;
  fileType?: string;
};

// reMarkable's lastModified is an epoch timestamp as a string on current
// firmware (milliseconds; some older data used seconds or ISO). Normalize to
// ISO so formatLocalTime can always render it; pass through anything already
// parseable.
function normalizeLastModified(raw: string | undefined): string {
  if (!raw) return "";
  if (/^\d{9,}$/.test(raw)) {
    // 12+ digits → milliseconds; 9-11 digits → seconds.
    const n = Number(raw);
    const d = new Date(raw.length >= 12 ? n : n * 1000);
    return isNaN(d.getTime()) ? raw : d.toISOString();
  }
  return raw;
}

// Pure: keep only handwritten notebooks that aren't in the trash, mapped to
// our display shape — with the containing folder's display name resolved from
// the CollectionType entries in the same listing — sorted newest-first.
// Exported for unit testing without the network.
export function filterNotebooks(entries: RmEntry[]): RemarkableNotebook[] {
  const folderNames = new Map<string, string>();
  for (const e of entries) {
    if (e.type === "CollectionType") {
      folderNames.set(e.id, e.visibleName || "(untitled folder)");
    }
  }
  return entries
    .filter(
      (e) =>
        e.type === "DocumentType" &&
        e.fileType === "notebook" &&
        e.parent !== "trash"
    )
    .map((e) => ({
      id: e.id,
      name: e.visibleName || "(untitled)",
      hash: e.hash,
      lastModified: normalizeLastModified(e.lastModified),
      parent: e.parent || "",
      folder: (e.parent && folderNames.get(e.parent)) || "",
    }))
    .sort((a, b) => (b.lastModified || "").localeCompare(a.lastModified || ""));
}

// Pure: derive the ordered list of page ids from a notebook's `.content`
// payload. Prefers the modern `cPages.pages[]` (each entry has a page `id`
// and, when removed, a `deleted` marker we skip), falls back to the legacy
// `pages: string[]`. Exported for unit testing without the network.
export function orderedPageIdsFromContent(content: unknown): string[] {
  const c = (content || {}) as {
    cPages?: { pages?: Array<{ id?: string; deleted?: unknown }> };
    pages?: unknown;
  };
  const cpages = c.cPages?.pages;
  if (Array.isArray(cpages) && cpages.length > 0) {
    return cpages
      .filter((p) => p && typeof p.id === "string" && p.deleted == null)
      .map((p) => p.id as string);
  }
  if (Array.isArray(c.pages)) {
    return (c.pages as unknown[]).filter(
      (id): id is string => typeof id === "string"
    );
  }
  return [];
}

// Translate rmapi-js failures into a short, safe message (never echo tokens
// or raw bodies). rmapi-js throws ResponseError { status, statusText }.
function safeRemarkableError(e: unknown, fallback: string): string {
  const err = e as { status?: number; statusText?: string; message?: string };
  if (typeof err?.status === "number") {
    if (err.status === 401 || err.status === 403) {
      return "reMarkable rejected the credentials — re-pair with a fresh code.";
    }
    if (err.status === 429) {
      return "reMarkable rate-limited the request — try again in a minute.";
    }
    return `reMarkable returned ${err.status}${
      err.statusText ? ` (${err.statusText})` : ""
    }.`;
  }
  const msg = (err?.message || "").slice(0, 160);
  return msg || fallback;
}

export type PairResult = { ok: boolean; count?: number; error?: string };

/**
 * Exchange a one-time pairing code (from
 * https://my.remarkable.com/device/browser/connect) for a long-lived device
 * token, store it, and immediately list notebooks to prove it works.
 */
export async function pairRemarkable(code: string): Promise<PairResult> {
  const trimmed = (code || "").trim();
  // rmapi-js register() throws if the code isn't 8 chars; check first for a
  // friendlier message.
  if (trimmed.length !== 8) {
    return {
      ok: false,
      error: "The code should be 8 characters — copy it exactly from my.remarkable.com.",
    };
  }
  try {
    const { register } = await import("rmapi-js");
    const deviceToken = await register(trimmed);
    if (!deviceToken || typeof deviceToken !== "string") {
      return { ok: false, error: "Pairing did not return a token. Try a fresh code." };
    }
    setSetting(TOKEN_KEY, deviceToken);
    setSetting(PAIRED_AT_KEY, new Date().toISOString());
    clearSetting(LAST_ERROR_KEY);
    // Prove it: list notebooks now.
    const list = await listRemarkableNotebooks();
    if (!list.ok) {
      // Pairing succeeded (token stored) but listing failed — surface that,
      // keep the token so the user can retry listing without re-pairing.
      return { ok: true, count: 0, error: list.error };
    }
    return { ok: true, count: list.notebooks?.length ?? 0 };
  } catch (e) {
    const error = safeRemarkableError(e, "Pairing failed. Get a fresh code and try again.");
    setSetting(LAST_ERROR_KEY, error);
    return { ok: false, error };
  }
}

export function unpairRemarkable(): void {
  clearSetting(TOKEN_KEY);
  clearSetting(PAIRED_AT_KEY);
  clearSetting(LAST_LIST_AT_KEY);
  clearSetting(LAST_ERROR_KEY);
  clearSetting(DOC_COUNT_KEY);
  clearSetting(LIST_KEY);
}

export type ListResult = {
  ok: boolean;
  notebooks?: RemarkableNotebook[];
  error?: string;
};

/**
 * List the handwritten notebooks in the paired cloud account. Read-only.
 * Fail-soft: records the error in settings and returns { ok:false } rather
 * than throwing.
 */
export async function listRemarkableNotebooks(): Promise<ListResult> {
  const token = getSetting(TOKEN_KEY);
  if (!token) return { ok: false, error: "Not paired with reMarkable." };
  try {
    const { remarkable } = await import("rmapi-js");
    const api = await remarkable(token);
    const entries = (await api.listItems()) as unknown as RmEntry[];
    const notebooks = filterNotebooks(entries);
    setSetting(LAST_LIST_AT_KEY, new Date().toISOString());
    setSetting(DOC_COUNT_KEY, String(notebooks.length));
    // Persist a bounded copy so the UI can list notebooks (with Import
    // buttons) without a fresh network call on every page load.
    setSetting(
      LIST_KEY,
      JSON.stringify(notebooks.slice(0, MAX_PERSISTED_NOTEBOOKS))
    );
    clearSetting(LAST_ERROR_KEY);
    return { ok: true, notebooks };
  } catch (e) {
    const error = safeRemarkableError(e, "Couldn't list reMarkable notebooks.");
    setSetting(LAST_ERROR_KEY, error);
    return { ok: false, error };
  }
}

export type RemarkableStatus = {
  paired: boolean;
  pairedAt: string | null;
  lastListAt: string | null;
  lastError: string | null;
  notebookCount: number | null;
  notebooks: RemarkableNotebook[];
};

// Parse the persisted notebook list, tolerating an absent/garbled row.
function persistedNotebooks(): RemarkableNotebook[] {
  const raw = getSetting(LIST_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as RemarkableNotebook[]) : [];
  } catch {
    return [];
  }
}

export function remarkableStatus(): RemarkableStatus {
  const countRaw = getSetting(DOC_COUNT_KEY);
  const count = countRaw !== null && Number.isFinite(Number(countRaw))
    ? Number(countRaw)
    : null;
  return {
    paired: remarkablePaired(),
    pairedAt: getSetting(PAIRED_AT_KEY),
    lastListAt: getSetting(LAST_LIST_AT_KEY),
    lastError: getSetting(LAST_ERROR_KEY),
    notebookCount: count,
    notebooks: persistedNotebooks(),
  };
}

/**
 * Account-wide change cursor: reMarkable's root hash moves whenever ANYTHING
 * in the account changes. The sync sweep uses it as a cheap "anything new?"
 * fast-path before listing/diffing. Fail-soft.
 */
export async function remarkableRootHash(): Promise<string | null> {
  const token = getSetting(TOKEN_KEY);
  if (!token) return null;
  try {
    const { remarkable } = await import("rmapi-js");
    const api = await remarkable(token);
    const [hash] = await api.raw.getRootHash();
    return typeof hash === "string" && hash ? hash : null;
  } catch {
    return null;
  }
}

export type DownloadedPage = { pageId: string; rmBytes: Uint8Array };
export type DownloadResult = {
  ok: boolean;
  pages?: DownloadedPage[];
  error?: string;
};

/**
 * Download ONE notebook's raw files from the cloud and return its `.rm` page
 * bytes in reading order. Read-only; fail-soft (returns { ok:false } rather
 * than throwing).
 *
 * `getDocument(id, hash)` yields a ZIP of the notebook's raw files
 * (`<docId>/<pageId>.rm`, `<docId>.content`, `.metadata`, …). We read the
 * `.content` for page order, then pull each `<pageId>.rm` in that order. Pages
 * with no `.rm` (never drawn) are skipped. If the content can't be parsed we
 * fall back to every `.rm` entry sorted by name so a valid notebook still
 * imports.
 */
export async function downloadNotebook(
  id: string,
  hash: string
): Promise<DownloadResult> {
  const token = getSetting(TOKEN_KEY);
  if (!token) return { ok: false, error: "Not paired with reMarkable." };
  try {
    const { remarkable } = await import("rmapi-js");
    const { default: JSZip } = await import("jszip");
    const api = await remarkable(token);
    const zipBytes = (await api.getDocument(id, hash)) as Uint8Array;
    const zip = await JSZip.loadAsync(zipBytes);

    // Index every `.rm` file by the basename (its pageId) for O(1) lookup,
    // tolerant of any `<docId>/` prefix in the path.
    const rmByPageId = new Map<string, import("jszip").JSZipObject>();
    const allRm: import("jszip").JSZipObject[] = [];
    zip.forEach((relPath, file) => {
      if (file.dir || !relPath.endsWith(".rm")) return;
      const base = relPath.slice(relPath.lastIndexOf("/") + 1); // <pageId>.rm
      rmByPageId.set(base.replace(/\.rm$/, ""), file);
      allRm.push(file);
    });

    // Page order from the notebook's `.content`.
    let orderedIds: string[] = [];
    let contentParsed = false;
    const contentFile = zip.file(/\.content$/)[0];
    if (contentFile) {
      try {
        orderedIds = orderedPageIdsFromContent(
          JSON.parse(await contentFile.async("string"))
        );
        contentParsed = true;
      } catch {
        contentParsed = false;
      }
    }

    const pages: DownloadedPage[] = [];
    for (const pageId of orderedIds) {
      const f = rmByPageId.get(pageId);
      if (f) pages.push({ pageId, rmBytes: await f.async("uint8array") });
    }
    // Fallback: take every `.rm` name-sorted — but ONLY when we couldn't read
    // the page order at all (missing/garbled `.content`). When `.content`
    // parsed, its verdict stands even if it yielded zero pages: an empty or
    // all-deleted order, or active ids matching no `.rm` (blank pages), must
    // NOT dredge up stale/deleted `.rm` blobs still shipping in the ZIP
    // (Codex, PR #78) — report "no drawn pages" instead.
    if (pages.length === 0 && !contentParsed && allRm.length > 0) {
      const sorted = allRm.slice().sort((a, b) => a.name.localeCompare(b.name));
      for (const f of sorted) {
        const base = f.name.slice(f.name.lastIndexOf("/") + 1);
        pages.push({
          pageId: base.replace(/\.rm$/, ""),
          rmBytes: await f.async("uint8array"),
        });
      }
    }

    return { ok: true, pages };
  } catch (e) {
    return {
      ok: false,
      error: safeRemarkableError(e, "Couldn't download the reMarkable notebook."),
    };
  }
}
