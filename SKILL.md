---
name: remarkabler
description: Self-hosted Next.js app that ingests reMarkable tablet PDFs, OCRs every handwritten page with Claude, builds an evolving profile of the owner, and surfaces it via chat (with durable cross-session memory), reflections, a 3D /mind embedding map, a native /graph entity relationship map, an Insights record, a cost calendar, and weekly off-site backup. Long-horizon personal record, single-user. Use this skill whenever the working directory is `remarkabler`.
---

# Remarkabler — one-page project index

A long-horizon (5–10 year) personal record. Owner exports a notebook as PDF
from their reMarkable, uploads (or auto-ingests via Dropbox), and Claude
transcribes every handwritten page. The owner then chats over their notes,
generates insights, watches a 3D map of their themes plus a native entity
relationship graph, and accumulates a profile Claude continuously refines.

Companion docs — read in order if any is unfamiliar:

| Doc | What it covers |
|---|---|
| **this file** | One-page index. Where things live, what they do, what env vars exist. Skim first. |
| **`ARCHITECTURE.md`** | The whole-app structure map: data-flow + layer diagrams, annotated file tree, lib modules by domain, data model, external services. |
| **`AGENTS.md`** | Tool-agnostic onboarding (works for any AI agent, not just Claude). Includes the "what an AI can/can't do in this container" boundaries and Graphify-first orientation rule. |
| **`CLAUDE.md`** | Claude-specific deep detail + the load-bearing "do not regress" rules with full reasoning. The mandatory Codex/Claude Code/Antigravity Graphify workflow is at the top. |
| **`DESIGN.md`** | UI tokens: single-font Clear Sans, amber accent, color/spacing/focus rules. **Read before any UI change.** |
| **`CHANGELOG.md`** | What changed and why, newest first. |
| **`docs/design/mockup.html`** | Self-contained visual reference of the design tokens (light + dark side-by-side). |
| **`docs/sessions/*.md`** | Per-session decision logs (model choices, cost trade-offs, etc.). |

## At a glance

- **Stack:** Next.js 16 App Router, TypeScript, `better-sqlite3`,
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
| `claude.ts` | Every Anthropic SDK call. Model resolution chain: in-app setting → env var → built-in default, per role (`modelMain` / `modelChat` / `modelChatFallback` / `modelChatMemory`). `analyzeEntryContent` extracts themes + sentiment + summary + named entities (people / places / projects) in one Sonnet call per page. Also `composeEntityWiki`/`cleanEntityWiki` (life-wiki), `findEntityDuplicates`/`parseEntityDuplicates` (dedup), `extractTaggingEntities` (bounded entities-only extraction for auto-tagging). |
| `chatTools.ts` | Tool-calling toolbox for chat — `search_diary` (hybrid FTS + Voyage), `get_entries_by_date`, summaries (day/week/month), current time, locations, chat-history search, `top_entities`, `pages_for_entity`, `related_entities` (entity-graph edges via `entityGraph.ts`). |
| `chatMemory.ts` | Durable cross-chat memory: extract on Clear → embed → dedup → insert → recall top-K on next turn. Fail-open. Also the rolling-memory pair (`createRollingBatch`/`maybeRollConversationMemory`) that compresses an active chat's out-of-window turns before a Clear. |
| `chatMemoryBackfill.ts` | Pure helpers that split a long history into transcript-fit chunks (`CHUNK_TARGET_CHARS = 12_000`) so backfill doesn't truncate. |
| `embeddings.ts` | Voyage AI: token-budget batching, 429 retry, Float32 BLOB codec, cosine similarity. Gated by `VOYAGE_API_KEY`. |
| `notes.ts` | `createNotebook` + `queueNotebookProcessing` (durable, bounded background OCR), `runMaintenanceSweep` (one throttled cascade for all chores), entry-date parsing + carry-forward, discipline-repo sync. Owns the synthetic-notebook ids (`DISCIPLINE_ID`, `CONVERSATIONS_NOTEBOOK_ID`, `REFLECTIONS_NOTEBOOK_ID`, `DECISIONS_NOTEBOOK_ID`) + real `CHAT_DIARY_NOTEBOOK_ID`, and the exclude-helpers `nonDiaryNotebookExcludeIdsForChat`/`ForMind`. |
| `pendingShares.ts` | Inert public share-target quarantine: persistent rate/count/byte/retention caps; authenticated approval moves a PDF into the notebook OCR queue. |
| `profile.ts` | The evolving "memory of you" (versioned `profile` table). |
| `mind.ts` | `/mind` analytics: heatmap, theme cloud, sentiment timeline, 3D embedding map. Shared PCA + persisted axis labels. The `analyzePending` in-flight-guard pattern is reused by `chatMemory`. Excludes discipline + all three synthetic notebooks. |
| `entityGraph.ts` | Pure `computeRelatedEntities` — ranks entities that share diary days with a target (the co-occurrence graph behind `related_entities` + the Obsidian graph). |
| `diaryGraph.ts` | DB-backed graph payload for `/graph`: canonical entities, diary days, exported conversations/reflections/decisions, co-occurrence edges, typed `entity_relationships`, source evidence, and Discipline exclusion. |
| `entityMerge.ts` | Entity de-dup: `applyEntityAlias` (fold on insert), `mergeEntity`/`mergeEntitiesManually`, the Claude-driven `dedupeAllEntities`. Keyed on `name_norm`, so a merge is a data rewrite with no read-path changes. |
| `entityWiki.ts` | The "life wiki": a deep Claude-written bio per entity (`composeEntityWiki`), content-addressed by `source_hash`, embedded atop the entity's Obsidian stub. `refreshEntityWiki`/`maybeRefreshEntityWiki` (opt-in, batched). |
| `mcp.ts` | MCP bridge — derives the remote tool list from `CHAT_TOOLS` + MCP-only reads (`get_profile`/`recall_memories`/`get_guidance`), the write tools, and fail-closed bearer auth. See the MCP route below. |
| `mcpOauth.ts` | Minimal OAuth 2.1 server for the claude.ai connector (DCR + PKCE-S256, opaque tokens stored hashed, consent reuses `MCP_AUTH_TOKEN`). |
| `conversationWiki.ts` / `conversationEntities.ts` | Phase B/C: store + verbatim-note renderer for exported subscription-conversations (`mcp_conversations`), and the "librarian" data layer (synthetic pages under `CONVERSATIONS_NOTEBOOK_ID`, `entity_conversation_notes`, heartbeat). |
| `reflectionWiki.ts` / `reflectionEntities.ts` | Standalone AI-written reflections (`mcp_reflections`, `Reflections/` folder) — 1:1 mirror of the conversation pair, its own table/folder. Entity-linked. |
| `decisionWiki.ts` / `decisionEntities.ts` | Decision Records (`mcp_decisions`, `Decisions/` folder) — 1:1 mirror of the reflection pair. Entity-linked. |
| `chatDiary.ts` | "Chat diary": a REAL diary entry composed by talking to Claude (`save_diary_entry`). Lands in the non-excluded `CHAT_DIARY_NOTEBOOK_ID` and runs the full post-ingest pipeline (embed → profile fold → analyze → day-file export). |
| `entityTagging.ts` | Guaranteed, app-initiated entity-tagging for conversations/reflections/decisions, gated by `autoTagExportsEnabled()` (`MCP_AUTO_TAG_EXPORTS` layered on `MCP_ALLOW_WIKI_LINKING`). `sampleForTagging` + `autoTag*` + sweep backstops. |
| `usage.ts` | `recordUsage` (per-call cost from list prices) + KST-aware monthly/daily/total aggregation. |
| `extractText.ts` | Convert PDF/Word attachments to text on the server before sending to Claude. Saves ~3-5× tokens. Handwritten PDFs fall back to raw. |
| `auth.ts` / `webauthn.ts` | Passcode + passkey (WebAuthn). HMAC cookie + per-device server session, 24h inactivity, local/global revocation, passcode lockout recovery. |
| `backup.ts` | Weekly tar.gz of `/data` to a private GitHub repo, keep-last-12. `dropbox_refresh_token` redacted. |
| `dropbox.ts` | OAuth refresh-token flow, folder polling, dedupe by `dropbox_file_id` **+ tombstones**. Fired from `runMaintenanceSweep`. Also opt-in **per-day** diary auto-export back to Dropbox (`maybeExportDiaryToDropbox`, one `.md` per day into `dropboxExportFolder`, needs `files.content.write` scope) + the conversation/reflection/decision vault exporters. |
| `diaryExport.ts` / `diaryExportDb.ts` | Diary→Markdown: pure assembly, carry-forward, per-day file builder + DB renderers. **Obsidian-native**: entity `[[wikilinks]]`, entity **stub notes** (with `## Related notes` back-links to tagged conversations/reflections/decisions), and the **vault-structure "second brain" notes** (`Home.md`, `People|Places|Projects.md`, `Profile.md` — `renderVaultStructureFiles`/`vaultStructureFileNames`). Excludes discipline + synthetic notebooks from day files, includes them in the entity graph/stubs. |
| `notebookDedup.ts` / `notebookDedupDb.ts` | Flags old notebooks whose diary dates are already covered by a reMarkable-cloud import (`/notebooks` "Possible duplicates"). |
| `remarkableCloud.ts` / `rmRender.ts` / `remarkableImport.ts` / `remarkableSync.ts` | reMarkable-cloud secondary source (rmapi-js, unofficial). Pair+list, `.rm`→PDF render (image-only), on-demand import, zero-tap page-hash sync. |
| `owntracks.ts` / `location.ts` | OwnTracks ingestion, stay clustering, reverse-geocoding (Nominatim cache). |
| `github.ts` | Discipline-repo Contents API fetcher. |
| `format.ts` / `cleanup.ts` / `upload.ts` | KST helpers, orphan-attachment sweep, upload validation. |

## Database tables

| Table | What it holds |
|---|---|
| `settings` | key/value store (model overrides, persisted PCA axes, last-maintenance-at, `schema_pages_fts_v3` migration flag). |
| `notebooks` | One row per approved/ingested notebook. `status` is `queued` / `processing` / `done` / `error`. `dropbox_file_id` supports ingest dedupe. |
| `pending_shares` / `share_rate_events` | Inert Android share submissions awaiting authenticated approval + hashed-source throttle events. |
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
| `entry_entities` | Per-page named entities (`kind` ∈ person/place/project, `name`, `name_norm` for grouping). Populated alongside `entry_analysis`. Powers `top_entities`/`pages_for_entity`/`related_entities`. ON DELETE CASCADE from `pages`. |
| `entity_aliases` | Merge records folding a duplicate spelling into a canonical `(kind, name_norm)` (`lib/entityMerge.ts`). |
| `entity_wiki` | Claude-written life-wiki bio per entity + a `source_hash` of its mentioning pages. Embedded atop the entity's Obsidian stub (`lib/entityWiki.ts`). |
| `entity_conversation_notes` | The Phase C librarian agent's OWN notes about an entity — kept SEPARATE from `entity_wiki` so the two authors never clobber each other (`lib/conversationEntities.ts`). |
| `mcp_conversations` | Full subscription-conversation transcripts exported via `export_conversation`, filed verbatim into `Conversations/`. `filed_at` = Dropbox filing, `linked_at` = librarian tagging (`lib/conversationWiki.ts`). |
| `mcp_reflections` | Standalone AI-written reflections saved via `save_reflection`, filed into `Reflections/`. Own table/folder, entity-linked (`lib/reflectionWiki.ts`). |
| `mcp_decisions` | Decision Records saved via `save_decision`, filed into `Decisions/`. Own table/folder, entity-linked (`lib/decisionWiki.ts`). |
| `mcp_audit` | Size-capped log of MCP tool calls + failed auth attempts. |
| `mcp_oauth_clients` / `mcp_oauth_tokens` | OAuth 2.1 state for the claude.ai connector — DCR clients + issued access/refresh tokens stored HASHED, each bound to its authorizing `MCP_AUTH_TOKEN` (`lib/mcpOauth.ts`). |
| `dropbox_ingest_tombstones` / `remarkable_ingest_tombstones` | Deleted source ids the Dropbox watcher / reMarkable sweep must NOT re-ingest (`deleteNotebook` writes them). |
| `locations` | Manual one-tap log (legacy). |
| `location_points` | OwnTracks raw points. |
| `route_stops` | Clustered stays (place + dwell). |
| `geocode_cache` | Nominatim cache (key → place). |
| `credentials` | WebAuthn credentials (passkey). |
| `app_sessions` | Per-device session id, expiry, and sliding activity time; enables true inactivity and revocation boundaries. |
| `api_usage` | One row per Claude/Voyage call. Powers `/usage`. |

## API routes (`app/api/*`)

- **Chat:** `chat` (POST send, GET history, DELETE = Clear = archive+batch+extract),
  `chat/attachment/[id]`, `chat/memories` (GET list+status), `chat/memories/[id]` (DELETE soft-delete),
  `chat/memories/retry/[batchId]` (POST reset stuck batch),
  `chat/memories/backfill-all` (POST chunked re-process, `?reset=true` for destructive clean re-run).
- **Notes:** `notebooks`, `notebooks/[id]/pages`, `shares` (authenticated pending-share approval/discard), `diary`, `graph`.
- **Memory/profile:** `memory` (the `/memory` page's profile editor — *not* chat memory).
- **Insights:** `insights`.
- **Mind:** `mind`, `mind/analyze`, `mind/reanalyze`, `mind/axis-labels`, `mind/reparse-dates`, `mind/merge-entities` (Claude-driven entity dedup), `mind/build-wiki` (batched life-wiki build).
- **Embeddings:** `embeddings/status` (GET status + POST run-backfill).
- **Backup:** `backup` (GET status, POST run-now).
- **Dropbox:** `dropbox/connect`, `/callback`, `/status`, `/disconnect`,
  `/export` (toggle + run the opt-in diary auto-export back to Dropbox).
- **reMarkable cloud (Phase 2 — zero-tap sync):** `remarkable/connect`
  (pair via one-time code + list), `/refresh` (re-list), `/disconnect`,
  `/status` (+ sync status), `/import` (on-demand one notebook), `/compare`
  (quality report vs existing entries), `/autosync` (folder toggle). Backed
  by `lib/remarkableCloud.ts` (rmapi-js) + `lib/rmRender.ts` (`.rm`→PDF via
  the image's rm2pdf/pypdf) + `lib/remarkableImport.ts` (dedupe on
  `remarkable_doc_id`) + `lib/remarkableSync.ts` (sweep-driven page-hash
  incremental polling of imported notebooks + enabled folders).
- **Discipline:** `discipline` (GET + POST sync), `discipline/settings` (enable toggle).
- **Location:** `location` (GET + POST manual log), `location/settings`, `owntracks` (`?token=` push endpoint).
- **MCP:** `mcp` (remote MCP endpoint, Streamable HTTP — read-only diary tools
  for Claude on the user's subscription, + three MCP-only companion tools
  `get_profile`/`recall_memories`/`get_guidance`. **Sanctioned write tools, each
  OFF by default behind its OWN flag** (independent privacy tradeoffs, so any
  subset can be enabled):
  - `export_conversation` (`MCP_ALLOW_CONVERSATION_EXPORT=true`) — files a full
    conversation verbatim into `Conversations/` (Phase B, `lib/conversationWiki.ts`).
  - `save_reflection` (`MCP_ALLOW_REFLECTION_SAVE=true`) — Claude's own one-sided
    reflection into `Reflections/` (`lib/reflectionWiki.ts`).
  - `save_decision` (`MCP_ALLOW_DECISION_SAVE=true`) — a Decision Record into
    `Decisions/` (`lib/decisionWiki.ts`).
  - `save_diary_entry` (`MCP_ALLOW_DIARY_WRITE=true`) — the ONE write that is
    REAL diary: composed by talking to Claude, lands in the non-excluded
    `CHAT_DIARY_NOTEBOOK_ID` and runs the full profile/analytics pipeline
    (`lib/chatDiary.ts`).
  - Six Phase C "librarian" tools behind one flag `MCP_ALLOW_WIKI_LINKING=true`
    (reads `list_unlinked_conversations`/`get_conversation`/`get_entity_wiki`,
    writes `tag_conversation_entities`/`update_entity_conversation_notes`/
    `record_librarian_heartbeat` — lets a SEPARATE, subscription-billed Claude
    Code agent link conversations into the entity graph/wiki; `lib/conversationEntities.ts`).
  Layered on top: `MCP_AUTO_TAG_EXPORTS=true` (requires `MCP_ALLOW_WIKI_LINKING`)
  makes the app itself guarantee entity-tagging right after each export/save,
  on its own `ANTHROPIC_API_KEY` (`lib/entityTagging.ts`). Sensitive tools
  (`get_recent_locations`/`search_chat_history`) excluded unless
  `MCP_ALLOW_SENSITIVE_TOOLS=true`. Bearer auth via `MCP_AUTH_TOKEN`
  (comma-separated = zero-downtime rotation),
  fails closed when unset; backed by `lib/mcp.ts`; setup in `docs/mcp-setup.md`)
  + authenticated `mcp/audit` and `mcp/oauth/grants`, plus public
  `mcp/oauth/{register,authorize,token,protected-resource,authorization-server}`
  (minimal OAuth 2.1 server so the claude.ai connector can complete its OAuth
  handshake — consent reuses `MCP_AUTH_TOKEN`; backed by `lib/mcpOauth.ts`;
  `/.well-known/oauth-*` discovery via `next.config.mjs` rewrites).
- **Librarian status:** `librarian` (GET-only heartbeat for the Phase C
  agent — `lib/conversationEntities.ts`; surfaced on `/memory`).
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
| `/mind` | Heatmap (6 months) + theme cloud + "Who, where, what" (top people/places/projects) + sentiment timeline + 3D embedding map (`Map3D.tsx`). Axis labels under the map. "Re-analyse" / "Re-label" / "Merge duplicate names" / "Merge specific names" / "Build life wiki" buttons. |
| `/graph` | Interactive native diary graph. Renders entities, diary days, exported Claude notes, co-occurrence links, typed relationships, filters/search, highlighting, and source evidence. |
| `/memory` | Profile editor (the textarea) + Discipline, Location, OwnTracks, Models, Voyage status, Dropbox (+ vault auto-export toggle), Backup, reMarkable import/auto-sync, **Chat memory** (collapsible), Librarian heartbeat status, Export sections. |
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
12. `maybeSyncRemarkable()` — reMarkable-cloud zero-tap sync (own interval/backoff/quiesce gates).
13. `maybeRefreshEntityWiki()` — regenerate stale entity "life-wiki" profiles (once opted in; a few/tick).
14. `maybeExportConversationsToDropbox()` / `maybeExportReflectionsToDropbox()` / `maybeExportDecisionsToDropbox()` — file any unfiled vault notes (backstops the inline export from each write tool).
15. `maybeRollConversationMemory()` — roll an active chat's out-of-window turns into memory before a Clear.
16. `maybeAutoTagUnlinkedConversations()` / `...Reflections()` / `...Decisions()` — guaranteed app-side entity-tagging backstop (no-op unless `MCP_AUTO_TAG_EXPORTS` + `MCP_ALLOW_WIKI_LINKING`).

## Models

| Role | Setting key | Env var | Default |
|---|---|---|---|
| OCR / profile build/update / insights / daily summary / book | `model_main` | `CLAUDE_MODEL` | `claude-opus-4-7` |
| Chat | `model_chat` | `CHAT_MODEL` | `claude-sonnet-5` |
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
- **MCP (subscription-Claude diary access):** `MCP_AUTH_TOKEN` (16+ chars,
  comma-separated for rotation; unset = endpoint disabled/fails closed),
  `APP_BASE_URL` (fixes the OAuth public origin). Write-tool flags, each OFF by
  default and independent: `MCP_ALLOW_CONVERSATION_EXPORT`,
  `MCP_ALLOW_REFLECTION_SAVE`, `MCP_ALLOW_DECISION_SAVE`, `MCP_ALLOW_DIARY_WRITE`,
  `MCP_ALLOW_WIKI_LINKING` (the six librarian tools). Layered:
  `MCP_AUTO_TAG_EXPORTS` (requires `MCP_ALLOW_WIKI_LINKING`). Read-surface:
  `MCP_ALLOW_SENSITIVE_TOOLS` (exposes location + chat-history search),
  `MCP_EXCLUDE_TOOLS` (add more exclusions; can never re-include a sensitive tool).

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
11. **The MCP endpoint is read-only by default and fails closed.** Every write tool is OFF behind its own flag, deterministic-destination, size-capped; a missing/short `MCP_AUTH_TOKEN` returns 503 (never "open"); sensitive tools stay excluded unless `MCP_ALLOW_SENSITIVE_TOOLS=true`.
12. **Synthetic notebooks excluded from analytics, included in entity stubs and `/graph`; Remarkabler is the SOLE deterministic writer of its vault.** `CHAT_DIARY_NOTEBOOK_ID` is the one synthetic-notebook exception — it's REAL diary and stays on every list.
13. **Every data API route gates behind the app lock — `test/authGuard.test.ts` enforces it.** There's no `middleware.ts`; each route calls `isAuthenticated()`/`requireAuth()` (`lib/auth.ts`) and the layout gates the UI. Only login + the MCP bearer endpoint + the OAuth handshake (+ `csp-report`) are on the PUBLIC allowlist. Lock-off (`APP_PASSCODE` unset) is loud now: boot warning + red in-app banner. Baseline hardening headers (HSTS/COOP/CORP/etc.) live in `next.config.mjs`.

## Known intentional limits

- reMarkable cloud zero-tap sync (Phase 2) is scoped to imported notebooks +
  auto-sync-enabled folders — never the whole account. The renderer lives only
  in the Railway Docker image. It rides the unofficial protocol, so Dropbox
  export-from-device stays the reliable fallback and is never removed.
- reMarkable PDFs are image-based ink with no text layer — only vision OCR (Claude) reads them.
- PWA share target + voice input work on Android Chrome only.
- ~5 second async-gap window after Clear before new chat memories surface. Acceptable for v1.

## Graphify Phase A

[safishamsi/graphify](https://github.com/safishamsi/graphify) is a CLI +
MCP server that builds a JSON knowledge graph from ingested files and
exposes graph query/path/explain tools to an agent. It was originally evaluated
2026-06-19 for use in Remarkabler's chat and rejected as a runtime diary feature
for three reasons:

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

Phase A was finalized on 2026-07-25 as a **code-only developer artifact**, not
as an app feature. The committed `graphify-out/` snapshot contains
`graph.html`, `graph.json`, and `GRAPH_REPORT.md`, generated with
`graphify extract . --code-only` and `graphify cluster-only . --no-label`.
See `docs/graphify-phase-a.md` for the exact commands and ignored local cache
files.

The **one piece of Graphify's idea that fit the diary product itself** —
structured entities (people / places / projects) for aggregate queries Claude
can't answer cheaply by grepping — is built native here as the **entities
layer**: `analyzeEntryContent` extracts entities alongside themes / sentiment /
summary, persists them to `entry_entities`, exposes the `top_entities` chat
tool for aggregate queries, and now renders `/graph` via `lib/diaryGraph.ts`.
Future sessions: use Graphify for developer navigation only. If new diary
structural-retrieval needs come up, extend the native entities layer or add a
focused chat tool — don't route user diary queries through the external graph
engine.

## Working with the owner

- Non-technical. Mobile-first. Communicates via screenshots. Give step-by-step instructions.
- Vision: "Claude continuously fed my reMarkable notes to help my life in every way."
- Verify with `npm run build` (and `npm test` for pure logic) before claiming a task is done. Claude/Voyage features can only be fully verified on Railway — say so honestly.
