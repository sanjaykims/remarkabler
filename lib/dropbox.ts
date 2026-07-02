import {
  db,
  getSetting,
  setSetting,
  clearSetting,
} from "@/lib/db";
import { createNotebook, processNotebook } from "@/lib/notes";
import { MAX_UPLOAD_BYTES } from "@/lib/upload";
import { renderDiaryMarkdown } from "@/lib/diaryExportDb";

// Where the auto-exported diary Markdown is written inside the user's
// Dropbox. Overridable via the `dropbox_export_path` setting. Kept in a
// dedicated folder (not the ingest folder) so it can never be mistaken for
// a notebook to re-ingest — and the ingest guard only accepts PDFs anyway.
const DEFAULT_EXPORT_PATH = "/Remarkabler/diary.md";

// Dropbox auto-ingest. reMarkable Connect's "Export to integration" pushes a
// flattened PDF of a notebook to a user-chosen Dropbox folder. This module
// watches that folder and feeds new PDFs into the same createNotebook +
// processNotebook pipeline that handles manual uploads — so the user's loop
// becomes write → tap "Send to Dropbox" → notebook appears in Remarkabler
// within minutes, with no manual download/upload step.
//
// Trust model:
//   * App credentials (APP_KEY / APP_SECRET) live in Railway env vars,
//     never in code or DB.
//   * The user-specific refresh_token is stored in the settings table
//     alongside other server-side secrets (Anthropic key etc are in env;
//     the refresh token, being per-user, lives in the DB).
//   * Permissions are READ-ONLY on the Dropbox side (files.{metadata,content}
//     .read). Even if a bug here tried to delete or upload, Dropbox would
//     refuse — least-privilege is enforced server-side, not in this code.

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes between polls
// After a failed poll, back off so a persistent error (bad token / revoked
// permissions) doesn't hammer Dropbox or our own logs every sweep.
const POLL_FAILURE_BACKOFF_MS = 30 * 60 * 1000; // 30 minutes
// Cap a single sweep so a freshly-connected account with hundreds of files
// can't trigger hundreds of downloads at once. NOTE: this caps DOWNLOADS,
// not concurrent Claude OCR jobs — the OCR concurrency budget is enforced
// separately via the processing-notebook count, see ocrConcurrencyLimit().
const MAX_INGEST_PER_SWEEP = 10;
// Above this Dropbox folder size we warn (and recommend the user enable
// cursor-based polling). Below it the existing full-list polling is fine.
const FOLDER_SIZE_WARN = 500;

// Shared expensive-OCR gate. Manual uploads also start `status='processing'`
// notebooks, so this budget is consumed by both paths — Dropbox backs off
// when the budget is full, preventing a freshly-connected account from
// stacking 20+ concurrent Claude OCR calls against the user's Anthropic key.
// Default 2; configurable up to 5 via OCR_CONCURRENCY_LIMIT. Clamp safely.
function ocrConcurrencyLimit(): number {
  const raw = Number(process.env.OCR_CONCURRENCY_LIMIT);
  if (!Number.isFinite(raw) || raw <= 0) return 2;
  return Math.max(1, Math.min(5, Math.floor(raw)));
}

function processingNotebookCount(): number {
  const row = db()
    .prepare(`SELECT COUNT(*) AS c FROM notebooks WHERE status = 'processing'`)
    .get() as { c: number };
  return row.c;
}

// ───────────────────────────────────────────────────────────────────────────
// Base-URL resolution for the OAuth redirect.
//
// In production we REQUIRE APP_BASE_URL to be set in the environment. We
// refuse to fall back to forwarded headers there because, while Railway's
// ingress is well-behaved, "trust the proxy" is a weaker posture than "use
// a canonical configured value." In dev we honour the forwarded headers so
// localhost / preview deploys still work without setup.
// ───────────────────────────────────────────────────────────────────────────

// Validate that a configured APP_BASE_URL is a sensible OAuth origin: must
// parse, must be http or https, must have a host. We reject `http://` in
// production because Dropbox redirects to the literal value and an http
// origin would expose the OAuth code in clear traffic. Returns null if
// valid (no error), otherwise an explanation string.
function validateConfiguredBaseUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return `APP_BASE_URL is not a valid URL: ${raw.slice(0, 80)}`;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return `APP_BASE_URL must use http or https (got ${parsed.protocol})`;
  }
  if (!parsed.host) return "APP_BASE_URL is missing a host";
  if (
    process.env.NODE_ENV === "production" &&
    parsed.protocol !== "https:"
  ) {
    return "APP_BASE_URL must be https in production (Dropbox redirects to it; an http origin would leak the OAuth code).";
  }
  if (parsed.pathname && parsed.pathname !== "/") {
    return `APP_BASE_URL must not include a path (got "${parsed.pathname}"); the callback path is appended internally.`;
  }
  // Query strings and fragments would survive trailing-slash strip and
  // produce garbage when the callback path is appended (e.g.
  // "https://x?foo=1" + "/api/dropbox/callback" → "https://x?foo=1/api/...").
  if (parsed.search) {
    return `APP_BASE_URL must not include a query string (got "${parsed.search}").`;
  }
  if (parsed.hash) {
    return `APP_BASE_URL must not include a URL fragment (got "${parsed.hash}").`;
  }
  return null;
}

export function resolveAppBaseUrl(headers: {
  get(name: string): string | null;
}): { ok: true; baseUrl: string } | { ok: false; error: string } {
  const configured = (process.env.APP_BASE_URL || "").trim();
  if (configured) {
    const err = validateConfiguredBaseUrl(configured);
    if (err) return { ok: false, error: err };
    return { ok: true, baseUrl: configured.replace(/\/+$/, "") };
  }
  if (process.env.NODE_ENV === "production") {
    return {
      ok: false,
      error:
        "APP_BASE_URL is required in production for OAuth callbacks. Set it in Railway (e.g. https://your-app.up.railway.app) and redeploy.",
    };
  }
  const proto = headers.get("x-forwarded-proto") || "http";
  const host = headers.get("x-forwarded-host") || headers.get("host");
  if (!host) return { ok: false, error: "Could not determine app host." };
  return { ok: true, baseUrl: `${proto}://${host}` };
}

// ───────────────────────────────────────────────────────────────────────────
// Dropbox error classification.
//
// The whole point of this taxonomy is to decide whether a failure is a
// per-file blip (skip and continue) or a systemic problem (record visibly
// and engage backoff). The previous code swallowed every error including
// 401, which made a revoked token look like a successful empty poll. Now
// auth / rate-limit / transient / network errors all propagate to the
// poll-level error handler.
// ───────────────────────────────────────────────────────────────────────────

export type DropboxErrorKind =
  | "auth"
  | "rate-limit"
  | "transient"
  | "file-local"
  | "unknown";

export function classifyDropboxError(
  status: number,
  errorSummary?: string
): DropboxErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate-limit";
  if (status >= 500 && status < 600) return "transient";
  if (status === 409) {
    // Dropbox uses 409 for everything from "path not found" to "file too
    // large" to "endpoint-specific bad input". The .error_summary tells us
    // which — path / lookup / not_found are per-file blips; anything else
    // we don't recognise as file-local, treat as unknown so it surfaces.
    const s = (errorSummary || "").toLowerCase();
    if (
      s.startsWith("path/") ||
      s.startsWith("path_lookup/") ||
      s.includes("not_found") ||
      s.includes("not_file")
    ) {
      return "file-local";
    }
    return "unknown";
  }
  // 400 / 404 used to map to "file-local" by default. Codex correctly
  // pointed out the asymmetry: we only have evidence something is
  // file-local when Dropbox's .error_summary says so. A bare 400 / 404
  // could be a malformed app-level request (systemic) just as easily as
  // a missing path (file-local). Default to "unknown" so systemic bugs
  // surface; only the recognised path-style summaries flip back to
  // file-local.
  if (status === 400 || status === 404) {
    const s = (errorSummary || "").toLowerCase();
    if (
      s.startsWith("path/") ||
      s.startsWith("path_lookup/") ||
      s.includes("not_found") ||
      s.includes("not_file")
    ) {
      return "file-local";
    }
    return "unknown";
  }
  return "unknown";
}

export function isPollLevelError(kind: DropboxErrorKind): boolean {
  // Anything that says "the integration is broken or rate-limited as a whole"
  // must trip the outer catch so dropbox_last_error stays set and the failure
  // backoff engages. Only true per-file blips are safe to swallow.
  return kind !== "file-local";
}

// Sanitised error string for persistence + UI. Never includes raw response
// bodies from token endpoints (could echo Authorization headers / tokens in
// some failure modes). For file/list endpoints we include Dropbox's own
// .error_summary because it's informative and Dropbox crafts it for users.
type Endpoint = "token" | "file";
export function safeDropboxError(
  endpoint: Endpoint,
  status: number,
  errorSummary?: string
): string {
  const kind = classifyDropboxError(status, errorSummary);
  if (endpoint === "token") {
    // Token endpoints: generic message only. We never want a raw response
    // body from /oauth2/token landing in the settings table.
    return `Dropbox token endpoint returned ${status} (${kind}).`;
  }
  const summary = (errorSummary || "").trim().slice(0, 120);
  return summary
    ? `Dropbox ${status} (${kind}): ${summary}`
    : `Dropbox ${status} (${kind}).`;
}

// PDFs start with "%PDF" (0x25 0x50 0x44 0x46). Cheap post-download sanity
// check — Dropbox's metadata-driven size guard is the main gate; this
// catches files that arrived corrupted or were misclassified by extension.
export function looksLikePdf(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

// Where in Dropbox we look for notebooks. Defaults to /Diary (matching how
// the user has theirs configured), but overridable via env so future users
// don't have to share that exact convention.
function ingestFolder(): string {
  const raw = (process.env.DROPBOX_INGEST_PATH || "/Diary").trim();
  // Normalise to "/Foo" — Dropbox API wants leading slash, no trailing slash.
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withSlash.endsWith("/") && withSlash !== "/"
    ? withSlash.slice(0, -1)
    : withSlash;
}

export function dropboxConfigured(): boolean {
  return !!(process.env.DROPBOX_APP_KEY && process.env.DROPBOX_APP_SECRET);
}

export function dropboxConnected(): boolean {
  return dropboxConfigured() && !!getSetting("dropbox_refresh_token");
}

export type DropboxStatus = {
  configured: boolean;
  connected: boolean;
  folder: string;
  account: string | null;
  lastSyncAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  ingestedCount: number;
  // Operational visibility added after Codex's review. Sanitised — never
  // contains raw provider response bodies. lastSkipped surfaces files the
  // size/format guards rejected. lastRevokeWarning surfaces a Dropbox-side
  // revoke failure on disconnect (local state is always cleared regardless).
  lastSeenFileCount: number | null;
  lastSkipped: string | null;
  lastRevokeWarning: string | null;
  // Auto-export of the diary Markdown back into Dropbox (opt-in; needs the
  // files.content.write scope added to the Dropbox app + a reconnect).
  exportEnabled: boolean;
  exportPath: string;
  exportLastAt: string | null;
  exportLastError: string | null;
};

export function dropboxExportEnabled(): boolean {
  return getSetting("dropbox_export_enabled") === "1";
}

export function dropboxExportPath(): string {
  const p = (getSetting("dropbox_export_path") || "").trim();
  return p || DEFAULT_EXPORT_PATH;
}

export function setDropboxExportEnabled(enabled: boolean): void {
  setSetting("dropbox_export_enabled", enabled ? "1" : "0");
}

export function dropboxStatus(): DropboxStatus {
  const countRow = db()
    .prepare(
      `SELECT COUNT(*) AS c FROM notebooks WHERE dropbox_file_id IS NOT NULL`
    )
    .get() as { c: number };
  // Preserve 0 — an empty Dropbox folder is informative ("we polled, found
  // nothing yet"). The previous `seenCount ? ... || null : null` collapsed
  // "0" to null via the `||` coercion and the UI showed "never polled".
  const seenCount = getSetting("dropbox_last_seen_file_count");
  let parsedSeen: number | null = null;
  if (seenCount !== null) {
    const n = Number(seenCount);
    if (Number.isFinite(n)) parsedSeen = n;
  }
  return {
    configured: dropboxConfigured(),
    connected: dropboxConnected(),
    folder: ingestFolder(),
    account: getSetting("dropbox_account_name"),
    lastSyncAt: getSetting("dropbox_last_sync_at"),
    lastAttemptAt: getSetting("dropbox_last_attempt_at"),
    lastError: getSetting("dropbox_last_error"),
    ingestedCount: countRow.c,
    lastSeenFileCount: parsedSeen,
    lastSkipped: getSetting("dropbox_last_skipped"),
    lastRevokeWarning: getSetting("dropbox_last_revoke_warning"),
    exportEnabled: dropboxExportEnabled(),
    exportPath: dropboxExportPath(),
    exportLastAt: getSetting("dropbox_export_last_at"),
    exportLastError: getSetting("dropbox_export_last_error"),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// OAuth helpers — exchange a one-time authorization code for a long-lived
// refresh token, and mint short-lived access tokens on demand.
// ───────────────────────────────────────────────────────────────────────────

export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.DROPBOX_APP_KEY || "",
    response_type: "code",
    redirect_uri: redirectUri,
    // offline = include refresh_token in the token response so we don't have
    // to re-authorise every 4 hours when the access_token expires.
    token_access_type: "offline",
    state,
  });
  return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ refresh_token: string; access_token: string; account_id?: string }> {
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    client_id: process.env.DROPBOX_APP_KEY || "",
    client_secret: process.env.DROPBOX_APP_SECRET || "",
  });
  const resp = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!resp.ok) {
    // Token-endpoint errors never include the raw response body — that body
    // could echo client_secret or the authorization code in some failure
    // modes. Persist a generic, status-coded message instead.
    throw new Error(safeDropboxError("token", resp.status));
  }
  return (await resp.json()) as {
    refresh_token: string;
    access_token: string;
    account_id?: string;
  };
}

// Access tokens last ~4 hours; we cache in-memory to skip the refresh dance
// on every sweep. The cache is best-effort — a process restart re-mints.
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt - now > 60_000) {
    return cachedAccessToken.token;
  }
  const refresh = getSetting("dropbox_refresh_token");
  if (!refresh) throw new Error("Dropbox not connected");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refresh,
    client_id: process.env.DROPBOX_APP_KEY || "",
    client_secret: process.env.DROPBOX_APP_SECRET || "",
  });
  const resp = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!resp.ok) {
    throw new Error(safeDropboxError("token", resp.status));
  }
  const data = (await resp.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: now + Math.max(60_000, data.expires_in * 1000),
  };
  return data.access_token;
}

// Best-effort Dropbox-side token revocation. Returns a structured result so
// the caller can record a warning when revoke fails, but NEVER blocks local
// state clearing — that's the user's escape hatch when Dropbox is down.
async function revokeAccessTokenAtDropbox(token: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const resp = await fetch(
      "https://api.dropboxapi.com/2/auth/token/revoke",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (resp.ok) return { ok: true };
    return { ok: false, error: safeDropboxError("file", resp.status) };
  } catch (e) {
    return { ok: false, error: `Network error during revoke: ${(e as Error).message.slice(0, 120)}` };
  }
}

export async function fetchAccountDisplayName(): Promise<string | null> {
  try {
    const token = await getAccessToken();
    const resp = await fetch(
      "https://api.dropboxapi.com/2/users/get_current_account",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      name?: { display_name?: string };
      email?: string;
    };
    return data.name?.display_name || data.email || null;
  } catch {
    return null;
  }
}

/**
 * Disconnect. Tries to revoke the token at Dropbox first (best-effort) so a
 * leaked credential elsewhere doesn't outlive the user's intent — but ALWAYS
 * clears local state regardless of the revoke outcome. That guarantees the
 * user can stop this app from polling even when Dropbox is down or the
 * cached token is already invalid. If revoke failed, the failure is recorded
 * in `dropbox_last_revoke_warning` and surfaced on the Memory page so the
 * user can manually revoke from dropbox.com/account/connected_apps.
 */
export async function disconnectDropbox(): Promise<{
  revoked: boolean;
  revokeWarning: string | null;
}> {
  let revoked = false;
  let revokeWarning: string | null = null;
  // Reach for whatever access token we have — cached is fine. If we don't
  // have one and can't refresh (no creds, etc), skip cleanly; local clearing
  // happens regardless.
  try {
    const token = await getAccessToken();
    const result = await revokeAccessTokenAtDropbox(token);
    revoked = result.ok;
    if (!result.ok) {
      revokeWarning =
        result.error ||
        "Dropbox token revocation failed. You can manually revoke from dropbox.com/account/connected_apps.";
    }
  } catch (e) {
    revokeWarning = `Could not reach Dropbox to revoke: ${(e as Error).message.slice(0, 120)}. Local disconnect proceeding anyway.`;
  }
  // ALWAYS clear local state. This is the user's hard escape hatch.
  clearSetting("dropbox_refresh_token");
  clearSetting("dropbox_account_name");
  clearSetting("dropbox_last_sync_at");
  clearSetting("dropbox_last_attempt_at");
  clearSetting("dropbox_last_error");
  clearSetting("dropbox_last_seen_file_count");
  clearSetting("dropbox_last_skipped");
  if (revokeWarning) {
    setSetting("dropbox_last_revoke_warning", revokeWarning);
  } else {
    clearSetting("dropbox_last_revoke_warning");
  }
  cachedAccessToken = null;
  return { revoked, revokeWarning };
}

// ───────────────────────────────────────────────────────────────────────────
// Watcher — list the ingest folder, ingest any PDF whose Dropbox file id
// we haven't seen before. Bounded, idempotent, best-effort.
// ───────────────────────────────────────────────────────────────────────────

type DropboxFile = {
  ".tag": "file";
  id: string;
  name: string;
  path_lower: string;
  size: number;
};

// Custom error carrying enough structured info that the outer loop can
// decide whether to abort the whole poll (auth/rate-limit/transient) or
// continue past a single bad file.
class DropboxApiError extends Error {
  readonly status: number;
  readonly kind: DropboxErrorKind;
  constructor(status: number, errorSummary?: string) {
    super(safeDropboxError("file", status, errorSummary));
    this.status = status;
    this.kind = classifyDropboxError(status, errorSummary);
  }
}

async function parseErrorSummary(resp: Response): Promise<string | undefined> {
  // Dropbox returns JSON like { error_summary: "path/not_found/.", error: {...} }
  // for file-level errors. We only want the .error_summary; never the
  // surrounding body (which can contain user paths but for token endpoints
  // could in principle echo headers).
  try {
    const text = await resp.text();
    if (!text) return undefined;
    const data = JSON.parse(text) as { error_summary?: string };
    if (typeof data.error_summary === "string") return data.error_summary;
  } catch {
    // not JSON — fine, no summary available
  }
  return undefined;
}

async function listFolder(folder: string): Promise<DropboxFile[]> {
  const token = await getAccessToken();
  const out: DropboxFile[] = [];
  let cursor: string | null = null;
  do {
    const url: string = cursor
      ? "https://api.dropboxapi.com/2/files/list_folder/continue"
      : "https://api.dropboxapi.com/2/files/list_folder";
    const body = cursor
      ? { cursor }
      : { path: folder, recursive: false, include_deleted: false };
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const summary = await parseErrorSummary(resp);
      throw new DropboxApiError(resp.status, summary);
    }
    const data = (await resp.json()) as {
      entries: Array<DropboxFile | { ".tag": string }>;
      cursor?: string;
      has_more?: boolean;
    };
    for (const e of data.entries) {
      if (e[".tag"] === "file") out.push(e as DropboxFile);
    }
    cursor = data.has_more ? data.cursor || null : null;
  } while (cursor);
  return out;
}

async function downloadFile(path: string): Promise<Uint8Array> {
  const token = await getAccessToken();
  const resp = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path }),
    },
  });
  if (!resp.ok) {
    // For the download endpoint Dropbox puts the error summary in a
    // Dropbox-API-Result header (since the body is the file content) but on
    // failure it usually echoes the JSON in the body. Try both.
    let summary: string | undefined;
    const hdr = resp.headers.get("dropbox-api-result");
    if (hdr) {
      try {
        const parsed = JSON.parse(hdr) as { error_summary?: string };
        summary = parsed.error_summary;
      } catch {
        // ignore
      }
    }
    if (!summary) summary = await parseErrorSummary(resp);
    throw new DropboxApiError(resp.status, summary);
  }
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}

// Upload (overwrite) a UTF-8 text file to Dropbox. Requires the
// files.content.write scope — a scope the app does NOT request by default
// (least privilege). If the user hasn't enabled it in the Dropbox app
// console + reconnected, Dropbox returns 401 with a missing-scope summary,
// which maybeExportDiaryToDropbox turns into an actionable message.
async function uploadTextFile(dropboxPath: string, contents: string): Promise<void> {
  const token = await getAccessToken();
  const resp = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({
        path: dropboxPath,
        mode: "overwrite",
        mute: true,
        autorename: false,
      }),
      "Content-Type": "application/octet-stream",
    },
    // A JS string body is sent as UTF-8 — correct for Korean/English text.
    body: contents,
  });
  if (!resp.ok) {
    const summary = await parseErrorSummary(resp);
    throw new DropboxApiError(resp.status, summary);
  }
}

let exportInFlight = false;

export type DiaryExportResult = {
  ok: boolean;
  skipped?: "disabled" | "not-connected" | "in-flight";
  error?: string;
};

/**
 * Regenerate the diary Markdown and write it back into Dropbox (overwrite).
 * Opt-in (dropbox_export_enabled) and best-effort — never throws, so it
 * can't break the ingest/OCR pipeline it's fired from. On a missing-scope
 * failure it records an actionable message pointing at the fix.
 */
export async function maybeExportDiaryToDropbox(): Promise<DiaryExportResult> {
  if (!dropboxExportEnabled()) return { ok: false, skipped: "disabled" };
  if (!dropboxConnected()) return { ok: false, skipped: "not-connected" };
  if (exportInFlight) return { ok: false, skipped: "in-flight" };
  exportInFlight = true;
  try {
    const md = renderDiaryMarkdown();
    await uploadTextFile(dropboxExportPath(), md);
    setSetting("dropbox_export_last_at", new Date().toISOString());
    clearSetting("dropbox_export_last_error");
    return { ok: true };
  } catch (e) {
    const msg = friendlyExportError(e);
    setSetting("dropbox_export_last_error", msg);
    console.warn("[dropbox] diary export failed:", msg);
    return { ok: false, error: msg };
  } finally {
    exportInFlight = false;
  }
}

// Turn an upload failure into a message the user can act on. The common one
// is a missing write scope (401 with a scope summary) — spell out the fix.
function friendlyExportError(e: unknown): string {
  if (e instanceof DropboxApiError) {
    // kind === "auth" covers 401/403 (the missing-scope case); also match a
    // "scope" summary embedded in the message defensively.
    if (e.kind === "auth" || /scope/i.test(e.message)) {
      return (
        "Dropbox refused the write (needs the files.content.write scope). " +
        "In the Dropbox app console → Permissions, enable files.content.write, " +
        "then Disconnect + Connect Dropbox again."
      );
    }
    // e.message is already the sanitised safeDropboxError string.
    return e.message;
  }
  return `Diary export failed: ${(e as Error).message.slice(0, 120)}`;
}

let ingestInFlight = false;

/**
 * Poll the ingest folder for new PDFs and feed them into the OCR pipeline.
 * Safe to call repeatedly:
 *   * No-op if not connected, or if a prior sweep is still running.
 *   * Skips if we polled within POLL_INTERVAL_MS, or if the last attempt
 *     failed and we're inside POLL_FAILURE_BACKOFF_MS.
 *   * Per-sweep cap of MAX_INGEST_PER_SWEEP so a freshly-connected account
 *     with hundreds of files doesn't trigger hundreds of Claude jobs at once.
 *   * Dedup on the Dropbox file `id` (a stable, rename-survivable handle),
 *     stored on the notebook row.
 */
export async function maybeIngestDropbox(): Promise<{
  attempted: boolean;
  ingested?: number;
  skipped?: string;
  error?: string;
}> {
  if (!dropboxConnected()) return { attempted: false, skipped: "not-connected" };
  if (ingestInFlight) return { attempted: false, skipped: "in-flight" };
  const now = Date.now();
  const lastSync = Date.parse(getSetting("dropbox_last_sync_at") || "");
  if (Number.isFinite(lastSync) && now - lastSync < POLL_INTERVAL_MS) {
    return { attempted: false, skipped: "interval" };
  }
  const lastAttempt = Date.parse(getSetting("dropbox_last_attempt_at") || "");
  const lastError = getSetting("dropbox_last_error");
  if (
    lastError &&
    Number.isFinite(lastAttempt) &&
    now - lastAttempt < POLL_FAILURE_BACKOFF_MS
  ) {
    return { attempted: false, skipped: "backoff" };
  }

  ingestInFlight = true;
  setSetting("dropbox_last_attempt_at", new Date().toISOString());
  // Bookkeeping for the visible "what got skipped" summary. Bounded to a few
  // names so this can't grow unbounded in the settings table.
  const skips: string[] = [];
  const noteSkip = (name: string, reason: string) => {
    if (skips.length < 8) skips.push(`${name}: ${reason}`);
  };
  try {
    const folder = ingestFolder();
    // listFolder throws DropboxApiError on any failure — auth, rate-limit,
    // transient, anything. That throw propagates to the outer catch where it
    // records dropbox_last_error and engages backoff. That's the fix to the
    // "401 mid-poll looked like a green success" bug Codex caught.
    const files = await listFolder(folder);
    setSetting("dropbox_last_seen_file_count", String(files.length));
    if (files.length > FOLDER_SIZE_WARN) {
      console.warn(
        `[dropbox] ${folder} has ${files.length} files (>${FOLDER_SIZE_WARN}). Full-list polling is intentional at this scale; consider cursor-based polling when this exceeds ~2000.`
      );
    }

    // Only PDFs, alphabetic order so the on-disk order mirrors the order
    // written. Apply the size guard BEFORE downloading so an oversized file
    // never costs bandwidth or OCR.
    const pdfs = files
      .filter((f) => {
        if (!f.name.toLowerCase().endsWith(".pdf")) return false;
        if (f.size > MAX_UPLOAD_BYTES) {
          noteSkip(f.name, `too large (${Math.round(f.size / 1024 / 1024)}MB > 20MB)`);
          return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const seenIds = new Set(
      (
        db()
          .prepare(`SELECT dropbox_file_id FROM notebooks WHERE dropbox_file_id IS NOT NULL`)
          .all() as Array<{ dropbox_file_id: string }>
      ).map((r) => r.dropbox_file_id)
    );

    const ocrCap = ocrConcurrencyLimit();
    let ingested = 0;
    for (const f of pdfs) {
      if (seenIds.has(f.id)) continue;
      if (ingested >= MAX_INGEST_PER_SWEEP) break;

      // Shared OCR budget — counts ALL notebooks with status='processing'
      // (manual uploads + previous Dropbox ingests), not just this poll's.
      // When the budget is full we stop starting new ones; the next sweep
      // picks them up. Safe from deadlock because the startup migration
      // resets stale 'processing' rows to 'error'.
      if (processingNotebookCount() >= ocrCap) {
        break;
      }

      try {
        const bytes = await downloadFile(f.path_lower);
        // Belt-and-braces: the metadata size guard is the main gate, but
        // verify the actual bytes didn't somehow arrive larger, and verify
        // the magic bytes — protects against a file with a .pdf extension
        // that isn't actually a PDF.
        if (bytes.length > MAX_UPLOAD_BYTES) {
          noteSkip(f.name, `download exceeded size cap`);
          continue;
        }
        if (!looksLikePdf(bytes)) {
          noteSkip(f.name, `not a valid PDF (bad magic bytes)`);
          continue;
        }
        const nb = createNotebook(f.name, bytes);
        // Stamp the Dropbox id so future sweeps skip this file even if the
        // user renames it on the device.
        db()
          .prepare(`UPDATE notebooks SET dropbox_file_id = ? WHERE id = ?`)
          .run(f.id, nb.id);
        // Fire-and-forget OCR — same as manual upload. The concurrency gate
        // above is what bounds how many of these run at once.
        void processNotebook(nb.id).catch(() => {});
        ingested++;
      } catch (e) {
        // The only errors we silently continue past are file-local ones
        // (per-file 404, malformed path, etc). Auth/rate-limit/transient
        // errors propagate to the outer catch so the failure is visible AND
        // engages backoff — that's the core of Codex's "systemic failure
        // masquerading as success" fix.
        if (e instanceof DropboxApiError && !isPollLevelError(e.kind)) {
          noteSkip(f.name, e.message);
          continue;
        }
        throw e;
      }
    }

    if (skips.length > 0) {
      setSetting("dropbox_last_skipped", skips.join("; ").slice(0, 500));
    } else {
      clearSetting("dropbox_last_skipped");
    }
    setSetting("dropbox_last_sync_at", new Date().toISOString());
    clearSetting("dropbox_last_error");
    return { attempted: true, ingested };
  } catch (e) {
    // Record the structured error if available — otherwise generic.
    const msg =
      e instanceof DropboxApiError
        ? e.message
        : `Dropbox poll failed: ${(e as Error).message.slice(0, 200)}`;
    setSetting("dropbox_last_error", msg.slice(0, 500));
    if (skips.length > 0) {
      setSetting("dropbox_last_skipped", skips.join("; ").slice(0, 500));
    }
    return { attempted: true, error: msg };
  } finally {
    ingestInFlight = false;
  }
}
