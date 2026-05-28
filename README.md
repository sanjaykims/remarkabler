# Remarkabler

A self-hosted, private **AI companion that grows with you.** You write by hand
on your reMarkable, export a notebook as PDF, and upload it here; Claude
transcribes every page and folds what it learns into an evolving "profile of
you." You can then chat with something that actually remembers your life,
generate cumulative insights, and — optionally — let it know where you've been.

Everything lives in your own database; the only data that leaves is what you
send to Claude to answer you.

> **Looking for how to *use* the app?** See [`USER_GUIDE.md`](./USER_GUIDE.md)
> — a friendly, non-technical manual. This README is for running and
> developing it.

## How it works

```
reMarkable PDF → upload → Claude OCR (background) → per-page text + FTS
                                                  ↘ updates the "profile of you"
chat → reasons over the compact profile + a few relevant note excerpts
       (+ your recent location route) → personal answers
```

Chat deliberately reasons over the **compact profile plus a few retrieved
excerpts**, not the entire notes corpus — that keeps each message roughly 10×
cheaper. Insights still reflects over everything, on demand.

## Stack

Next.js 14 (App Router, TypeScript) · better-sqlite3 · `@anthropic-ai/sdk` ·
Tailwind CSS · WebAuthn passkeys (`@simplewebauthn`) · installable PWA with a
Web Share Target. All data (the SQLite `app.db` plus uploaded PDFs and chat
attachments) lives under `DATA_DIR` (defaults to `./data`).

## Setup (local dev)

```bash
cp .env.local.example .env.local   # add your ANTHROPIC_API_KEY
npm install
npm run dev
```

Open <http://localhost:3001>.

## Configuration

Behavior is controlled by environment variables. Only `ANTHROPIC_API_KEY` is
required; every optional feature stays **off until its variable is set**.

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | **Required.** Claude API key. |
| `CLAUDE_MODEL` | Model for OCR / insights / memory (an Opus model). |
| `CHAT_MODEL` | Model for everyday chat (defaults to `claude-sonnet-4-6`). |
| `CHAT_FALLBACK_MODEL` | Used for one message if the chat model is overloaded (default `claude-sonnet-4-6`). |
| `DATA_DIR` | Where `app.db` + PDFs live (mount a persistent volume here). |
| `APP_PASSCODE` | Set to enable the private lock (passkey + passcode). Unset = app is fully open. |
| `OWNTRACKS_TOKEN` | Set to enable automatic location ingestion at `/api/owntracks`. |
| `LOCATION_TZ_OFFSET` | Minutes from UTC for displayed local times (default `540` = Seoul). |
| `DISCIPLINE_REPO` / `DISCIPLINE_GITHUB_TOKEN` / `DISCIPLINE_BRANCH` | Connect a private GitHub notes repo (default branch auto-detected). |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | Optional anonymous analytics (no note content is ever sent; `NEXT_PUBLIC_*` are inlined at build time). |

## Architecture

- `lib/db.ts` — SQLite connection, schema, migrations. Tables: `settings`,
  `notebooks`, `pages`, `pages_fts`, `chat_messages`, `chat_attachments`,
  `insights`, `profile`, `credentials`, `api_usage`, `locations`,
  `route_stops`, `location_points`, `geocode_cache`.
- `lib/claude.ts` — Anthropic calls: `ocrNotebookPdf`, `chatOverNotes`,
  `generateInsights`, `generateInsightTitle`, and the evolving-memory pair
  `buildSelfModel` / `updateSelfModel`. Each records token usage + cost.
- `lib/notes.ts` — `createNotebook` (fast: save PDF + row), `processNotebook`
  (background OCR, then folds the entry into the profile), `deleteNotebook`,
  `retrieveRelevantNotes` (FTS), `ensureProfileSeed`, plus the GitHub
  "discipline" sync helpers.
- `lib/profile.ts` — the versioned "profile of you" (read / save / rebuild).
- `lib/usage.ts` — `recordUsage` plus monthly / daily / total cost aggregation.
- `lib/owntracks.ts`, `lib/timeline.ts`, `lib/location.ts` — automatic route
  (OwnTracks), Google Timeline import, and the one-tap location log.
- `lib/auth.ts`, `lib/webauthn.ts` — session cookie + passkey registration/verify.
- `lib/github.ts` — fetch text files from the discipline repo.
- `app/api/*` — `notebooks`, `chat` (+ `chat/attachment/[id]`), `insights`,
  `memory`, `usage`, `owntracks`, `location` (+ `location/import`),
  `discipline`, `auth`.
- `app/notebooks`, `app/chat`, `app/insights`, `app/memory`, `app/usage`, and
  the `app/page.tsx` dashboard — the UI.
- `app/share/route.ts` — PWA Web Share Target; `public/manifest.json` — manifest.

A two-page visual overview lives in
[`remarkabler-architecture.pdf`](./remarkabler-architecture.pdf).

## Deployment

Runs on **Railway**, which auto-deploys on every push to `main`. It needs a
**persistent disk** for the SQLite database and PDFs, so it can't run on a
serverless platform with an ephemeral filesystem.

- Set `ANTHROPIC_API_KEY` (and any optional variables) in the host environment.
- Attach a persistent volume and point `DATA_DIR` at its mount path (e.g.
  `/data`).
- `npm run start` respects the host-provided `PORT`.
- Automatic location and GitHub sync need the host's network policy to allow
  outbound calls to `nominatim.openstreetmap.org` and `api.github.com`.

## Design notes (don't regress these)

- **Chat reasons over the profile, not the whole corpus** — sending all notes
  per message is what made one chat cost ~$0.11.
- **Transcription runs in the background** — `createNotebook` returns
  immediately; `processNotebook` is fired un-awaited and sets the notebook
  `status`. Never make upload or share wait for OCR.
- **OCR streams the response** and uses a `--- PAGE n ---` delimiter format
  (not JSON) so it survives truncation.
- **Behind Railway's proxy, `req.url` reports the internal `localhost:8080`** —
  never build redirects or absolute URLs from it; redirect client-side.
- **No automatic reMarkable cloud sync** — there's no reliable JavaScript
  renderer for the raw `.rm` handwriting format, so the app relies on manual
  PDF export by design.
