import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

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
