import { db } from "./db";
import { compressChatSession, modelChatMemory } from "./claude";
import type { ChatMemoryDraft } from "./claude";
import {
  embed,
  embeddingsEnabled,
  encodeEmbedding,
  decodeEmbedding,
  cosineSimilarity,
} from "./embeddings";
import { getCurrentProfile } from "./profile";

// Knobs. Tunable in one place so a sweep parameter doesn't drift between
// the extractor and the recall path.
const COMPRESS_DEFAULT_LIMIT = 5;
const COMPRESS_MAX_LIMIT = 25;
const MIN_MESSAGES_FOR_COMPRESSION = 4;
const MIN_USER_CHARS_FOR_COMPRESSION = 200;
const MAX_TRANSCRIPT_CHARS = 16_000;
const MAX_ITEMS_PER_BATCH = 7;
const MAX_ITEM_TEXT_CHARS = 280;
const MAX_EXCERPT_CHARS = 240;
const MAX_RECALL_CHARS = 2000;
const DEDUP_COSINE_THRESHOLD = 0.88;
const RECALL_MIN_SIMILARITY = 0.4;
const RECALL_K = 5;
const MAX_EXTRACTION_ATTEMPTS = 2;
const RECENT_MEMORY_PRIMER_COUNT = 15;

export type ChatMemoryCategory =
  | "fact"
  | "preference"
  | "intent"
  | "feeling"
  | "unresolved"
  | "other";

const CATEGORY_ALIASES: Record<string, ChatMemoryCategory> = {
  fact: "fact",
  facts: "fact",
  bio: "fact",
  biography: "fact",
  background: "fact",
  identity: "fact",
  preference: "preference",
  preferences: "preference",
  like: "preference",
  likes: "preference",
  dislike: "preference",
  dislikes: "preference",
  taste: "preference",
  habit: "preference",
  habits: "preference",
  routine: "preference",
  intent: "intent",
  intents: "intent",
  intention: "intent",
  goal: "intent",
  goals: "intent",
  plan: "intent",
  plans: "intent",
  ambition: "intent",
  feeling: "feeling",
  feelings: "feeling",
  emotion: "feeling",
  emotions: "feeling",
  mood: "feeling",
  unresolved: "unresolved",
  open: "unresolved",
  thread: "unresolved",
  threads: "unresolved",
  "open loop": "unresolved",
  "open thread": "unresolved",
  todo: "unresolved",
  followup: "unresolved",
  "follow-up": "unresolved",
  "follow up": "unresolved",
  context: "other",
  other: "other",
  note: "other",
  misc: "other",
};

export function normaliseChatMemoryCategory(raw: string): ChatMemoryCategory {
  const key = (raw || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (!key) return "other";
  if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
  // First word only — "preferences for X" → "preferences" → "preference".
  const first = key.split(/\s+/)[0];
  return CATEGORY_ALIASES[first] || "other";
}

export function normaliseMemoryText(text: string): string {
  // Lowercase, collapse whitespace, strip light punctuation. Used both as
  // the stored text_norm column and the exact-dedup lookup key, so the
  // generator and the consumer agree byte-for-byte.
  return (text || "")
    .toLowerCase()
    .replace(/[‘’“”`]/g, "'")
    .replace(/[.,;:!?…—–\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateChars(text: string, limit: number): string {
  if (!text) return "";
  if (text.length <= limit) return text;
  return text.slice(0, limit).trimEnd() + "…";
}

type ChatMemoryRowForDedup = {
  id: number;
  text_norm: string;
  embedding: Buffer | null;
};

export type DuplicateCheck = {
  duplicate: boolean;
  matchedId?: number;
  reason?: "exact" | "cosine";
};

export function isDuplicateMemory(candidate: {
  text: string;
  embedding: Float32Array | null;
}): DuplicateCheck {
  const norm = normaliseMemoryText(candidate.text);
  if (!norm) return { duplicate: false };

  const exact = db()
    .prepare(
      `SELECT id FROM chat_memories
       WHERE deleted_at IS NULL AND text_norm = ?
       LIMIT 1`
    )
    .get(norm) as { id: number } | undefined;
  if (exact) {
    return { duplicate: true, matchedId: exact.id, reason: "exact" };
  }

  if (!candidate.embedding) return { duplicate: false };

  const rows = db()
    .prepare(
      `SELECT id, text_norm, embedding FROM chat_memories
       WHERE deleted_at IS NULL AND embedding IS NOT NULL`
    )
    .all() as ChatMemoryRowForDedup[];

  for (const row of rows) {
    if (!row.embedding) continue;
    const vec = decodeEmbedding(row.embedding);
    if (!vec) continue;
    const sim = cosineSimilarity(candidate.embedding, vec);
    if (sim >= DEDUP_COSINE_THRESHOLD) {
      return { duplicate: true, matchedId: row.id, reason: "cosine" };
    }
  }

  return { duplicate: false };
}

type BatchRow = {
  id: number;
  conversation_id: string;
  message_start_id: number | null;
  message_end_id: number | null;
  message_count: number;
  user_char_count: number;
  memory_extracted_at: string | null;
  failed_attempts: number;
};

type MessageRow = {
  id: number;
  role: string;
  content: string;
};

function buildTranscript(messages: MessageRow[]): string {
  // Most-recent slice fits into MAX_TRANSCRIPT_CHARS. Earlier turns drop
  // off the front rather than the back, because the back is where the
  // unresolved threads usually sit.
  const lines = messages.map((m) => {
    const who = m.role === "user" ? "User" : "Claude";
    return `${who}: ${m.content || ""}`;
  });
  let out = lines.join("\n\n");
  if (out.length <= MAX_TRANSCRIPT_CHARS) return out;
  out = out.slice(out.length - MAX_TRANSCRIPT_CHARS);
  // Find the first full turn boundary to avoid starting mid-message.
  const cut = out.indexOf("\n\n");
  return cut > 0 ? out.slice(cut + 2) : out;
}

function fetchRecentMemoryTexts(limit: number): string[] {
  const rows = db()
    .prepare(
      `SELECT text FROM chat_memories
       WHERE deleted_at IS NULL
       ORDER BY id DESC LIMIT ?`
    )
    .all(limit) as Array<{ text: string }>;
  return rows.map((r) => r.text);
}

export type CompressBatchResult = {
  inserted: number;
  duplicatesSkipped: number;
  skipped?: "too-short" | "already-extracted" | "not-found";
  failed?: string;
  permanentlyFailed?: true;
};

export async function compressBatch(
  batchId: number
): Promise<CompressBatchResult> {
  const batch = db()
    .prepare(
      `SELECT id, conversation_id, message_start_id, message_end_id,
              message_count, user_char_count, memory_extracted_at, failed_attempts
       FROM chat_archive_batches WHERE id = ?`
    )
    .get(batchId) as BatchRow | undefined;
  if (!batch) {
    return { inserted: 0, duplicatesSkipped: 0, skipped: "not-found" };
  }
  if (batch.memory_extracted_at !== null) {
    return { inserted: 0, duplicatesSkipped: 0, skipped: "already-extracted" };
  }

  const messages = db()
    .prepare(
      `SELECT id, role, content FROM chat_messages
       WHERE archive_batch_id = ?
       ORDER BY id ASC`
    )
    .all(batch.id) as MessageRow[];

  if (
    messages.length < MIN_MESSAGES_FOR_COMPRESSION ||
    batch.user_char_count < MIN_USER_CHARS_FOR_COMPRESSION
  ) {
    db()
      .prepare(
        `UPDATE chat_archive_batches
         SET memory_extracted_at = datetime('now'),
             extraction_error = NULL,
             failed_attempts = 0
         WHERE id = ?`
      )
      .run(batch.id);
    return { inserted: 0, duplicatesSkipped: 0, skipped: "too-short" };
  }

  const transcript = buildTranscript(messages);
  const profile = getCurrentProfile() || "";
  const existingMemories = fetchRecentMemoryTexts(RECENT_MEMORY_PRIMER_COUNT);

  let extraction;
  try {
    extraction = await compressChatSession({
      transcript,
      profile,
      existingMemories,
    });
  } catch (e) {
    return recordBatchFailure(batch, (e as Error).message || "Claude call failed");
  }

  if (extraction.parseError || extraction.items.length === 0 && extraction.raw) {
    // raw was returned but JSON parsing failed → real parse failure.
    // Empty items with no parse error means "Claude legitimately had
    // nothing durable" — that's a success, not a retry case.
    if (extraction.parseError) {
      return recordBatchFailure(batch, extraction.parseError);
    }
  }

  const items = extraction.items.slice(0, MAX_ITEMS_PER_BATCH);
  const model = extraction.model;

  const insertStmt = db().prepare(
    `INSERT INTO chat_memories(
       source_archive_batch_id, source_conversation_id,
       source_message_start_id, source_message_end_id,
       category, category_raw,
       text, text_norm,
       embedding, source_excerpt, model
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let inserted = 0;
  let duplicatesSkipped = 0;
  for (const draft of items) {
    const trimmedText = truncateChars(draft.text.trim(), MAX_ITEM_TEXT_CHARS);
    if (!trimmedText) continue;
    const norm = normaliseMemoryText(trimmedText);
    if (!norm) continue;

    let embedding: Float32Array | null = null;
    if (embeddingsEnabled()) {
      try {
        embedding = await embed(trimmedText, "document");
      } catch {
        embedding = null;
      }
    }

    const dup = isDuplicateMemory({ text: trimmedText, embedding });
    if (dup.duplicate) {
      duplicatesSkipped++;
      continue;
    }

    const excerpt = truncateChars(
      (draft.source_excerpt || "").trim(),
      MAX_EXCERPT_CHARS
    );
    const category = normaliseChatMemoryCategory(draft.category);
    const categoryRaw = (draft.category || "").trim().slice(0, 60) || null;

    insertStmt.run(
      batch.id,
      batch.conversation_id,
      batch.message_start_id,
      batch.message_end_id,
      category,
      categoryRaw,
      trimmedText,
      norm,
      embedding ? encodeEmbedding(embedding) : null,
      excerpt || null,
      model
    );
    inserted++;
  }

  db()
    .prepare(
      `UPDATE chat_archive_batches
       SET memory_extracted_at = datetime('now'),
           memories_inserted = ?,
           extraction_error = NULL,
           failed_attempts = 0
       WHERE id = ?`
    )
    .run(inserted, batch.id);

  return { inserted, duplicatesSkipped };
}

function recordBatchFailure(
  batch: BatchRow,
  error: string
): CompressBatchResult {
  const nextAttempts = batch.failed_attempts + 1;
  const permanent = nextAttempts >= MAX_EXTRACTION_ATTEMPTS;
  if (permanent) {
    db()
      .prepare(
        `UPDATE chat_archive_batches
         SET failed_attempts = ?,
             extraction_error = ?,
             memory_extracted_at = datetime('now')
         WHERE id = ?`
      )
      .run(nextAttempts, error.slice(0, 500), batch.id);
    return {
      inserted: 0,
      duplicatesSkipped: 0,
      failed: error,
      permanentlyFailed: true,
    };
  }
  db()
    .prepare(
      `UPDATE chat_archive_batches
       SET failed_attempts = ?,
           extraction_error = ?
       WHERE id = ?`
    )
    .run(nextAttempts, error.slice(0, 500), batch.id);
  return { inserted: 0, duplicatesSkipped: 0, failed: error };
}

let compressionInFlight = false;

export type SweepResult = {
  processed: number;
  inserted: number;
  duplicatesSkipped: number;
  failed: number;
  remaining: number;
  inFlight?: true;
};

export async function maybeCompressChatSessions(
  limit: number = COMPRESS_DEFAULT_LIMIT
): Promise<SweepResult> {
  if (compressionInFlight) {
    return {
      processed: 0,
      inserted: 0,
      duplicatesSkipped: 0,
      failed: 0,
      remaining: pendingBatchCount(),
      inFlight: true,
    };
  }
  compressionInFlight = true;
  try {
    const n = Math.max(1, Math.min(COMPRESS_MAX_LIMIT, Math.floor(limit)));
    const pending = db()
      .prepare(
        `SELECT id FROM chat_archive_batches
         WHERE memory_extracted_at IS NULL
         ORDER BY id ASC LIMIT ?`
      )
      .all(n) as Array<{ id: number }>;

    let processed = 0;
    let inserted = 0;
    let duplicatesSkipped = 0;
    let failed = 0;
    for (const { id } of pending) {
      const r = await compressBatch(id);
      processed++;
      inserted += r.inserted;
      duplicatesSkipped += r.duplicatesSkipped;
      if (r.failed) failed++;
    }
    return {
      processed,
      inserted,
      duplicatesSkipped,
      failed,
      remaining: pendingBatchCount(),
    };
  } finally {
    compressionInFlight = false;
  }
}

function pendingBatchCount(): number {
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS c FROM chat_archive_batches
       WHERE memory_extracted_at IS NULL`
    )
    .get() as { c: number };
  return row.c;
}

/**
 * Clear failure state on a batch so the next sweep picks it up. Used by
 * the manual retry endpoint when a batch has been permanently skipped
 * (failed_attempts >= MAX_EXTRACTION_ATTEMPTS).
 */
export function resetBatchForRetry(batchId: number): boolean {
  const r = db()
    .prepare(
      `UPDATE chat_archive_batches
       SET memory_extracted_at = NULL,
           failed_attempts = 0,
           extraction_error = NULL
       WHERE id = ?`
    )
    .run(batchId);
  return r.changes > 0;
}

export type RecalledMemory = {
  id: number;
  category: ChatMemoryCategory;
  text: string;
  score: number;
  created_at: string;
};

/**
 * Find the top-K non-deleted chat memories most semantically similar to
 * `message`. Fail-open: any error (no API key, Voyage outage, decode
 * failure) returns an empty list rather than throwing, so chat never 500s
 * because recall failed.
 */
export async function recallChatMemories(
  message: string,
  k: number = RECALL_K,
  minSim: number = RECALL_MIN_SIMILARITY
): Promise<{ items: RecalledMemory[] }> {
  try {
    if (!message || !message.trim()) return { items: [] };
    if (!embeddingsEnabled()) return { items: [] };
    const queryVec = await embed(message, "query");
    if (!queryVec) return { items: [] };

    const rows = db()
      .prepare(
        `SELECT id, category, text, embedding, created_at FROM chat_memories
         WHERE deleted_at IS NULL AND embedding IS NOT NULL`
      )
      .all() as Array<{
      id: number;
      category: string;
      text: string;
      embedding: Buffer | null;
      created_at: string;
    }>;

    const scored: RecalledMemory[] = [];
    for (const r of rows) {
      if (!r.embedding) continue;
      const vec = decodeEmbedding(r.embedding);
      if (!vec) continue;
      const score = cosineSimilarity(queryVec, vec);
      if (score < minSim) continue;
      scored.push({
        id: r.id,
        category: normaliseChatMemoryCategory(r.category),
        text: r.text,
        score,
        created_at: r.created_at,
      });
    }
    scored.sort((a, b) => b.score - a.score);
    return { items: scored.slice(0, k) };
  } catch (e) {
    console.warn("[chatMemory] recall failed:", (e as Error).message);
    return { items: [] };
  }
}

function relativeAge(createdAt: string, now: Date = new Date()): string {
  // Parses SQLite "YYYY-MM-DD HH:MM:SS" (UTC) into a relative string. Falls
  // back gracefully for unparseable inputs.
  const iso = createdAt.includes("T") ? createdAt : createdAt.replace(" ", "T") + "Z";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "recently";
  const diffMs = now.getTime() - t;
  const days = Math.floor(diffMs / (24 * 3600 * 1000));
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months < 18) return `${months} months ago`;
  const years = Math.floor(days / 365);
  return `${years} years ago`;
}

/**
 * Render recalled memories as a system-prompt block. Framed as advisory:
 * Claude should prefer current info if there's a conflict.
 */
export function formatRecalledMemoriesBlock(
  items: RecalledMemory[],
  now: Date = new Date()
): string {
  if (items.length === 0) return "";

  const header = [
    "=== THINGS THEY'VE TOLD YOU BEFORE ===",
    "These are compact memories extracted from past chats. Use them as helpful",
    "context, but don't overstate them. If they conflict with the current",
    "message, the diary, or the profile, prefer the current information.",
    "",
  ].join("\n");
  const footer = "=== END ===";

  const lines: string[] = [];
  let used = header.length + footer.length;
  for (const m of items) {
    const line = `- [${m.category}] ${m.text} (from ${relativeAge(m.created_at, now)})`;
    if (used + line.length + 1 > MAX_RECALL_CHARS) break;
    lines.push(line);
    used += line.length + 1;
  }
  if (lines.length === 0) return "";
  return [header, lines.join("\n"), footer].join("\n");
}

// Exported for tests so they can probe the loop's draft handling without
// recreating the full extraction code path.
export type { ChatMemoryDraft };
