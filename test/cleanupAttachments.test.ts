import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, existsSync, utimesSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// The chat route writes an attachment file BEFORE inserting its
// chat_attachments row (mid-request), and runMaintenanceSweep() runs between.
// The orphan-file cleanup must therefore keep files newer than a grace window,
// or it would delete a just-uploaded attachment before its row lands (P1).

type DbMod = typeof import("@/lib/db");
type CleanupMod = typeof import("@/lib/cleanup");

let dbMod: DbMod;
let cleanupMod: CleanupMod;
let attachDir: string;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "cleanup-att-"));
  dbMod = await import("@/lib/db");
  cleanupMod = await import("@/lib/cleanup");
  dbMod.db();
  attachDir = path.join(process.env.DATA_DIR as string, "chat-attachments");
  mkdirSync(attachDir, { recursive: true });
});

beforeEach(() => {
  const d = dbMod.db();
  d.prepare(`DELETE FROM chat_attachments`).run();
  d.prepare(`DELETE FROM chat_messages`).run();
});

function writeFresh(name: string) {
  writeFileSync(path.join(attachDir, name), "x");
}
function writeOld(name: string) {
  const p = path.join(attachDir, name);
  writeFileSync(p, "x");
  const old = Date.now() / 1000 - 3600; // 1 hour ago (past the 30-min grace)
  utimesSync(p, old, old);
}

describe("cleanupOrphanChatAttachments — grace period (P1)", () => {
  it("keeps a fresh unreferenced file (its row may still be in flight)", () => {
    writeFresh("fresh.png");
    const res = cleanupMod.cleanupOrphanChatAttachments();
    expect(existsSync(path.join(attachDir, "fresh.png"))).toBe(true);
    expect(res.strayFiles).toBe(0);
  });

  it("deletes an old unreferenced file", () => {
    writeOld("old.png");
    const res = cleanupMod.cleanupOrphanChatAttachments();
    expect(existsSync(path.join(attachDir, "old.png"))).toBe(false);
    expect(res.strayFiles).toBe(1);
  });

  it("keeps a referenced file even if old", () => {
    const d = dbMod.db();
    const info = d
      .prepare(
        `INSERT INTO chat_messages(conversation_id, role, content) VALUES('c1','user','hi')`
      )
      .run();
    d.prepare(
      `INSERT INTO chat_attachments(message_id, kind, filename, mime, path)
       VALUES(?, 'image', 'ref.png', 'image/png', 'ref.png')`
    ).run(info.lastInsertRowid);
    writeOld("ref.png"); // old, but referenced
    cleanupMod.cleanupOrphanChatAttachments();
    expect(existsSync(path.join(attachDir, "ref.png"))).toBe(true);
  });
});
