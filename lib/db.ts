import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { chunkedBackfillForConversation } from "./chatMemoryBackfill";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export { DATA_DIR };

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  const dbPath = path.join(DATA_DIR, "app.db");
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  // SQLite ships with foreign keys off by default. We rely on ON DELETE
  // CASCADE in several tables (chat_attachments → chat_messages,
  // entry_analysis → pages) so without this pragma cascades are silently
  // dropped and orphaned rows accumulate.
  _db.pragma("foreign_keys = ON");
  _db.exec(SCHEMA);

  // Migrations for columns added after the initial schema.
  for (const col of [
    "status TEXT",
    "error TEXT",
    // The Dropbox file id of the source PDF when a notebook was auto-ingested
    // by the dropbox watcher — used to dedupe so a re-poll of the folder
    // doesn't ingest the same notebook twice. NULL for manually-uploaded
    // notebooks.
    "dropbox_file_id TEXT",
    // reMarkable cloud origin markers (Phase 1b). remarkable_doc_id is the
    // stable notebook id from the cloud account; remarkable_doc_hash is the
    // content hash at import time. Together they let a re-import dedupe (same
    // hash → skip) and detect change (different hash → re-import). NULL for
    // Dropbox/manual notebooks.
    "remarkable_doc_id TEXT",
    "remarkable_doc_hash TEXT",
  ]) {
    try {
      _db.exec(`ALTER TABLE notebooks ADD COLUMN ${col}`);
    } catch {
      // column already exists
    }
  }
  // Lookup index for the watcher's "have I seen this file?" check.
  _db.exec(
    `CREATE INDEX IF NOT EXISTS idx_notebooks_dropbox_file_id
       ON notebooks(dropbox_file_id) WHERE dropbox_file_id IS NOT NULL`
  );
  // Lookup index for the reMarkable importer's "already imported?" dedupe.
  _db.exec(
    `CREATE INDEX IF NOT EXISTS idx_notebooks_remarkable_doc_id
       ON notebooks(remarkable_doc_id) WHERE remarkable_doc_id IS NOT NULL`
  );
  // Per-page reMarkable identity for incremental cloud sync (Phase 2):
  // remarkable_page_id is the stable page uuid from the tablet;
  // remarkable_page_hash is a sha256 of the page's raw .rm bytes at last
  // ingest. Together they let the sweep re-OCR ONLY new/changed pages.
  // NULL for pages from manual/Dropbox notebooks and legacy cloud imports.
  // profile_fold_pending=1 marks a page ingested from a not-yet-settled
  // notebook: its text is live everywhere immediately, but the fold into the
  // long-lived profile waits until the notebook stops changing (the fold is
  // append-only and can't be undone by a later corrected re-OCR).
  for (const col of [
    "remarkable_page_id TEXT",
    "remarkable_page_hash TEXT",
    "profile_fold_pending INTEGER",
  ]) {
    try {
      _db.exec(`ALTER TABLE pages ADD COLUMN ${col}`);
    } catch {
      // column already exists
    }
  }
  try {
    _db.exec(`ALTER TABLE insights ADD COLUMN title TEXT`);
  } catch {
    // column already exists
  }
  // Archived chat messages are hidden from the chat view and no longer feed
  // Claude as raw history — the chat POST filters archived_at IS NULL so
  // Clear is a real semantic boundary. Continuity across Clears is carried
  // by the chat_memories layer (compact items extracted from each archive
  // batch), not by replaying old raw messages.
  try {
    _db.exec(`ALTER TABLE chat_messages ADD COLUMN archived_at TEXT`);
  } catch {
    // column already exists
  }
  // The model that produced each assistant reply, so the chat can flag when a
  // cheaper fallback model (e.g. Haiku) answered instead of the main one.
  try {
    _db.exec(`ALTER TABLE chat_messages ADD COLUMN model TEXT`);
  } catch {
    // column already exists
  }
  // The archive batch that grouped this message at Clear time. Lets the chat
  // memory compressor find every message belonging to a single Clear event
  // and treat it as one compression unit.
  try {
    _db.exec(`ALTER TABLE chat_messages ADD COLUMN archive_batch_id INTEGER`);
  } catch {
    // column already exists
  }
  _db.exec(
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_archive_batch
       ON chat_messages(archive_batch_id) WHERE archive_batch_id IS NOT NULL`
  );
  // Per-page semantic embedding (Float32 BLOB) for hybrid (FTS + meaning)
  // search. Backfilled in the background; absent for older pages until then.
  try {
    _db.exec(`ALTER TABLE pages ADD COLUMN embedding BLOB`);
  } catch {
    // column already exists
  }
  // The diary's own date for a page — parsed from the YYYY-MM-DD-HHMM-KST
  // timestamp the user writes at the top of each entry. Lets daily
  // summaries group entries by *when they were written*, not when uploaded.
  try {
    _db.exec(`ALTER TABLE pages ADD COLUMN entry_date TEXT`);
  } catch {
    // column already exists
  }
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_pages_entry_date ON pages(entry_date)`);
  // Hot path: chat POST history fetch, chat GET render, attachment join, and
  // the Clear/archive UPDATE all filter on (conversation_id, archived_at) and
  // sort by id. One compound index covers all four queries.
  _db.exec(
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_archived
       ON chat_messages(conversation_id, archived_at, id)`
  );
  _db.exec(
    `CREATE INDEX IF NOT EXISTS idx_chat_attachments_message
       ON chat_attachments(message_id)`
  );
  _db.exec(`
    CREATE TABLE IF NOT EXISTS daily_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Per-page semantic analysis used by the /mind visualisations: extracted
  // themes (JSON array), an overall sentiment in [-1, +1], and a one-line
  // summary. Populated lazily — pages without a row are simply not yet
  // analysed and the UI shows a backfill button. ON DELETE CASCADE keeps
  // the table in sync when a notebook (and its pages) is removed.
  _db.exec(`
    CREATE TABLE IF NOT EXISTS entry_analysis (
      page_id TEXT PRIMARY KEY,
      themes TEXT NOT NULL DEFAULT '[]',
      sentiment REAL,
      summary TEXT,
      model TEXT,
      analyzed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    )
  `);
  _db.exec(
    `CREATE INDEX IF NOT EXISTS idx_entry_analysis_analyzed_at
       ON entry_analysis(analyzed_at)`
  );
  // Per-page named entities (people / places / projects) extracted in the
  // same Claude call that fills entry_analysis. Many-per-page, so it's a
  // separate table rather than columns on entry_analysis. name_norm is
  // lowercase + collapsed whitespace, used for grouping ("Sermorizer"
  // and "sermorizer" coalesce). Cascades on page delete.
  _db.exec(`
    CREATE TABLE IF NOT EXISTS entry_entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id    TEXT NOT NULL,
      kind       TEXT NOT NULL CHECK (kind IN ('person', 'place', 'project')),
      name       TEXT NOT NULL,
      name_norm  TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    )
  `);
  _db.exec(
    `CREATE INDEX IF NOT EXISTS idx_entry_entities_page
       ON entry_entities(page_id)`
  );
  _db.exec(
    `CREATE INDEX IF NOT EXISTS idx_entry_entities_kind_norm
       ON entry_entities(kind, name_norm)`
  );
  // Dedup any pre-existing (page_id, kind, name_norm) collisions before
  // promoting the index to UNIQUE — older deployments may have a few
  // duplicates from edge cases (Claude returning the same entity twice
  // in one response with different casings) where the now-fixed
  // delete-then-insert pattern wouldn't have caught them. Keep the
  // newest row (highest id) so the freshest display casing survives.
  _db.exec(
    `DELETE FROM entry_entities
       WHERE id NOT IN (
         SELECT MAX(id) FROM entry_entities GROUP BY page_id, kind, name_norm
       )`
  );
  _db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_entry_entities_unique
       ON entry_entities(page_id, kind, name_norm)`
  );
  // Chat memory: each Clear becomes an archive batch, and the compressor
  // extracts a small set of durable items from the batch's transcript.
  // Batches stay around as the audit unit (last error, attempt count,
  // memory counts); memories outlive their source batch (FK SET NULL on
  // batch deletion) so a deleted batch doesn't erase what was learned
  // from it.
  _db.exec(`
    CREATE TABLE IF NOT EXISTS chat_archive_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id      TEXT NOT NULL,
      archived_at          TEXT NOT NULL DEFAULT (datetime('now')),
      message_start_id     INTEGER,
      message_end_id       INTEGER,
      message_count        INTEGER NOT NULL DEFAULT 0,
      user_char_count      INTEGER NOT NULL DEFAULT 0,
      memory_extracted_at  TEXT,
      extraction_error     TEXT,
      failed_attempts      INTEGER NOT NULL DEFAULT 0,
      memories_inserted    INTEGER NOT NULL DEFAULT 0
    )
  `);
  _db.exec(
    `CREATE INDEX IF NOT EXISTS idx_chat_archive_batches_pending
       ON chat_archive_batches(memory_extracted_at)
       WHERE memory_extracted_at IS NULL`
  );
  _db.exec(`
    CREATE TABLE IF NOT EXISTS chat_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_archive_batch_id  INTEGER,
      source_conversation_id   TEXT NOT NULL,
      source_message_start_id  INTEGER,
      source_message_end_id    INTEGER,
      category                 TEXT NOT NULL DEFAULT 'fact',
      category_raw             TEXT,
      text                     TEXT NOT NULL,
      text_norm                TEXT NOT NULL,
      embedding                BLOB,
      source_excerpt           TEXT,
      model                    TEXT,
      created_at               TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at               TEXT,
      FOREIGN KEY (source_archive_batch_id) REFERENCES chat_archive_batches(id) ON DELETE SET NULL
    )
  `);
  _db.exec(
    `CREATE INDEX IF NOT EXISTS idx_chat_memories_active
       ON chat_memories(source_conversation_id, created_at) WHERE deleted_at IS NULL`
  );
  _db.exec(
    `CREATE INDEX IF NOT EXISTS idx_chat_memories_recall
       ON chat_memories(deleted_at, id)`
  );
  _db.exec(
    `CREATE INDEX IF NOT EXISTS idx_chat_memories_dedup
       ON chat_memories(text_norm) WHERE deleted_at IS NULL`
  );
  // Drop columns that have been confirmed dead — written but never read by
  // any current code path. Idempotent (SQLite raises "no such column" once
  // the drop has already happened, and the try/catch swallows it).
  for (const sql of [
    `ALTER TABLE notebooks DROP COLUMN parent`,
    `ALTER TABLE notebooks DROP COLUMN last_modified`,
    `ALTER TABLE notebooks DROP COLUMN hash`,
    `ALTER TABLE pages DROP COLUMN image_path`,
    `ALTER TABLE pages DROP COLUMN ocr_model`,
    `ALTER TABLE pages DROP COLUMN ocr_at`,
    `ALTER TABLE pages DROP COLUMN ocr_summary`,
    `ALTER TABLE profile DROP COLUMN source`,
  ]) {
    try {
      _db.exec(sql);
    } catch {
      // column already absent
    }
  }
  // pages_fts is an FTS5 virtual table — DROP COLUMN isn't supported, so we
  // rebuild it once to remove the now-empty ocr_summary column. Gated by a
  // settings flag so the rebuild only runs after the schema has been bumped
  // (and never again afterwards).
  try {
    const row = _db
      .prepare(`SELECT value FROM settings WHERE key = 'schema_pages_fts_v3'`)
      .get() as { value: string } | undefined;
    if (!row) {
      _db.exec(`DROP TABLE IF EXISTS pages_fts`);
      _db.exec(`
        CREATE VIRTUAL TABLE pages_fts USING fts5(
          ocr_text,
          notebook_name,
          page_id UNINDEXED,
          notebook_id UNINDEXED
        )
      `);
      _db.exec(`
        INSERT INTO pages_fts(ocr_text, notebook_name, page_id, notebook_id)
        SELECT p.ocr_text, n.name, p.id, p.notebook_id
        FROM pages p JOIN notebooks n ON n.id = p.notebook_id
        WHERE p.ocr_text IS NOT NULL AND p.ocr_text != ''
      `);
      _db
        .prepare(
          `INSERT INTO settings(key,value) VALUES('schema_pages_fts_v3','1')
             ON CONFLICT(key) DO UPDATE SET value=excluded.value`
        )
        .run();
    }
  } catch {
    // best-effort; older deployments stay on the previous FTS schema
  }
  // One-time backfill: chats cleared BEFORE the chat-memory feature shipped
  // sit with archived_at set but archive_batch_id NULL — they were never
  // grouped into a batch because the table didn't exist yet. Chunk them
  // by char budget (via chunkedBackfillForConversation) so a multi-month
  // conversation produces many batches under compressBatch's 16K-char cap,
  // not one giant batch that gets silently truncated to the most recent
  // tail. Idempotent: once every archived row has a batch_id, the SELECT
  // returns nothing.
  try {
    const orphanConvs = _db
      .prepare(
        `SELECT DISTINCT conversation_id FROM chat_messages
         WHERE archived_at IS NOT NULL AND archive_batch_id IS NULL`
      )
      .all() as Array<{ conversation_id: string }>;
    for (const { conversation_id } of orphanConvs) {
      chunkedBackfillForConversation(_db, conversation_id, {
        onlyArchived: true,
      });
    }
  } catch {
    // best-effort; the sweep would retry on the next process startup
  }
  // Any notebook still "processing" at startup was interrupted by a restart.
  _db
    .prepare(
      `UPDATE notebooks SET status='error',
         error='Transcription was interrupted. Delete and re-add this notebook.'
       WHERE status='processing'`
    )
    .run();

  return _db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notebooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL,
  page_index INTEGER NOT NULL,
  ocr_text TEXT,
  FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pages_notebook ON pages(notebook_id);

CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
  ocr_text,
  notebook_name,
  page_id UNINDEXED,
  notebook_id UNINDEXED
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage(created_at);

CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lat REAL,
  lng REAL,
  place TEXT,
  local_time TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS route_stops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place TEXT,
  lat REAL,
  lng REAL,
  start_time TEXT,
  end_time TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_route_stops_key ON route_stops(start_time, place);

CREATE TABLE IF NOT EXISTS location_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  tst INTEGER NOT NULL,
  acc REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_location_points_tst ON location_points(tst);

CREATE TABLE IF NOT EXISTS geocode_cache (
  key TEXT PRIMARY KEY,
  place TEXT NOT NULL
);
`;

export function getSetting(key: string): string | null {
  const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  db()
    .prepare(
      "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    )
    .run(key, value);
}

export function clearSetting(key: string) {
  db().prepare("DELETE FROM settings WHERE key = ?").run(key);
}
