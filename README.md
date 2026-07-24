# Remarkabler

> **Your private AI companion that grows with you.** Write by hand on your
> reMarkable; chat with something that actually remembers your life — and
> watch your diary quietly become a connected "second brain."

A self-hosted Next.js app that transcribes your handwritten notebooks with
Claude vision, builds an **evolving "profile of you"** from your diary, and
lets you chat with something that reasons over its accumulated understanding
of who you are — not just keyword-matches your notes. It also links the people,
places, and projects you write about into an **Obsidian-native knowledge
vault**, and can be reached from your **Claude subscription** (the claude.ai
app or Claude Code) so you can talk to your diary without per-token API billing.

Everything lives in your own database. The only data that leaves is what you
send to Claude to answer you (plus, if you turn them on, an optional Dropbox
vault export and reverse-geocoding for location names).

> **Looking for the end-user manual (non-technical)?** See
> [`USER_GUIDE.md`](./USER_GUIDE.md). For the subscription-Claude / Obsidian
> connector setup, see [`docs/mcp-setup.md`](./docs/mcp-setup.md). For a visual
> overview, see [`remarkabler-architecture.pdf`](./remarkabler-architecture.pdf).

## How it works

```
notes in ─┬─ manual PDF upload
          ├─ Dropbox auto-ingest (Share → Export to Dropbox from reMarkable)
          └─ reMarkable cloud sync (zero-tap, secondary source)
                     ↓
          Claude OCR (background) → per-page text
                     ↓
   ┌─────────────────┼──────────────────────────────┐
   ↓                 ↓                               ↓
"profile of you"   named-entity graph          /mind analytics
(evolving memory)  (people/places/projects)    (themes, mood, map)
                     ↓
          Obsidian/Dropbox vault export (day files, entity wiki,
          Home dashboard, reflections, decisions)

chat ─┬─ in-app Chat tab (reasons over the profile + retrieved excerpts)
      └─ your Claude subscription (claude.ai app / Claude Code) via the MCP connector
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

> **Build note:** the app builds from a `Dockerfile` on Railway (not Nixpacks),
> because the reMarkable-cloud feature bundles a small Python `.rm` renderer
> (`rmc` + `cairosvg`) alongside Node. A plain `npm run build` still works for
> local development; the Docker image is only needed for the cloud-sync path.

### Local
```bash
cp .env.local.example .env.local   # paste your ANTHROPIC_API_KEY
npm install
npm run dev
```
Open <http://localhost:3001>.

## Getting your notes in — three ways

1. **Manual upload** (always works). Export a notebook as PDF on the reMarkable,
   get it to your phone, and upload it on the **Notebooks** tab (or use the
   Android share sheet straight from the reMarkable app).
2. **Dropbox auto-ingest** (one-tap, the reliable automatic path). With
   reMarkable Connect, tap **Share → Export to integration → Dropbox** on the
   tablet; Remarkabler polls that folder and ingests new PDFs on its own.
3. **reMarkable cloud sync** (zero-tap, *secondary* source). Pair the tablet
   once from the **Memory** tab and enable Auto-sync for chosen folders;
   Remarkabler downloads and renders new/changed pages in the background —
   "write, close the cover, done." It rides reMarkable's *unofficial* protocol,
   so the Dropbox path stays the dependable fallback.

## The Obsidian "second brain" vault (optional)

Turn on the Dropbox export (needs the `files.content.write` scope) and
Remarkabler continuously writes your diary out as an **Obsidian-native vault**:

- **One Markdown file per day**, with `[[wikilinks]]` to the people, places,
  and projects each entry mentions.
- **Entity pages** (`People/`, `Places/`, `Projects/`) — one per person/place/
  project, with a Claude-written "life wiki" bio, typed relationships such as
  `works_at`/`lives_in`, and backlinks to every day and note that mentions them.
- **A `Home.md` dashboard**, `People.md`/`Places.md`/`Projects.md` index pages,
  and a `Profile.md` — the knowledge-architecture layer (inspired by
  obsidian-mind), generated deterministically so Remarkabler stays the sole
  writer of the vault.
- **Conversation archives, Reflections, and Decisions** (saved via the connector
  below) filed into their own vault folders and linked into the same graph.

## Chat with your diary from your Claude subscription (optional)

Set `MCP_AUTH_TOKEN` and Remarkabler exposes a **read-only MCP endpoint** at
`/api/mcp`. Add it to the **claude.ai app** as a custom connector (OAuth) or to
**Claude Code**, and you can talk to your diary on your existing Claude
subscription instead of per-token API billing. It's read-only and fail-closed
by default; opt-in write tools (`export_conversation`, `save_reflection`,
`save_decision`, `save_diary_entry`, plus a "librarian" that links exported
content and typed relationships into your entity graph) are behind explicit
flags. Full setup and the security model:
[`docs/mcp-setup.md`](./docs/mcp-setup.md).

## Configuration

Only `ANTHROPIC_API_KEY` is required. Every optional feature stays **off until
its variable is set** — so you flip each one on by adding a single variable.

### Core

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | **Required.** Claude API key. |
| `CLAUDE_MODEL` | Model for OCR / insights / evolving memory (e.g. `claude-opus-4-7`). |
| `CHAT_MODEL` | Model for everyday chat (e.g. `claude-sonnet-5`). |
| `CHAT_FALLBACK_MODEL` | Used if the chat model is briefly overloaded (e.g. `claude-sonnet-4-6`). |
| `CHAT_MEMORY_MODEL` | Optional. Model that extracts durable memories from cleared chats (defaults to `CHAT_MODEL`). |
| `DATA_DIR` | Where `app.db` + PDFs live (mount a persistent volume here). |
| `APP_PASSCODE` | Set to enable the private lock (passkey + passcode backup). Unset = app is open (a red in-app banner + a boot log warn until it's set). |
| `VOYAGE_API_KEY` | Optional. Enables Voyage embeddings for semantic diary search + the `/mind` 3D map. |

### Sources & sync

| Variable | Purpose |
|---|---|
| `DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET` | Enable Dropbox auto-ingest (read-only) — and, with the write scope, the Obsidian vault export. |
| `APP_BASE_URL` | The canonical https URL of the deployment (required in production when Dropbox or MCP OAuth is on). |
| `DROPBOX_INGEST_PATH` | Folder the watcher polls (default `/Diary`). |
| `OCR_CONCURRENCY_LIMIT` | Caps the shared OCR budget across uploads + ingest (default 2, max 5). |
| `OWNTRACKS_TOKEN` | Set to enable the automatic daily location route at `/api/owntracks`. |
| `LOCATION_TZ_OFFSET` | Minutes from UTC for displayed local times (default `540` = Seoul). |
| `DISCIPLINE_REPO` / `DISCIPLINE_GITHUB_TOKEN` / `DISCIPLINE_BRANCH` | Optional GitHub notes repo to fold in. |

### Subscription-Claude / Obsidian connector (MCP)

All OFF by default and fail-closed. See [`docs/mcp-setup.md`](./docs/mcp-setup.md)
for the full walkthrough and security model.

| Variable | Purpose |
|---|---|
| `MCP_AUTH_TOKEN` | 16+ char secret. Enables the read-only MCP endpoint (`/api/mcp`). Comma-separated for zero-downtime rotation. |
| `MCP_ALLOW_CONVERSATION_EXPORT` | Enable the `export_conversation` write tool (files a full chat into the vault). |
| `MCP_ALLOW_REFLECTION_SAVE` | Enable the `save_reflection` write tool (a standalone reflection Claude wrote about you). |
| `MCP_ALLOW_DECISION_SAVE` | Enable the `save_decision` write tool (a structured Decision Record). |
| `MCP_ALLOW_DIARY_WRITE` | Enable the `save_diary_entry` write tool — compose a **real diary entry** by talking to Claude (feeds your profile + analytics, unlike the vault-only tools above). |
| `MCP_ALLOW_WIKI_LINKING` | Enable linking exported content into your entity graph (the librarian reads/writes: tags, notes, and typed relationships). |
| `MCP_AUTO_TAG_EXPORTS` | Layered on top of the above — the app auto-tags entities itself right after conversation/reflection/decision saves (guaranteed, not opportunistic). |
| `MCP_ALLOW_SENSITIVE_TOOLS` | Opt in to exposing location + chat-history tools over MCP (excluded by default for physical-safety reasons). |
| `MCP_EXCLUDE_TOOLS` | Comma-separated tool names to drop from the MCP surface. |

### Analytics

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | Optional anonymous analytics (autocapture + session recording disabled; no note content is ever sent). |

## Honest cost

There's no subscription for the app itself — you pay Anthropic per token. The
in-app **Cost** tab records every call, with a month calendar and
tap-into-a-day breakdown by feature (transcription, chat, insights, memory).

Rough monthly figures for **heavy daily use** (a short diary notebook a day,
~15 chat messages a day):

- ~**$10–15/month** with chat on Haiku.
- ~**$15–25/month** with chat on Sonnet (a noticeably more thoughtful companion).

Levers: OCR scales with notebook length; chat scales with how much you use it;
Opus is the expensive engine, Haiku is the cheap one. Reaching your diary from
your **Claude subscription** via the MCP connector shifts that chat cost onto
your existing plan instead of per-token billing.

## Architecture

- `lib/db.ts` — SQLite + FTS5 + migrations (diary, entities, chat memory, MCP/OAuth, exports).
- `lib/claude.ts` — OCR, chat, insights, evolving-memory, entity-analysis, entity-tagging calls; all record token usage + cost.
- `lib/notes.ts` — notebook ingestion, background OCR, the maintenance sweep, the GitHub "discipline" sync, the synthetic-notebook ids.
- `lib/profile.ts` — the versioned "profile of you".
- `lib/embeddings.ts` — Voyage embeddings for semantic search + the `/mind` map.
- `lib/chatTools.ts` · `lib/chatMemory.ts` — the tools chat calls on demand + the durable chat-memory layer.
- `lib/entityWiki.ts` · `lib/entityGraph.ts` · `lib/entityMerge.ts` — the "life wiki" bios, the co-occurrence graph, and entity de-duplication.
- `lib/diaryExport.ts` · `lib/diaryExportDb.ts` — the Obsidian vault renderer (day files, entity stubs, Home/index/Profile notes).
- `lib/dropbox.ts` — Dropbox auto-ingest + the vault export.
- `lib/remarkableCloud.ts` · `lib/remarkableSync.ts` · `lib/rmRender.ts` — the reMarkable-cloud secondary source (pair, download, render, zero-tap sync).
- `lib/mcp.ts` · `lib/mcpOauth.ts` — the read-only MCP endpoint + its OAuth 2.1 server for the claude.ai connector.
- `lib/conversationWiki.ts` · `lib/reflectionWiki.ts` · `lib/decisionWiki.ts` (+ their `*Entities.ts`) — exported conversations, reflections, and decisions, filed into the vault and linked into the graph.
- `lib/owntracks.ts` · `lib/location.ts` — automatic OwnTracks route + the one-tap "Log my location" path.
- `lib/auth.ts` · `lib/webauthn.ts` — session cookie + passkey lock.
- `app/api/*` — routes for each feature (including `/api/mcp` + `/api/mcp/oauth/*`).
- `app/*` — the pages: Dashboard, Notebooks, Chat, Insights, **Mind**, Memory, Cost.

A two-page visual overview lives in
[`remarkabler-architecture.pdf`](./remarkabler-architecture.pdf); the
deep-dive contributor notes live in [`CLAUDE.md`](./CLAUDE.md) and
[`AGENTS.md`](./AGENTS.md).

## Deployment

Runs on **Railway**, which auto-deploys on push to `main`. The app needs a
persistent disk for SQLite and PDFs, so it can't run on a serverless platform
with an ephemeral filesystem.

- Attach a persistent volume; point `DATA_DIR` at its mount path (e.g. `/data`).
- Built from a `Dockerfile` (bundles Node + the Python `.rm` renderer).
- `npm run start` respects the host-provided `PORT`.
- Optional integrations need outbound access to their hosts:
  `api.dropboxapi.com` / `content.dropboxapi.com` (Dropbox),
  `nominatim.openstreetmap.org` (location names), `api.github.com` (discipline
  sync), and the reMarkable cloud + Voyage APIs where enabled.

## Design notes (don't regress these)

- **Chat reasons over the profile, not the whole corpus** — full-corpus chat made one message cost ~$0.11.
- **Transcription runs in the background** — upload returns immediately; OCR sets the notebook `status`. Never block upload on OCR.
- **OCR streams the response** and uses a `--- PAGE n ---` delimiter format (not JSON) so it survives truncation.
- **Behind Railway's proxy, `req.url` reports the internal `localhost:8080`** — never build redirects or absolute URLs from it; redirect client-side.
- **The MCP endpoint is read-only and fail-closed by default** — no token = disabled; every write tool is a separate opt-in flag; sensitive (location / chat-history) tools stay hidden unless explicitly allowed.
- **Remarkabler is the sole writer of the exported vault** — the Obsidian files are generated deterministically from the database, so an external agent never fights it for the same files.
- **reMarkable cloud sync is a *secondary* source on an unofficial protocol** — the Dropbox one-tap path stays the reliable fallback and is never removed.

## Status

Built and used in production by one person (the author) — actively
maintained, but treat it as a **personal beta** if you're forking it. The
core flows (get notes in → OCR → memory → chat → insights → vault) are stable.

## License

[MIT](./LICENSE). Use it, fork it, modify it, ship your own version.
