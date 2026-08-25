import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Backup redaction is a security boundary: the Dropbox refresh token (and
// any transient OAuth state) must not travel to the off-site GitHub backup
// repo. The redact step runs on the STAGED DB copy only — the live DB
// must remain untouched.

type DbMod = typeof import("@/lib/db");
type BackupMod = typeof import("@/lib/backup");

let dbMod: DbMod;
let backupMod: BackupMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "backup-redact-"));
  dbMod = await import("@/lib/db");
  backupMod = await import("@/lib/backup");

  // Seed the live DB with the sensitive rows so we can prove (a) the staged
  // copy is redacted and (b) the live DB still has them after redaction.
  const conn = dbMod.db();
  conn.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run("dropbox_refresh_token", "SECRET_REFRESH_TOKEN_xyz");
  conn.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run("dropbox_oauth_state", "stale-state");
  conn.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run("dropbox_oauth_redirect", "https://example.com/cb");
  conn.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run("dropbox_last_error", "Dropbox 401 (auth).");
  // The session-signing HMAC key — forging power over the whole app lock, so
  // it must be redacted from off-site backups (review finding).
  conn.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run("session_secret", "SUPER_SECRET_HMAC_KEY_abc");
  // Per-source brute-force buckets are keyed by sha256(client ip). SHA-256 of
  // an IPv4 is trivially enumerable, so shipping these off-site would disclose
  // the set of addresses that hit the login page (review finding).
  conn.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run("auth_fail_state:deadbeef", '{"count":3,"windowStart":1}');
  conn.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run("auth_fail_global", '{"count":9,"windowStart":1}');
  // Non-sensitive setting — should survive redaction.
  conn.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run("mind_dates_reparsed_v2", "yes");
});

describe("redactSensitiveSettings", () => {
  it("removes sensitive rows from the staged DB copy", async () => {
    const Database = (await import("better-sqlite3")).default;
    // Make a staged copy of the live DB and redact it.
    const stagedPath = path.join(process.env.DATA_DIR!, "staged.db");
    await (dbMod.db() as any).backup(stagedPath);
    backupMod.redactSensitiveSettings(stagedPath);

    // Open the staged copy with a separate handle and check.
    const staged = new Database(stagedPath, { readonly: true });
    try {
      const get = (k: string): string | undefined =>
        (
          staged
            .prepare(`SELECT value FROM settings WHERE key = ?`)
            .get(k) as { value: string } | undefined
        )?.value;
      expect(get("dropbox_refresh_token")).toBeUndefined();
      expect(get("dropbox_oauth_state")).toBeUndefined();
      expect(get("dropbox_oauth_redirect")).toBeUndefined();
      expect(get("dropbox_last_error")).toBeUndefined();
      // The session-forging HMAC key must not ship off-site.
      expect(get("session_secret")).toBeUndefined();
      // Nor may the brute-force buckets — the per-source ones need a PREFIX
      // delete, not an exact-key one, since the ip hash is part of the key.
      expect(get("auth_fail_state:deadbeef")).toBeUndefined();
      expect(get("auth_fail_global")).toBeUndefined();
      // Non-sensitive key still present.
      expect(get("mind_dates_reparsed_v2")).toBe("yes");
    } finally {
      staged.close();
    }
  });

  it("does NOT mutate the live DB — the live token still works after redaction", async () => {
    // After running redact on the staged copy above, the live DB should
    // still have the secrets. This is the property that lets the running
    // app keep polling Dropbox after a backup runs.
    const liveToken = dbMod.getSetting("dropbox_refresh_token");
    expect(liveToken).toBe("SECRET_REFRESH_TOKEN_xyz");
    const liveError = dbMod.getSetting("dropbox_last_error");
    expect(liveError).toBe("Dropbox 401 (auth).");
  });
});
