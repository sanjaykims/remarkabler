import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import Database from "better-sqlite3";
import { db, DATA_DIR, getSetting, setSetting, clearSetting } from "./db";

// Settings keys whose values must NEVER leave Railway in a backup. The
// staged DB copy gets these rows deleted before tar/push; the live DB is
// untouched.
//
// dropbox_refresh_token  : long-lived credential — granting future Dropbox
//                          read access if exfiltrated from the backup repo.
// dropbox_oauth_state    : (legacy — now cookie-based, but redact anyway in
//                          case any old row survives a migration).
// dropbox_oauth_redirect : same legacy reason.
// dropbox_last_error     : Dropbox error text passes through safeDropboxError
//                          before persistence, but redact defensively — any
//                          future code path that bypasses the helper would
//                          land sensitive text here.
const SENSITIVE_SETTING_KEYS = [
  "dropbox_refresh_token",
  "dropbox_oauth_state",
  "dropbox_oauth_redirect",
  "dropbox_last_error",
];

export function redactSensitiveSettings(stagedDbPath: string): void {
  // Open the staged copy with a SEPARATE Database handle so we can't
  // accidentally mutate the live DB. The live one is owned by lib/db.ts.
  const staged = new Database(stagedDbPath);
  try {
    const del = staged.prepare(`DELETE FROM settings WHERE key = ?`);
    const tx = staged.transaction((keys: string[]) => {
      for (const k of keys) del.run(k);
    });
    tx(SENSITIVE_SETTING_KEYS);
  } finally {
    staged.close();
  }
}

// Auto-backup to a user-owned private GitHub repo. The whole DATA_DIR
// (SQLite database + uploaded PDFs + chat attachments) is bundled into a
// single date-stamped tar.gz and pushed via GitHub's REST API. The repo
// belongs to the user, the token only has write access to that one repo,
// so this is the smallest reasonable surface for off-site durability.

const BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // ~weekly
// When an automatic backup FAILS (revoked token, oversized tarball, network
// policy change…), back off before the maintenance sweep retries. Without
// this, a persistently-failing backup retries on every sweep — and the sweep
// runs every ~5 minutes — burning CPU, API calls, and filling the logs. Six
// hours is long enough to stop the loop but short enough that a transient
// outage still recovers the same day. Manual "Backup now" ignores this and
// retries immediately.
const BACKUP_FAILURE_BACKOFF_MS = 6 * 60 * 60 * 1000; // 6 hours
// Keep the last N snapshots in the repo. Older ones are pruned via the
// GitHub API after each successful backup, so the repo never balloons
// indefinitely. 12 ≈ 3 months of weekly snapshots — plenty to roll back
// from any single bad week.
const BACKUPS_TO_KEEP = 12;
let runningBackup = false;

export function backupConfigured(): boolean {
  return !!(process.env.BACKUP_REPO && process.env.BACKUP_GITHUB_TOKEN);
}

export type BackupStatus = {
  configured: boolean;
  repo: string | null;
  lastAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  lastSizeBytes: number | null;
};

export function backupStatus(): BackupStatus {
  const sizeStr = getSetting("backup_last_size_bytes");
  return {
    configured: backupConfigured(),
    repo: process.env.BACKUP_REPO || null,
    lastAt: getSetting("backup_last_at"),
    lastAttemptAt: getSetting("backup_last_attempt_at"),
    lastError: getSetting("backup_last_error"),
    lastSizeBytes: sizeStr ? Number(sizeStr) || null : null,
  };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function stampNow(): string {
  const d = new Date();
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

type RepoFile = { name: string; sha: string; path: string; type?: string };

async function listBackups(): Promise<RepoFile[]> {
  const repo = process.env.BACKUP_REPO;
  const token = process.env.BACKUP_GITHUB_TOKEN;
  if (!repo || !token) return [];
  const url = `https://api.github.com/repos/${repo}/contents/backups`;
  try {
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (resp.status === 404) return []; // backups/ doesn't exist yet
    if (!resp.ok) return [];
    const data = (await resp.json()) as RepoFile[];
    return data
      .filter((f) => f.type === "file" && f.name.endsWith(".tar.gz"))
      .sort((a, b) => a.name.localeCompare(b.name)); // oldest first
  } catch {
    return [];
  }
}

async function deleteBackupFile(
  path: string,
  sha: string,
  commitMessage: string
): Promise<void> {
  const repo = process.env.BACKUP_REPO;
  const token = process.env.BACKUP_GITHUB_TOKEN;
  if (!repo || !token) return;
  const url = `https://api.github.com/repos/${repo}/contents/${path}`;
  const resp = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ message: commitMessage, sha }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Delete failed (${resp.status}): ${text.slice(0, 200)}`);
  }
}

async function pruneOldBackups(): Promise<number> {
  const all = await listBackups();
  if (all.length <= BACKUPS_TO_KEEP) return 0;
  const toDelete = all.slice(0, all.length - BACKUPS_TO_KEEP);
  let deleted = 0;
  for (const f of toDelete) {
    try {
      await deleteBackupFile(f.path, f.sha, `Prune old backup ${f.name}`);
      deleted++;
    } catch {
      // best-effort; skip this one and try the rest
    }
  }
  return deleted;
}

async function pushToGithub(
  content: Buffer,
  repoPath: string,
  commitMessage: string
): Promise<void> {
  const repo = process.env.BACKUP_REPO;
  const token = process.env.BACKUP_GITHUB_TOKEN;
  if (!repo || !token) throw new Error("Backup env vars not set");

  const apiBase = `https://api.github.com/repos/${repo}/contents/${repoPath}`;

  // If the file already exists at that path (e.g., manual retry with the
  // same timestamp), GitHub requires the existing SHA for the update.
  let existingSha: string | undefined;
  try {
    const head = await fetch(apiBase, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (head.ok) {
      const data = (await head.json()) as { sha?: string };
      existingSha = data.sha;
    }
  } catch {
    // ignore — assume not present
  }

  const resp = await fetch(apiBase, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      message: commitMessage,
      content: content.toString("base64"),
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `GitHub upload failed (${resp.status}): ${text.slice(0, 200)}`
    );
  }
}

/**
 * Build a tar.gz of DATA_DIR (clean SQLite copy + PDFs + chat attachments)
 * and push it to the configured GitHub repo. Returns the byte size of the
 * uploaded archive.
 */
export async function runBackup(): Promise<number> {
  if (!backupConfigured()) {
    throw new Error("Backup is not configured. Set BACKUP_REPO and BACKUP_GITHUB_TOKEN in Railway.");
  }
  const stamp = stampNow();
  const stagingDir = `/tmp/remarkabler-backup-staging-${stamp}`;
  const tarPath = `/tmp/remarkabler-backup-${stamp}.tar.gz`;
  fs.mkdirSync(stagingDir, { recursive: true });

  try {
    // 1. Clean SQLite copy via the online backup API — safe even mid-write.
    const dbCopyPath = path.join(stagingDir, "app.db");
    // better-sqlite3's backup() returns a Promise.
    await (db() as any).backup(dbCopyPath);

    // 1a. Redact sensitive settings from the STAGED copy only — never touch
    // the live DB. This is what stops the Dropbox refresh token (and any
    // transient OAuth state) from travelling to the off-site GitHub backup
    // repo with the rest of the diary data. Restore-from-backup users will
    // re-connect Dropbox after restore; that's a feature, not a bug — the
    // backup is for diary durability, not credential durability.
    redactSensitiveSettings(dbCopyPath);

    // 2. Copy the PDF + attachment directories (use cp for symlink safety).
    const filesSrc = path.join(DATA_DIR, "files");
    if (fs.existsSync(filesSrc)) {
      execSync(`cp -r "${filesSrc}" "${stagingDir}/files"`, { stdio: "pipe" });
    }
    const attSrc = path.join(DATA_DIR, "chat-attachments");
    if (fs.existsSync(attSrc)) {
      execSync(`cp -r "${attSrc}" "${stagingDir}/chat-attachments"`, {
        stdio: "pipe",
      });
    }

    // 3. tar + gzip the whole staging directory.
    execSync(`tar czf "${tarPath}" -C "${stagingDir}" .`, { stdio: "pipe" });

    // 4. Read the archive and push to GitHub.
    const bytes = fs.readFileSync(tarPath);
    await pushToGithub(
      bytes,
      `backups/${stamp}.tar.gz`,
      `Backup ${stamp}`
    );

    // 5. Prune old snapshots (best-effort; never fails the backup).
    try {
      await pruneOldBackups();
    } catch {
      // ignore — keeping the new backup is what matters
    }

    return bytes.length;
  } finally {
    // Always clean up the staging area + the tarball.
    try {
      execSync(`rm -rf "${stagingDir}" "${tarPath}"`, { stdio: "pipe" });
    } catch {
      // best-effort
    }
  }
}

/**
 * Fire-and-forget weekly backup. If the configured backup hasn't run in
 * BACKUP_INTERVAL_MS (~7 days) or has never run, kicks off a backup in
 * the background. Safe to call from chat POST and dashboard render — most
 * calls are a single cheap DB read against settings.
 */
export function maybeRunWeeklyBackup(): void {
  if (runningBackup) return;
  if (!backupConfigured()) return;
  const now = Date.now();

  // Schedule gate: skip if a backup succeeded within the weekly interval.
  const last = getSetting("backup_last_at");
  if (last) {
    const lastAt = Date.parse(last);
    if (!Number.isNaN(lastAt) && now - lastAt < BACKUP_INTERVAL_MS) {
      return;
    }
  }

  // Backoff gate: skip if we attempted recently, regardless of outcome. This
  // is what stops a persistently-failing backup from retrying every 5-minute
  // sweep — the attempt timestamp is written below before the (possibly slow,
  // possibly failing) upload runs. After a SUCCESS the weekly gate above
  // dominates, so the backoff never delays the normal cadence.
  const lastAttempt = getSetting("backup_last_attempt_at");
  if (lastAttempt) {
    const attemptAt = Date.parse(lastAttempt);
    if (!Number.isNaN(attemptAt) && now - attemptAt < BACKUP_FAILURE_BACKOFF_MS) {
      return;
    }
  }

  runningBackup = true;
  // Record the attempt up-front so a crash or a slow failure mid-upload still
  // counts against the backoff window.
  setSetting("backup_last_attempt_at", new Date().toISOString());
  (async () => {
    try {
      const size = await runBackup();
      setSetting("backup_last_at", new Date().toISOString());
      setSetting("backup_last_size_bytes", String(size));
      clearSetting("backup_last_error");
    } catch (err) {
      setSetting("backup_last_error", (err as Error).message.slice(0, 500));
    } finally {
      runningBackup = false;
    }
  })();
}
