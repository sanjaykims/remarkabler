# Remarkabler

> **Your private AI companion that grows with you.** Write by hand on your
> reMarkable; chat with something that actually remembers your life.

A self-hosted Next.js app that transcribes your handwritten notebooks with
Claude vision, builds an **evolving "profile of you"** from your diary, and
lets you chat with something that reasons over its accumulated understanding
of who you are — not just keyword-matches your notes. Optional automatic
location route, GitHub-notes sync, and an honest day-by-day cost calendar.

Everything lives in your own database. The only data that leaves is what you
send to Claude to answer you.

> **Looking for the end-user manual (non-technical)?** See
> [`USER_GUIDE.md`](./USER_GUIDE.md). For a visual overview of the system,
> see [`remarkabler-architecture.pdf`](./remarkabler-architecture.pdf).

## How it works

```
reMarkable PDF → upload → Claude OCR (background) → per-page text
                                                  ↘ updates the "profile of you"
chat → reasons over the compact profile + a few relevant note excerpts
       (+ your recent location route) → personal answers
```

Chat deliberately reasons over a **compact profile plus a few retrieved
excerpts**, not your entire note corpus — that keeps each message roughly 10×
cheaper. Insights reflects over everything on demand. Once a week, the app
quietly distills your location patterns into the same evolving profile.

## Quick start

You'll need an [Anthropic API key](https://console.anthropic.com).

### Hosted (Railway) — recommended

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template?template=https%3A%2F%2Fgithub.com%2Fsanjaykims%2Fremarkable-feed)

The button starts a new Railway project from this repo. Then, in your new project:

1. **Variables → `ANTHROPIC_API_KEY`** — paste your key from [console.anthropic.com](https://console.anthropic.com).
2. **Volumes** — add a volume (Railway → service → New → Volume) mounted at `/data`. Then in **Variables** add `DATA_DIR=/data`.
3. Open the URL Railway assigns. Done.

You can flip on optional features later by adding more variables (see [Configuration](#configuration)). For a truly one-click flow for *other* people, you can [publish your running project as a Railway template](https://docs.railway.com/guides/marketplace/publish) once it's live — that pre-configures the volume and env vars for the next person.

### Local
```bash
cp .env.local.example .env.local   # paste your ANTHROPIC_API_KEY
npm install
npm run dev
```
Open <http://localhost:3001>.

## Configuration

Only `ANTHROPIC_API_KEY` is required. Every optional feature stays **off until
its variable is set** — so you can flip the lock, location, GitHub sync, and
analytics on simply by adding one variable each.

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | **Required.** Claude API key. |
| `CLAUDE_MODEL` | Model for OCR / insights / memory (e.g. `claude-opus-4-7`). |
| `CHAT_MODEL` | Model for everyday chat (e.g. `claude-sonnet-4-6`). |
| `CHAT_FALLBACK_MODEL` | Used if the chat model is briefly overloaded (e.g. `claude-haiku-4-5`). |
| `DATA_DIR` | Where `app.db` + PDFs live (mount a persistent volume here). |
| `APP_PASSCODE` | Set to enable the private lock (passkey + passcode backup). Unset = app is open. |
| `OWNTRACKS_TOKEN` | Set to enable the automatic daily location route at `/api/owntracks`. |
| `LOCATION_TZ_OFFSET` | Minutes from UTC for displayed local times (default `540` = Seoul). |
| `DISCIPLINE_REPO` / `DISCIPLINE_GITHUB_TOKEN` / `DISCIPLINE_BRANCH` | Optional GitHub notes repo to fold in. |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | Optional anonymous analytics (no note content is ever sent). |

## Honest cost

There's no subscription — you pay Anthropic per token. The in-app **Cost** tab
records every call, with a month calendar and tap-into-a-day breakdown by
feature (transcription, chat, insights, memory).

Rough monthly figures for **heavy daily use** (a short diary notebook a day,
~15 chat messages a day):

- ~**$10–15/month** with chat on Haiku.
- ~**$15–25/month** with chat on Sonnet (a noticeably more thoughtful companion).

Levers: OCR scales with notebook length; chat scales with how much you use it;
Opus is the expensive engine, Haiku is the cheap one.

## Architecture

- `lib/db.ts` — SQLite + FTS5 + migrations.
- `lib/claude.ts` — OCR, chat, insights, evolving-memory calls; all record token usage + cost.
- `lib/notes.ts` — notebook ingestion, background OCR, FTS retrieval, weekly location distill, the GitHub "discipline" sync.
- `lib/profile.ts` — the versioned "profile of you".
- `lib/usage.ts` — per-call cost + monthly / daily aggregation.
- `lib/owntracks.ts` · `lib/timeline.ts` · `lib/location.ts` — three location sources.
- `lib/auth.ts` · `lib/webauthn.ts` — session cookie + passkey lock.
- `lib/github.ts` — fetch text files from the optional discipline repo.
- `app/api/*` — routes for each feature.
- `app/*` — the pages: Dashboard, Notebooks, Chat, Insights, Memory, Cost.

A two-page visual overview lives in
[`remarkabler-architecture.pdf`](./remarkabler-architecture.pdf).

## Deployment

Runs on **Railway**, which auto-deploys on push to `main`. The app needs a
persistent disk for SQLite and PDFs, so it can't run on a serverless platform
with an ephemeral filesystem.

- Attach a persistent volume; point `DATA_DIR` at its mount path (e.g. `/data`).
- `npm run start` respects the host-provided `PORT`.
- Automatic location and GitHub sync need outbound access to
  `nominatim.openstreetmap.org` and `api.github.com`.

## Design notes (don't regress these)

- **Chat reasons over the profile, not the whole corpus** — full-corpus chat made one message cost ~$0.11.
- **Transcription runs in the background** — upload returns immediately; OCR sets the notebook `status`. Never block upload on OCR.
- **OCR streams the response** and uses a `--- PAGE n ---` delimiter format (not JSON) so it survives truncation.
- **Behind Railway's proxy, `req.url` reports the internal `localhost:8080`** — never build redirects or absolute URLs from it; redirect client-side.
- **No automatic reMarkable cloud sync** — there's no reliable JavaScript renderer for the `.rm` format, so the app uses manual PDF export by design.

## Status

Built and used in production by one person (the author) — actively
maintained, but treat it as a **personal beta** if you're forking it. The
core flows (upload → OCR → memory → chat → insights) are stable.

## License

[MIT](./LICENSE). Use it, fork it, modify it, ship your own version.
