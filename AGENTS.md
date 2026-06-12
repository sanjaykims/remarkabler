# AGENTS.md — onboarding for any AI working on this repo

This is the tool-agnostic front door for **any** AI coding agent (a fresh
Claude Code session, Codex, Cursor, or anything else) about to work on this
project. Read this first, then the linked docs. The goal: get productive in
one pass without re-deriving what we already know.

> **Companion docs (read in this order if you're new):**
> 1. **`CLAUDE.md`** — project specifics + hard rules that override defaults.
> 2. **This file** — orientation, structure map, how to work, what you (the
>    agent) can and can't do in this environment.
> 3. **`docs/claude-harness.md`** (+ `.svg`/`.png`) — how the agent harness
>    itself is wired (tools, context, subagents, permissions, MCP).
> 4. **`docs/sessions/*.md`** — decision logs. Read the most recent before
>    touching embeddings, OCR model choice, cost, or backup.
> 5. **`CHANGELOG.md`** — what changed and why, newest first.

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
| `db.ts` | SQLite connection, schema, migrations. Tables: settings, notebooks, pages, pages_fts, chat_messages, insights, credentials, chat_attachments, api_usage, profile, locations, daily_summaries, geocode_cache. |
| `claude.ts` | All Anthropic calls: `ocrNotebookPdf`, `chatOverNotes`, `generateInsights`, `generateInsightTitle`, `composeBook`, `summarizeDay`, `buildSelfModel`/`updateSelfModel`. Model resolution (`modelMain`/`modelChat`/`modelChatFallback`/`modelOcr`) is in-app-setting → env var → default. |
| `chatTools.ts` | The tool-calling toolbox Claude uses during chat (`search_diary` hybrid FTS+semantic, `get_entries_by_date`, summaries, etc.). |
| `embeddings.ts` | Voyage AI embeddings: token-budget batching, 429 retry, `embedBatch`/`embedBatchOrThrow`, encode/decode BLOB helpers, cosine similarity. |
| `notes.ts` | `createNotebook`, `processNotebook` (background OCR), `runMaintenanceSweep` (throttled background chores), discipline sync, embedding/summary backfills. |
| `profile.ts` | The evolving "memory of you" (versioned `profile` table). |
| `usage.ts` | `recordUsage` (per-call cost from list prices) + aggregation for the Cost tab. |
| `extractText.ts` | Converts PDF/Word chat attachments to text (pdf-parse/mammoth) before sending to Claude — token savings. Handwritten PDFs fall back to raw. |
| `auth.ts` / `webauthn.ts` | Passcode + passkey (WebAuthn) lock; HMAC session cookie; 24h server-side inactivity timeout. |
| `backup.ts` | Weekly auto-backup of `/data` to a private GitHub repo, keep-last-12. |
| `owntracks.ts` / `location.ts` / `format.ts` | Location ingestion, clustering, KST timezone helpers. |
| `github.ts` | Discipline-repo fetching (GitHub Contents API). |
| `cleanup.ts` / `upload.ts` | Orphan-attachment sweep; upload validation/duck-typing. |

### `app/` — UI + API
- Pages: `/` (dashboard), `/notebooks`, `/chat`, `/insights`, `/memory`,
  `/usage` (cost).
- `app/api/*` — one route per feature. All data-reading routes set
  `runtime = "nodejs"` and `dynamic = "force-dynamic"`.
- `app/share/route.ts` — PWA Web Share Target. `public/manifest.json` — PWA.

---

## 3. How to work here

- **Build must pass:** `npm run build`. There are no automated tests; the
  build + a careful read is the safety net. Lint: `npm run lint`.
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
2. **Transcription runs in the background.** `createNotebook` returns
   immediately; `processNotebook` is fired un-awaited and sets notebook
   `status`. Never make upload/share wait on OCR.
3. **OCR streams the response** (`messages.stream()`) and uses a
   `--- PAGE n ---` delimiter format, not JSON.
4. **OCR stays on Opus for this user.** Validated against Sonnet on real
   Korean handwriting (see `docs/sessions/2026-06-04.md`): Sonnet makes
   consistent meaning-changing errors. Don't propose switching without
   re-reading that log.
5. **Behind Railway's proxy, `req.url` reports internal `localhost:8080`.**
   Never build redirects/absolute URLs from it; redirect client-side.
6. **Background chores run via one throttled `runMaintenanceSweep`** (5-min
   window, `last_maintenance_at` persisted so cold-starts don't refire).

---

## 6. Known intentional limits

- No automatic reMarkable cloud sync (no reliable JS renderer for the `.rm`
  format) — manual PDF export is deliberate.
- PWA share target + voice input work on Android Chrome only, not iOS Safari.
- reMarkable PDFs are image-based ink with **no text layer** — text
  extraction tools (MarkItDown, pdf-parse) return nothing for them; only
  vision OCR (Claude) reads them. This is why OCR can't be replaced by a
  cheap text extractor.
