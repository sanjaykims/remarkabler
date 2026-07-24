# AGENTS.md — onboarding for any AI working on this repo

This is the tool-agnostic front door for **any** AI coding agent (a fresh
Claude Code session, Cursor, or anything else) about to work on this
project. Read this first, then the linked docs. The goal: get productive in
one pass without re-deriving what we already know.

> **Companion docs (read in this order if you're new):**
> 1. **`SKILL.md`** — one-page index of the whole project (modules, tables,
>    routes, pages, env vars). Skim this first to know what exists.
> 2. **`CLAUDE.md`** — project specifics + hard rules that override defaults.
> 3. **This file** — orientation, structure map, how to work, what you (the
>    agent) can and can't do in this environment.
> 4. **`DESIGN.md`** — UI tokens (single-font Clear Sans, amber accent,
>    color/spacing/focus). Read before any UI change. Companion preview at
>    `docs/design/mockup.html`.
> 5. **`docs/claude-harness.md`** (+ `.svg`/`.png`) — how the agent harness
>    itself is wired (tools, context, subagents, permissions, MCP).
> 6. **`docs/sessions/*.md`** — decision logs. Read the most recent before
>    touching embeddings, OCR model choice, cost, or backup.
> 7. **`CHANGELOG.md`** — what changed and why, newest first.

---

## 1. What this app is

**Remarkabler** (formerly "Feed Claude"): a self-hosted, single-user Next.js
app. The owner exports a notebook as PDF from their reMarkable tablet,
uploads it, and Claude transcribes (OCR) every handwritten page. They can
then chat over their notes, and the app keeps an evolving "memory" profile
and an accumulating record of "insights" about them. It's a long-horizon
(5–10 year) personal record, not a product for others.

- **Owner/user:** non-technical, works primarily from an Android phone,
  communicates with screenshots, based in Seoul (KST, UTC+9). Give
  mobile-friendly, step-by-step guidance.
- **Stack:** Next.js 14 (App Router, TypeScript), better-sqlite3,
  `@anthropic-ai/sdk`, Tailwind CSS. Optional Voyage AI for embeddings.
- **Deploy:** Railway, auto-deploys on every push to `main`. A persistent
  volume is mounted at `/data` (SQLite DB + uploaded PDFs).

---

## 2. Architecture map

### `lib/` — the core logic
| File | Responsibility |
|---|---|
| `db.ts` | SQLite connection, schema, migrations. Tables: settings, notebooks, pages, pages_fts, chat_messages, insights, credentials, chat_attachments, api_usage, profile, locations, location_points, route_stops, geocode_cache, daily_summaries, entry_analysis (`/mind`), entry_entities (per-page named entities — person/place/project — powering `top_entities`/`pages_for_entity`/`related_entities`), entity_aliases (merge records → canonical `name_norm`), entity_wiki (Claude-written life-wiki bio + `source_hash`), chat_archive_batches + chat_memories (durable chat-memory layer), mcp_conversations (Phase B exported transcripts; `linked_at` = Phase C librarian tagging, separate from `filed_at`'s Dropbox status), mcp_reflections + mcp_decisions (standalone AI-written reflections / Decision Records — own tables, own `Reflections/`/`Decisions/` vault folders), entity_conversation_notes (the Phase C librarian's own entity notes — kept separate from entity_wiki so the two authors never clobber each other), entity_relationships (provenance-scoped typed edges between entities; source columns are part of the PK), mcp_audit (size-capped MCP call/auth log), mcp_oauth_clients + mcp_oauth_tokens (OAuth 2.1 state; tokens stored HASHED + bound to their authorizing secret), dropbox_ingest_tombstones + remarkable_ingest_tombstones (deleted-source ids the ingest paths must not re-add). One-time chunked backfill (via `chatMemoryBackfill.chunkedBackfillForConversation`) creates batches for chats archived before the chat-memory feature shipped — chunked so a long history under compressBatch's 16K-char cap produces many batches, not one truncated giant batch. |
| `claude.ts` | All Anthropic calls: `ocrNotebookPdf`, `chatOverNotes` (accepts `recalledMemories`), `generateInsights`, `generateInsightTitle`, `composeBook`, `summarizeDay`, `buildSelfModel`/`updateSelfModel`, `/mind` helpers (`analyzeEntryContent` extracts themes/sentiment/summary/entities in one call, `labelEmbeddingAxes` + pure `parseAxisLabels`, pure `parseAnalyzeEntryContent`), and chat-memory pair `compressChatSession` + pure `parseChatMemories`. Model resolution (`modelMain`/`modelChat`/`modelChatFallback`/`modelChatMemory`) is in-app-setting → env var → default. |
| `chatTools.ts` | The tool-calling toolbox Claude uses during chat: `search_diary` (hybrid FTS+semantic), `get_entries_by_date`, summaries, location, `top_entities` (aggregate ranking of people/places/projects), `pages_for_entity` (drill-down to actual pages tagged with a named entity), etc. |
| `mcp.ts` | MCP bridge: derives the remote MCP tool list from `CHAT_TOOLS` (+ three MCP-only reads: `get_profile`, `recall_memories` = the durable chat-memory layer, `get_guidance` = the companion tone/anti-confabulation contract — these exist only on MCP since the in-app chat gets the same via its system prompt), dispatches via `executeTool`, and enforces the fail-closed `MCP_AUTH_TOKEN` bearer auth (comma-separated tokens = zero-downtime rotation; also accepts OAuth access tokens from `mcpOauth.ts`). Hardened: per-IP brute-force throttle on FAILED auth only (a valid token is never blocked), size-capped `mcp_audit` trail, sensitive tools (`get_recent_locations`, `search_chat_history`) excluded BY DEFAULT (only `MCP_ALLOW_SENSITIVE_TOOLS=true` exposes them). Served by `app/api/mcp/route.ts`. Read-only by default; the sanctioned writes are, each OFF behind its OWN flag: `export_conversation` (`MCP_ALLOW_CONVERSATION_EXPORT`, Phase B), `save_reflection` (`MCP_ALLOW_REFLECTION_SAVE`), `save_decision` (`MCP_ALLOW_DECISION_SAVE`), `save_diary_entry` (`MCP_ALLOW_DIARY_WRITE` — the one that writes REAL diary + triggers the analytics pipeline), and seven "librarian" tools behind one flag `MCP_ALLOW_WIKI_LINKING=true` (Phase C + relationship enrichment: reads `list_unlinked_conversations`/`get_conversation`/`get_entity_wiki`, writes `tag_conversation_entities`/`relate_entities`/`update_entity_conversation_notes`/`record_librarian_heartbeat`). Layered on `MCP_ALLOW_WIKI_LINKING`: `MCP_AUTO_TAG_EXPORTS` makes the app itself guarantee tagging after each export/save. See the do-not-regress rule in CLAUDE.md. |
| `conversationWiki.ts` | Phase B: store + verbatim-note renderer for full subscription-conversations exported via `export_conversation` (`mcp_conversations` table). `saveExportedConversation` (upsert, add-only), pure `renderConversationNote`/`conversationNoteFileName`, the Dropbox filing helpers (`renderConversationNoteFiles`/`unfiledConversationKeys`/`markConversationsFiled`), and the separate librarian-linking helpers (`getConversationByKey`/`listUnlinkedConversations`/`markConversationsLinked`, keyed off `linked_at`). Filed into the Obsidian/Dropbox vault by `maybeExportConversationsToDropbox` (`dropbox.ts`). |
| `conversationEntities.ts` | Phase C: the "librarian" data layer — a recurring, subscription-billed Claude Code agent (not this app's own API key) links exported conversations into the diary's entity graph/wiki via the librarian MCP tools above. `ensureConversationPage`/`tagConversationEntities` create one synthetic `pages` row per conversation under `CONVERSATIONS_NOTEBOOK_ID` (mirrors the `DISCIPLINE_ID` pattern) so tags flow through the normal `entry_entities` pipeline; `resolveConversationEntityName` folds through `applyEntityAlias` and prefers an already-canonical casing (generic kind+name — reused by the reflection/decision mirrors and relationship endpoints). `updateConversationNotes`/`getConversationNotes`/`allConversationNotesRows` own `entity_conversation_notes` — a table kept separate from `entity_wiki` on purpose. `recordLibrarianHeartbeat`/`librarianStatus` mirror `backup.ts`'s status pattern. |
| `reflectionWiki.ts` / `reflectionEntities.ts` | Standalone AI-written reflections saved via the `save_reflection` MCP write tool (`mcp_reflections`, `Reflections/` folder). A 1:1 mirror of the conversation pair — deliberately its OWN table/module/folder because a reflection is Claude's one-sided writing, never a verbatim transcript. Entity-linked (`ensureReflectionPage`/`tagReflectionEntities` under `REFLECTIONS_NOTEBOOK_ID`, reusing the generic resolver + note tools). |
| `decisionWiki.ts` / `decisionEntities.ts` | Decision Records saved via the `save_decision` MCP write tool (`mcp_decisions`, `Decisions/` folder). A 1:1 mirror of the reflection pair — own table/folder so a decision is never confused with a reflection or conversation. Entity-linked; auto-tagged by `entityTagging.autoTagDecision`. |
| `chatDiary.ts` | "Chat diary" (`save_diary_entry` MCP write tool): a REAL diary entry composed by talking to Claude instead of handwriting. UNLIKE the vault-only writes above, it lands in the NON-excluded `CHAT_DIARY_NOTEBOOK_ID` and `processChatDiaryEntry` runs the same post-OCR pipeline a handwritten page does (embed → profile fold → `analyzePending` → day-file export), so it fully counts toward profile/heatmap/Mind/graph. Deterministic-destination + size-capped; the tool description enforces compose-in-voice + get-approval-first. |
| `entityTagging.ts` | Guaranteed, APP-INITIATED entity-tagging for conversations/reflections/decisions, gated by `autoTagExportsEnabled()` (`MCP_AUTO_TAG_EXPORTS=true` AND `MCP_ALLOW_WIKI_LINKING=true` — layered, not peer). `autoTag*` call `extractTaggingEntities` on a bounded evenly-sampled slice (`sampleForTagging`), tag, then re-export the affected entity stubs; backstopped by `maybeAutoTagUnlinked*` in the sweep. Shared across all three content types on purpose (not folded into `conversationEntities.ts`). |
| `entityPredicates.ts` / `entityRelationships.ts` | Controlled relationship predicates (`friend_of`, `works_at`, `lives_in`, etc.) + `relateEntities`: provenance-scoped replace by `conversation_key`, canonical endpoint resolution, two-direction reads for `get_entity_wiki`, and deduped rows for stub rendering. Never free-text predicates; never a blind global upsert. |
| `entityWiki.ts` | The "life wiki": a deep Claude-written biographical profile per entity (`composeEntityWiki`), content-addressed by `source_hash` over its diary mentions, embedded atop the entity's Obsidian stub. `refreshEntityWiki`/`maybeRefreshEntityWiki` (opt-in via "Build life wiki", batched, in-flight guarded). |
| `entityGraph.ts` / `diaryGraph.ts` / `entityMerge.ts` | Pure `computeRelatedEntities` (co-occurrence edges behind `related_entities`; distinct from typed `entity_relationships`); `buildDiaryGraph` (DB-backed payload for `/graph`, combining diary days, exported notes, co-occurrence, typed relationships, and evidence while excluding Discipline); entity de-dup (`applyEntityAlias`/`mergeEntity`/`mergeEntitiesManually`/`dedupeAllEntities`, all keyed on `name_norm` so a merge is a pure data rewrite). `mergeEntity` must rewrite both `entry_entities` and `entity_relationships` endpoints in the same transaction. |
| `diaryExport.ts` / `diaryExportDb.ts` | Diary→Markdown, Obsidian-native. Pure builders (`buildDiaryMarkdown`, `buildDayFiles`, entity **stub notes**, and the **vault-structure "second brain" notes** `Home.md`/`People|Places|Projects.md`/`Profile.md`) + DB renderers (`renderDiaryDayFiles`, `renderEntityStubFiles`, `renderVaultStructureFiles`/`vaultStructureFileNames`). Entity mentions render as `[[wikilinks]]`; stub notes carry `## Relationships` for typed assertions plus `## Related notes` back-links to tagged conversations/reflections/decisions (the reverse of those notes' own `## Connects to`). Obsidian connects nodes; labels live in note bodies, not graph-edge labels. Remarkabler is the SOLE deterministic writer of this vault (see CLAUDE.md). |
| `notebookDedup.ts` / `notebookDedupDb.ts` | Flags old (Dropbox/manual) notebooks whose diary dates are already covered by a reMarkable-cloud import — `/notebooks` "Possible duplicates", manual delete only. |
| `mcpOauth.ts` | Minimal OAuth 2.1 authorization server so the claude.ai connector (whose web UI has no static-header field) can complete its OAuth handshake. Metadata (RFC 9728 / 8414), dynamic client registration, PKCE-S256 authorize+token, opaque tokens stored HASHED. The `/authorize` consent screen reuses `MCP_AUTH_TOKEN` as the password (the security anchor). Endpoints under `app/api/mcp/oauth/*`; well-known paths via `next.config.mjs` rewrites. |
| `chatMemory.ts` | Durable chat-memory layer. `compressBatch` (extract→embed→dedup→insert with bounded retry), `maybeCompressChatSessions` (in-flight-guarded sweep), `recallChatMemories` (fail-open Voyage top-K cosine), `formatRecalledMemoriesBlock` (advisory framing), `normaliseChatMemoryCategory` (6-value enum), `isDuplicateMemory` (exact text_norm + 0.88 cosine), `resetBatchForRetry`. |
| `chatMemoryBackfill.ts` | Pure helpers shared by the startup orphan migration in `db.ts` and `/api/chat/memories/backfill-all`: `chunkMessageIds`, `createBatchForChunk`, `chunkedBackfillForConversation` (the high-level entry point with `onlyArchived` opt-in), `CHUNK_TARGET_CHARS = 12_000`. A long history is sliced into transcript-fit batches so compressBatch's 16K-char cap doesn't silently truncate. |
| `embeddings.ts` | Voyage AI embeddings: token-budget batching, 429 retry, `embed`/`embedBatch`/`embedBatchOrThrow`, encode/decode BLOB helpers, cosine similarity. |
| `notes.ts` | `createNotebook`, `processNotebook` (background OCR → embed → fold into profile → auto-analyse pages for `/mind`), `runMaintenanceSweep` (throttled background chores: profile seed, weekly insight, embedding backfill, daily summaries, location distill, Dropbox poll, weekly backup, **chat-memory sweep**, discipline auto-sync), discipline sync, embedding/summary backfills. |
| `profile.ts` | The evolving "memory of you" (versioned `profile` table). |
| `mind.ts` | `/mind` analytics (heatmap, themes, sentiment series, embedding map). Shared PCA + persisted axis labels. `analyzePending` is the in-flight-guard pattern reused by `chatMemory`. |
| `usage.ts` | `recordUsage` (per-call cost from list prices) + aggregation for the Cost tab. |
| `extractText.ts` | Converts PDF/Word chat attachments to text (pdf-parse/mammoth) before sending to Claude — token savings. Handwritten PDFs fall back to raw. |
| `auth.ts` / `webauthn.ts` | Passcode + passkey (WebAuthn) lock; HMAC session cookie; 24h server-side inactivity timeout. |
| `backup.ts` | Weekly auto-backup of `/data` to a private GitHub repo, keep-last-12. |
| `dropbox.ts` | reMarkable Connect → Dropbox auto-ingest. OAuth refresh-token flow, polling, dedupe by `dropbox_file_id`. Fired from `runMaintenanceSweep`. |
| `remarkableCloud.ts` / `rmRender.ts` / `remarkableImport.ts` / `remarkableSync.ts` | reMarkable-cloud secondary source (rmapi-js, unofficial). Pair + list (Phase 0); `downloadNotebook` + `.rm`→PDF render (rm2pdf/pypdf, image-only) + on-demand import, dedupe by `remarkable_doc_id` (Phase 1b); sweep-driven zero-tap sync with per-page sha256 diffing over imported notebooks + auto-sync folders (Phase 2). |
| `owntracks.ts` / `location.ts` / `format.ts` | Location ingestion (OwnTracks endpoint), stay clustering, reverse-geocoding via Nominatim, KST timezone helpers. |
| `github.ts` | Discipline-repo fetching (GitHub Contents API). |
| `cleanup.ts` / `upload.ts` | Orphan-attachment sweep; upload validation/duck-typing. |

### `app/` — UI + API
- Pages: `/` (dashboard), `/notebooks`, `/chat`, `/insights`, `/memory`,
  `/mind` (heatmap, theme cloud, mood timeline, 3D embedding map —
  `app/mind/Map3D.tsx`), `/graph` (interactive diary/entity relationship
  map), `/usage` (cost calendar).
- `app/api/*` — one route per feature. All data-reading routes set
  `runtime = "nodejs"` and `dynamic = "force-dynamic"`. Notable groups:
  - `notebooks`, `chat` (POST + GET + DELETE), `chat/attachment/[id]`,
    `chat/memories` (GET list + status), `chat/memories/[id]` (DELETE
    soft delete), `chat/memories/retry/[batchId]` (POST reset stuck
    batch), `chat/memories/backfill-all` (POST chunked re-process, with
    `?reset=true` for destructive clean re-run).
  - `insights`, `usage`, `memory` (the profile, not chat memory), `diary`, `graph`.
  - `mind` (+ `mind/analyze`, `mind/reanalyze`, `mind/axis-labels`,
    `mind/reparse-dates`, `mind/merge-entities` = Claude-driven entity dedup,
    `mind/build-wiki` = batched life-wiki build), `embeddings/status`.
  - `backup` (GET status + POST run-now), `dropbox/{connect,callback,status,disconnect,export}`.
  - `mcp` (remote MCP endpoint — see the `mcp.ts` row) +
    `mcp/oauth/{register,authorize,token,protected-resource,authorization-server}`
    (OAuth 2.1 server — `mcpOauth.ts`; `.well-known/oauth-*` via `next.config.mjs` rewrites).
  - `remarkable/{connect,refresh,disconnect,status,import,compare,autosync}`
    (reMarkable-cloud secondary source).
  - `librarian` (GET-only status for the Phase C librarian agent's
    heartbeat — no POST, the app doesn't run the agent itself).
  - `discipline` (GET + POST sync), `discipline/settings`.
  - `location` (GET + POST), `location/settings`, `owntracks` (`?token=`).
  - `export` (raw bundle), `export/diary` (diary-only Markdown), `export/book` (Opus editor pass).
  - `settings/models`, `auth`.
- `app/share/route.ts` — PWA Web Share Target. `public/manifest.json` — PWA.

---

## 3. How to work here

- **Build must pass:** `npm run build`. `npm test` runs Vitest over
  `test/*.test.ts` — pure-logic units + DB-backed integration tests with
  throwaway SQLite. Lint: `npm run lint`. The build, the tests, and a careful read are the
  safety net for changes that don't need real Claude/Voyage credentials.
- **Branch / commit / PR discipline (required):**
  - Never commit straight to `main`. Branch first (`claude/<short-topic>`).
  - Commit with clear messages, push, open a PR, then merge.
  - `main` auto-deploys to Railway, so only merge green, building code.
- **Keep `CHANGELOG.md` updated** with every notable change (newest first).
- **Add a session log** under `docs/sessions/YYYY-MM-DD.md` when a session
  makes decisions worth preserving (model choices, cost trade-offs, etc.).

---

## 4. What you (the AI) CAN and CANNOT do in this environment

This is the part most agents get wrong. See `docs/claude-harness.md` for the
full picture; the essentials:

- **You run in an ephemeral container.** The repo is cloned fresh; anything
  not committed and pushed is lost. Persist work via git.
- **Secrets are NOT in this container.** `ANTHROPIC_API_KEY`,
  `VOYAGE_API_KEY`, GitHub tokens, etc. live on **Railway**, the deploy
  host. Consequences:
  - You **cannot** run real OCR, chat, embeddings, or any Claude/Voyage
    call from inside this container — there's no key. Don't write a script
    that "tests OCR locally"; it will fail.
  - The Claude-powered features can only be truly verified on the deployed
    Railway instance. Say so honestly rather than claiming local validation.
  - To test a model on real input, either (a) spawn a subagent (it has its
    own model credentials), or (b) have the user paste/upload content into
    chat directly.
- **The user's PDFs live on Railway's `/data` volume**, not in the repo. To
  inspect a real diary page, ask the user to upload it.
- **GitHub access is via MCP tools, restricted to `sanjaykims/remarkable-feed`.**
  No `gh` CLI, no direct API, no other repos.
- **Do not put model identifiers or internal harness IDs in commits, PRs,
  or code** — keep those to chat replies only.

---

## 5. Hard-won rules — do not regress these

(Full detail in `CLAUDE.md`; the load-bearing ones:)

1. **Chat reasons over the compact `profile`, not the whole corpus.** Chat
   uses tool-calling (`lib/chatTools.ts`) to fetch entries on demand.
   Sending all notes per message once cost ~$0.11/chat — never revert to it.
2. **Clear is a real boundary.** The chat POST history query filters
   `archived_at IS NULL` — cleared messages no longer feed Claude as raw
   history. Continuity is carried forward by extracted `chat_memories`
   (compact items: preferences, facts, intents, feelings, unresolved).
   Do NOT revert that filter — it would double-count cleared messages.
3. **Chat memory recall is fail-open.** `chatOverNotes` accepts a
   pre-rendered `recalledMemories` block. Recall errors return an empty
   block, never throw — chat must never 500 because Voyage was down.
4. **Memory extraction is bounded-retry** (`MAX_EXTRACTION_ATTEMPTS = 2`).
   On parse failure the first attempt leaves the batch pending; the
   second sets `memory_extracted_at` to mark permanent skip. Reset via
   `POST /api/chat/memories/retry/[batchId]`. Do not switch back to
   "advance the watermark on first failure" — that quietly discards a
   useful conversation when Claude returns garbage once.
5. **Chat memory backfill is chunked, not single-batch.** The
   `backfill-all` endpoint splits each conversation by
   `CHUNK_TARGET_CHARS = 12_000` (well under `compressBatch`'s 16K
   transcript cap) so a long history is fully read, not silently
   truncated to the tail. The earlier single-batch shape produced ~6
   items from months of history; don't reintroduce it.
6. **Transcription runs in the background.** `createNotebook` returns
   immediately; `processNotebook` is fired un-awaited and sets notebook
   `status`. Never make upload/share wait on OCR.
7. **OCR streams the response** (`messages.stream()`) and uses a
   `--- PAGE n ---` delimiter format, not JSON.
8. **OCR stays on Opus for this user.** Validated against Sonnet on real
   Korean handwriting (see `docs/sessions/2026-06-04.md`): Sonnet makes
   consistent meaning-changing errors. Don't propose switching without
   re-reading that log.
9. **Behind Railway's proxy, `req.url` reports internal `localhost:8080`.**
   Never build redirects/absolute URLs from it; redirect client-side.
10. **Background chores run via one throttled `runMaintenanceSweep`**
    (5-min window, `last_maintenance_at` persisted so cold-starts don't
    refire). The chat-memory sweep, Dropbox poll, weekly backup, weekly
    insight, embedding backfill, daily summaries, profile seed, discipline
    auto-sync, reMarkable sync, life-wiki refresh, vault-export backstops,
    and auto-tagging backstops all ride this one cadence.
11. **The MCP endpoint is read-only by default and fails closed.** Every
    write tool is OFF behind its own env flag, deterministic-destination
    (the agent supplies content, the server computes the DB/file target),
    and size-capped. A missing/short `MCP_AUTH_TOKEN` returns 503, never
    "open". Sensitive tools (location, chat-history search) are excluded
    unless `MCP_ALLOW_SENSITIVE_TOOLS=true`. Don't weaken any of these to
    opt-out — see the full invariant list in CLAUDE.md.
12. **The synthetic notebooks (conversations/reflections/decisions) need
    BOTH exclusion and inclusion, and Remarkabler is the SOLE deterministic
    writer of its Obsidian/Dropbox vault.** Exclude them from diary-analytics
    surfaces (heatmap, themes, day files) via
    `nonDiaryNotebookExcludeIdsForChat`/`ForMind`; keep them INCLUDED in the
    entity graph/stubs. `CHAT_DIARY_NOTEBOOK_ID` is the exception — it's REAL
    diary and stays on every list. Never introduce a second writer that edits
    the exported vault files in place (the librarian's `entity_conversation_notes`
    and `entity_relationships` are the sanctioned "own table, composed at
    render time" exceptions).
13. **Every data API route gates behind the app lock — `test/authGuard.test.ts`
    enforces it.** There's no `middleware.ts`: `app/layout.tsx` gates the UI,
    and each `app/api/**/route.ts` calls `isAuthenticated()`/`requireAuth()`
    (`lib/auth.ts`). Only the login endpoint, the MCP bearer endpoint, the
    OAuth handshake, and the `csp-report` sink are on the test's PUBLIC
    allowlist — adding to it is a deliberate security decision. Lock-off
    (`APP_PASSCODE` unset = whole app open) is now loud: a boot warning
    (`instrumentation.ts`) + a red in-app banner (`app/LockOffBanner.tsx`).
    Baseline response headers (HSTS, COOP, CORP, X-Frame-Options,
    Permissions-Policy) live in `next.config.mjs`; an enforced CSP is a
    deferred report-only-first pass (no `dangerouslySetInnerHTML` = no active
    XSS surface).

---

## 6. Known intentional limits

- reMarkable cloud zero-tap sync (Phase 2) is scoped to imported notebooks +
  auto-sync-enabled folders, never the whole account. The `.rm` renderer lives
  only in the Railway Docker image; it rides the unofficial protocol, so
  Dropbox export-from-device stays the reliable fallback.
- PWA share target + voice input work on Android Chrome only, not iOS Safari.
- reMarkable PDFs are image-based ink with **no text layer** — text
  extraction tools (MarkItDown, pdf-parse) return nothing for them; only
  vision OCR (Claude) reads them. This is why OCR can't be replaced by a
  cheap text extractor.
- After Clear, there's a brief (~5 sec) async-gap window before the new
  chat memories from that batch are available. Acceptable for v1; if it
  becomes a problem, the fix is sync-on-Clear or a "extracting…"
  indicator. Don't paper over it by re-feeding archived messages as raw
  history (see rule 2 above).
