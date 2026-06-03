# CLAUDE.md

Guidance for Claude Code working on this repository.

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
  `claude-sonnet-4-6`); OCR and insights stay on `CLAUDE_MODEL`.
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

- `lib/db.ts` — SQLite connection, schema, migrations. Tables: `settings`,
  `notebooks`, `pages`, `pages_fts`, `chat_messages`, `insights`,
  `credentials`, `chat_attachments`, `api_usage`, `profile`.
- `lib/claude.ts` — Anthropic API calls: `ocrNotebookPdf`, `chatOverNotes`,
  `generateInsights`, `generateInsightTitle`, and the evolving-memory pair
  `buildSelfModel` / `updateSelfModel`. Each records token usage + an
  estimated cost via `recordUsage` from `lib/usage.ts`.
- `lib/usage.ts` — `recordUsage` (per-call cost from list prices) plus
  `monthlyUsage` / `dailyUsage` / `totalUsage` aggregation (timezone-aware).
- `lib/profile.ts` — the evolving "profile of you" (`profile` table, versioned):
  `getCurrentProfile`, `getCurrentProfileRow`, `hasProfile`, `saveProfile`.
  Surfaced/edited via `app/memory` + `app/api/memory` (view, save edits,
  rebuild from all notes).
- `lib/notes.ts` — `createNotebook` (fast: save PDF + DB row), `processNotebook`
  (background OCR, then folds the entry into the profile via
  `build`/`updateSelfModel`), `deleteNotebook`, `buildNotesContext`,
  `buildChatContext`, `ensureProfileSeed`. (Chat retrieval now lives in
  `lib/chatTools.ts` as the `search_diary` tool, dispatched by Claude.)
- `app/api/notebooks` — upload (POST) / list (GET) / delete; `app/api/chat`;
  `app/api/insights`; `app/api/usage` (cost aggregation).
- `app/notebooks`, `app/chat`, `app/insights`, `app/usage` (cost calendar) — UI
  pages.
- `app/share/route.ts` — PWA Web Share Target; `public/manifest.json` — PWA
  manifest.

## Hard-won rules — do not regress these

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
- Keep `CHANGELOG.md` updated with every notable change.

## Known limits (intentional)

- No automatic reMarkable cloud sync — there is no reliable JavaScript renderer
  for the `.rm` handwriting format, so the app relies on manual PDF export.
  This was deliberately deferred; revisit only with the user's agreement.
- The PWA share target and the voice features work on Android Chrome only;
  iOS Safari does not support them.

## Working with this user

- Non-technical; works primarily from an Android phone; communicates with
  screenshots. Give clear, mobile-friendly, step-by-step instructions.
- Their vision: Claude continuously fed their reMarkable notes to "help my
  life in every way." Plausible next steps: turning notes into calendar
  events / todos, proactive weekly digests.
- Verify with `npm run build` before claiming a task is done. The
  Claude-powered features (OCR, chat, insights) need `ANTHROPIC_API_KEY` and
  can only be fully tested on the deployed Railway instance — say so honestly
  rather than claiming they were verified locally.
