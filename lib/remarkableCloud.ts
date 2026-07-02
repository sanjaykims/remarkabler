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

export function remarkablePaired(): boolean {
  return !!getSetting(TOKEN_KEY);
}

export type RemarkableNotebook = {
  id: string;
  name: string;
  hash: string;
  lastModified: string;
  parent: string;
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

// Pure: keep only handwritten notebooks that aren't in the trash, mapped to
// our display shape. Exported for unit testing without the network.
export function filterNotebooks(entries: RmEntry[]): RemarkableNotebook[] {
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
      lastModified: e.lastModified || "",
      parent: e.parent || "",
    }));
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
};

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
  };
}
