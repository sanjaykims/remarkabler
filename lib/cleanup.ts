import fs from "fs";
import path from "path";
import { db, DATA_DIR, getSetting, setSetting } from "./db";
import { parseSqliteUtc } from "./format";

const ATTACHMENT_DIR = path.join(DATA_DIR, "chat-attachments");
const DAY_MS = 24 * 60 * 60 * 1000;

let cleaningUpAttachments = false;

/**
 * Remove orphaned chat attachments. Two passes:
 *   1) Rows in chat_attachments whose message_id no longer exists in
 *      chat_messages — including the on-disk file the row pointed to. These
 *      can appear if chat_messages rows are ever hard-deleted (which doesn't
 *      happen today, but is the kind of future change worth being ready for).
 *   2) Files in DATA_DIR/chat-attachments/ that are referenced by no row at
 *      all. These can show up after a partial restore from backup, or if a
 *      previous deploy crashed between writing the file and inserting the row.
 *
 * Idempotent and safe to run alongside live writes — a brand-new attachment
 * is referenced by its row before the file is even written, so the
 * unreferenced-file sweep can't race against a fresh upload.
 *
 * Returns counts so a future status surface can show what was freed.
 */
export function cleanupOrphanChatAttachments(): {
  orphanRows: number;
  strayFiles: number;
  bytesFreed: number;
} {
  let orphanRows = 0;
  let strayFiles = 0;
  let bytesFreed = 0;

  // (1) Rows with no matching chat_messages row.
  const orphans = db()
    .prepare(
      `SELECT a.id, a.path FROM chat_attachments a
         LEFT JOIN chat_messages m ON m.id = a.message_id
       WHERE m.id IS NULL`
    )
    .all() as Array<{ id: number; path: string }>;

  if (orphans.length > 0) {
    const del = db().prepare(`DELETE FROM chat_attachments WHERE id = ?`);
    for (const o of orphans) {
      const fullPath = path.join(ATTACHMENT_DIR, o.path);
      try {
        const stat = fs.statSync(fullPath);
        bytesFreed += stat.size;
        fs.unlinkSync(fullPath);
      } catch {
        // file already gone — still drop the row
      }
      del.run(o.id);
    }
    orphanRows = orphans.length;
  }

  // (2) Files on disk that no row references.
  try {
    if (fs.existsSync(ATTACHMENT_DIR)) {
      const referenced = new Set(
        (
          db().prepare(`SELECT path FROM chat_attachments`).all() as Array<{
            path: string;
          }>
        ).map((r) => r.path)
      );
      for (const name of fs.readdirSync(ATTACHMENT_DIR)) {
        if (referenced.has(name)) continue;
        const fullPath = path.join(ATTACHMENT_DIR, name);
        try {
          const stat = fs.statSync(fullPath);
          if (!stat.isFile()) continue;
          bytesFreed += stat.size;
          fs.unlinkSync(fullPath);
          strayFiles++;
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // best-effort
  }

  return { orphanRows, strayFiles, bytesFreed };
}

/**
 * Fire-and-forget orphan sweep, gated at most once per day so the
 * 5-minute maintenance tick doesn't pay the cost on every chat send.
 */
export function maybeCleanupOrphanAttachments(): void {
  if (cleaningUpAttachments) return;
  const last = getSetting("attachment_cleanup_at");
  if (last) {
    const lastAt = parseSqliteUtc(last);
    if (lastAt && Date.now() - lastAt.getTime() < DAY_MS) return;
  }
  cleaningUpAttachments = true;
  try {
    cleanupOrphanChatAttachments();
    setSetting("attachment_cleanup_at", new Date().toISOString());
  } catch {
    // best-effort; try again next sweep
  } finally {
    cleaningUpAttachments = false;
  }
}
