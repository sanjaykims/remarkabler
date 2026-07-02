---
name: remarkabler
description: Self-hosted Next.js app that ingests reMarkable tablet PDFs, OCRs every handwritten page with Claude, builds an evolving profile of the owner, and surfaces it via chat (with durable cross-session memory), reflections, a 3D /mind embedding map, an Insights record, a cost calendar, and weekly off-site backup. Long-horizon personal record, single-user. Use this skill whenever the working directory is `remarkable-feed`.
---

# Remarkabler — one-page project index

A long-horizon (5–10 year) personal record. Owner exports a notebook as PDF
from their reMarkable, uploads (or auto-ingests via Dropbox), and Claude
transcribes every handwritten page. The owner then chats over their notes,
generates insights, watches a 3D map of their themes, and accumulates a
profile Claude continuously refines.

Companion docs — read in order if any is unfamiliar:

| Doc | What it covers |
|---|---|
| **this file** | One-page index. Where things live, what they do, what env vars exist. Skim first. |
| **`AGENTS.md`** | Tool-agnostic onboarding (works for any AI agent, not just Claude). Includes the "what an AI can/can't do in this container" boundaries. |
| **`CLAUDE.md`** | Claude-specific deep detail + the load-bearing "do not regress" rules with full reasoning. |
| **`DESIGN.md`** | UI tokens: single-font Clear Sans, amber accent, color/spacing/focus rules. **Read before any UI change.** |
| **`CHANGELOG.md`** | What changed and why, newest first. |
| **`docs/design/mockup.html`** | Self-contained visual reference of the design tokens (light + dark side-by-side). |
| **`docs/sessions/*.md`** | Per-session decision logs (model choices, cost trade-offs, etc.). |

## At a glance

- **Stack:** Next.js 14 App Router, TypeScript, `better-sqlite3`,
  `@anthropic-ai/sdk`, optional Voyage AI for embeddings, Tailwind.
- **Deploy:** Railway, auto-deploys on every push to `main`. Persistent
  volume mounted at `/data` holds SQLite + uploaded PDFs.
- **Owner:** non-technical, mobile-first (Android Chrome), KST timezone.
- **Tests:** `npm test` runs Vitest over pure-logic units and DB-backed
  integration tests (against throwaway SQLite). `npm run lint` + `npm run
  build` are the integration safety nets. Claude/Voyage features need real
  keys, so they can only be fully verified on Railway.

## Modules (`lib/`)

| File | Role |
|---|---|
| `db.ts` | SQLite connection, schema, migrations. All `ALTER TABLE ADD COLUMN` and `CREATE INDEX` live here. Idempotent. |
| `claude.ts` | Every Anthropic SDK call. Model resolution chain: in-app setting → env var → built-in default, per role (`modelMain` / `modelChat` / `modelChatFallback` / `modelChatMemory`). `analyzeEntryContent` extracts themes + sentiment + summary + named entities (people / places / projects) in one Sonnet call per page. |
| `chatTools.ts` | Tool-calling toolbox for chat — `search_diary` (hybrid FTS + Voyage), `get_entries_by_date`, summaries (day/week/month), current time, locations, chat-history search. |
| `chatMemory.ts` | Durable cross-chat memory: extract on Clear → embed → dedup → insert → recall top-K on next turn. Fail-open. |
| `chatMemoryBackfill.ts` | Pure helpers that split a long history into transcript-fit chunks (`CHUNK_TARGET_CHARS = 12_000`) so backfill doesn't truncate. |
| `embeddings.ts` | Voyage AI: token-budget batching, 429 retry, Float32 BLOB codec, cosine similarity. Gated by `VOYAGE_API_KEY`. |
| `notes.ts` | `createNotebook` / `processNotebook` (background OCR), `runMaintenanceSweep` (one throttled cascade for all chores), entry-date parsing + carry-forward, discipline-repo sync. |
| `profile.ts` | The evolving "memory of you" (versioned `profile` table). |
| `mind.ts` | `/mind` analytics: heatmap, theme cloud, sentiment timeline, 3D embedding map. Shared PCA + persisted axis labels. The `analyzePending` in-flight-guard pattern is reused by `chatMemory`. |
| `usage.ts` | `recordUsage` (per-call cost from list prices) + KST-aware monthly/daily/total aggregation. |
| `extractText.ts` | Convert PDF/Word attachments to text on the server before sending to Claude. Saves ~3-5× tokens. Handwritten PDFs fall back to raw. |
| `auth.ts` / `webauthn.ts` | Passcode + passkey (WebAuthn). HMAC session cookie. 24h server-side inactivity timeout. |
| `backup.ts` | Weekly tar.gz of `/data` to a private GitHub repo, keep-last-12. `dropbox_refresh_token` redacted. |
| `dropbox.ts` | OAuth refresh-token flow, folder polling, dedupe by `dropbox_file_id`. Fired from `runMaintenanceSweep`. Also opt-in diary auto-export back to Dropbox (`maybeExportDiaryToDropbox`, needs `files.content.write` scope). |
| `diaryExport.ts` / `diaryExportDb.ts` | Diary→Markdown: pure assembly + date carry-forward (`diaryExport`, unit-tested) and the DB renderer (`renderDiaryMarkdown`) shared by the download route + Dropbox auto-export. Excludes the discipline notebook. |
| `owntracks.ts` / `location.ts` | OwnTracks ingestion, stay clustering, reverse-geocoding (Nominatim cache). |
| `github.ts` | Discipline-repo Contents API fetcher. |
| `format.ts` / `cleanup.ts` / `upload.ts` | KST helpers, orphan-attachment sweep, upload validation. |

## Database tables

| Table | What it holds |
|---|---|
| `settings` | key/value store (model overrides, persisted PCA axes, last-maintenance-at, `schema_pages_fts_v3` migration flag). |
| `notebooks` | One row per uploaded/ingested notebook. `status` ∈ `processing` / `done` / `error`. `dropbox_file_id` for ingest dedupe. |
| `pages` | OCR'd pages. `embedding` BLOB (Voyage Float32), `entry_date` parsed from the diary header. |
| `pages_fts` | FTS5 virtual table over `pages.ocr_text` + `notebook_name`. |
| `chat_messages` | Conversation log. `archived_at` (Clear hides from POST history), `archive_batch_id` (chat-memory link), `model` (which model answered). |
| `chat_attachments` | Per-message file attachments (image/PDF). ON DELETE CASCADE from `chat_messages`. |
| `chat_archive_batches` | One row per Clear. `message_start_id`/`end_id`, `failed_attempts` (bounded retry), `memory_extracted_at`, `memories_inserted`. |
| `chat_memories` | Extracted durable items. 6-value `category`, `text_norm` for exact dedup, `embedding` for cosine recall, `deleted_at` soft delete. |
| `insights` | Generated weekly reflections (Opus). Auto-titled via `generateInsightTitle`. |
| `profile` | Versioned "memory of you" rows. `getCurrentProfile()` returns latest. |
| `daily_summaries` | One row per dated day, generated by `summarizeDay` (Opus). Drives week/month aggregates. |
| `entry_analysis` | Per-page themes/sentiment/summary for `/mind`. Discipline notebook excluded. |
| `entry_entities` | Per-page named entities (`kind` ∈ person/place/project, `name`, `name_norm` for grouping). Populated alongside `entry_analysis`. Powers the `top_entities` chat tool. ON DELETE CASCADE from `pages`. |
| `locations` | Manual one-tap log (legacy). |
| `location_points` | OwnTracks raw points. |
| `route_stops` | Clustered stays (place + dwell). |
| `geocode_cache` | Nominatim cache (key → place). |
| `credentials` | WebAuthn credentials (passkey). |
| `api_usage` | One row per Claude/Voyage call. Powers `/usage`. |

## API routes (`app/api/*`)

- **Chat:** `chat` (POST send, GET history, DELETE = Clear = archive+batch+extract),
  `chat/attachment/[id]`, `chat/memories` (GET list+status), `chat/memories/[id]` (DELETE soft-delete),
  `chat/memories/retry/[batchId]` (POST reset stuck batch),
  `chat/memories/backfill-all` (POST chunked re-process, `?reset=true` for destructive clean re-run).
- **Notes:** `notebooks`, `notebooks/[id]/pages`, `diary`.
- **Memory/profile:** `memory` (the `/memory` page's profile editor — *not* chat memory).
- **Insights:** `insights`.
- **Mind:** `mind`, `mind/analyze`, `mind/reanalyze`, `mind/axis-labels`, `mind/reparse-dates`.
- **Embeddings:** `embeddings/status` (GET status + POST run-backfill).
- **Backup:** `backup` (GET status, POST run-now).
- **Dropbox:** `dropbox/connect`, `/callback`, `/status`, `/disconnect`,
  `/export` (toggle + run the opt-in diary auto-export back to Dropbox).
- **Discipline:** `discipline` (GET + POST sync), `discipline/settings` (enable toggle).
- **Location:** `location` (GET + POST manual log), `location/settings`, `owntracks` (`?token=` push endpoint).
- **Export:** `export` (raw bundle Markdown: profile+diary+chats+insights),
  `export/diary` (diary-only Markdown, per-day, for Obsidian/NotebookLM/backup —
  no LLM cost), `export/book` (Opus editor pass).
- **Settings:** `settings/models` (which model runs each role), `auth`.
- **PWA share:** `app/share/route.ts`.
- **Usage:** `usage` (cost calendar data).

## UI pages (`app/*`)

| Path | What it does |
|---|---|
| `/` | Dashboard. Counts, recent notebooks, latest insight. Fires `runMaintenanceSweep` on load. |
| `/notebooks` | Upload PDFs. Per-notebook expand → status + transcribed pages. Delete. |
| `/chat` | Conversational chat with Claude over the profile. Image/PDF attachments. Voice in/out (Android). Clear button (= archive + chat-memory extraction). Tools include `top_entities` (aggregate "who/where/what do I mention most?") and `pages_for_entity` (drill down to actual pages for a named entity). |
| `/insights` | History of reflections. "Generate now" button (Opus). |
| `/mind` | Heatmap (6 months) + theme cloud + "Who, where, what" (top people/places/projects) + sentiment timeline + 3D embedding map (`Map3D.tsx`). Axis labels under the map. "Re-analyse" / "Re-label" buttons. |
| `/memory` | Profile editor (the textarea) + Discipline, Location, OwnTracks, Models, Voyage status, Dropbox, Backup, **Chat memory** (collapsible), Export sections. |
| `/usage` | Cost calendar (daily/monthly), feature breakdown. KST timezone. |

## UI structure

- **`components/`** — shared UI primitives. `cn` (class join), `Button` /
  `LinkButton`, `Card`, `Section`, `Stat`, `Badge`. Server-safe and
  hook-free so RSC pages can import them. See `DESIGN.md` for tokens.
- **`app/Nav.tsx`** — client component, owns the active-link state
  (amber underline). Rendered inside `app/layout.tsx`'s server-side
  header.
- **`public/fonts/clear-sans-{400,500,700,400-italic}.woff2`** —
  self-hosted Clear Sans. Loaded via `next/font/local` in `layout.tsx`.
  No build-time or runtime external font requests.

## Background sweep — `runMaintenanceSweep()` in `lib/notes.ts`

One throttled cascade (5-minute window, persisted via `last_maintenance_at`).
Fired from `/` page load, `/chat` POST, and a few other entry points. Each
sub-job has its own in-flight guard and conditions; the sweep just nudges
them all.

1. `ensureProfileSeed()` — build first profile if notes exist but profile is empty.
2. `maybeDistillLocation()` — once a week, fold location patterns into profile.
3. `maybeGenerateWeeklyInsight()` — once a week, write a fresh insight.
4. `maybeBackfillEmbeddings()` — embed pages still missing a vector.
5. `maybeBackfillEntryDates()` — parse `YYYY-MM-DD-HHMM-KST` headers.
6. `maybeGenerateDailySummaries()` — fill missing daily summaries (cap 3/tick).
7. `maybeAutoSyncDiscipline()` — once per local day, pull discipline repo.
8. `maybeCleanupOrphanAttachments()` — once a day, sweep orphans.
9. `maybeRunWeeklyBackup()` — once a week, tar.gz `/data` to GitHub.
10. `maybeIngestDropbox()` — Dropbox watcher (own interval gate).
11. `maybeCompressChatSessions()` — chat-memory extractor for any pending batches.

## Models

| Role | Setting key | Env var | Default |
|---|---|---|---|
| OCR / profile build/update / insights / daily summary / book | `model_main` | `CLAUDE_MODEL` | `claude-opus-4-7` |
| Chat | `model_chat` | `CHAT_MODEL` | `claude-sonnet-4-6` |
| Chat fallback (when chat model overloads mid-turn) | `model_chat_fallback` | `CHAT_FALLBACK_MODEL` | `claude-sonnet-4-6` |
| Chat memory extraction | `model_chat_memory` | `CHAT_MEMORY_MODEL` | inherits `model_chat` (Sonnet) |
| Per-entry analysis for `/mind` | n/a | n/a (`CHAT_MODEL`) | Sonnet |
| Axis labelling for `/mind` | n/a | n/a (`CHAT_MODEL`) | Sonnet |
| Insight title | n/a | n/a (`CHAT_MODEL`) | Sonnet |

Each call uses `recordUsage(feature, model, usage)` so the `/usage` page can
attribute cost to features and surfaces.

## Environment variables

**Required:**
- `ANTHROPIC_API_KEY` — Claude API access.

**Recommended:**
- `CLAUDE_MODEL` — main model (default `claude-opus-4-7`).
- `DATA_DIR` — defaults to `./data`; on Railway set to `/data` (mounted volume).

**Optional — feature toggles (set in Railway, then redeploy):**
- `CHAT_MODEL`, `CHAT_FALLBACK_MODEL`, `CHAT_MEMORY_MODEL` — model overrides.
- `VOYAGE_API_KEY` / `VOYAGE_MODEL` — embeddings (without this, recall is keyword-only).
- `APP_PASSCODE` — turns on the passkey/passcode lock.
- `INACTIVITY_HOURS` — server-side session inactivity timeout (default 24).
- `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` — analytics (build-time inlined).
- `DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET` / `APP_BASE_URL` / `DROPBOX_INGEST_PATH` — Dropbox auto-ingest. `OCR_CONCURRENCY_LIMIT` caps shared OCR budget (default 2, max 5).
- `OWNTRACKS_TOKEN` — enables OwnTracks ingestion endpoint. `LOCATION_TZ_OFFSET` (minutes, default 540 = Seoul).
- `DISCIPLINE_REPO` / `DISCIPLINE_GITHUB_TOKEN` / `DISCIPLINE_BRANCH` — GitHub discipline-notes source.
- `BACKUP_REPO` / `BACKUP_GITHUB_TOKEN` — off-site auto-backup.

## Hard-won rules — do not regress

(Full reasoning in `CLAUDE.md`; the load-bearing list:)

1. **Chat reasons over the compact profile, not the whole corpus.** Tool-calling fetches entries on demand. Sending all notes per message once cost ~$0.11/chat.
2. **Clear is a real boundary.** POST history filters `archived_at IS NULL`. Continuity is carried by extracted `chat_memories`. Don't re-feed archived raw messages.
3. **Chat memory recall is fail-open.** Recall errors return empty, never throw. Chat must never 500 because Voyage was down.
4. **Memory extraction is bounded-retry** (max 2). Manual reset via `POST /api/chat/memories/retry/[batchId]`. Don't go back to "advance-and-skip on first failure".
5. **Chat memory backfill is chunked, not single-batch.** Splits each conversation by ~12K chars so a long history doesn't truncate to its tail.
6. **Transcription runs in the background.** `createNotebook` returns immediately. Never make upload/share wait on OCR.
7. **OCR streams the response** (`messages.stream()`) and uses `--- PAGE n ---` delimiters, not JSON.
8. **OCR stays on Opus** for this user (validated on Korean handwriting — `docs/sessions/2026-06-04.md`).
9. **Behind Railway's proxy, `req.url` reports `localhost:8080`.** Never build absolute URLs from it.
10. **One throttled `runMaintenanceSweep`** drives every background job.

## Known intentional limits

- No automatic reMarkable cloud sync (no reliable JS renderer for `.rm`). Manual PDF export or Dropbox export-from-device is the path.
- reMarkable PDFs are image-based ink with no text layer — only vision OCR (Claude) reads them.
- PWA share target + voice input work on Android Chrome only.
- ~5 second async-gap window after Clear before new chat memories surface. Acceptable for v1.

## Evaluated and rejected: Graphify

[safishamsi/graphify](https://github.com/safishamsi/graphify) is a CLI +
MCP server that builds a JSON knowledge graph from ingested files and
exposes `query_graph` / `get_neighbors` / `shortest_path` tools to an
agent. Evaluated 2026-06-19 for use in Remarkabler's chat, rejected for
three reasons:

1. **The core innovation is tree-sitter ASTs over code.** Diary text
   has no equivalent structural skeleton; for non-code content,
   Graphify falls back to LLM-based extraction — token cost shifted
   around, not reduced.
2. **Functional overlap with what we already have.** FTS5 (keyword) +
   Voyage embeddings (semantic) + `entry_analysis` (themes / sentiment
   / summary) + the chat tools in `lib/chatTools.ts` cover almost
   every query shape Graphify would.
3. **Cost math is negative.** Building + maintaining the graph would
   cost ~$2 upfront + ~$1/month per new notebook in LLM extraction.
   Chat is already at ~$0.014/turn with caching — savings ceiling is
   maybe $0.50-1/month. Net loss after engineering + operational cost.

The **one piece of Graphify's idea that did fit** — structured
entities (people / places / projects) for aggregate queries Claude
can't answer cheaply by grepping — is built native here as the
**entities layer**: `analyzeEntryContent` extracts entities alongside
themes / sentiment / summary, persists them to `entry_entities`, and
exposes the `top_entities` chat tool for aggregate queries. Future
sessions: do not re-litigate the Graphify integration. If new
structural-retrieval needs come up, extend the entities layer or add a
focused chat tool — don't wholesale-import an external graph engine.

## Working with the owner

- Non-technical. Mobile-first. Communicates via screenshots. Give step-by-step instructions.
- Vision: "Claude continuously fed my reMarkable notes to help my life in every way."
- Verify with `npm run build` (and `npm test` for pure logic) before claiming a task is done. Claude/Voyage features can only be fully verified on Railway — say so honestly.
