# CLAUDE.md

Guidance for Claude Code working on this repository.

> **New here?** Start with **`SKILL.md`** for a one-page index of every
> module/table/route/page, then **`AGENTS.md`** for the tool-agnostic
> orientation (how to work, what an AI agent can/can't do in this
> environment). This file holds the Claude-specific deep detail with the
> "do not regress" rules.

## What this is

"Remarkabler" (formerly "Feed Claude"): a self-hosted Next.js app. The user
exports a notebook as PDF from their reMarkable tablet, uploads it here, and
Claude transcribes every handwritten page. They can then chat over their notes
and generate an accumulating record of "insights" about themselves.

## Repo & deployment

- **This repo (`remarkable-feed`) is the source of truth — develop directly
  here.** It was previously a generated mirror of
  `korean-news-study-en/remarkable-app` via a "split" workflow; that bridge is
  retired. Do not recreate it, and ignore the old repo.
- Deployed on **Railway**, which auto-deploys on every push to `main`.
  **Build is now a `Dockerfile`** (`railway.json` builder `DOCKERFILE`), not
  Nixpacks — the image bundles a Python `.rm` renderer (`rmc` + `cairosvg`
  in a venv at `/opt/renderer`, wrapper `rm2pdf` on PATH) alongside Node for
  the reMarkable-cloud feature. Multi-stage: `nikolaik/python-nodejs` base;
  builder compiles better-sqlite3, runner is the slim variant. To revert to
  Nixpacks, set the builder back — one line. Renderer helper files live in
  `docker/` (`rm2pdf`, `patch_rm_palette.py`, empty `certs/` CA hook).
- Railway config: env vars `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`
  (set to `claude-opus-4-7`), `DATA_DIR=/data`; a persistent volume is mounted
  at `/data` and holds the SQLite database and uploaded PDFs. Optional
  `CHAT_MODEL` overrides the model used for chat only (defaults to
  `claude-sonnet-5`); OCR and insights stay on `CLAUDE_MODEL`. Optional
  `CHAT_MEMORY_MODEL` overrides the model used to extract durable items
  from cleared chats (defaults to `CHAT_MODEL`); set this to a cheaper
  tier once extraction quality is known to hold.
- Optional env var `APP_PASSCODE` enables the private lock. When set, the
  whole app (pages + APIs) is gated behind a passkey (fingerprint / Face ID)
  or the passcode itself. When unset, the app is fully open — so the lock can
  be turned on/off purely by adding/removing this one variable.
- Optional analytics: set `NEXT_PUBLIC_POSTHOG_KEY` (and optionally
  `NEXT_PUBLIC_POSTHOG_HOST`, default `https://us.i.posthog.com`) to enable
  PostHog. It only sends anonymous page views + a few explicit events
  (`notebook_uploaded`, `chat_message_sent`, `insight_generated`); autocapture
  and session recording are disabled so no note content is ever sent. These
  are `NEXT_PUBLIC_*` vars, so they are inlined at build time — set them in
  Railway before the build (changing them triggers a rebuild).
- Optional Dropbox auto-ingest: set `DROPBOX_APP_KEY` + `DROPBOX_APP_SECRET`
  (Dropbox app with `files.metadata.read` + `files.content.read`; read-only
  by default — see the diary-export note below for the one optional write
  scope) and `APP_BASE_URL` (the canonical https URL of the deployment, e.g.
  `https://your-app.up.railway.app`). Optional: `DROPBOX_INGEST_PATH`
  (defaults to `/Diary`), `OCR_CONCURRENCY_LIMIT` (defaults to 2, max 5)
  caps the shared OCR budget across manual uploads + Dropbox ingest. The
  refresh token is redacted from off-site backups; CSRF state for the
  OAuth dance is an httpOnly cookie, not a settings row. In production
  `APP_BASE_URL` is required if Dropbox is configured — we fail closed
  rather than fall back to forwarded headers.
- Optional subscription-Claude diary access (MCP): set `MCP_AUTH_TOKEN` (16+
  chars, long random string) to enable the read-only remote MCP endpoint at
  `/api/mcp` — added to claude.ai as a custom connector and to Claude Code, so
  the user can chat with their diary on their Claude subscription instead of
  per-token API billing. Unset = endpoint disabled (fails closed). The
  claude.ai web connector UI only offers OAuth (no static-header field), so the
  endpoint also runs a minimal OAuth 2.1 authorization server (`lib/mcpOauth.ts`)
  whose consent screen reuses `MCP_AUTH_TOKEN` as the password; Claude Code
  accepts the raw bearer token directly. Optional `APP_BASE_URL` fixes the
  public origin used in OAuth metadata/redirects (else derived from
  `X-Forwarded-*`). Optional `MCP_ALLOW_CONVERSATION_EXPORT=true` enables the
  write tool `export_conversation` — subscription-Claude saves a full
  conversation, filed verbatim into the Obsidian/Dropbox vault as one note
  (Phase B); OFF by default keeps the endpoint read-only. Optional
  `MCP_ALLOW_REFLECTION_SAVE=true` enables a separate write tool,
  `save_reflection` — any connected Claude (subscription-Claude, Claude
  Code, or a scheduled Routine) can save a standalone independent
  reflection it wrote about the user (not a conversation transcript),
  filed into its own `Reflections/` folder (`lib/reflectionWiki.ts`); its
  own flag, independent of `MCP_ALLOW_CONVERSATION_EXPORT`. OFF by default.
  Optional `MCP_ALLOW_WIKI_LINKING=true` enables the six Phase C "librarian" tools
  (`lib/conversationEntities.ts`) so a SEPARATE, recurring Claude Code agent
  — set up by the user as a cron Routine, billed to their own Claude
  subscription rather than this app's `ANTHROPIC_API_KEY` — can tag which
  people/places/projects a conversation mentions and keep its own notes
  about them, linking conversations into the same entity graph/Obsidian
  wiki the diary builds. This app never runs that agent itself; it only
  exposes the tools and a status heartbeat (`GET /api/librarian`, surfaced
  on `/memory`). OFF by default. Setup guide: `docs/mcp-setup.md`.
- Optional automatic location (OwnTracks): set `OWNTRACKS_TOKEN` to enable the
  `/api/owntracks` ingestion endpoint (the phone app posts there with
  `?token=`). Points are clustered into stays (place + dwell), reverse-geocoded
  via Nominatim (cached in `geocode_cache`), and fed to chat. `LOCATION_TZ_OFFSET`
  (minutes, default 540 = Seoul) sets the display timezone. Needs outbound to
  `nominatim.openstreetmap.org` for place names (falls back to coordinates).
- Optional GitHub "discipline" source: set `DISCIPLINE_REPO` (`owner/name`),
  `DISCIPLINE_GITHUB_TOKEN` (a fine-grained read-only PAT), and optionally
  `DISCIPLINE_BRANCH` (default `main`). The Memory page's "Sync now" pulls the
  repo's text files into a notebook and folds them into the profile. Requires
  the Railway network policy to allow outbound calls to `api.github.com`.
- `npm run start` honors the host-provided `PORT`. `npm run build` must pass.
  The `Dockerfile` must also build (Railway uses it) — but note it needs a
  running Docker daemon + outbound apt/pip, which the sandbox may lack;
  Railway is the real build test.

## Stack

Next.js 14 (App Router, TypeScript), better-sqlite3, @anthropic-ai/sdk,
Tailwind CSS. All data (SQLite `app.db` + uploaded PDFs) lives under
`DATA_DIR` (defaults to `./data`).

## Architecture

> Keep this in sync with the structure map in `AGENTS.md`; the two should
> agree. When you add a lib, table, route, or page, update both.

- `lib/db.ts` — SQLite connection, schema, migrations. `foreign_keys` pragma
  is ON (so `ON DELETE CASCADE` actually fires). Tables: `settings`,
  `notebooks`, `pages`, `pages_fts` (FTS5 virtual), `chat_messages`,
  `insights`, `credentials`, `chat_attachments`, `api_usage`, `profile`,
  `daily_summaries`, `entry_analysis` (per-entry themes/sentiment/summary
  cache for `/mind`), `entry_entities` (per-page named entities —
  person/place/project — for the `top_entities` chat tool), `entity_aliases`
  (merge records folding a duplicate spelling into a canonical
  `(kind, name_norm)`; see `lib/entityMerge.ts`), `entity_wiki` (Claude-written
  profile per entity + a `source_hash` of its mentioning pages, embedded atop
  the Obsidian stub; see `lib/entityWiki.ts`), `locations`,
  `location_points`, `route_stops`, `geocode_cache`, `chat_archive_batches`
  + `chat_memories` (durable chat-memory layer; one batch per Clear,
  soft-deleted items don't resurrect), `dropbox_ingest_tombstones` +
  `remarkable_ingest_tombstones` (deleted source ids the Dropbox watcher /
  reMarkable sweep must not re-ingest — see the "do not regress" rule
  below), `mcp_audit` (size-capped log of MCP tool calls + failed auth
  attempts; see `lib/mcp.ts`), `mcp_oauth_clients` + `mcp_oauth_tokens`
  (OAuth 2.1 state for the claude.ai connector — dynamically registered
  clients + issued access/refresh tokens stored HASHED; see `lib/mcpOauth.ts`),
  `mcp_conversations` (full subscription-conversation transcripts exported via
  the `export_conversation` write tool, filed verbatim into the Obsidian vault;
  `linked_at` tracks the librarian agent's separate tagging progress, distinct
  from `filed_at`'s Dropbox-filing progress; see `lib/conversationWiki.ts`),
  `entity_conversation_notes` (the librarian agent's own notes about an
  entity — kept in a table SEPARATE from `entity_wiki` so the two authors
  can never clobber each other's writes; see `lib/conversationEntities.ts`),
  `mcp_reflections` (standalone AI-written reflections saved via the
  `save_reflection` write tool — deliberately a SEPARATE table from
  `mcp_conversations`: a reflection is Claude's own one-sided writing about
  the person, not a verbatim transcript, so it gets its own table and its
  own vault folder (`Reflections/`, vs `Conversations/`) rather than being
  mixed in; see `lib/reflectionWiki.ts`).
  Some durable state also lives in
  `settings` rows, e.g.
  `mind_pca_axes` (persisted PCA mean + PC vectors + axis labels) and the
  `backup_last_*` markers.
- `lib/claude.ts` — Anthropic API calls: `ocrNotebookPdf`, `chatOverNotes`,
  `generateInsights`, `generateInsightTitle`, the evolving-memory pair
  `buildSelfModel` / `updateSelfModel`, `summarizeDay`, `composeBook`, the
  `/mind` helpers `analyzeEntryContent` (themes/sentiment/summary, English),
  `labelEmbeddingAxes` + the pure `parseAxisLabels`, and the chat-memory
  pair `compressChatSession` + the pure `parseChatMemories`. Each records
  token usage + an estimated cost via `recordUsage` from `lib/usage.ts`.
- `lib/chatMemory.ts` — durable chat-memory layer. `compressBatch`
  (extract → embed → dedup → insert with bounded retry),
  `maybeCompressChatSessions` (in-flight-guarded sweep matching the
  `analyzePending` shape; also runs `reembedMissingMemories`),
  `recallChatMemories` (include-all for a small corpus, semantic top-K +
  recency floor at scale; degrades to recency, fail-open),
  `reembedMissingMemories` (bounded re-embed of NULL-embedding rows),
  `formatRecalledMemoriesBlock` (advisory framing for the
  system prompt), `normaliseChatMemoryCategory` (6-value enum),
  `isDuplicateMemory` (exact text_norm + 0.88 cosine),
  `resetBatchForRetry` (clears permanent-skip state), and the rolling-memory
  pair `createRollingBatch` (pure-DB: stamp an active conversation's
  out-of-window turns into a batch WITHOUT archiving them) +
  `maybeRollConversationMemory` (create-then-compress, per-conversation
  in-flight guarded; fired un-awaited from the chat POST). See the rolling-
  memory rule under "Hard-won rules".
- `lib/chatMemoryBackfill.ts` — pure helpers (`chunkMessageIds`,
  `estimateTranscriptCost`, `CHUNK_TARGET_CHARS = 12_000`) shared
  between the `/api/chat/memories/backfill-all` endpoint and its test.
  Splits each conversation into transcript-fit chunks so a long
  history is processed in many batches under the 16K cap, not one
  truncated batch.
- `lib/usage.ts` — `recordUsage` (per-call cost from list prices) plus
  `monthlyUsage` / `dailyUsage` / `totalUsage` aggregation (timezone-aware).
- `lib/embeddings.ts` — Voyage embeddings (`embed`, `embedBatch`,
  `encodeEmbedding`/`decodeEmbedding` Float32-BLOB codec, `cosineSimilarity`).
  Stored per-page on `pages.embedding`; gated by `VOYAGE_API_KEY`.
- `lib/chatTools.ts` — the tools Claude calls during chat (`search_diary`,
  `get_entries_by_date`, `get_day_summary`, `top_entities`,
  `pages_for_entity`, `related_entities`, …), dispatched on demand. The
  `related_entities` tool surfaces the entity graph's *edges* (who/what the
  user writes about on the same days) via the pure `lib/entityGraph.ts`
  co-occurrence helper — the relationship view behind the Obsidian graph,
  not just a flat ranking.
- `lib/mcp.ts` — the MCP bridge: `mcpToolList` (derives the MCP tool list from
  `CHAT_TOOLS` at runtime + three MCP-only tools — `get_profile`,
  `recall_memories` (the durable `chat_memories` layer, via `recallChatMemories`),
  and `get_guidance` (the companion tone/anti-confabulation contract) — so the
  two surfaces can never drift; these three exist ONLY on MCP because the in-app
  chat gets the same content via its system prompt + auto-recall — plus the
  write tool `export_conversation` (Phase B, off unless
  `MCP_ALLOW_CONVERSATION_EXPORT=true`) — plus the six "librarian" tools
  (Phase C, all gated behind ONE flag `MCP_ALLOW_WIKI_LINKING=true`, via
  `librarianToolsEnabled`): reads `list_unlinked_conversations`,
  `get_conversation` (full verbatim read-back — the one MCP read that exposes
  raw conversation content, so it shares the write tools' opt-in gate rather
  than being ungated like the other reads), `get_entity_wiki`; writes
  `tag_conversation_entities`, `update_entity_conversation_notes`,
  `record_librarian_heartbeat` — see `lib/conversationEntities.ts`), `callMcpTool`
  (special-cases the MCP-only tools, else dispatch via `executeTool`), and
  the fail-closed bearer auth (`checkMcpAuth`, timing-safe, `MIN_TOKEN_LENGTH`).
  Served by `app/api/mcp/route.ts` (mcp-handler, Streamable HTTP, stateless,
  SSE disabled) so Claude on the user's subscription (claude.ai custom
  connector / Claude Code) can query the diary. Read-only by default (the
  sanctioned writes are `export_conversation`, `save_reflection`, and the
  three librarian write tools, see the do-not-regress rule).
- `lib/conversationWiki.ts` — Phase B store + renderer for full
  subscription-conversation transcripts (`mcp_conversations`): `saveExportedConversation`
  (upsert by key, add-only), pure `renderConversationNote`/`conversationNoteFileName`
  (verbatim note, no summarizing), `renderConversationNoteFiles`/
  `unfiledConversationKeys`/`markConversationsFiled` for the Dropbox filing
  cycle, and `getConversationByKey`/`listUnlinkedConversations`/
  `markConversationsLinked` (the separate `linked_at` tracking the Phase C
  librarian's own progress). Filed into the Obsidian/Dropbox vault by
  `maybeExportConversationsToDropbox` (`lib/dropbox.ts`), fired from the
  `export_conversation` tool + the maintenance sweep.
- `lib/reflectionWiki.ts` — store + renderer for standalone AI-written
  reflections (`mcp_reflections`), saved via the `save_reflection` MCP
  write tool. Mirrors `lib/conversationWiki.ts`'s shape exactly
  (`saveReflection`, pure `renderReflectionNote`/`reflectionNoteFileName`,
  `renderReflectionNoteFiles`/`unfiledReflectionKeys`/`markReflectionsFiled`)
  but is a deliberately SEPARATE module/table/folder (`Reflections/`, not
  `Conversations/`) — a reflection is Claude's own one-sided writing about
  the person, never a verbatim transcript, so the two content types must
  stay visually and structurally distinct in the vault. No entity-linking
  section (unlike conversations, reflections aren't tagged into the entity
  graph). Filed by `maybeExportReflectionsToDropbox` (`lib/dropbox.ts`,
  shares the same `exportInFlight` guard as the diary/conversation
  exporters), fired from the `save_reflection` tool + the maintenance sweep.
- `lib/conversationEntities.ts` — Phase C: the "librarian" data layer. A
  recurring, autonomous Claude Code agent (a cron Routine, billed to the
  user's Claude subscription, NOT this app's `ANTHROPIC_API_KEY`) links
  exported conversations into the diary's existing entity graph/wiki.
  `ensureConversationPage`/`tagConversationEntities` create one synthetic
  `pages` row per conversation under the `CONVERSATIONS_NOTEBOOK_ID`
  notebook (`lib/notes.ts`, mirrors the `DISCIPLINE_ID` synthetic-notebook
  pattern) so tags flow through the same `entry_entities`/co-occurrence-graph
  pipeline diary content uses — `ocr_text` is a short bounded placeholder
  (never the full transcript), reused ONLY so the day-membership query has
  the non-empty text it requires. `resolveConversationEntityName` folds
  through `applyEntityAlias` and prefers an already-existing canonical
  casing over the agent's freshly supplied one. `updateConversationNotes`/
  `getConversationNotes`/`allConversationNotesRows` read/write
  `entity_conversation_notes` — kept in a table separate from `entity_wiki`
  (owned by the in-app `refreshEntityWiki`) specifically so the two authors
  can never overwrite each other; `getCombinedEntityWiki` reads both
  together for the agent. `recordLibrarianHeartbeat`/`librarianStatus`
  mirror `lib/backup.ts`'s status pattern, surfaced via `GET /api/librarian`
  and a status section on `/memory` (no "run now" — the app doesn't run the
  agent itself).
- `lib/mcpOauth.ts` — minimal OAuth 2.1 authorization server backing the
  claude.ai connector (its web UI has no static-header field, so it requires
  the OAuth discovery → DCR → authorize → token dance). `publicOrigin`
  (APP_BASE_URL → X-Forwarded-* → req.url), the RFC 9728 / RFC 8414 metadata
  builders, `registerClient`/`getClient` (DCR), `issueAuthCode`/`redeemAuthCode`
  (single-use, in-memory, PKCE-bound), `verifyPkce` (S256), `issueTokens`/
  `refreshAccessToken`/`isValidAccessToken` (opaque tokens stored HASHED in
  `mcp_oauth_tokens`), and `consentSecretValid` (the `/authorize` gate reuses
  `MCP_AUTH_TOKEN`). Endpoints under `app/api/mcp/oauth/*`; well-known
  discovery paths are `next.config.mjs` rewrites. `checkMcpAuth` accepts a live
  access token in addition to the raw `MCP_AUTH_TOKEN`.
- `lib/entityGraph.ts` — pure `computeRelatedEntities`: ranks the entities
  that share diary days with a target (undated pages excluded). DB glue +
  effective-date carry-forward live in `lib/chatTools.ts:relatedEntities`.
- `lib/entityMerge.ts` — entity de-duplication. `applyEntityAlias` (fold a
  merged-away spelling on insert), `mergeEntity` (rewrite `name_norm` rows +
  record the alias + collapse chains), the Claude-driven `dedupeAllEntities`
  driver behind `app/api/mind/merge-entities` and the `/mind` "Merge duplicate
  names" button, and `mergeEntitiesManually` (fold an explicit variant list
  into one canonical — the `/mind` "Merge specific names" form, for OCR
  variants / cross-script pairs Claude won't risk; records an alias even for
  a variant not yet extracted, so a future ingest auto-folds). Because every reader keys on
  `name_norm`, a merge is a data rewrite with no read-path changes; the
  `entity_aliases` record makes it stick for future ingests. Claude call +
  pure `parseEntityDuplicates` live in `lib/claude.ts:findEntityDuplicates`
  (conservative — only clear same-entity merges).
- `lib/entityWiki.ts` — the "life wiki": a deep Claude-written biographical
  profile per entity (`composeEntityWiki` + pure `cleanEntityWiki` in
  `lib/claude.ts`), read from the entity's **entire** diary history in
  chronological order (identity/relationship + `## Key facts` + `## Over
  time`), stored in `entity_wiki` and embedded atop that entity's Obsidian
  stub note (`renderEntityStubFiles` reads `allEntityWikiRows`). `mentions`
  returns the whole chronological history; pure `selectWikiExcerpts` trims
  each page and, only if over the `MAX_INPUT_CHARS` budget, takes an even
  chronological sample (keeping first + last) so the arc stays represented and
  cost stays bounded. `refreshEntityWiki` is content-addressed (the
  `source_hash` digests EXACTLY the excerpts sent, so any edit that changes
  the profile's input regenerates it — and, for entities under budget, that's
  every mentioning page), bounded + in-flight guarded; `maybeRefreshEntityWiki`
  runs a few per maintenance sweep once the user opted in by tapping "Build
  life wiki" (`entity_wiki_auto`), exporting only the regenerated stubs.
  Driven by `app/api/mind/build-wiki` (batched — reports `remaining`).
- `lib/mind.ts` — `/mind` analytics, all free per view (cached): `getHeatmap`,
  `getThemes`, `getSentimentSeries`, `getEmbeddingMap`; the one shared PCA
  (`computePca` + `projectOnto`); the per-entry analysis driver
  (`analyzePending`, bounded/serial/guarded); and axis labelling
  (`generateAxisLabels`, persists axes to the `mind_pca_axes` setting). The
  discipline notebook is excluded everywhere here, same as themes/sentiment.
- `lib/profile.ts` — the evolving "profile of you" (`profile` table, versioned):
  `getCurrentProfile`, `getCurrentProfileRow`, `hasProfile`, `saveProfile`.
- `lib/notes.ts` — `createNotebook` (fast: save PDF + DB row), `processNotebook`
  (background OCR → embed → fold into profile → auto-analyse fresh pages for
  `/mind`), `deleteNotebook`, `buildNotesContext`, `buildChatContext`,
  `ensureProfileSeed`, `extractEntryDate` / `reparseAllEntryDates` (diary-date
  parsing + carry-forward), and the GitHub "discipline" sync (`DISCIPLINE_ID`).
- `lib/backup.ts` — weekly tar.gz backup of `DATA_DIR` to a private GitHub repo
  (`maybeRunWeeklyBackup`, with a failure backoff so a broken backup doesn't
  retry every sweep; manual `runBackup` via `/api/backup` ignores the backoff).
- `lib/dropbox.ts` — Dropbox auto-ingest: OAuth (refresh-token flow),
  read-only folder polling, dedupe by `notebooks.dropbox_file_id` **plus
  `dropbox_ingest_tombstones`** (the "already seen" set is `ingestSkipFileIds()`
  = both). Watcher is fired from `runMaintenanceSweep` so it runs alongside
  the other background jobs. Also the **opt-in per-day diary auto-export**
  (`maybeExportDiaryToDropbox`, fired from `processNotebook` with the
  notebook id): writes ONE Markdown file per day into `dropboxExportFolder`
  after each ingest, re-uploading only the day files that notebook touched
  (`affectedDayFileNames`) — a full every-day sync runs on demand from the
  `/memory` toggle (probe one file for scope, then background the rest).
  This is the ONE path that needs the `files.content.write` scope — off by
  default (`dropbox_export_enabled`), fails-open with an actionable "enable
  the write scope + reconnect" message. Ingest stays read-only.
- `lib/diaryExport.ts` (pure, unit-tested: `buildDiaryMarkdown` combined
  doc for the download, `buildDayFiles` per-day map for Dropbox, plus
  `carryForwardDates` / `effectiveDateKeys`) + `lib/diaryExportDb.ts`
  (DB-backed `renderDiaryMarkdown`, `renderDiaryDayFiles`,
  `affectedDayFileNames`). Excludes the `github-discipline` notebook,
  same as `/mind`. **Obsidian-native**: entity mentions (person/place/
  project) render as `[[wikilinks]]` (`pageMetaLine`'s per-page line +
  YAML frontmatter arrays via `collectEntities`/`yamlQuoted`), with
  `lib/diaryExportDb.ts:fetchCanonicalEntityNames` resolving one canonical
  casing per `(kind, name_norm)` — the same `MIN(name) GROUP BY name_norm`
  convention `/mind`'s `getTopEntities` and the `top_entities` chat tool
  already use — so the same real-world entity always links to the same
  Obsidian graph node regardless of which page's casing produced it. Also
  emits **entity stub notes** (`buildEntityStubFiles`/`entityStubFileName` +
  `EntityStub` pure; `renderEntityStubFiles`/`affectedEntityStubFileNames`
  DB-backed): one `People|Places|Projects/<name>.md` per entity with
  `[[YYYY-MM-DD]]` backlinks to its days, so the day files' `[[wikilinks]]`
  resolve to real (clickable) Obsidian pages instead of unresolved nodes.
  Merged into `maybeExportDiaryToDropbox`'s file map (incremental per
  notebook, full on a whole-vault sync).
- `lib/notebookDedup.ts` (pure: `classifyDuplicate`, `buildCloudCoverage`,
  `buildCandidate`) + `lib/notebookDedupDb.ts` (DB-backed
  `findDuplicateCandidates`) — flags old (Dropbox-ingested or manually
  uploaded) notebooks whose diary dates are already covered by a
  reMarkable-cloud-imported notebook, via `app/api/notebooks/duplicates`
  and a "Possible duplicates" section on `/notebooks`. Manual delete only,
  reusing `app/notebooks/page.tsx`'s existing `remove()` pattern.
- `lib/remarkableCloud.ts` — reMarkable-cloud secondary source (rmapi-js,
  unofficial protocol). Phase 0: `pairRemarkable`/`listRemarkableNotebooks`/
  `remarkableStatus`/`unpairRemarkable` + pure `filterNotebooks`. Phase 1b:
  `downloadNotebook(id,hash)` (getDocument → jszip unzip → ordered `.rm`
  bytes) + pure `orderedPageIdsFromContent` (cPages/legacy page order);
  persists the listed notebooks so the UI can render Import rows. Fail-soft
  everywhere; device token redacted from backups.
- `lib/rmRender.ts` — renders ordered `.rm` pages → one merged PDF via the
  image's `rm2pdf` (per page) + `pypdf` (merge), with per-page failure
  isolation. `renderersAvailable()` is false off-image, so local/CI/build
  never render. `lib/remarkableImport.ts` — `importRemarkableNotebook` ties
  download → render → the normal createNotebook/processNotebook pipeline, with
  `remarkable_doc_id`/`remarkable_doc_hash` dedupe (skip unchanged; replace on
  change, but only after a good render). `lib/remarkableSync.ts` — Phase 2
  zero-tap sweep sync (see Known limits for the full invariant list): pure
  `diffRmPages`/`orderPagesKeepStale` + `maybeSyncRemarkable` +
  `incrementalSyncNotebook`; per-page sha256 diffing so a daily diary session
  OCRs 1-2 pages, never the notebook.
- `lib/location.ts` + `lib/owntracks.ts` — OwnTracks ingestion, stay
  clustering, reverse-geocoding; `lib/github.ts` — discipline repo fetch;
  `lib/cleanup.ts`, `lib/upload.ts`, `lib/extractText.ts`, `lib/format.ts` —
  support utilities; `lib/auth.ts` + `lib/webauthn.ts` — passkey/passcode lock
  (`lib/auth.ts` also gates the passcode itself with a brute-force lockout —
  `passcodeLockRemainingMs`/`recordFailedPasscodeAttempt`/
  `recordSuccessfulAuth`, DB-persisted so it survives a cold restart mid-attack).
- `instrumentation.ts` — two jobs, both because this is the ONE place in the
  app that runs once at server boot, independent of any HTTP request. (1)
  Process-level `unhandledRejection`/`uncaughtException` safety net (log,
  don't crash). Needed because the app fires a lot of never-awaited
  background work (`runMaintenanceSweep` in `lib/notes.ts` and friends); an
  unguarded async failure anywhere in that chain would otherwise be a fatal
  unhandled rejection under modern Node and take the whole server down for
  the one person using it. Every fire-and-forget call site in
  `lib/notes.ts`/`lib/entityWiki.ts`/`app/api/chat/route.ts` still has its
  own `.catch()` too — this is defense in depth, not a replacement for
  handling errors at the call site. (2) Calls
  `startBackgroundMaintenanceScheduler` (`lib/notes.ts`) — a real
  `setInterval`, fired once immediately then every `MAINTENANCE_INTERVAL_MS`.
  Without this, `runMaintenanceSweep` (and therefore reMarkable-cloud polling
  + Dropbox ingest — the "zero-tap" sync) only ever ran as a side effect of
  someone loading a page; a notebook wouldn't actually sync until the user
  opened the app, defeating the "write, close the cover, done" promise. The
  scheduler is a thin wrapper — `runMaintenanceSweep` is already
  self-throttled internally, so calling it on a clock needed no changes to
  its own guard logic. Requires `experimental.instrumentationHook: true` in
  `next.config.mjs` on Next 14.2 (default-on from Next 15 — remove the flag
  on that upgrade, don't remove the file).
- API routes (`app/api/*`): `auth`, `notebooks`, `chat`, `insights`, `usage`,
  `memory`, `diary`, `mind` (+ `mind/analyze`, `mind/reanalyze`,
  `mind/axis-labels`, `mind/reparse-dates`, `mind/merge-entities`,
  `mind/build-wiki`), `embeddings`, `backup`,
  `discipline`, `dropbox/{connect,callback,status,disconnect,export}`,
  `location`, `owntracks`, `mcp` (remote MCP endpoint — see `lib/mcp.ts`) +
  `mcp/oauth/{register,authorize,token,protected-resource,authorization-server}`
  (OAuth 2.1 server for the claude.ai connector — see `lib/mcpOauth.ts`; the
  `/.well-known/oauth-*` discovery paths are `next.config.mjs` rewrites),
  `remarkable/{connect,refresh,disconnect,status,import,compare,autosync}`,
  `export` (+ `export/diary` diary-only Markdown,
  `export/book` Opus editor pass), `settings`,
  `chat/memories` (GET list+status / DELETE soft-delete /
  `retry/[batchId]` reset stuck / `backfill-all` chunked re-process
  with optional `?reset=true`), `librarian` (GET-only status for the Phase C
  librarian agent's heartbeat — see `lib/conversationEntities.ts`; no POST,
  the app doesn't run the agent itself).
- UI pages (`app/*`): `notebooks`, `chat`, `insights`, `mind` (heatmap, theme
  cloud, mood timeline, 3D embedding map — `app/mind/Map3D.tsx`), `memory`,
  `usage` (cost calendar).
- `app/share/route.ts` — PWA Web Share Target; `public/manifest.json` — PWA
  manifest.

## GitHub Actions

- `.github/workflows/review-watcher.yml` — when the automated code-review
  bot (GitHub actor `chatgpt-codex-connector`, its fixed external username)
  posts a review comment, review, or issue comment, the workflow auto-pings
  `@claude` on the same thread so the Claude Code GitHub App spawns a session
  to investigate. The handoff instructs that session to **review the finding
  and ASK the user before applying anything** — verify validity, report the
  finding + proposed fix, and wait for the user's go-ahead rather than
  auto-fixing (the owner wants to be asked after every review). No new
  secrets; uses the default `GITHUB_TOKEN`. Disable by deleting the file or
  commenting out the `on:` triggers.

## Tests

`npm test` runs Vitest over `test/*.test.ts` — pure-logic units only (no
network, throwaway SQLite for the one DB-backed test). Covers `extractEntryDate`
formats, the PCA invariants (orthonormality, variance ordering, reconstruction,
direction match *up to sign* — never absolute coordinates, since PCA sign is
arbitrary), `parseAxisLabels` leniency, and the `/mind` discipline-exclusion
filter. `npm run build` is still the integration safety net; Claude/Voyage
features need the deployed instance to fully verify.

## Hard-won rules — do not regress these

- **Fire-and-forget background calls need `.catch()`, not just an outer
  `try/catch`.** A `try { void asyncFn(); } catch {}` block only catches a
  *synchronous* throw — once `asyncFn()` returns a promise, that block has
  already exited by the time it rejects, so the rejection goes unhandled.
  Under modern Node an unhandled rejection is fatal by default and kills the
  whole process (`instrumentation.ts` logs-and-survives it as a last resort,
  but the real fix is not needing that safety net). Every fire-and-forget
  call (`runMaintenanceSweep`'s jobs, the Dropbox/entity-wiki/chat-memory
  triggers) must end its own promise chain with `.catch(e => console.warn(...))`.
  When adding a new one, copy that pattern — don't rely on the outer
  try/catch alone.
- **The passcode has a brute-force lockout — don't bypass it.** `lib/auth.ts`
  tracks failures in the `auth_fail_state` setting; 8 wrong passcodes within
  a rolling 15-minute window lock further passcode attempts (`action:
  "register-options"` and `"passcode"`) for the rest of that window, checked
  before `checkPasscode` even runs. WebAuthn `login-verify` is deliberately
  NOT gated — a forged assertion isn't practically guessable, so limiting it
  would only add self-lockout risk with no security benefit. A correct
  passcode clears the counter immediately.
- **Deleting an auto-ingested notebook must tombstone its source id — BOTH
  channels.** The Dropbox watcher dedupes on `notebooks.dropbox_file_id` and
  the reMarkable sweep's subscription set is `notebooks.remarkable_doc_id`;
  the DELETE removes both — so `deleteNotebook` writes a
  `dropbox_ingest_tombstones` and/or `remarkable_ingest_tombstones` row, the
  watcher's seen-set is `ingestSkipFileIds()` (notebooks ∪ tombstones), and
  the sweep's auto-import branch skips `remarkableTombstonedDocIds()`.
  Without this a deleted notebook re-ingests on the very next poll/sweep
  (and re-bills OCR on the reMarkable side). An explicit user Import clears
  the reMarkable tombstone (deliberate re-add). Do NOT revert either reader
  to the live `notebooks` columns alone.
- **Clear is a real boundary.** The chat POST history query filters
  `archived_at IS NULL` — cleared messages no longer feed Claude as raw
  history. Continuity is carried forward by extracted `chat_memories`
  (compact items: preferences, facts, intents, feelings, unresolved).
  Each Clear creates a `chat_archive_batches` row, the
  `app/api/chat/route.ts:DELETE` handler fires
  `maybeCompressChatSessions` un-awaited, and the maintenance sweep
  catches whatever the inline trigger missed. Do NOT revert the POST
  filter to "all rows" — that would double-count cleared messages
  (once as raw history, once as recalled memory).
- **Rolling memory must stay OUTSIDE the raw-history window.** As an active
  conversation grows, `maybeRollConversationMemory` (fired un-awaited from the
  chat POST) compresses its older turns into `chat_memories` *before* a Clear,
  so the middle of a long never-cleared chat isn't a blind spot (too old for
  the live window, not yet a memory). `createRollingBatch` stamps those
  turns with an `archive_batch_id` but **leaves `archived_at` NULL** — so they
  stay visible in the UI (the GET filters `archived_at IS NULL`) and it's
  purely additive. The live window is `RAW_HISTORY_WINDOW` (20), exported from
  `lib/chatMemory.ts` and imported by the chat route's `LIMIT`, so the two can
  never drift. The load-bearing invariant: `ROLL_KEEP_RECENT` must stay **≥**
  `RAW_HISTORY_WINDOW`, so a rolled turn can never *also* still be in the live
  window — that's what stops the same turn counting once as raw history and
  once as recalled memory. They're set **equal** (both 20), which means there's
  no structural gap at all — every turn is either in the live window or rolled
  (the only residual is the sub-`ROLL_MIN_OLD` accumulation buffer).
  `createRollingBatch` ALSO
  gates on `MIN_USER_CHARS_FOR_COMPRESSION` (200) before creating a batch:
  without it, a chunk of terse turns would be rolled, permanently marked
  `too-short` by `compressBatch`, and — because Clear preserves the existing
  `archive_batch_id` via `COALESCE` — never re-compressed with the rest of the
  conversation (its substance silently lost). A later Clear relies on that same
  `COALESCE` to leave rolled turns in their rolling batch and never re-extract
  them. Compression is routed through `maybeCompressChatSessions` (the guarded
  single-flight sweep), NOT a direct `compressBatch` call, so a concurrent
  sweep can't double-compress the same pending batch. Do NOT make rolling set
  `archived_at` (it would delete messages from the user's view mid-chat), do
  NOT drop `ROLL_KEEP_RECENT` below `RAW_HISTORY_WINDOW`, and do NOT drop the
  user-char gate.
- **The MCP endpoint is read-only by default and fails closed.**
  `app/api/mcp/route.ts` exposes the diary to Claude on the user's
  subscription, guarded ONLY by the `MCP_AUTH_TOKEN` bearer check in
  `lib/mcp.ts` (the cookie/passkey lock does not apply to it). Invariants: (1)
  the endpoint is genuinely read-only, not just by convention — `callMcpTool`
  passes `{ readOnly: true }` to `executeTool`, and any tool with a side effect
  must honor it (e.g. `get_recent_locations` skips its
  `warmCurrentLocationGeocode` — a Nominatim call + `geocode_cache` write —
  under readOnly; `search_diary`'s Voyage query-embed is compute-only, no DB/fs
  write, and stays). Diary text is OCR'd handwriting and chat is outside our
  system prompt, so treat every request as hostile and keep the blast radius at
  "read". **The sanctioned writes are `export_conversation` (Phase B),
  `save_reflection`, and the three Phase C librarian write tools**
  (`tag_conversation_entities`, `update_entity_conversation_notes`,
  `record_librarian_heartbeat`): all five are MCP-only, handled directly in
  `callMcpTool` (not via `executeTool`), and are (a) OFF by default —
  `export_conversation` behind `MCP_ALLOW_CONVERSATION_EXPORT=true`,
  `save_reflection` behind its OWN separate `MCP_ALLOW_REFLECTION_SAVE=true`
  (deliberately independent of the conversation-export flag — saving a real
  conversation verbatim and saving Claude-generated reflective content are
  different privacy tradeoffs, so a user can enable one without the other),
  the three librarian tools (PLUS the three librarian READ tools — see
  below) behind ONE flag `MCP_ALLOW_WIKI_LINKING=true` — hidden from
  `tools/list` AND refused on `tools/call` when off; (b)
  DETERMINISTIC-DESTINATION — the agent supplies only content (and, for the
  librarian tools, a `conversation_key`/entity name it doesn't get to
  invent a row for), never a path or id; this code always computes the
  actual DB row/file target itself. `export_conversation` and
  `save_reflection` are both literally add-only (each upserts exactly one
  row in its own table — `mcp_conversations` / `mcp_reflections`, never
  mixed); `tag_conversation_entities` is a SCOPED REPLACE of exactly one
  page's own `entry_entities` rows (the same delete+reinsert shape
  `analyzePending` already uses on that table) — narrower blast radius than
  a general write, but not literally add-only, so don't describe it that
  way; (c) size-capped (`MAX_CONVERSATION_CHARS`, `MAX_REFLECTION_CHARS`,
  `MAX_ENTITY_NOTES_CHARS`). `export_conversation`'s and `save_reflection`'s
  content is filed into the vault VERBATIM as quoted markdown by a
  deterministic exporter — no Claude call ever reads the raw content inside
  THIS process, so there is no prompt-injection-into-summarizer surface in
  our own server. The Phase C librarian is a genuinely agentic
  reader of that same content, but it runs as a SEPARATE, user-controlled
  Claude Code agent (a cron Routine on the user's own subscription) — not
  code in this repo — and it can only ever act through these narrow,
  destination-fixed tools, so the "AI decides content, code decides
  destination" discipline still holds even though an AI now reads
  previously-exported content. **`get_conversation` is the one MCP read that
  is NOT ungated**: reading back a full stored transcript is new exposure
  this endpoint couldn't previously provide, so it (and its sibling reads
  `list_unlinked_conversations`/`get_entity_wiki`) share the write tools'
  `MCP_ALLOW_WIKI_LINKING` gate rather than being always-on like
  `get_profile`/`recall_memories`/`get_guidance`. Any OTHER new write tool
  must follow the same properties AND gate behind `!opts?.readOnly` if it
  rides `executeTool`; (2) never make a missing/short token fall back
  to "open" — `checkMcpAuth` returns `disabled` (503), and that must stay the
  no-config behavior; (3) the per-IP brute-force throttle applies to FAILED
  auth only — a valid token must never be throttled (Claude's connector
  traffic can share egress IPs with other tenants, so throttling valid
  requests would let an attacker lock the real user out); (4) every failed
  attempt and tool call is recorded in `mcp_audit` (size-capped, best-effort —
  audit writes must never take the endpoint down); (5) the sensitive tools
  `get_recent_locations` + `search_chat_history` are excluded from the MCP
  surface BY DEFAULT (`SENSITIVE_TOOL_NAMES`) — location is a timestamped
  movement schedule, and under claude.ai account takeover that's a
  physical-safety risk, so forgetting config must fail SAFE. Only
  `MCP_ALLOW_SENSITIVE_TOOLS=true` exposes them; `MCP_EXCLUDE_TOOLS` can add
  more exclusions but can NEVER re-include a sensitive tool. Do not weaken
  this to opt-out. `MCP_AUTH_TOKEN` accepts comma-separated tokens for
  zero-downtime rotation. The tool list is derived from `CHAT_TOOLS`, so a new
  chat tool automatically appears on MCP — if you ever add a WRITE chat tool,
  you must exclude it in `mcpToolList` first (and if it's sensitive, add it to
  `SENSITIVE_TOOL_NAMES`); (6) the OAuth `/authorize` endpoint
  (`lib/mcpOauth.ts`) is the auth server's security anchor — it MUST keep
  gating on `consentSecretValid` (= `MCP_AUTH_TOKEN`), never auto-approve;
  PKCE `S256` is required at token exchange, `redirect_uri` must exact-match a
  registered client's URIs (no open redirect / code interception), auth codes
  are single-use, and issued tokens are stored HASHED. Every issued token is
  BOUND to the `MCP_AUTH_TOKEN` value that authorized it (`secret_hash`), and
  `isValidAccessToken`/`refreshAccessToken` reject a token whose secret is no
  longer configured — so **rotating** the token (not just unsetting it) truly
  revokes tokens minted under the old value, which is the documented
  revocation path for a compromised connector. Keep that binding; don't let a
  token validate solely because *some* `MCP_AUTH_TOKEN` is set. (One bridge:
  `backfillLegacyTokenSecrets` adopts pre-migration rows whose `secret_hash` is
  NULL into the *current* secret once, at first use — so the migration deploy
  doesn't log an existing connector out; after adoption they revoke on rotation
  like any other token. Don't turn that into a general "NULL = always valid".)
  Registration
  is open (public clients) ON PURPOSE — it grants nothing without passing the
  consent gate. Don't relax any of these.
- **The librarian's synthetic notebook needs BOTH an inclusion and an
  exclusion list — getting either backwards is the likely bug class here.**
  `CONVERSATIONS_NOTEBOOK_ID` (`lib/notes.ts`) is a second synthetic notebook
  alongside `DISCIPLINE_ID`, but with the OPPOSITE default posture: its pages
  carry a real, non-empty `ocr_text`/`entry_date` (unlike discipline's), so it
  needs explicit exclusion from surfaces that assume "this is real diary
  content" — `analyzePending`'s pending-query (`lib/mind.ts`; this one fix
  also transitively protects `getThemes`/`getSentimentSeries`/
  `getEmbeddingMap`, since none of them have any other notebook filter and
  rely entirely on `entry_analysis` never containing this notebook's rows),
  `getHeatmap`, `entityWiki.ts`'s `candidates`/`mentions` (protects the
  ownership separation below), `diaryExportDb.ts`'s `fetchDiaryData` (day
  files — a conversation already gets its own note, a day file would
  duplicate it) and `affectedDayFileNames`, and `chatTools.ts`'s
  `getEntriesByDate`/`getRecentEntries`/`listNotebooks`. But UNLIKE
  discipline, it must stay INCLUDED (never added to an exclusion list) in
  `chatTools.ts`'s `topEntities`/`pagesForEntity`/`relatedEntities`,
  `mind.ts`'s `getTopEntities`, `entityMerge.ts`'s dedup candidates,
  `diaryExportDb.ts`'s `fetchCanonicalEntityNames`/`renderEntityStubFiles`/
  `affectedEntityStubFileNames` — that inclusion is what makes a person only
  ever discussed in a subscription conversation still show up in the entity
  graph, rankings, and get a real Obsidian stub page. Do not "clean up" by
  excluding it everywhere discipline is excluded, and do not forget the
  exclusions above just because the graph/stub side stays inclusive.
- **`entity_wiki.summary` (in-app diary bio) and `entity_conversation_notes`
  (librarian's own notes) are DISJOINT tables on purpose — never merge them
  into one column.** `refreshEntityWiki` (`lib/entityWiki.ts`) regenerates
  `entity_wiki.summary` via content-addressed hashing over diary mentions
  only; the librarian's `update_entity_conversation_notes` MCP tool
  (`lib/conversationEntities.ts`) writes `entity_conversation_notes.notes`
  via a full-text replace with no hash at all. If these ever shared one
  field, whichever wrote second would silently clobber the other's work on
  its next regen. `renderEntityStubFiles` (`lib/diaryExportDb.ts`) reads both
  and renders them as separate sections (the diary bio, then a "## Recent
  conversations" heading) on the same stub note — that's the only place they
  ever appear together, and it's read-only composition, not a merge.
- **Chat memory recall is fail-open AND embedding-optional.** `chatOverNotes`
  accepts `recalledMemories` as a pre-rendered text block; it lives in the
  dynamic context block (never cached). Recall must never throw — chat must
  never 500 because Voyage was down. **Do NOT re-gate recall purely on
  semantic similarity.** For a small corpus (≤ `RECALL_INCLUDE_ALL_MAX`)
  `recallChatMemories` returns *all* non-deleted memories — embeddings are
  used only to *order* them, never to *exclude* them — because a memory with
  a NULL embedding (Voyage rate-limited during extraction) or sub-threshold
  phrasing would otherwise be silently invisible even though it's right there
  on `/memory`. That exact bug shipped once: memories the user could see were
  never reaching Claude. When Voyage is down or the query can't be embedded,
  recall degrades to **recency**, not emptiness. Semantic top-K only kicks in
  at scale, and even then a recency floor is always blended in.
- **Memory extraction is bounded-retry.** `MAX_EXTRACTION_ATTEMPTS = 2`.
  On parse failure the first attempt leaves the batch pending; the
  second attempt sets `memory_extracted_at` to mark permanent skip.
  Reset via `POST /api/chat/memories/retry/[batchId]` (also exposed
  as a "Retry stuck batches" button on `/memory`). Do not switch back
  to "advance the watermark on first failure" — that quietly discards
  a useful conversation when Claude returns garbage once.
- **Chat memory backfill is chunked, not single-batch.** The
  `backfill-all` endpoint splits each conversation by
  `CHUNK_TARGET_CHARS = 12_000` (well under `compressBatch`'s
  `MAX_TRANSCRIPT_CHARS = 16_000` cap) so a long history flows into
  many batches and Claude actually reads all of it. The first
  implementation grouped each conversation into one giant batch —
  combined with the 16K cap, that silently truncated months of chat
  to the most recent tail and produced ~6 items from real history.
  Don't reintroduce a single-batch backfill.
- **Chat reasons over the profile, not the whole corpus.** `chatOverNotes`
  takes the compact `profile` (Claude's accumulated understanding, updated in
  the background when a diary is fed) and exposes a set of tools in
  `lib/chatTools.ts` (`search_diary`, `get_entries_by_date`,
  `get_day_summary` etc.) that Claude calls on demand — NOT the full notes
  context. Sending all notes per message is what made one chat cost ~$0.11;
  do not revert to that. The profile is built/kept by
  `buildSelfModel`/`updateSelfModel` on `CLAUDE_MODEL` (Opus); chat stays on
  `CHAT_MODEL` (Sonnet by default). If the chat model is overloaded, chat
  falls back to `CHAT_FALLBACK_MODEL` (default `claude-sonnet-4-6`) for that
  message. Insights deliberately still uses the full corpus (it's an
  occasional, on-demand reflection).
- **Transcription runs in the background.** `createNotebook` returns
  immediately; `processNotebook` is fired un-awaited and sets the notebook
  `status` (`processing`/`done`/`error`). Never make upload or share wait for
  OCR — doing so froze the UI for ~a minute.
- **OCR streams the response** (`messages.stream()`). A non-streaming call
  with a large `max_tokens` is rejected by the SDK.
- **OCR output is a `--- PAGE n ---` delimiter format, not JSON.** It survives
  truncation and escaping issues. Do not switch back to JSON.
- **Behind Railway's proxy, `req.url` reports the internal `localhost:8080`.**
  Never build redirects or absolute URLs from it; redirect client-side (see
  `app/share/route.ts`).
- **UI tokens live in `DESIGN.md`. Read it before any UI change.** Three
  load-bearing rules:
  - **One font everywhere — Clear Sans, self-hosted under `public/fonts/`.**
    Loaded via `next/font/local` in `app/layout.tsx`. Zero build-time and
    runtime external font requests. Do not add a serif, do not add Caveat
    back, do not switch loaders unless you also update `DESIGN.md`.
  - **`.font-semibold` is globally remapped to `font-weight: 500`** in
    `app/globals.css` because Clear Sans has no 600 face. Do not introduce
    a real 600 font face unless Clear Sans starts shipping one; do not
    remove the remap.
  - **Dark mode stays media-based.** Every existing `dark:` variant in the
    codebase depends on `prefers-color-scheme`. Do not switch to
    class-based without auditing the whole repo.
- Keep `CHANGELOG.md` updated with every notable change.

## Known limits (intentional)

- Direct reMarkable-cloud polling (zero-tap) — **in progress as a
  SECONDARY source, phased.** The old blocker (no reliable renderer) eased
  in 2025–2026: `rmapi-js` (maintained, pure-JS, ESM) reads the cloud, and
  `rmc`+`cairosvg` (Python) render `.rm` v6 → SVG → PDF server-side
  (validated on real firmware-3.x samples; caveats: never use `rmc -t pdf`
  — it needs Inkscape — and patch rmc's RM_PALETTE, which in `rmc==0.3.0`
  genuinely omits the firmware-≥3.14 highlighter color id 9 and crashes with
  `KeyError: 9` on those pages. `docker/patch_rm_palette.py` restores it,
  necessity-gated on the *live* dict so it inserts only when 9 is missing).
  **Phase 0 (shipped): `lib/remarkableCloud.ts`
  pairs via a one-time code from my.remarkable.com and LISTS notebooks
  read-only.** **Phase 1a (shipped): the Dockerfile builder + bundled
  renderer toolchain (deploy switch, verified on Railway).** **Phase 1b
  (shipped): on-demand import of ONE notebook behind a human quality gate —
  `downloadNotebook` → `lib/rmRender.ts` → the normal OCR pipeline, exposed as
  an Import button per notebook on `/memory`.** Whole-notebook render + re-OCR;
  dedupe via `remarkable_doc_id`/`remarkable_doc_hash`. **Phase 2 (shipped):
  `lib/remarkableSync.ts` — zero-tap polling from `runMaintenanceSweep`.**
  Scope = previously-imported notebooks + folders enabled via the Auto-sync
  toggle on `/memory` (`remarkable_sync_folders`; never all notebooks).
  Page-level diffing: each page row stores `remarkable_page_id` + a sha256 of
  its raw `.rm` bytes; only new/changed pages get rendered + OCR'd. Ordering
  (`page_index`) re-syncs from cloud page order every sync; tablet-deleted
  pages are KEPT (append-only diary), ordered last. Guards: in-flight flag,
  5-min interval, 30-min failure backoff, 30-min quiesce window, rootHash
  fast-path (cursor advances only when every candidate settled), per-sweep
  OCR budget. Legacy Phase-1b imports restructure to per-tablet-page rows on
  their first incremental sync (one-time re-OCR). This rides reMarkable's
  *unofficial* protocol, so it's a secondary source — **the Dropbox one-tap
  path stays the reliable fallback and is never removed.**
- Dropbox one-tap ingest (still the primary path): with reMarkable Connect,
  the user taps **Share → Export to integration → Dropbox**, reMarkable
  renders the PDF server-side, and `lib/dropbox.ts` auto-ingests from there.
- The PWA share target and the voice features work on Android Chrome only;
  iOS Safari does not support them.

## Session logs

Detailed records of what was decided and validated in past sessions live
under `docs/sessions/`. Read the most recent ones before starting work on
related areas (Voyage embeddings, OCR model choice, cost optimization,
backup behavior) so you don't re-derive answers we already have.

## Agent skills

Vendored from [`sanjaykims/skills`](https://github.com/sanjaykims/skills)
(a fork of [`mattpocock/skills`](https://github.com/mattpocock/skills),
MIT) — 22 engineering + productivity skills for disciplined,
alignment-first agentic development (grill-with-docs, tdd, diagnosing-bugs,
implement, code-review-style two-axis review, domain-modeling, triage,
research, and more), installed live under `.claude/skills/`. See
`docs/reference/README.md` for the full list and the one rename
(`code-review` → `/deep-code-review`, to avoid colliding with this
session's built-in `code-review` skill).

### Issue tracker

Issues live in this repo's GitHub Issues. See `docs/agents/issue-tracker.md`
(note: sessions without the `gh` CLI on `PATH` should use the equivalent
GitHub MCP tools instead — see that file's compatibility note).

### Triage labels

Default canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`), unchanged. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`CONTEXT.md` + `docs/adr/` at the repo root, created
lazily by `/domain-modeling` — neither exists yet). See `docs/agents/domain.md`.

## Working with this user

- Non-technical; works primarily from an Android phone; communicates with
  screenshots. Give clear, mobile-friendly, step-by-step instructions.
- Their vision: Claude continuously fed their reMarkable notes to "help my
  life in every way." Plausible next steps: turning notes into calendar
  events / todos, proactive weekly digests.
- Verify with `npm run build` (and `npm test` when you touch pure logic like
  date parsing, PCA, or cost math) before claiming a task is done. The
  Claude-powered features (OCR, chat, insights) need `ANTHROPIC_API_KEY` and
  can only be fully tested on the deployed Railway instance — say so honestly
  rather than claiming they were verified locally.
