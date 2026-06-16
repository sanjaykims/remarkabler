import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Disconnect's core property — explicitly insisted on by Codex — is that
// LOCAL STATE IS ALWAYS CLEARED, regardless of whether the Dropbox revoke
// call succeeded. This is the user's hard escape hatch: even if Dropbox is
// down or the cached token is invalid, the user must be able to stop this
// app from polling. Revoke failure is surfaced as a warning, not a blocker.

type DbMod = typeof import("@/lib/db");
type DropboxMod = typeof import("@/lib/dropbox");

let dbMod: DbMod;
let dropboxMod: DropboxMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "dropbox-disc-"));
  // No DROPBOX_APP_KEY/SECRET set — that means getAccessToken() will throw
  // "Dropbox not connected" in the disconnect path, which simulates the
  // exact failure mode we care about: revoke can't even start, but local
  // clearing must still happen.
  dbMod = await import("@/lib/db");
  dropboxMod = await import("@/lib/dropbox");

  // Seed a refresh token + bookkeeping so we can prove they get cleared.
  const conn = dbMod.db();
  const upsert = conn.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  upsert.run("dropbox_refresh_token", "some-refresh-token");
  upsert.run("dropbox_account_name", "Test User");
  upsert.run("dropbox_last_sync_at", new Date().toISOString());
  upsert.run("dropbox_last_attempt_at", new Date().toISOString());
});

describe("disconnectDropbox", () => {
  it("clears local state even when Dropbox revoke can't be attempted", async () => {
    // Sanity check: state is present before disconnect.
    expect(dbMod.getSetting("dropbox_refresh_token")).toBe("some-refresh-token");
    expect(dbMod.getSetting("dropbox_account_name")).toBe("Test User");

    const result = await dropboxMod.disconnectDropbox();

    // Local state — gone regardless of revoke outcome. This is the
    // property under test.
    expect(dbMod.getSetting("dropbox_refresh_token")).toBeNull();
    expect(dbMod.getSetting("dropbox_account_name")).toBeNull();
    expect(dbMod.getSetting("dropbox_last_sync_at")).toBeNull();
    expect(dbMod.getSetting("dropbox_last_attempt_at")).toBeNull();

    // Revoke could not be performed (no app credentials in env, no cached
    // token). disconnectDropbox should report that and stash a warning the
    // UI can surface.
    expect(result.revoked).toBe(false);
    expect(result.revokeWarning).toBeTruthy();
    expect(dbMod.getSetting("dropbox_last_revoke_warning")).toBeTruthy();
  });
});
