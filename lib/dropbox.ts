import {
  db,
  getSetting,
  setSetting,
  clearSetting,
} from "@/lib/db";
import { createNotebook, processNotebook } from "@/lib/notes";

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
// can't trigger hundreds of OCR jobs at once — the rest will be picked up
// on subsequent sweeps.
const MAX_INGEST_PER_SWEEP = 10;

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
};

export function dropboxStatus(): DropboxStatus {
  const countRow = db()
    .prepare(
      `SELECT COUNT(*) AS c FROM notebooks WHERE dropbox_file_id IS NOT NULL`
    )
    .get() as { c: number };
  return {
    configured: dropboxConfigured(),
    connected: dropboxConnected(),
    folder: ingestFolder(),
    account: getSetting("dropbox_account_name"),
    lastSyncAt: getSetting("dropbox_last_sync_at"),
    lastAttemptAt: getSetting("dropbox_last_attempt_at"),
    lastError: getSetting("dropbox_last_error"),
    ingestedCount: countRow.c,
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
    const text = await resp.text().catch(() => "");
    throw new Error(`Dropbox token exchange failed (${resp.status}): ${text.slice(0, 200)}`);
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
    const text = await resp.text().catch(() => "");
    throw new Error(`Dropbox refresh failed (${resp.status}): ${text.slice(0, 200)}`);
  }
  const data = (await resp.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: now + Math.max(60_000, data.expires_in * 1000),
  };
  return data.access_token;
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

export function disconnectDropbox(): void {
  clearSetting("dropbox_refresh_token");
  clearSetting("dropbox_account_name");
  clearSetting("dropbox_last_sync_at");
  clearSetting("dropbox_last_attempt_at");
  clearSetting("dropbox_last_error");
  cachedAccessToken = null;
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
      const text = await resp.text().catch(() => "");
      throw new Error(`Dropbox list_folder failed (${resp.status}): ${text.slice(0, 200)}`);
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
    const text = await resp.text().catch(() => "");
    throw new Error(`Dropbox download failed (${resp.status}): ${text.slice(0, 200)}`);
  }
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
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
  try {
    const folder = ingestFolder();
    const files = await listFolder(folder);
    // Only PDFs, only files we haven't seen, oldest-first so the order on
    // disk mirrors the order written.
    const pdfs = files
      .filter((f) => f.name.toLowerCase().endsWith(".pdf"))
      .sort((a, b) => a.name.localeCompare(b.name));

    const seenIds = new Set(
      (
        db()
          .prepare(`SELECT dropbox_file_id FROM notebooks WHERE dropbox_file_id IS NOT NULL`)
          .all() as Array<{ dropbox_file_id: string }>
      ).map((r) => r.dropbox_file_id)
    );

    let ingested = 0;
    for (const f of pdfs) {
      if (seenIds.has(f.id)) continue;
      if (ingested >= MAX_INGEST_PER_SWEEP) break;
      try {
        const bytes = await downloadFile(f.path_lower);
        const nb = createNotebook(f.name, bytes);
        // Stamp the Dropbox id so future sweeps skip this file even if the
        // user renames it on the device.
        db()
          .prepare(`UPDATE notebooks SET dropbox_file_id = ? WHERE id = ?`)
          .run(f.id, nb.id);
        // Same fire-and-forget pattern as the upload endpoint — OCR runs in
        // the background so the next file's download isn't blocked.
        void processNotebook(nb.id).catch(() => {});
        ingested++;
      } catch (e) {
        // One bad file shouldn't kill the rest of the sweep.
        console.warn(
          "[dropbox] ingest failed for",
          f.path_lower,
          (e as Error).message
        );
      }
    }

    setSetting("dropbox_last_sync_at", new Date().toISOString());
    clearSetting("dropbox_last_error");
    return { attempted: true, ingested };
  } catch (e) {
    const msg = (e as Error).message;
    setSetting("dropbox_last_error", msg.slice(0, 500));
    return { attempted: true, error: msg };
  } finally {
    ingestInFlight = false;
  }
}
