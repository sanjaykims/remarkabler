import { db } from "./db";
import { compressChatSession } from "./claude";
import type { ChatMemoryDraft } from "./claude";
import {
  embed,
  embedBatch,
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
const MAX_RECALL_CHARS = 4000;
const DEDUP_COSINE_THRESHOLD = 0.88;
const RECALL_MIN_SIMILARITY = 0.4;
const RECALL_K = 5;
// Below this many total memories, the whole set fits comfortably in the
// prompt budget, so we include ALL of them rather than gating on semantic
// similarity. Gating a small corpus can only hurt — it drops relevant items
// (missing embedding, sub-threshold phrasing) for no benefit, since they'd
// all fit anyway. Semantic top-K only earns its keep at scale.
const RECALL_INCLUDE_ALL_MAX = 30;
// In the large-corpus path, always blend in this many most-recent memories
// alongside the semantic top-K, so a brand-new memory is never invisible
// just because its phrasing doesn't match the current message.
const RECALL_RECENT_FLOOR = 5;
const MAX_EXTRACTION_ATTEMPTS = 2;
const RECENT_MEMORY_PRIMER_COUNT = 15;

// The chat POST feeds Claude the most recent RAW_HISTORY_WINDOW turns of an
// active conversation verbatim (ORDER BY id DESC LIMIT this, in the route).
// This is the "live window" — the recent context Claude sees without needing
// recall. Widening it gives fuller recent context at a modest per-message
// token cost. The route imports this constant so the live window and the
// rolling machinery can never drift apart.
export const RAW_HISTORY_WINDOW = 20;

// Rolling memory. Turns older than the live window are no longer fed raw, and —
// before this — only became recallable memory when the user hit Clear. That
// left a blind spot: in a long, never-cleared chat, the middle turns were
// neither in the live window nor in chat_memories. Rolling memory closes it:
// once an active conversation grows past ROLL_KEEP_RECENT, its older un-batched
// turns are compressed into chat_memories as they scroll out of the window —
// WITHOUT archiving them, so they stay visible in the UI (the GET filters
// archived_at IS NULL) and this is purely additive.
//
// ROLL_KEEP_RECENT must stay >= RAW_HISTORY_WINDOW: a message is only rolled
// once it's older than the KEEP_RECENT-th most recent, so a rolled message can
// never also still be in the live window — which is what prevents double-
// counting (once as raw history, once as memory). Setting them EQUAL means
// there is no structural gap at all: every turn is either in the live window or
// rolled (the only residual is the accumulation buffer below the roll size).
// Rolled messages get archive_batch_id stamped but archived_at left NULL; a
// later Clear's COALESCE(archive_batch_id, ...) then leaves them in their
// rolling batch and never re-extracts them.
//
// A rolling batch must ALSO clear compressBatch's own substance gate
// (MIN_MESSAGES_FOR_COMPRESSION / MIN_USER_CHARS_FOR_COMPRESSION) BEFORE it's
// created. Otherwise a chunk of short turns ("ok", "thanks") would be rolled,
// then permanently marked `too-short` with zero memories — and because Clear
// preserves the existing archive_batch_id via COALESCE, those turns would
// never get re-compressed as part of the whole conversation. So we gate
// rolling on user-text volume too: too-thin turns stay unrolled (archive_batch_id
// NULL) and accumulate until they're worth a batch, or get swept up by Clear.
const ROLL_KEEP_RECENT = RAW_HISTORY_WINDOW; // 20 — equal ⇒ no structural gap
const ROLL_MIN_OLD = 8;
const ROLL_MAX_PER_BATCH = 30;

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

// A preloaded, already-decoded set of active memory embeddings. Callers that
// dedup many candidates in a row (compressBatch) build this ONCE and pass it
// in, so the full embedding table isn't re-queried and re-decoded per item.
export type PreloadedEmbeddings = Array<{ id: number; vec: Float32Array }>;

export function isDuplicateMemory(
  candidate: {
    text: string;
    embedding: Float32Array | null;
  },
  preloaded?: PreloadedEmbeddings
): DuplicateCheck {
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

  // When the caller supplied a preloaded set, compare against that (already
  // decoded) instead of re-querying + re-decoding every embedding per call.
  if (preloaded) {
    for (const p of preloaded) {
      const sim = cosineSimilarity(candidate.embedding, p.vec);
      if (sim >= DEDUP_COSINE_THRESHOLD) {
        return { duplicate: true, matchedId: p.id, reason: "cosine" };
      }
    }
    return { duplicate: false };
  }

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

// Load + decode the active memory embeddings once (for compressBatch's loop).
export function loadActiveMemoryEmbeddings(): PreloadedEmbeddings {
  const rows = db()
    .prepare(
      `SELECT id, embedding FROM chat_memories
       WHERE deleted_at IS NULL AND embedding IS NOT NULL`
    )
    .all() as Array<{ id: number; embedding: Buffer | null }>;
  const out: PreloadedEmbeddings = [];
  for (const r of rows) {
    if (!r.embedding) continue;
    const vec = decodeEmbedding(r.embedding);
    if (vec) out.push({ id: r.id, vec });
  }
  return out;
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

  // A parse error is the ONLY retry trigger. Empty items with no parse error
  // means "Claude legitimately had nothing durable" — a success, not a retry.
  // (The previous condition also tested `items.length === 0 && raw`, but that
  // operand was dead: with no parseError the branch did nothing and fell
  // through to the success path either way.)
  if (extraction.parseError) {
    return recordBatchFailure(batch, extraction.parseError);
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

  // Normalise + filter the drafts first, then embed them ALL in one Voyage
  // request. Embedding each item with its own call (the previous behaviour)
  // fired up to 7 requests in a tight loop — Voyage's free tier is 3/min, so
  // the later items reliably 429'd, got swallowed to null, and were stored
  // with no embedding. A single embedBatch call stays within the rate limit,
  // so memories actually keep their embeddings (which recall and dedup need).
  const prepared = items
    .map((draft) => {
      const trimmedText = truncateChars(draft.text.trim(), MAX_ITEM_TEXT_CHARS);
      const norm = normaliseMemoryText(trimmedText);
      return { draft, trimmedText, norm };
    })
    .filter((p) => p.trimmedText && p.norm);

  let embeddings: Array<Float32Array | null> = prepared.map(() => null);
  if (embeddingsEnabled() && prepared.length > 0) {
    try {
      const batched = await embedBatch(
        prepared.map((p) => p.trimmedText),
        "document"
      );
      if (batched && batched.length === prepared.length) embeddings = batched;
    } catch {
      // Leave embeddings null — recall now falls back to recency, and the
      // maintenance sweep's re-embed pass will fill these in later.
    }
  }

  // Preload + decode the active memory embeddings ONCE, then dedup every
  // draft against this in-memory set (instead of re-querying + re-decoding the
  // whole table per draft). Items inserted earlier in this same loop are
  // appended below so intra-batch cosine duplicates are still caught. (The
  // exact text_norm check inside isDuplicateMemory still hits the DB, which
  // also sees this loop's already-committed inserts, so exact intra-batch
  // dupes are covered too.)
  const activeEmbeddings = loadActiveMemoryEmbeddings();

  let inserted = 0;
  let duplicatesSkipped = 0;
  for (let i = 0; i < prepared.length; i++) {
    const { draft, trimmedText, norm } = prepared[i];
    const embedding = embeddings[i];

    const dup = isDuplicateMemory({ text: trimmedText, embedding }, activeEmbeddings);
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

    const info = insertStmt.run(
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
    // So later drafts in this batch dedup against what we just inserted.
    if (embedding) {
      activeEmbeddings.push({ id: Number(info.lastInsertRowid), vec: embedding });
    }
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

// In-flight guard with a time-bound. If a previous sweep hung mid-await
// (Claude SDK with no explicit timeout, or a process killed without
// running the finally), the lock stays set until process restart and
// every subsequent sweep silently no-ops. Treat any lock older than
// COMPRESSION_INFLIGHT_TIMEOUT_MS as stale and let the next caller
// proceed. The hung sweep, if still alive, just continues — the work it
// might race on is per-batch and idempotent (each batch is only "claimed"
// once its memory_extracted_at is set, which is the last step).
const COMPRESSION_INFLIGHT_TIMEOUT_MS = 5 * 60 * 1000;
let compressionStartedAt: number | null = null;

function compressionInFlight(): boolean {
  if (compressionStartedAt === null) return false;
  if (Date.now() - compressionStartedAt > COMPRESSION_INFLIGHT_TIMEOUT_MS) {
    compressionStartedAt = null;
    return false;
  }
  return true;
}

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
  if (compressionInFlight()) {
    return {
      processed: 0,
      inserted: 0,
      duplicatesSkipped: 0,
      failed: 0,
      remaining: pendingBatchCount(),
      inFlight: true,
    };
  }
  compressionStartedAt = Date.now();
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

    // Repair any memories that were stored without an embedding (e.g. a
    // Voyage rate-limit during extraction). Recall now falls back to recency
    // so these are still surfaced, but a real embedding sharpens dedup and
    // large-corpus recall. Bounded + best-effort.
    await reembedMissingMemories();

    return {
      processed,
      inserted,
      duplicatesSkipped,
      failed,
      remaining: pendingBatchCount(),
    };
  } finally {
    compressionStartedAt = null;
  }
}

// Pure-DB half of rolling memory (no Claude call — unit-testable). In one
// transaction: find the messages of an ACTIVE conversation that have scrolled
// out of the recent window and haven't been batched yet, and, if there are
// enough to be worth a compression call, stamp them into a fresh archive batch
// WITHOUT setting archived_at (they stay visible). Returns the new batchId, or
// null when there's nothing to roll. The returned batch is then compressed by
// maybeRollConversationMemory / the maintenance sweep, exactly like a Clear
// batch.
//
// Concurrency: the whole select-and-stamp runs in a single transaction and the
// candidate filter is `archive_batch_id IS NULL`, so a second concurrent call
// finds no candidates and returns null — no double-batching.
export function createRollingBatch(conversationId: string): number | null {
  return db().transaction(() => {
    // The cutoff is the ROLL_KEEP_RECENT-th most recent ACTIVE message (rolled
    // messages are still active/visible, so they count toward the window).
    // Anything strictly older than it is eligible to roll.
    const cutoff = db()
      .prepare(
        `SELECT id FROM chat_messages
         WHERE conversation_id = ? AND archived_at IS NULL
         ORDER BY id DESC LIMIT 1 OFFSET ?`
      )
      .get(conversationId, ROLL_KEEP_RECENT - 1) as { id: number } | undefined;
    if (!cutoff) return null; // fewer than ROLL_KEEP_RECENT active messages

    const old = db()
      .prepare(
        `SELECT id FROM chat_messages
         WHERE conversation_id = ? AND archived_at IS NULL
           AND archive_batch_id IS NULL AND id < ?
         ORDER BY id ASC LIMIT ?`
      )
      .all(conversationId, cutoff.id, ROLL_MAX_PER_BATCH) as Array<{ id: number }>;
    if (old.length < ROLL_MIN_OLD) return null;

    const ids = old.map((o) => o.id);
    const placeholders = ids.map(() => "?").join(",");

    // Substance gate: don't create a batch compressBatch would just discard as
    // `too-short` (permanently, un-recoverable via a later Clear). If the
    // candidate turns don't carry enough user text yet, leave them unrolled to
    // accumulate. Mirrors compressBatch's MIN_USER_CHARS_FOR_COMPRESSION.
    const userChars = (
      db()
        .prepare(
          `SELECT COALESCE(SUM(LENGTH(content)), 0) AS uc FROM chat_messages
           WHERE role = 'user' AND id IN (${placeholders})`
        )
        .get(...ids) as { uc: number }
    ).uc;
    if (userChars < MIN_USER_CHARS_FOR_COMPRESSION) return null;

    const ins = db()
      .prepare(`INSERT INTO chat_archive_batches(conversation_id) VALUES(?)`)
      .run(conversationId);
    const batchId = Number(ins.lastInsertRowid);
    // Stamp the batch id but DELIBERATELY leave archived_at NULL — the messages
    // stay in the user's visible conversation. This is the one thing that makes
    // rolling memory additive rather than a mid-chat Clear.
    db()
      .prepare(
        `UPDATE chat_messages SET archive_batch_id = ?
         WHERE id IN (${placeholders})`
      )
      .run(batchId, ...ids);

    const stats = db()
      .prepare(
        `SELECT MIN(id) AS s, MAX(id) AS e, COUNT(*) AS c,
                COALESCE(SUM(CASE WHEN role='user' THEN LENGTH(content) ELSE 0 END), 0) AS uc
           FROM chat_messages WHERE archive_batch_id = ?`
      )
      .get(batchId) as { s: number | null; e: number | null; c: number; uc: number };
    db()
      .prepare(
        `UPDATE chat_archive_batches
           SET message_start_id = ?, message_end_id = ?,
               message_count = ?, user_char_count = ?
         WHERE id = ?`
      )
      .run(stats.s, stats.e, stats.c, stats.uc, batchId);
    return batchId;
  })();
}

// Per-conversation in-flight guard so a burst of messages doesn't fire
// overlapping rolls for the same chat. The transaction in createRollingBatch is
// the real correctness guarantee; this just avoids redundant Claude calls.
const rollInFlight = new Set<string>();

// Async half: create a rolling batch (if due) and compress it into memories.
// Fire-and-forget from the chat POST (with .catch). Safe to call every turn —
// it no-ops cheaply until enough turns have scrolled out of the window.
export async function maybeRollConversationMemory(
  conversationId: string
): Promise<{ rolled: boolean; inserted?: number }> {
  if (rollInFlight.has(conversationId)) return { rolled: false };
  rollInFlight.add(conversationId);
  try {
    const batchId = createRollingBatch(conversationId);
    if (batchId === null) return { rolled: false };
    // Compress through the shared single-flight sweep rather than calling
    // compressBatch(batchId) directly. compressBatch has no atomic per-batch
    // claim — it reads memory_extracted_at up front and only writes it after
    // two awaits (Claude, then Voyage). A direct call here doesn't hold the
    // compressionInFlight guard, so a concurrent maybeCompressChatSessions
    // (fired by Clear or runMaintenanceSweep) could select this same still-
    // pending batch and compress it a second time — duplicate memories (the
    // 0.88 dedup only catches near-identical phrasings, and nothing at all
    // when embeddings are unavailable) plus a wasted Claude call. Routing
    // through the sweep serialises all compression under one guard; if the
    // sweep is already busy, this batch stays pending and the next sweep
    // drains it (the standard safety net).
    const r = await maybeCompressChatSessions();
    return { rolled: true, inserted: r.inserted };
  } finally {
    rollInFlight.delete(conversationId);
  }
}

const REEMBED_BATCH_LIMIT = 32;

/**
 * Fill in embeddings for non-deleted memories that have none. Processes up to
 * REEMBED_BATCH_LIMIT in a single Voyage request so it stays within the rate
 * limit; the next sweep picks up any remainder. Best-effort and fail-quiet —
 * recall works without embeddings, this just improves it.
 */
export async function reembedMissingMemories(
  limit: number = REEMBED_BATCH_LIMIT
): Promise<{ repaired: number }> {
  if (!embeddingsEnabled()) return { repaired: 0 };
  try {
    const rows = db()
      .prepare(
        `SELECT id, text FROM chat_memories
         WHERE deleted_at IS NULL AND embedding IS NULL
         ORDER BY id DESC LIMIT ?`
      )
      .all(Math.max(1, Math.floor(limit))) as Array<{ id: number; text: string }>;
    if (rows.length === 0) return { repaired: 0 };

    const vectors = await embedBatch(
      rows.map((r) => r.text),
      "document"
    );
    if (!vectors || vectors.length !== rows.length) return { repaired: 0 };

    const update = db().prepare(
      `UPDATE chat_memories SET embedding = ? WHERE id = ? AND embedding IS NULL`
    );
    let repaired = 0;
    for (let i = 0; i < rows.length; i++) {
      const v = vectors[i];
      if (!v) continue;
      update.run(encodeEmbedding(v), rows[i].id);
      repaired++;
    }
    return { repaired };
  } catch (e) {
    console.warn("[chatMemory] reembed failed:", (e as Error).message);
    return { repaired: 0 };
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

export type PendingBatchDetail = {
  id: number;
  conversation_id: string;
  archived_at: string;
  message_count: number;
  user_char_count: number;
  failed_attempts: number;
  extraction_error: string | null;
};

/**
 * One row per pending (not-yet-extracted) chat archive batch. Used by the
 * /memory page so the user can SEE what's pending — id, age, attempts,
 * the last extraction error if any — rather than just a "N pending" count
 * with no detail and no way to debug.
 *
 * NOTE: the timestamp column on chat_archive_batches is `archived_at`, not
 * `created_at`. Using the wrong name throws at query time, which 500s the
 * whole /api/chat/memories GET and renders /memory as "Loading…" + "No
 * chat memories yet" simultaneously. Test/chatMemoryFlow pins this.
 */
export function pendingBatchDetails(): PendingBatchDetail[] {
  return db()
    .prepare(
      `SELECT id, conversation_id, archived_at, message_count, user_char_count,
              failed_attempts, extraction_error
       FROM chat_archive_batches
       WHERE memory_extracted_at IS NULL
       ORDER BY id ASC`
    )
    .all() as PendingBatchDetail[];
}

/**
 * Force-release the in-flight guard. Used by the manual "Process pending
 * now" path so a sweep that crashed mid-await (and left the lock set)
 * can be unblocked without a process restart.
 */
export function clearCompressionInFlight(): void {
  compressionStartedAt = null;
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
 * Surface the chat memories relevant to `message`.
 *
 * Strategy (see RECALL_INCLUDE_ALL_MAX): for a SMALL corpus the whole set
 * fits in the prompt budget, so we include everything — ordered most-relevant
 * first when we can embed the query, most-recent first otherwise. Semantic
 * gating is only applied to a LARGE corpus, and even then we always blend in
 * the most-recent few so a brand-new memory is never invisible.
 *
 * Fail-open by design: a missing API key, Voyage outage, or decode failure
 * degrades to RECENCY (not emptiness) so chat never loses durable context
 * just because the embedding step hiccuped, and never 500s.
 */
export async function recallChatMemories(
  message: string,
  k: number = RECALL_K,
  minSim: number = RECALL_MIN_SIMILARITY
): Promise<{ items: RecalledMemory[] }> {
  try {
    // Fetch the whole non-deleted set, newest first. Rows may or may not
    // carry an embedding — recall must work either way.
    const rows = db()
      .prepare(
        `SELECT id, category, text, embedding, created_at FROM chat_memories
         WHERE deleted_at IS NULL
         ORDER BY id DESC`
      )
      .all() as Array<{
      id: number;
      category: string;
      text: string;
      embedding: Buffer | null;
      created_at: string;
    }>;
    if (rows.length === 0) return { items: [] };

    // Best-effort query embedding. Null is fine — we fall back to recency.
    let queryVec: Float32Array | null = null;
    if (message && message.trim() && embeddingsEnabled()) {
      try {
        queryVec = await embed(message, "query");
      } catch {
        queryVec = null;
      }
    }

    // recencyRank: 0 = most recent (rows arrive id DESC). Score defaults to 0
    // for rows we can't compare (no query vec, or no row embedding), so they
    // naturally fall back to recency ordering.
    const scored = rows.map((r, recencyRank) => {
      let score = 0;
      if (queryVec && r.embedding) {
        const vec = decodeEmbedding(r.embedding);
        if (vec) score = cosineSimilarity(queryVec, vec);
      }
      return {
        id: r.id,
        category: normaliseChatMemoryCategory(r.category),
        text: r.text,
        score,
        created_at: r.created_at,
        recencyRank,
      };
    });

    // Small corpus: include everything. Most-relevant first when we have a
    // query vector, most-recent first otherwise. formatRecalledMemoriesBlock
    // applies the final char-budget cap.
    if (rows.length <= RECALL_INCLUDE_ALL_MAX) {
      scored.sort(
        (a, b) => b.score - a.score || a.recencyRank - b.recencyRank
      );
      return { items: scored.map(stripRecencyRank) };
    }

    // Large corpus: semantic top-K above threshold, unioned with the most
    // recent few (deduped by id, semantic ordering preserved).
    const semantic = scored
      .filter((s) => s.score >= minSim)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
    const recent = scored.slice(0, RECALL_RECENT_FLOOR);

    const seen = new Set<number>();
    const merged: RecalledMemory[] = [];
    for (const s of [...semantic, ...recent]) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      merged.push(stripRecencyRank(s));
    }
    return { items: merged };
  } catch (e) {
    console.warn("[chatMemory] recall failed:", (e as Error).message);
    return { items: [] };
  }
}

function stripRecencyRank(
  s: RecalledMemory & { recencyRank: number }
): RecalledMemory {
  const { recencyRank: _omit, ...rest } = s;
  void _omit;
  return rest;
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
