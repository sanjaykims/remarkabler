import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export { DATA_DIR };

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  const dbPath = path.join(DATA_DIR, "app.db");
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.exec(SCHEMA);

  // Migrations for columns added after the initial schema.
  for (const col of ["status TEXT", "error TEXT"]) {
    try {
      _db.exec(`ALTER TABLE notebooks ADD COLUMN ${col}`);
    } catch {
      // column already exists
    }
  }
  try {
    _db.exec(`ALTER TABLE insights ADD COLUMN title TEXT`);
  } catch {
    // column already exists
  }
  // Archived chat messages are hidden from the chat view but kept in the DB,
  // and still feed Claude so a cleared conversation continues seamlessly.
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
  // Per-page semantic embedding (Float32 BLOB) for hybrid (FTS + meaning)
  // search. Backfilled in the background; absent for older pages until then.
  try {
    _db.exec(`ALTER TABLE pages ADD COLUMN embedding BLOB`);
  } catch {
    // column already exists
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
  parent TEXT,
  last_modified TEXT,
  hash TEXT,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL,
  page_index INTEGER NOT NULL,
  image_path TEXT,
  ocr_text TEXT,
  ocr_summary TEXT,
  ocr_model TEXT,
  ocr_at TEXT,
  FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pages_notebook ON pages(notebook_id);

CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
  ocr_text,
  ocr_summary,
  notebook_name UNINDEXED,
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
  source TEXT,
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
