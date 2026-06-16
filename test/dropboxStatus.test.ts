import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// Codex's verification pass flagged that the previous
//   `seenCount ? Number(seenCount) || null : null`
// expression collapsed a stored "0" to null via the `||` falsey coercion —
// so an empty Dropbox folder appeared as "never polled" in the UI rather
// than "0 files". This locks the fix.

type DbMod = typeof import("@/lib/db");
type DropboxMod = typeof import("@/lib/dropbox");

let dbMod: DbMod;
let dropboxMod: DropboxMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "dropbox-status-"));
  dbMod = await import("@/lib/db");
  dropboxMod = await import("@/lib/dropbox");
});

function setSeen(value: string | null) {
  const conn = dbMod.db();
  if (value === null) {
    conn.prepare(`DELETE FROM settings WHERE key = ?`).run(
      "dropbox_last_seen_file_count"
    );
  } else {
    conn
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run("dropbox_last_seen_file_count", value);
  }
}

describe("dropboxStatus().lastSeenFileCount", () => {
  it("preserves 0 (empty folder is an informative state, not 'never polled')", () => {
    setSeen("0");
    expect(dropboxMod.dropboxStatus().lastSeenFileCount).toBe(0);
  });

  it("returns the parsed integer for typical positive counts", () => {
    setSeen("42");
    expect(dropboxMod.dropboxStatus().lastSeenFileCount).toBe(42);
  });

  it("returns null when the setting is absent (never polled yet)", () => {
    setSeen(null);
    expect(dropboxMod.dropboxStatus().lastSeenFileCount).toBeNull();
  });

  it("returns null when the stored value isn't a finite number", () => {
    setSeen("not-a-number");
    expect(dropboxMod.dropboxStatus().lastSeenFileCount).toBeNull();
  });
});
