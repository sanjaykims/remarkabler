# CLAUDE.md

Guidance for Claude Code working on this repository.

## What this is

"Feed Claude — reMarkable": a self-hosted Next.js app. The user exports a
notebook as PDF from their reMarkable tablet, uploads it here, and Claude
transcribes every handwritten page. They can then chat over their notes and
generate an accumulating record of "insights" about themselves.

## Repo & deployment

- **This repo (`remarkable-feed`) is the source of truth — develop directly
  here.** It was previously a generated mirror of
  `korean-news-study-en/remarkable-app` via a "split" workflow; that bridge is
  retired. Do not recreate it, and ignore the old repo.
- Deployed on **Railway**, which auto-deploys on every push to `main`.
- Railway config: env vars `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`
  (set to `claude-opus-4-7`), `DATA_DIR=/data`; a persistent volume is mounted
  at `/data` and holds the SQLite database and uploaded PDFs.
- `npm run start` honors the host-provided `PORT`. `npm run build` must pass.

## Stack

Next.js 14 (App Router, TypeScript), better-sqlite3, @anthropic-ai/sdk,
Tailwind CSS. All data (SQLite `app.db` + uploaded PDFs) lives under
`DATA_DIR` (defaults to `./data`).

## Architecture

- `lib/db.ts` — SQLite connection, schema, migrations. Tables: `settings`,
  `notebooks`, `pages`, `pages_fts`, `chat_messages`, `insights`.
- `lib/claude.ts` — Anthropic API calls: `ocrNotebookPdf`, `chatOverNotes`,
  `generateInsights`.
- `lib/notes.ts` — `createNotebook` (fast: save PDF + DB row), `processNotebook`
  (background OCR), `deleteNotebook`, `buildNotesContext`, `buildChatContext`.
- `app/api/notebooks` — upload (POST) / list (GET) / delete; `app/api/chat`;
  `app/api/insights`.
- `app/notebooks`, `app/chat`, `app/insights` — UI pages.
- `app/share/route.ts` — PWA Web Share Target; `public/manifest.json` — PWA
  manifest.

## Hard-won rules — do not regress these

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
