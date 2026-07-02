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
- Railway config: env vars `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`
  (set to `claude-opus-4-7`), `DATA_DIR=/data`; a persistent volume is mounted
  at `/data` and holds the SQLite database and uploaded PDFs. Optional
  `CHAT_MODEL` overrides the model used for chat only (defaults to
  `claude-sonnet-4-6`); OCR and insights stay on `CLAUDE_MODEL`. Optional
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
  person/place/project — for the `top_entities` chat tool), `locations`,
  `location_points`, `route_stops`, `geocode_cache`, `chat_archive_batches`
  + `chat_memories` (durable chat-memory layer; one batch per Clear,
  soft-deleted items don't resurrect). Some durable state also lives in
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
  `isDuplicateMemory` (exact text_norm + 0.88 cosine), and
  `resetBatchForRetry` (clears permanent-skip state).
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
  `get_entries_by_date`, `get_day_summary`, …), dispatched on demand.
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
  read-only folder polling, dedupe by `notebooks.dropbox_file_id`. Watcher
  is fired from `runMaintenanceSweep` so it runs alongside the other
  background jobs. Also the **opt-in diary auto-export**
  (`maybeExportDiaryToDropbox`, fired from `processNotebook`): writes the
  rendered diary Markdown back to Dropbox after each ingest. This is the
  ONE path that needs the `files.content.write` scope — off by default
  (`dropbox_export_enabled` setting), and it fails-open with an actionable
  "enable the write scope + reconnect" message. Ingest stays read-only.
- `lib/diaryExport.ts` (pure Markdown assembly + date carry-forward,
  unit-tested) + `lib/diaryExportDb.ts` (`renderDiaryMarkdown`: the
  DB-backed renderer shared by `GET /api/export/diary` and the Dropbox
  auto-export). Excludes the `github-discipline` notebook, same as `/mind`.
- `lib/location.ts` + `lib/owntracks.ts` — OwnTracks ingestion, stay
  clustering, reverse-geocoding; `lib/github.ts` — discipline repo fetch;
  `lib/cleanup.ts`, `lib/upload.ts`, `lib/extractText.ts`, `lib/format.ts` —
  support utilities; `lib/auth.ts` + `lib/webauthn.ts` — passkey/passcode lock.
- API routes (`app/api/*`): `auth`, `notebooks`, `chat`, `insights`, `usage`,
  `memory`, `diary`, `mind` (+ `mind/analyze`, `mind/reanalyze`,
  `mind/axis-labels`, `mind/reparse-dates`), `embeddings`, `backup`,
  `discipline`, `dropbox/{connect,callback,status,disconnect,export}`,
  `location`, `owntracks`, `export` (+ `export/diary` diary-only Markdown,
  `export/book` Opus editor pass), `settings`,
  `chat/memories` (GET list+status / DELETE soft-delete /
  `retry/[batchId]` reset stuck / `backfill-all` chunked re-process
  with optional `?reset=true`).
- UI pages (`app/*`): `notebooks`, `chat`, `insights`, `mind` (heatmap, theme
  cloud, mood timeline, 3D embedding map — `app/mind/Map3D.tsx`), `memory`,
  `usage` (cost calendar).
- `app/share/route.ts` — PWA Web Share Target; `public/manifest.json` — PWA
  manifest.

## GitHub Actions

- `.github/workflows/codex-watcher.yml` — when Codex
  (`chatgpt-codex-connector`) posts a review comment, review, or issue
  comment, the workflow auto-pings `@claude` on the same thread so the
  Claude Code GitHub App spawns a session to investigate. No new secrets;
  uses the default `GITHUB_TOKEN`. Disable by deleting the file or
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

- No direct reMarkable-cloud polling — there is still no reliable JavaScript
  renderer for the `.rm` handwriting format, so we never try to render
  notebooks ourselves. Instead, we sidestep the renderer entirely: with
  reMarkable Connect ($8/mo), the user taps **Share → Export to integration
  → Dropbox** on the device, reMarkable renders the PDF server-side, and
  `lib/dropbox.ts` auto-ingests from there. One device-side tap per notebook
  replaces the whole download-and-upload dance. Direct reMarkable-cloud
  polling (zero taps) is deferred for the same renderer reason; revisit only
  if the one-tap friction becomes a real chore in practice.
- The PWA share target and the voice features work on Android Chrome only;
  iOS Safari does not support them.

## Session logs

Detailed records of what was decided and validated in past sessions live
under `docs/sessions/`. Read the most recent ones before starting work on
related areas (Voyage embeddings, OCR model choice, cost optimization,
backup behavior) so you don't re-derive answers we already have.

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
