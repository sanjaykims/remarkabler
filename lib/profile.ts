import { db } from "./db";

// The evolving "profile of you" — Claude's accumulated understanding of the
// person, distilled from their diary. Stored as versioned rows; the latest is
// current. Read on every chat (cheap), revised in the background when a new
// diary entry is fed.

export function getCurrentProfile(): string | null {
  const row = db()
    .prepare(`SELECT content FROM profile ORDER BY id DESC LIMIT 1`)
    .get() as { content: string } | undefined;
  return row?.content ?? null;
}

export function hasProfile(): boolean {
  const row = db()
    .prepare(`SELECT COUNT(*) AS c FROM profile`)
    .get() as { c: number };
  return row.c > 0;
}

export function saveProfile(content: string, source: string): void {
  const trimmed = content.trim();
  if (!trimmed) return;
  db()
    .prepare(`INSERT INTO profile(content, source) VALUES(?, ?)`)
    .run(trimmed, source);
}
