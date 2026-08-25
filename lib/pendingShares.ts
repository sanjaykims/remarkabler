import { createHash, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { DATA_DIR, db } from "./db";
import { looksLikePdf, MAX_UPLOAD_BYTES } from "./upload";

const PENDING_DIR = path.join(DATA_DIR, "pending-shares");
export const MAX_PENDING_SHARES = 5;
export const MAX_PENDING_BYTES = 60 * 1024 * 1024;
export const PENDING_RETENTION_HOURS = 24;
export const SHARE_RATE_WINDOW_MINUTES = 60;
export const SHARE_RATE_MAX = 10;
// Of MAX_PENDING_SHARES, how many one source may hold at once. Without this
// the count cap is first-come-first-served, so a single anonymous source can
// occupy every slot — five requests is well under SHARE_RATE_MAX, so the
// throttle never even engages — and the owner's Android share sheet stops
// working until they notice and clear it. Reserving capacity keeps a genuine
// share landing even while junk is pending.
export const PER_SOURCE_PENDING_MAX = 2;

export type PendingShare = {
  id: string;
  notebookId: string;
  name: string;
  sizeBytes: number;
  createdAt: string;
};

type PendingRow = {
  id: string;
  notebook_id: string;
  name: string;
  size_bytes: number;
  created_at: string;
};

function filePath(id: string): string {
  return path.join(PENDING_DIR, `${id}.pdf`);
}

function cleanName(value: string): string {
  const base = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return (base || "shared.pdf").slice(0, 180);
}

export function shareSourceHash(source: string): string {
  return createHash("sha256").update(source || "unknown").digest("hex");
}

function toPending(row: PendingRow): PendingShare {
  return {
    id: row.id,
    notebookId: row.notebook_id,
    name: row.name,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

export function purgeExpiredPendingShares(): number {
  const expired = db()
    .prepare(
      `SELECT id FROM pending_shares
       WHERE created_at < datetime('now', ?)`
    )
    .all(`-${PENDING_RETENTION_HOURS} hours`) as Array<{ id: string }>;
  if (expired.length === 0) return 0;

  db().transaction(() => {
    for (const row of expired) {
      db().prepare(`DELETE FROM pending_shares WHERE id = ?`).run(row.id);
    }
  })();
  for (const row of expired) {
    try {
      fs.unlinkSync(filePath(row.id));
    } catch {
      // Missing files are harmless; the database row was the source of truth.
    }
  }
  return expired.length;
}

/** Count one share attempt against its source, accepted or not. */
function recordShareAttempt(sourceHash: string): void {
  db().transaction(() => {
    db()
      .prepare(`INSERT INTO share_rate_events(source_hash) VALUES(?)`)
      .run(sourceHash);
    db()
      .prepare(
        `DELETE FROM share_rate_events
         WHERE created_at < datetime('now', '-24 hours')`
      )
      .run();
  })();
}

export function createPendingShare(opts: {
  fileName: string;
  bytes: Uint8Array;
  source: string;
}): PendingShare {
  purgeExpiredPendingShares();
  const sourceHash = shareSourceHash(opts.source);

  // Record the ATTEMPT before validating anything. Counting only accepted
  // shares meant every rejection was free: once the quarantine filled, the
  // public endpoint had no rate limit at all, because each request threw
  // before ever reaching the insert.
  recordShareAttempt(sourceHash);
  const rateCount = db()
    .prepare(
      `SELECT COUNT(*) AS c FROM share_rate_events
       WHERE source_hash = ? AND created_at >= datetime('now', ?)`
    )
    .get(sourceHash, `-${SHARE_RATE_WINDOW_MINUTES} minutes`) as { c: number };
  if (rateCount.c > SHARE_RATE_MAX) {
    throw new Error("Too many shares were received recently. Try again later.");
  }

  if (opts.bytes.length === 0 || opts.bytes.length > MAX_UPLOAD_BYTES) {
    throw new Error("PDF size is outside the allowed range.");
  }
  if (!looksLikePdf(opts.bytes)) throw new Error("File is not a valid PDF.");

  const mine = db()
    .prepare(`SELECT COUNT(*) AS c FROM pending_shares WHERE source_hash = ?`)
    .get(sourceHash) as { c: number };
  if (mine.c >= PER_SOURCE_PENDING_MAX) {
    throw new Error("Too many shares from this source are already waiting.");
  }

  const totals = db()
    .prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(size_bytes), 0) AS bytes FROM pending_shares`)
    .get() as { count: number; bytes: number };
  if (
    totals.count >= MAX_PENDING_SHARES ||
    totals.bytes + opts.bytes.length > MAX_PENDING_BYTES
  ) {
    throw new Error("Pending-share storage is full. Unlock Remarkabler to review it.");
  }

  const id = randomUUID();
  const notebookId = randomUUID();
  fs.mkdirSync(PENDING_DIR, { recursive: true });
  const target = filePath(id);
  const temp = `${target}.${randomUUID()}.tmp`;
  fs.writeFileSync(temp, opts.bytes, { flag: "wx", mode: 0o600 });
  fs.renameSync(temp, target);

  try {
    db().transaction(() => {
      db()
        .prepare(
          `INSERT INTO pending_shares(id, notebook_id, name, size_bytes, source_hash)
           VALUES(?,?,?,?,?)`
        )
        .run(id, notebookId, cleanName(opts.fileName), opts.bytes.length, sourceHash);
    })();
  } catch (error) {
    try {
      fs.unlinkSync(target);
    } catch {
      // Best-effort rollback of the filesystem half.
    }
    throw error;
  }

  return {
    id,
    notebookId,
    name: cleanName(opts.fileName),
    sizeBytes: opts.bytes.length,
    createdAt: new Date().toISOString(),
  };
}

export function listPendingShares(): PendingShare[] {
  purgeExpiredPendingShares();
  const rows = db()
    .prepare(
      `SELECT id, notebook_id, name, size_bytes, created_at
       FROM pending_shares ORDER BY created_at ASC, rowid ASC`
    )
    .all() as PendingRow[];
  return rows.map(toPending);
}

export function readPendingShare(id: string): { share: PendingShare; bytes: Uint8Array } | null {
  const row = db()
    .prepare(
      `SELECT id, notebook_id, name, size_bytes, created_at
       FROM pending_shares WHERE id = ?`
    )
    .get(id) as PendingRow | undefined;
  if (!row) return null;
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(fs.readFileSync(filePath(id)));
  } catch {
    db().prepare(`DELETE FROM pending_shares WHERE id = ?`).run(id);
    return null;
  }
  if (bytes.length !== row.size_bytes || !looksLikePdf(bytes)) {
    discardPendingShare(id);
    return null;
  }
  return { share: toPending(row), bytes };
}

export function discardPendingShare(id: string): boolean {
  const changed = db().prepare(`DELETE FROM pending_shares WHERE id = ?`).run(id).changes > 0;
  if (changed) {
    try {
      fs.unlinkSync(filePath(id));
    } catch {
      // The row is gone, so an absent file needs no further repair.
    }
  }
  return changed;
}
