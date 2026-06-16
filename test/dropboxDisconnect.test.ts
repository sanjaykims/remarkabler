import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Disconnect's core property — explicitly insisted on by Codex — is that
// LOCAL STATE IS ALWAYS CLEARED, regardless of whether the Dropbox revoke
// call succeeded. This is the user's hard escape hatch: even if Dropbox is
// down or the cached token is invalid, the user must be able to stop this
// app from polling. Revoke failure is surfaced as a warning, not a blocker.
//
// `fetch` is mocked so this test never touches the real Dropbox API even
// if a future refactor changes the order in which the token-refresh path
// short-circuits. The original test only avoided the network by accident
// (getAccessToken throws before revoke is attempted), which Codex flagged
// as a future-fragility risk.

type DbMod = typeof import("@/lib/db");
type DropboxMod = typeof import("@/lib/dropbox");

let dbMod: DbMod;
let dropboxMod: DropboxMod;
const originalFetch = globalThis.fetch;
// Save env vars at module load so afterEach can restore them. Vitest's
// worker isolation usually makes this redundant, but explicit restoration
// matches the pattern in dropboxBaseUrl.test.ts and survives changes to
// test ordering or --no-isolate runs.
const originalAppKey = process.env.DROPBOX_APP_KEY;
const originalAppSecret = process.env.DROPBOX_APP_SECRET;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "dropbox-disc-"));
  dbMod = await import("@/lib/db");
  dropboxMod = await import("@/lib/dropbox");
});

beforeEach(() => {
  // Default: any unexpected network call fails loudly.
  globalThis.fetch = vi.fn(async () => {
    throw new Error("Unexpected network call in test");
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalAppKey === undefined) delete process.env.DROPBOX_APP_KEY;
  else process.env.DROPBOX_APP_KEY = originalAppKey;
  if (originalAppSecret === undefined) delete process.env.DROPBOX_APP_SECRET;
  else process.env.DROPBOX_APP_SECRET = originalAppSecret;
});

function seed(values: Record<string, string>) {
  const conn = dbMod.db();
  const upsert = conn.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  for (const [k, v] of Object.entries(values)) upsert.run(k, v);
}

describe("disconnectDropbox", () => {
  it("clears local state even when Dropbox revoke can't be attempted (no credentials)", async () => {
    // No DROPBOX_APP_KEY/SECRET → the refresh attempt sends an empty
    // client_id, which the throwing default-mock fetch turns into an
    // error inside getAccessToken(). The point isn't that fetch is
    // unreachable — it's that the safety net catches whatever happens,
    // and local state is cleared regardless.
    delete process.env.DROPBOX_APP_KEY;
    delete process.env.DROPBOX_APP_SECRET;
    seed({
      dropbox_refresh_token: "rt-1",
      dropbox_account_name: "Test User",
      dropbox_last_sync_at: new Date().toISOString(),
      dropbox_last_attempt_at: new Date().toISOString(),
    });

    const result = await dropboxMod.disconnectDropbox();

    expect(dbMod.getSetting("dropbox_refresh_token")).toBeNull();
    expect(dbMod.getSetting("dropbox_account_name")).toBeNull();
    expect(dbMod.getSetting("dropbox_last_sync_at")).toBeNull();
    expect(dbMod.getSetting("dropbox_last_attempt_at")).toBeNull();

    expect(result.revoked).toBe(false);
    expect(result.revokeWarning).toBeTruthy();
    expect(dbMod.getSetting("dropbox_last_revoke_warning")).toBeTruthy();
    // The throwing default mock means any network attempt routes into the
    // disconnect's outer catch and produces the warning above — exactly
    // the path we want when credentials are missing.
  });

  it("clears local state when Dropbox revoke endpoint returns an error", async () => {
    process.env.DROPBOX_APP_KEY = "test_key";
    process.env.DROPBOX_APP_SECRET = "test_secret";
    seed({
      dropbox_refresh_token: "rt-2",
      dropbox_account_name: "Test User 2",
    });

    // Mock: refresh returns a fresh access token, revoke returns 401.
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/oauth2/token")) {
        return new Response(
          JSON.stringify({ access_token: "fresh", expires_in: 14400 }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.includes("/2/auth/token/revoke")) {
        return new Response("", { status: 401 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    }) as unknown as typeof fetch;

    const result = await dropboxMod.disconnectDropbox();

    // Local clearing is non-negotiable.
    expect(dbMod.getSetting("dropbox_refresh_token")).toBeNull();
    expect(dbMod.getSetting("dropbox_account_name")).toBeNull();
    // Revoke failure surfaced as a warning.
    expect(result.revoked).toBe(false);
    expect(result.revokeWarning).toBeTruthy();
    expect(dbMod.getSetting("dropbox_last_revoke_warning")).toBeTruthy();
  });

  it("clears local state AND records no warning on a successful revoke", async () => {
    process.env.DROPBOX_APP_KEY = "test_key";
    process.env.DROPBOX_APP_SECRET = "test_secret";
    seed({
      dropbox_refresh_token: "rt-3",
      dropbox_account_name: "Test User 3",
    });

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/oauth2/token")) {
        return new Response(
          JSON.stringify({ access_token: "fresh", expires_in: 14400 }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.includes("/2/auth/token/revoke")) {
        return new Response("", { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    }) as unknown as typeof fetch;

    const result = await dropboxMod.disconnectDropbox();

    expect(dbMod.getSetting("dropbox_refresh_token")).toBeNull();
    expect(result.revoked).toBe(true);
    expect(result.revokeWarning).toBeNull();
    expect(dbMod.getSetting("dropbox_last_revoke_warning")).toBeNull();
  });
});
