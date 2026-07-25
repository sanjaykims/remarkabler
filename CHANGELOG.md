# Changelog

## 2026-07-25 (Dropbox coalesced diary export follow-up)

Fixed a Dropbox vault export race between the MCP librarian write tools. When a
diary/stub export request arrives while any Dropbox writer holds the shared
export lock, `lib/dropbox.ts` now records a pending diary export and guarantees
one unscoped follow-up run after the active writer exits. This makes exported
Obsidian entity stubs converge from fresh DB state instead of relying on a
bounded retry budget that normal vault sizes can exceed.

## 2026-07-25 (Diary Graph mobile framing)

Fixed the `/graph` mobile map framing so the SVG viewBox fits the visible node
bounds with padding instead of using the fixed desktop coordinate system. This
keeps dense graphs from being clipped off the right edge on phones. The graph
timestamp also now renders in a deterministic KST format to avoid hydration
mismatch warnings.

## 2026-07-25 (Diary Graph: native relationship map)

Added a first-class in-app graph for the diary's own entity system.

- **New graph data layer.** `lib/diaryGraph.ts` assembles a compact graph from
  canonical people/places/projects, real diary days, exported
  conversations/reflections/decisions, co-occurrence links, and typed
  relationship assertions with source evidence. Discipline content stays
  excluded; chat-diary entries stay included as real diary.
- **New locked graph API and UI.** `/api/graph` returns the graph payload behind
  the app lock, and `/graph` renders an interactive SVG workspace with search,
  node/edge filters, relationship labels, highlighting, and an evidence
  inspector.
- **Navigation and tests.** Added the Graph tab and `test/diaryGraph.test.ts`
  covering diary-day links, synthetic conversation evidence, relationship-only
  endpoints, and discipline exclusion.

## 2026-07-25 (Graphify Phase A: code-only repository graph)

Finalized Phase A as a committed, inspectable Graphify developer artifact.

- **Generated a code-only Graphify snapshot.** `graphify-out/graph.json`,
  `graphify-out/graph.html`, and `graphify-out/GRAPH_REPORT.md` were generated
  with `graphify 0.9.25`, `--code-only`, and `--no-label`, so no docs/PDFs/images
  were sent to an LLM and community labels remain deterministic placeholders.
- **Added extraction hygiene.** `.graphifyignore` excludes generated folders,
  local data, env files, binary/reference artifacts, and build output from the
  crawl. `.gitignore` excludes Graphify cache/root/manifest internals that carry
  local paths, mtimes, or cache state.
- **Documented the repeatable workflow.** `docs/graphify-phase-a.md` records the
  exact commands, snapshot stats, committed files, and intentionally ignored
  files.

## 2026-07-25 (MCP Phase B/C completion: relationship lifecycle, re-linking, setup docs)

Finished the remaining Phase B/C sharp edges around exported conversations and
the external librarian surface.

- **Re-exported conversations re-enter the linking queue.** `saveExportedConversation`
  now clears both `filed_at` and `linked_at` on update, matching reflections
  and decisions. A growing conversation saved again under the same id is still
  one row/note, but the librarian/auto-tag path can refresh entities against
  the new content instead of silently treating the old link pass as current.
- **Typed relationship handling hardened.** Predicate validation now uses an
  own-key check, and the `relate_entities` Dropbox refresh path rewrites
  touched stubs that still exist while deleting touched relationship-only stubs
  that disappeared after a scoped retraction.
- **Setup guidance caught up to the code.** `README.md`, `docs/mcp-setup.md`,
  and the `/memory` librarian copy now mention `save_diary_entry`,
  decision auto-tagging, `relate_entities`, supported typed relationships, and
  the accurate Obsidian promise: connected nodes, labels in note bodies.
- **Entity index wording now covers every exported note type.** Entities with
  zero diary-day mentions now render as "from exported notes" instead of
  implying they only came from conversations.

## 2026-07-24 (MCP OAuth: fail closed for unbound legacy tokens)

The secret-binding migration originally tried to preserve pre-migration OAuth
sessions by assigning NULL `secret_hash` rows to whichever `MCP_AUTH_TOKEN`
was currently configured. That could incorrectly associate a compromised,
pre-rotation refresh token with the *new* secret and let it survive the very
rotation intended to revoke it. NULL-secret access and refresh tokens now fail
closed and require the connector to re-authorize; newly issued tokens remain
bound to their exact authorizing secret, preserving normal overlap rotation.
Tests cover rejection for both legacy access and refresh tokens.

## 2026-07-22 (Security hardening: loud lock-off warning, HSTS/isolation headers, guard regression test)

A review of the content-security surfaces found the app well-hardened where it
was recently built (complete per-route app-lock coverage, fail-closed MCP, no
`dangerouslySetInnerHTML` / stored-XSS surface, passcode brute-force lockout),
with a few concrete, low-risk gaps. This closes the safe ones now; a Next 16
upgrade (the only fix for the flagged npm-audit CVEs, none of which apply to
this App-Router/no-i18n/no-middleware app) and at-rest encryption are
deliberately left as separate, larger efforts.

- **The unlocked state is no longer silent.** `APP_PASSCODE` is optional, and
  with it unset the whole app + every API is open to anyone with the URL — the
  single biggest risk. Now: a loud server **boot warning** (`instrumentation.ts`)
  and a dismissible **in-app banner** (`app/LockOffBanner.tsx`, shown by
  `app/layout.tsx` only when the lock is off) nag the owner to set it. The
  banner uses the red/danger tone, not amber (amber stays the one primary CTA).
- **New response headers** (`next.config.mjs`): `Strict-Transport-Security`
  (2-year HSTS + preload), `Cross-Origin-Opener-Policy: same-origin`,
  `Cross-Origin-Resource-Policy: same-origin`. All assets are same-origin, so
  nothing legitimate is blocked.
- **Auth-guard regression test** (`test/authGuard.test.ts`): asserts every
  `app/api/**/route.ts` references the lock guard unless it's on an explicit
  PUBLIC allowlist (login, MCP bearer endpoint, OAuth handshake). Plus a shared
  `requireAuth()` helper in `lib/auth.ts` for new routes. Coverage was already
  complete; this stops a future route from silently shipping unguarded.
- Verified: lint clean, 612 tests pass, `npm run build` green. (Full runtime
  confirmation of the headers/banner needs the deployed Railway instance.)
- Follow-up (separate PR): a `Content-Security-Policy-Report-Only` pass + a
  `/api/csp-report` sink, as the safe first step toward an enforced CSP.

## 2026-07-21 (Index docs refresh: SKILL.md + AGENTS.md caught up to the current codebase)

The two index/onboarding docs had fallen behind everything shipped over the
past several sessions (reflections, decisions, chat-diary, the entity
life-wiki, guaranteed auto-tagging, the second-brain vault structure, the MCP
write tools + OAuth server, and their tables/routes/env vars). Refreshed both
so a fresh agent gets an accurate map in one pass — no code change.

- **`SKILL.md`**: Modules table now lists `entityGraph`/`entityMerge`/
  `entityWiki`/`mcp`/`mcpOauth`/`conversation*`/`reflection*`/`decision*`/
  `chatDiary`/`entityTagging`/`notebookDedup`/`remarkable*` and the
  Obsidian-native vault-structure additions to `diaryExport*`. Database-tables
  section adds `entity_aliases`/`entity_wiki`/`entity_conversation_notes`/
  `mcp_conversations`/`mcp_reflections`/`mcp_decisions`/`mcp_audit`/
  `mcp_oauth_*`/`*_ingest_tombstones`. MCP route now documents all four
  independent write flags + the librarian flag + `MCP_AUTO_TAG_EXPORTS`; the
  sweep list, `/mind` + `/memory` page notes, env-var block, and rules list
  all catch up.
- **`AGENTS.md`**: the `db.ts` tables line, the `lib/` module table (new
  reflection/decision/chatDiary/entityTagging/entityWiki/entityGraph/
  entityMerge/diaryExport rows), the `mcp.ts` row, the API-route groups
  (mcp/oauth, remarkable, mind/merge-entities + build-wiki, export/diary), and
  two new load-bearing rules (MCP read-only-by-default; synthetic-notebook
  exclusion + sole-vault-writer) all updated.

Standing note for future sessions: keep `SKILL.md` and `AGENTS.md` current with
every notable change, same as `CLAUDE.md`/`CHANGELOG.md`.

## 2026-07-21 (MCP tool descriptions: stop confusing "archive this chat" with "save to my diary")

A live voice test surfaced a real tool-selection bug: asked to put a chat "in
my diary," Claude reached for `export_conversation` (which only archives the
transcript to the vault, excluded from the diary) instead of `save_diary_entry`
(the real diary write). The cause was wording — `export_conversation`'s
description and success note both said they saved to the "diary wiki," which
read like *that* was the diary.

- `export_conversation`'s description now says plainly it's a conversation
  ARCHIVE that does NOT become a diary entry, and points to `save_diary_entry`
  for "put this in my diary" intent.
- `save_diary_entry`'s description now claims the "in my diary / today's entry"
  intent explicitly and warns off `export_conversation`.
- The success notes for conversation/reflection/decision writes stop saying
  "diary wiki" (they save to the *vault*, not the diary); the conversation note
  actively tells Claude to use `save_diary_entry` if the diary was intended.
- New regression test pinning the cross-referencing wording. No behavior change
  beyond tool-selection guidance; build + lint clean.

## 2026-07-20 (Write your diary by conversation: the save_diary_entry MCP tool)

You can now **write a real diary entry by talking to subscription-Claude**
instead of handwriting it. A new opt-in MCP tool, `save_diary_entry`, lets any
connected Claude draft an entry in your first-person voice, show it to you for
approval, and — once you okay it — save it as a genuine diary entry.

- **It fully counts as diary.** Unlike `export_conversation` /
  `save_reflection` / `save_decision` (which file into vault folders *excluded*
  from analytics), a chat-diary entry lands in a **real, non-excluded "Chat
  diary" notebook** (`CHAT_DIARY_NOTEBOOK_ID`) and runs the same post-ingest
  pipeline a handwritten page does — embeddings, profile fold, `/mind`
  analysis, day-file export. So it feeds your profile, mood/theme charts,
  writing heatmap, day files, and entity graph.
- **New module** `lib/chatDiary.ts`: `saveChatDiaryEntry` (synchronous insert —
  ensure notebook, page + FTS + entry_date, append or upsert-by-`entry_id`) +
  `processChatDiaryEntry` (async post-ingest, fired un-awaited, mirroring
  `processNotebook`).
- **New MCP tool** (`lib/mcp.ts`): gated behind its own flag
  `MCP_ALLOW_DIARY_WRITE=true`, independent of the other write flags. Its
  description carries the discipline: write in the person's own voice, show the
  draft, get approval before saving. Deterministic-destination and size-capped;
  optional `date` (defaults to today) and `entry_id` (edit an entry vs. add).
- **Kept as its own notebook** so handwritten vs talked entries stay
  distinguishable (labeled per-entry in the day files) — but both count. Because
  every analytics surface is exclusion-based (discipline + the three synthetic
  notebooks), a new real notebook is auto-included everywhere with no other
  changes.
- New `test/chatDiary.test.ts` (6) + `save_diary_entry` tests in
  `test/mcp.test.ts` (4); 608 pass, lint + build clean.

## 2026-07-20 (Decision Records: the save_decision MCP write tool)

Phase 2 of "combine the two frameworks" — brings obsidian-mind's **Decision
Record** note type into Remarkabler. A new opt-in MCP write tool,
`save_decision`, lets any connected Claude record a decision ("we decided X
because Y") as a structured, durable, entity-linked note.

- **New table + modules**: `mcp_decisions` + `lib/decisionWiki.ts` +
  `lib/decisionEntities.ts`, a 1:1 mirror of the reflection modules — its own
  `Decisions/` vault folder, never mixed with reflections or conversations.
- **New MCP tool** (`lib/mcp.ts`): gated behind its own flag
  `MCP_ALLOW_DECISION_SAVE=true`, independent of the reflection/conversation
  flags. Add-only, deterministic destination, size-capped. Files to Dropbox
  within seconds (`maybeExportDecisionsToDropbox`) and is auto entity-linked
  (`lib/entityTagging.ts:autoTagDecision`) — a decision about a project/person
  shows up connected to it in the graph, with a `## Connects to` section on
  the note and a backlink from the entity's stub.
- **Fourth synthetic notebook**: `DECISIONS_NOTEBOOK_ID` joins conversations
  + reflections. The shared exclude helpers became 4-tuples and every
  `NOT IN (?, …)` exclusion site widened accordingly (the documented
  dual inclusion/exclusion discipline).
- **Home + stubs**: `Home.md` gains a Decisions count + "Recent decisions"
  section; the entity-stub back-link section was renamed `## Related notes`
  (it now covers conversations, reflections, AND decisions).
- New `test/decisionWiki.test.ts` (10) + `test/decisionEntities.test.ts` (4),
  plus extensions to `test/mcp.test.ts`, `test/diaryExportDb.test.ts`,
  `test/vaultStructure.test.ts`, `test/mind.test.ts`; build + lint clean.

## 2026-07-20 (Second-brain vault structure: Home dashboard + entity indexes + Profile note)

Brings [obsidian-mind](docs/reference/obsidian-mind)'s knowledge-architecture
layer into the vault Remarkabler already generates — **without** adopting its
desktop/manual-operator model, and keeping OCR ingestion as the foundation.
Remarkabler stays the sole deterministic writer of the vault; it just writes a
richer, more navigable one. (Phase 1 of "combine the two frameworks".)

- **New vault-root notes**, generated on every sync (`lib/diaryExport.ts` pure
  builders + `lib/diaryExportDb.ts:renderVaultStructureFiles`):
  - `Home.md` — a dashboard front page: live counts (diary days, People/
    Places/Projects, reflections, conversations), quick links to the index
    notes + Profile, and the most recent days/reflections/conversations.
  - `People.md` / `Places.md` / `Projects.md` — index MOCs listing every
    entity as a `[[wikilink]]` to its stub, sorted by mention count then name,
    with day-counts drawn from the SAME `collectEntityStubs()` the stub notes
    use (so the index and the stub can never disagree). Conversation/
    reflection-only entities are included and labeled distinctly.
  - `Profile.md` — Remarkabler's living "profile of you" (goals, patterns,
    open threads) rendered as a note; the direct analog of obsidian-mind's
    North Star. Omitted until a profile exists.
- **Wired into the existing exporter** (`lib/dropbox.ts`): merged into
  `maybeExportDiaryToDropbox`'s file map and added to `vaultStructureFileNames()`
  so they refresh on every sync path (full, per-ingest, and post-tag/wiki
  re-export) except the write-access probe. No new upload machinery.
- **Refactor**: extracted `collectEntityStubs()` from `renderEntityStubFiles`
  as the shared entity-computation source of truth for both the stubs and the
  new indexes.
- New `test/vaultStructure.test.ts` (7 pure-builder tests) + 5 DB-backed tests
  in `test/diaryExportDb.test.ts`; 578 pass, lint + build clean.
- New "do not regress" rule in `CLAUDE.md`: Remarkabler is the sole
  deterministic writer of the exported vault — this is why the vendored
  agent frameworks stay reference-only.

## 2026-07-19 (Guaranteed entity-tagging + bidirectional Obsidian links for conversations & reflections)

Until now, linking an exported conversation into the diary's entity graph
was **entirely opportunistic**: it only happened if the external Claude
session that exported it also chose to call the Phase C librarian tools —
nothing in the app itself ever tagged anything. Reflections had zero linking
at all. This closes both gaps and adds a new bidirectional-linking feature.

- **Guaranteed, app-initiated tagging** (`lib/entityTagging.ts`, new): right
  after `export_conversation`/`save_reflection` saves, the app itself calls
  Claude (its own `ANTHROPIC_API_KEY`, not the external agent's subscription)
  to extract entities and tag them — immediate and reliable, mirroring how
  diary pages already get tagged on upload. Gated behind
  `MCP_AUTO_TAG_EXPORTS=true`, layered on top of the existing
  `MCP_ALLOW_WIKI_LINKING` (not a peer flag — a user with wiki-linking off
  gets a safe no-op even if auto-tag is mistakenly set). In-flight guarded
  per key, backstopped by a maintenance-sweep retry for anything the inline
  fire missed. A new `extractTaggingEntities` (`lib/claude.ts`) is a
  lightweight, entities-only extraction on the cheap chat model — bounded
  via a new `sampleForTagging` (evenly-sampled chunks, not a flat
  truncation, so a long conversation's middle/end entities aren't lost).
- **Reflections now get linked, symmetrically with conversations**: a new
  `REFLECTIONS_NOTEBOOK_ID` synthetic notebook + `lib/reflectionEntities.ts`
  (`ensureReflectionPage`/`tagReflectionEntities`) mirror the existing
  conversation-side Phase C machinery. Every notebook-exclusion call site
  that already special-cased `CONVERSATIONS_NOTEBOOK_ID` (the `/mind`
  pending-query, heatmap, axis labels, entity-wiki bio composition, day-file
  export, chat-tool date surfaces) now excludes both; every inclusion
  surface (entity rankings, dedup, canonical-name resolution, entity stubs)
  already worked automatically since those filter on the discipline
  notebook alone.
- **Reinforced external-agent nudge, extended to reflections**:
  `save_reflection`'s tool description now nudges any connected Claude
  toward `get_entity_wiki`/`update_entity_conversation_notes` for
  enrichment — framed as optional judgment on top of guaranteed base
  tagging, not a mandatory follow-up call. Both tools are already fully
  generic (kind+name only), so no reflection-specific write tool was needed.
- **Killer feature — bidirectional Obsidian wikilinks**: once tagged, a
  conversation/reflection note gets a `## Connects to` section linking to
  every entity it mentions; the reverse direction — each entity's stub page
  now gets a `## Conversations & reflections` section linking back to every
  tagged note. Real, clickable graph edges in Obsidian, not just an internal
  ranking. Fixed a pre-existing gap along the way: nothing previously
  re-exported an entity's stub after a librarian tag, so a freshly-tagged
  entity sat stale in Dropbox until an unrelated full sync — now both the
  auto-tag path and the external `tag_conversation_entities` MCP call fire
  a scoped re-export immediately.
- 46 new/extended tests across `test/entityTagging.test.ts`,
  `test/reflectionEntities.test.ts`, `test/entityWikiExclude.test.ts` (new —
  closes a pre-existing gap: the diary-bio notebook exclusion had no test
  coverage before, for either synthetic notebook), plus extensions to
  `test/conversationWiki.test.ts`, `test/reflectionWiki.test.ts`,
  `test/mcp.test.ts`, `test/diaryExportDb.test.ts`, `test/mind.test.ts`;
  566 pass, build clean.

## 2026-07-19 (MCP: save_reflection — a standalone reflection tool, shared across every Claude surface)

New opt-in MCP write tool, `save_reflection`, for "give me an honest,
independent take on who I am" style asks — distinct from `export_conversation`
(which saves a verbatim human<->Claude transcript): this saves a standalone,
one-sided reflection Claude wrote about the user, filed into its own
`Reflections/` vault folder so it's never confused with a real conversation.

- **New table + module**: `mcp_reflections` + `lib/reflectionWiki.ts`,
  mirroring `lib/conversationWiki.ts`'s shape (store, pure note renderer,
  filing helpers) but deliberately kept separate — different content type,
  different folder.
- **New MCP tool** (`lib/mcp.ts`): gated behind its own flag,
  `MCP_ALLOW_REFLECTION_SAVE=true`, independent of
  `MCP_ALLOW_CONVERSATION_EXPORT` — a user can enable one without the other.
  Add-only, deterministic destination, size-capped, same discipline as every
  other MCP write tool. The tool's own description holds the quality bar
  observed to matter in practice: ground every claim in specific diary
  evidence, no empty flattery, name the limits of diary-based inference.
- **Filed automatically**: `maybeExportReflectionsToDropbox` (`lib/dropbox.ts`)
  fires inline on save (same fire-and-forget-with-`.catch()` pattern as
  conversations) plus a maintenance-sweep safety net for anything missed.
- **Available on every surface for free**: because this is a normal MCP tool
  (not Routine-specific logic), subscription-Claude in the claude.ai app,
  Claude Code, and any scheduled Routine using the same Remarkabler MCP
  connector can all call it identically — no separate integration needed
  per surface.
- 5 new MCP-gating tests + 7 new `lib/reflectionWiki.ts` pure-logic tests;
  520 pass, build clean.

## 2026-07-19 (Zero-tap sync actually runs zero-tap: a real background timer)

Every existing call site of `runMaintenanceSweep()` (`lib/notes.ts`) —
which fires reMarkable-cloud polling, Dropbox ingest, and everything else
in the background cascade — lived inside an HTTP request handler. Nothing
in the app ran on a real wall-clock timer, so "zero-tap" sync only ever
actually happened as a side effect of someone opening the app: writing on
the reMarkable and closing the cover did nothing until the next page load.

`instrumentation.ts` (the one place that runs once at server boot,
independent of any request) now also calls a new
`startBackgroundMaintenanceScheduler` (`lib/notes.ts`) — fires the sweep
once immediately, then on a real `setInterval` at the same
`MAINTENANCE_INTERVAL_MS` cadence the sweep already self-throttles to
internally. No changes needed to the sweep's own guard logic (in-flight
flag, interval/backoff, idempotent by design) — it was already safe to
call this often, nothing was actually driving it. Deploy-note: this only
delivers "no need to open the app" if the Railway service stays running
continuously rather than sleeping/scaling to zero when idle.

## 2026-07-19 (Whole-app code review fixes: OAuth cap, dedup SQL, Button consolidation, /mind stuck-page bug)

A whole-app review (Standards axis: Fowler smells + this repo's documented
conventions; Spec axis: audit against every "Hard-won rule" in `CLAUDE.md`)
surfaced several findings, all fixed:

- Five `maybeExportDiaryToDropbox()` fire-and-forget calls had no `.catch()`
  on the returned promise — one was the exact `try { void asyncFn() }
  catch {}` anti-pattern the hard-won rules name by name. Fixed all five.
- `checkOwntracksToken`/`checkPasscode` compared raw buffer lengths before
  the timing-safe compare (a length-leak). Switched both to hash-first
  (SHA-256) compares, matching `lib/mcp.ts`'s existing pattern.
- `createRollingBatch` and `createBatchForChunk` duplicated the same
  batch-insert/stamp/stats SQL; `createRollingBatch` now calls the shared
  helper instead.
- `/api/mcp/oauth/register` had no rate limit and `mcp_oauth_clients` had no
  row cap. Added a per-bucket rate limit (won't share budget with real auth
  failures) and eviction that only ever removes client rows with zero
  issued tokens — a live connector's refresh token can never be evicted.
- `Button` (`primary`/`secondary`/`ghost`) was used on Home only; six other
  pages hand-rolled ~60 button instances. Added `solid`/`danger` variants +
  an `xs` size and consolidated ~34 of them, leaving icon-only buttons,
  toggle/pill controls, and genuinely bespoke bare-text links out of scope.
- Fixed a real live bug: `/mind`'s "Analyse next N" could get permanently
  stuck on a whitespace-only OCR'd page — the pending-query filter and the
  analyzer's own blank-check disagreed (SQLite's `TRIM()` only strips plain
  spaces by default, not tabs/newlines, unlike JS's `.trim()`), so such a
  page failed deterministically forever. Fixed the SQL filter to agree with
  the analyzer.

479 tests pass (2 new), build clean.

## 2026-07-19 (Vendor Matt Pocock's engineering skills)

Brought in [`sanjaykims/skills`](https://github.com/sanjaykims/skills) (a
fork of [`mattpocock/skills`](https://github.com/mattpocock/skills), MIT) —
22 engineering + productivity Claude Code skills for alignment-first,
disciplined development (grill-with-docs, tdd, diagnosing-bugs, implement,
domain-modeling, triage, research, resolving-merge-conflicts, handoff, and
more), following the same live-vendoring pattern already used for
`kepano/obsidian-skills`.

- Installed all 22 skills under `.claude/skills/`, renaming the upstream
  `code-review` skill to `deep-code-review` (and its cross-references) to
  avoid colliding with this session's built-in `code-review` skill.
- Ran the one-time `setup-matt-pocock-skills` configuration: GitHub Issues
  as the issue tracker (`docs/agents/issue-tracker.md`, with a note that
  environments lacking the `gh` CLI should use the GitHub MCP tools
  instead), default triage labels (`docs/agents/triage-labels.md`), and a
  single-context domain-docs layout (`docs/agents/domain.md` — `CONTEXT.md`/
  `docs/adr/` are created lazily by `/domain-modeling`, not upfront). Logged
  in a new `## Agent skills` section in `CLAUDE.md`.
- Documented the source and the rename in `docs/reference/README.md`,
  alongside the existing `kepano/obsidian-skills` entry.

## 2026-07-19 (MCP Phase C follow-up: nudge inline tagging instead of polling)

Found that the "recurring Claude Code session" scheduling mechanism assumed
during Phase C isn't durable in this environment (session-scoped, expires),
and — separately — polling on a schedule wastes tokens checking for work that
usually isn't there yet. Better default: the `export_conversation` tool's own
description now nudges whichever Claude just exported a conversation to tag
it immediately afterward, while the content is still in its context — zero
polling, zero re-fetch, fires exactly once per real export. The nudge only
appears when `MCP_ALLOW_WIKI_LINKING=true` is also set (mcpToolList builds
`export_conversation`'s description dynamically), so it says nothing about
tools that don't exist when librarian linking is off. `list_unlinked_conversations`
etc. remain available for an occasional manual or Routine-driven catch-up
sweep. One new test pins the conditional nudge; 503 pass, build clean.

## 2026-07-19 (MCP Phase C: the conversation "librarian" — a subscription-billed Claude Code agent)

Closes Phase B's own follow-up note: conversation notes now link into the
diary's existing entity graph/wiki, instead of sitting in isolation. Compared
running this in-app (a Claude API call) against a recurring, subscription-billed
Claude Code agent; chose the latter, accepting an occasional manual
MCP-connector reconnect after a tool deploy (a platform behavior, not
something this app can fix) in exchange for using Claude subscription
headroom instead of metered API spend, plus a genuinely agentic reader that
can check what's already recorded before deciding what to add.

- **Six new MCP tools** (`lib/mcp.ts`), all gated behind one new flag
  `MCP_ALLOW_WIKI_LINKING=true` (OFF by default, hidden from `tools/list` and
  refused on `tools/call` otherwise — including the reads, since
  `get_conversation` exposes full previously-exported content the endpoint
  couldn't return before): read tools `list_unlinked_conversations`,
  `get_conversation`, `get_entity_wiki`; write tools
  `tag_conversation_entities`, `update_entity_conversation_notes`,
  `record_librarian_heartbeat`.
- **New data layer** (`lib/conversationEntities.ts`) — a synthetic
  `CONVERSATIONS_NOTEBOOK_ID` notebook (mirrors the existing `DISCIPLINE_ID`
  pattern) gives each exported conversation one lightweight `pages` row, so
  the librarian's entity tags flow through the SAME `entry_entities`/
  co-occurrence-graph pipeline diary content already uses — a person only
  ever discussed in a subscription chat now shows up in `related_entities`,
  `top_entities`, and gets a real Obsidian stub page.
- **Ownership-separated wiki content**: a new `entity_conversation_notes`
  table, kept structurally separate from `entity_wiki` (the in-app
  Claude-composed diary bio), so the librarian and the existing
  content-addressed bio regen can never overwrite each other. Entity stub
  notes now render both, in their own sections ("## Recent conversations"
  alongside the existing diary bio).
- **Notebook-exclusion audit**: unlike discipline, the conversations notebook
  carries a real `ocr_text`/`entry_date`, so it needed EXPLICIT exclusion
  from surfaces that assume real diary content (`analyzePending`'s pending
  query — which transitively protects `getThemes`/`getSentimentSeries`/
  `getEmbeddingMap` too, since none of them filter by notebook directly —
  plus `getHeatmap`, day-file export, `entityWiki.ts`'s bio composer,
  date/recency chat lookups) while staying deliberately INCLUDED everywhere
  the entity graph/rankings/stubs read (`top_entities`, `pages_for_entity`,
  `related_entities`, `getTopEntities`, entity dedup, canonical-name
  resolution, stub generation).
- **Heartbeat**: `GET /api/librarian` + a status section on `/memory`
  (mirrors the existing Backup section) — the app itself never runs the
  agent, so this only surfaces its last self-reported run.
- Caught and fixed a real bug during implementation: the existing entity-stub
  accumulator keys pages internally with a `\0` separator (not a space) to
  keep kind/name unambiguous — a new pass using a plain space silently
  created unmatched duplicate keys and made diary-sourced stubs lose their
  `## Mentions` section whenever the same entity also had librarian notes.

Honest tradeoffs (as designed): this app never runs the librarian — the user
sets up the recurring session themselves (a cron Routine) and it needs to
actually inherit the Remarkabler MCP connector, which is a platform behavior
to verify at setup time, not something the code guarantees. 27 new tests
(entity tagging/notes/heartbeat, stub rendering, notebook-exclusion pins);
502 pass, build clean.

## 2026-07-18 (MCP Phase B: export a full conversation into the Obsidian wiki)

The first WRITE on the (otherwise read-only) MCP endpoint, built to the user's
② vision: subscription-Claude **fully exports** a conversation and the app
files it, **verbatim (no summarizing)**, into the Obsidian/Dropbox vault as one
Markdown note — an accumulating, browsable record of your Claude conversations
alongside the diary.

- **`export_conversation` write tool** (`lib/mcp.ts`) — MCP-only, **OFF unless
  `MCP_ALLOW_CONVERSATION_EXPORT=true`** (hidden from `tools/list` AND refused on
  `tools/call` by default — forgetting config keeps the endpoint read-only).
  Add-only (upserts one row in the new `mcp_conversations` table, by
  `conversation_id`), size-capped (`MAX_CONVERSATION_CHARS`).
- **Filing** (`lib/conversationWiki.ts` + `maybeExportConversationsToDropbox` in
  `lib/dropbox.ts`) — renders each conversation as `Conversations/<date>-<slug>.md`
  with the full content verbatim, uploads via the existing Dropbox export path,
  and marks filed only on a clean upload. Deterministic (no Claude "librarian"
  call → no prompt-injection-into-summarizer surface). Fired inline from the
  tool and as a maintenance-sweep safety net (fire-and-forget + `.catch()`).
- New do-not-regress carve-out: the read-only invariant now documents this one
  sanctioned write and its three properties (opt-in/fail-safe, add-only,
  capped).

Honest tradeoffs (as designed): capture is Claude-initiated (it must call the
tool), and this reverses the subscription-privacy property — the full transcript
is now stored + written to your vault. Requires the Dropbox `files.content.write`
scope + export enabled. 16 new tests (store/renderer + tool gating/limits); 473
pass, build clean. (Follow-ups: entity `[[wikilinks]]` in conversation notes; a
smarter "librarian" organizing pass.)

## 2026-07-18 (MCP: recall_memories + get_guidance — richer subscription companion)

Phase A of bringing the in-app chat's richness to the subscription (MCP)
surface. The in-app chat auto-injects the durable memory layer and the persona
as its system prompt every turn; external Claude gets neither, so two MCP-only
tools (beside `get_profile`) close that gap:

- **`recall_memories`** — exposes the durable `chat_memories` layer (compressed
  preferences / facts / intents the author has told Claude before, distinct from
  diary entries) via the existing fail-open `recallChatMemories`. Optional
  `query`; omit for the most recent. Pure read (the Voyage query-embed is
  compute-only, matching `search_diary`).
- **`get_guidance`** — returns the companion tone + anti-confabulation contract
  (mirrors `lib/claude.ts:staticGuidance`), so subscription Claude behaves like
  the in-app companion: warm/specific, grounds in profile+memories+diary, and
  never fills a gap with a guess.

Both are MCP-only (not in `CHAT_TOOLS`) since the in-app chat already has this
content; both honor the read-only invariant, `MCP_EXCLUDE_TOOLS`, and the
sensitive-default machinery. 6 new tests; 463 pass, build clean. (Phase B —
full-conversation export into an Obsidian wiki — remains a deliberate, opt-in
decision; see the session plan.)

## 2026-07-18 (MCP OAuth: don't log out existing connectors on the migration — Codex P2)

Follow-up to the secret-binding fix: Codex noted the `ALTER TABLE ADD COLUMN
secret_hash` leaves NULL on every pre-existing `mcp_oauth_tokens` row, and the
new "reject a token whose secret isn't current" check treats NULL as invalid —
so a *plain* deploy (no rotation) would silently invalidate the user's current
connector session. Fixed with `backfillLegacyTokenSecrets`: it adopts NULL-
secret rows into the currently-configured secret once, at first use after the
migration (when the current secret is still the one that authorized them). They
then behave like any other token — valid on a same-secret deploy, revoked on a
later rotation — so the P1 revocation guarantee is preserved. 1 new test; 459
tests pass, build clean.

Also refreshed within-range dependencies (`npm update`, lockfile only) as part
of a repo-freshness pass; the flagged npm-audit vulnerabilities are almost all
dev/test tooling that never ships (the one runtime-relevant one, Next.js,
needs a 14->16 major migration deferred to its own effort).

## 2026-07-18 (MCP OAuth: rotating the token now truly revokes — Codex P1 fix)

Codex caught a real hole in the revocation story: the docs say "change
`MCP_AUTH_TOKEN` to revoke a compromised connector," but issued OAuth tokens
weren't bound to any secret, and `checkMcpAuth` accepted any live DB access
token as long as *some* valid `MCP_AUTH_TOKEN` existed. So **rotating** the
secret (old→new) left the old connector's tokens minting access forever —
only fully *unsetting* it disabled them.

Fixed by binding every issued token to the secret that authorized it
(`mcp_oauth_tokens.secret_hash`, captured at the `/authorize` consent step and
carried through the code exchange). `isValidAccessToken` and
`refreshAccessToken` now reject a token whose authorizing secret is no longer
in `MCP_AUTH_TOKEN`, and `pruneExpiredTokens` deletes the orphaned rows. This
preserves the comma-separated zero-downtime overlap (both valid during
`old,new`; the old-minted tokens die the moment you drop `old`). 3 new tests
pin it (rotate-revokes, overlap-then-drop, unset-disables); 458 tests pass,
build clean.

## 2026-07-18 (MCP: OAuth so the claude.ai app connector can connect)

The claude.ai **web** custom-connector UI only exposes OAuth fields (no static
Bearer header), so a token-only MCP server can't be added there — it fails
with *"couldn't register with sign-in service."* Added a **minimal OAuth 2.1
authorization server** (`lib/mcpOauth.ts` + `app/api/mcp/oauth/*`) so the
Claude app can complete the handshake, kept single-user simple:

- **Discovery**: RFC 9728 Protected Resource Metadata + RFC 8414 Authorization
  Server Metadata (served at `/.well-known/oauth-*` via `next.config.mjs`
  rewrites; the `/api/mcp` 401 now points `WWW-Authenticate` at the resource
  metadata — the bit that makes claude.ai discover the auth server).
- **Dynamic Client Registration** (RFC 7591) — public clients, no secret.
- **Authorize** — a consent screen that reuses `MCP_AUTH_TOKEN` as the
  password (the security anchor); issues a single-use, PKCE-bound code.
- **Token** — `authorization_code` (PKCE S256 required) + `refresh_token`;
  opaque access/refresh tokens stored HASHED in `mcp_oauth_tokens`.
- `checkMcpAuth` now also accepts a live OAuth access token, so both the
  claude.ai app (OAuth) and Claude Code (raw bearer) work off one endpoint.

Origin for metadata/redirects is `APP_BASE_URL` → `X-Forwarded-*` (never the
internal `req.url` behind Railway's proxy). Security anchors are a new
do-not-regress invariant: consent gate, PKCE, exact `redirect_uri` match,
single-use codes, hashed tokens. Verified with 9 new tests (full handshake +
every failure mode: wrong token, PKCE mismatch, code reuse, redirect
tampering) and a live end-to-end curl smoke test through the running server.
455 tests pass, build clean.

## 2026-07-15 (MCP endpoint: enforce read-only literally — Codex review fix)

Codex (P2) caught that the blanket auto-mirror of `CHAT_TOOLS` exposed a tool
with side effects: `get_recent_locations` fires `warmCurrentLocationGeocode`,
a background Nominatim lookup + `geocode_cache` write — so the endpoint's
"read-only" promise wasn't strictly true (only reachable under the sensitive
opt-in, but still a violation). Fixed by threading a `{ readOnly: true }`
option through `executeTool` (`lib/chatTools.ts`) that side-effecting tools
honor; `callMcpTool` (`lib/mcp.ts`) always passes it, so the location warm is
skipped on the MCP path while the in-app chat keeps warming as before.
`search_diary`'s Voyage query-embed is compute-only (no DB/fs write) and
stays. New invariant + a test proving the in-app path warms but the MCP path
does not. 27 MCP tests pass.

## 2026-07-15 (MCP endpoint: sensitive tools fail-safe by default)

War-gamed the worst case — claude.ai **account takeover** — and closed the
sharpest edge. The MCP connector rides on the user's subscription account, so
a compromised account can just *ask* for the diary. The most dangerous tool
there is `get_recent_locations`: it returns a timestamped movement schedule
(home/work, when the house is empty), turning an informational leak into a
physical-safety risk. `search_chat_history` similarly exposes raw late-night
chats.

Both are now **excluded from the MCP surface by default** (`SENSITIVE_TOOL_NAMES`
in `lib/mcp.ts`), hidden from `tools/list` AND refused on `tools/call`. They
return only when the operator explicitly opts in with
`MCP_ALLOW_SENSITIVE_TOOLS=true` — so forgetting a setting fails SAFE, matching
the token's own fail-closed philosophy. `MCP_EXCLUDE_TOOLS` can add more
exclusions but can never re-include a sensitive tool; the allow flag is the
only door. The in-app chat is unaffected — it still uses both tools fully;
only the subscription connector hides them. New "do not regress" invariant
(5). Tests: 6 new (default-hidden list + refused call, opt-in exposes +
executes, `"true"`-only gate, `MCP_EXCLUDE_TOOLS` composition).

## 2026-07-15 (MCP endpoint: security hardening)

Four layers on top of the bearer check, all fail-safe:

- **Brute-force throttle** — per-IP sliding window (10 failures / 10 min);
  once tripped, invalid attempts get 429. Deliberately failure-only: a valid
  token is NEVER throttled, so failed-attempt spam from a shared egress IP
  (Claude's connector proxy) can't lock the real user out.
- **Audit trail** — new size-capped `mcp_audit` table records every tool call
  (with tool name), handshake, failed attempt, and throttled hit, best-effort
  (an audit failure never takes the endpoint down). Failed attempts also log
  to console for Railway's log view.
- **Zero-downtime token rotation** — `MCP_AUTH_TOKEN` accepts comma-separated
  tokens; entries under 16 chars are ignored (all-short = disabled).
- **Scope control** — `MCP_EXCLUDE_TOOLS` removes tools from the MCP surface
  (filtered from tools/list AND refused on tools/call).

Tests: 8 new (rotation matrix, throttle window + aging, valid-token-bypasses-
throttle at the route level, audit rows, exclusion, client IP parsing).

## 2026-07-15 (MCP endpoint: chat with the diary on the Claude subscription)

Deep-research-verified path to zero-per-token diary chat: Remarkabler now
serves a **remote MCP endpoint** at `/api/mcp` (Streamable HTTP, stateless,
SSE disabled) exposing the in-app chat's read-only tools — `search_diary`,
dates/summaries, entities, locations, insights — plus an MCP-only
`get_profile` tool so external Claude can ground itself the way the in-app
chat does. Add it to claude.ai as a **custom connector** (Settings →
Connectors, `Authorization: Bearer <MCP_AUTH_TOKEN>` request header — OAuth
not required) and it propagates automatically to Claude Code (CLI + web
sessions), so one registration covers both. Chat about the diary then bills
to the Claude subscription, not the pay-per-token API; the in-app chat is
unchanged.

Design notes: the MCP tool list is **derived from `CHAT_TOOLS` at runtime**
(zero drift — a new chat tool automatically appears on MCP), dispatch reuses
`executeTool`, and auth is a fail-closed, timing-safe bearer check
(`MCP_AUTH_TOKEN` unset or <16 chars → endpoint disabled with 503, never
open). Built on `mcp-handler` + `@modelcontextprotocol/sdk`, registered via
raw `setRequestHandler` so the existing JSON schemas pass through verbatim.
New "do not regress" rule: the endpoint stays read-only and fail-closed.
Tests cover the tool mirror, the auth matrix, and a full MCP protocol round
trip (initialize → tools/list → tools/call) through the real route handler.
Setup guide (phone-friendly): `docs/mcp-setup.md`.

## 2026-07-15 (chat: widen the live window to fully close the gap)

Follow-up to the rolling-memory tuning: rather than just shrinking the
residual blind spot, close it structurally. The chat now feeds Claude the last
**20** turns of an active conversation as raw history (was 12), and the rolling
keep window is set **equal** to that (also 20). Because a turn is only rolled
once it's older than the keep window, and the keep window now matches the live
window exactly, there is **no structural gap** — every turn is either in the
live window Claude sees directly or compressed into memory (the only residual
is the small accumulation buffer below the roll batch size). The live window is
now a single exported constant (`RAW_HISTORY_WINDOW`) shared between the route
and the rolling logic so they can't drift. Trade-off: a modestly larger prompt
per message (20 recent turns instead of 12) for fuller recent context.

## 2026-07-15 (chat: rolling memory — review fixes)

Two P2 findings from the Codex review of the rolling-memory PR, both valid,
both fixed:

- **Don't discard thin rolled chunks (correctness).** `createRollingBatch`
  gated only on message count, but `compressBatch` permanently marks a batch
  `too-short` when its user text is under 200 chars — and Clear's `COALESCE`
  then never re-compresses those turns with the rest of the conversation, so a
  chunk of terse turns lost its memory extraction outright. Rolling now also
  gates on `MIN_USER_CHARS_FOR_COMPRESSION` (200): too-thin chunks stay
  unrolled and accumulate (or get swept by Clear) instead of being created and
  discarded.
- **Shrink the residual blind spot (tuning).** Lowered the keep window (20→14)
  and batch minimum (12→8) so rolling now kicks in around ~22 messages instead
  of 32, leaving only a couple of just-out-of-window turns uncaptured at any
  moment instead of an ~8-message band. The new substance gate keeps batch
  quality up despite the smaller minimum.

## 2026-07-15 (chat: rolling memory so long chats don't forget the middle)

Inspired by looking at claude-mem's "continuous capture" idea, but built on
our own SQLite + Voyage stack (no Bun worker, no Chroma). The chat already
compressed a conversation into durable `chat_memories` on Clear, and fed only
the last 12 turns as raw history. That left a blind spot: in a long chat you
haven't cleared, turns older than the last 12 were neither in the live window
nor yet turned into memory — mid-conversation details could quietly fall
through until you hit Clear.

Rolling memory closes it:

- **`createRollingBatch`** (pure, unit-tested) — once an active conversation
  grows past a keep window (20 turns), its older un-batched turns are stamped
  into an archive batch and compressed into `chat_memories` **as they scroll
  out of the window**, exactly like a partial Clear.
- **Crucially additive**: rolled turns keep `archived_at` NULL, so they stay
  visible in the chat (the UI filters on `archived_at`). Nothing disappears
  mid-conversation.
- **No double-counting**: the keep window (20) stays larger than the raw
  history window (12), so a rolled turn is never also fed as raw history; and
  a later Clear's `COALESCE(archive_batch_id, ...)` leaves rolled turns in
  their rolling batch and never re-extracts them.
- **`maybeRollConversationMemory`** — fired un-awaited (with `.catch`) from the
  chat POST, per-conversation in-flight guarded; the maintenance sweep is the
  safety net for any batch whose compression failed.

No new infrastructure; reuses `compressBatch`, dedup, and recall. Do NOT
confuse this with the claude-mem plugin — see that assessment: it's a Claude
Code dev-tool plugin, not something we adopt into the product.

## 2026-07-15 (chat: name a location gap plainly, don't reassure it away)

Follow-up polish after watching the deployed behavior. Chat correctly stopped
confabulating and interrogating, but when it hit a gap in the location record
it added a reassuring gloss — "likely just in transit / no movement trigger,
not missing data on my end necessarily." That over-reassurance quietly
downplays a real gap (a stationary stretch too sparse to cluster a stay IS
thin data). Tightened the guidance so chat:

- names a gap once, plainly, and moves on — no invented reason for it AND no
  "probably nothing / not missing data / you were likely in transit" gloss;
- applies the same rule to a hole BETWEEN stays, not just an old current
  position ("no location logged for that stretch").

Prompt-only; no change to location retrieval.

## 2026-07-15 (location: diagnose WHY tracking gaps form)

Root-cause follow-up to the chat gap-disclosure work. The server was ruled
out by code: `addPoint` stores every point OwnTracks POSTs — no throttle, no
dedup, no minimum interval — so a gap in the series means the PHONE stopped
sending (Android Doze suspending the app, or a Significant-mode monitoring
setting that only fires on movement), not that data was lost between the
server and chat.

To confirm from real data instead of theory, added a gap analyzer:

- **`analyzeGaps` (pure, unit-tested)** turns the raw point series into a
  summary: point count, median gap, count of gaps over 30 min, the longest
  gaps, and the still-open trailing gap (now − newest point). Timestamps
  only, no coordinates — safe to screenshot.
- **Memory page shows a last-24h gap line** ("N points, ~X min apart; M gaps
  over 30 min, longest Y min ending HH:MM") so a "why is there a 92-minute
  hole?" question is answered from the phone's actual publishing pattern.
- **`owntracksStatus` / `?debug=1`** now carry the gap stats too.
- **Corrected the stale-warning advice**: OwnTracks Monitoring → **Move**
  (steady interval) rather than Significant changes (movement-only, leaves
  long gaps), noting the battery trade-off.

## 2026-07-15 (chat: factual location answers, honest about data gaps)

Two flaws surfaced when the chat answered a plain "list my location history"
request: it invented explanations for things the data didn't show ("the
Samsung trip got moved", "your Suwon visit") and turned a factual list into a
personal interview ("you barely slept — how are you holding up?"). Both come
from the chat prompt, not the location data (which was retrieving correctly).

- **Factual requests get facts, not confabulation.** The chat guidance now
  tells Claude that for look-up questions (where was I, what did I do, a list,
  a timeline) it must report only what the data shows — never narrate a
  PLANNED or merely POSSIBLE thing as though it happened, and where the data
  is silent, say so instead of inventing a reason.
- **No unsolicited interrogation on a factual ask.** A location list no longer
  triggers "did the visit happen?" / "how are you holding up?" — the warm
  check-ins are reserved for when the user is actually reflecting.
- **Chat now discloses location data gaps instead of guessing.** When the last
  OwnTracks point is more than an hour old, both the ambient block and the
  `get_recent_locations` tool tell Claude to say plainly that its record stops
  there ("the last point I have is ~N min ago, so I may be missing anything
  after that") rather than speculating about what happened in the gap.

## 2026-07-13 (Memory page warns when OwnTracks goes quiet)

The chat's location knowledge is only as fresh as what the OwnTracks app
PUSHES — the server cannot pull from the phone. When Android battery
optimization kills OwnTracks in the background (points arrive only when the
user opens the app), that failure was invisible. The Memory page's OwnTracks
section now shows a warning when no point has arrived in >6h, with the
concrete Android fixes (location "Allow all the time", battery Unrestricted,
Monitoring mode). UI-only.

## 2026-07-13 (location: chat now sees your current position for a stationary user)

Fixed the reported bug where chat couldn't retrieve your recent/current
location — it kept reporting last night's stay while you were at the office,
and only caught up once a brand-new ping arrived. A 4-agent, adversarially-
verified assessment traced it to one root cause: the location data handed to
chat dropped a stationary user's real position.

- **`currentLocation()` no longer hard-drops a stationary position.** OwnTracks
  publishes mostly on movement, so sitting at the office all day produces no
  new pings — and the old 6-hour cutoff then returned `null`, so chat had no
  "current" and fell back to last night's completed stay. Now it returns the
  last-known point up to 36h with a `stale` flag (live under 45 min), so "at
  the office ~8h ago, likely still there" is reported instead of being erased.
- **The ambient location block leads with CURRENT POSITION** and labels the
  stays as history ("NOT necessarily where they are now"), so Claude stops
  reading an old completed stay as "now" even before calling the tool.
- **`get_recent_locations` explains `current` vs `route`** and that an old
  timestamp on a movement-published phone usually means "hasn't moved", not
  "wrong data".
- `owntracks?debug=1` now surfaces the `stale` flag too.

+tests (suite 405); build clean. The refuted findings (re-call guidance,
centroid clustering, clock-skew drop) are recorded, not acted on.


## 2026-07-12 (redesign phase 4 — consistent page headers)

Fourth redesign phase: every page's header brought up to the Home standard, so
the app reads as one cohesive surface.

- All six pages (Notebooks, Chat, Mind, Insights, Memory, Cost) now open with
  the `Eyebrow` sky-tick label + a larger, balanced (`text-3xl`,
  `tracking-tight`, `text-balance`) headline and calmer spacing — matching the
  Home hero. Chat keeps a compact header (it's height-constrained) but gains
  the eyebrow. Subtitles get `leading-relaxed max-w-prose`.
- Header-only, layout-safe change; no behavior touched.

Still to come: the transcription micro-loop, the sliding active-tab underline,
deeper per-page layout/component polish, and the Map3D recolor.

Suite 403; build clean.

## 2026-07-12 (redesign phase 3 — Home hero + Eyebrow motif)

Third redesign phase: elevate the Home page (the first impression) and add a
reusable header motif.

- **`Eyebrow` component** (`components/Eyebrow.tsx`) — a small uppercase label
  preceded by a short sky-blue tick, the "margin rule marks where you are"
  motif scaled down to a section label. Server-safe, hook-free, reused across
  pages in later phases.
- **Home hero** — the plain `Remarkabler` H1 (redundant with the nav wordmark)
  becomes an eyebrow + a larger, balanced headline ("Everything you write,
  understood.") + calmer spacing (`space-y-8`, `leading-relaxed`, `max-w-prose`).
  Pairs with the count-up stats from phase 2.

Still to come: the transcription micro-loop, the sliding active-tab underline,
the remaining pages (Notebooks/Chat/Mind/Insights/Memory/Cost), and Map3D.

Suite 403; build clean.

## 2026-07-12 (redesign phase 2 — motion: seamless navigation + count-up)

Second redesign phase: motion, with reMarkable's calm "never bouncy" pacing.

- **Seamless page transitions.** New `components/TransitionLink.tsx` runs client
  navigations inside `document.startViewTransition()`, and `globals.css` styles
  the root as a gentle cross-fade + upward drift (`::view-transition-old/new`).
  `Nav` uses it, so moving between pages glides instead of snapping. Degrades
  cleanly: reduced-motion and browsers without the View Transitions API (and
  modified/new-tab clicks) just navigate instantly — no regression.
- **Count-up stats.** `Stat` is now a client component that animates numeric
  values from 0 on first view (ease-out, IntersectionObserver-triggered). Pure
  enhancement — the server renders the final number, so no-JS / reduced-motion /
  pre-hydration all show the real value; string values (Cost's money) are
  untouched.
- **Calm-timing tokens** (`--ease-calm`, `--dur-calm`) added to `globals.css`.

Still to come: the transcription micro-loop, the sliding active-tab underline
(shared-element transition), per-page layout elevation, and the Map3D recolor.

Suite 403; build clean.

## 2026-07-12 (redesign phase 1 — Fresh Summer Sky palette)

First phase of the app redesign: a new **Fresh Summer Sky** palette, designed
with the `ui-ux-pro-max` skill and WCAG-AA verified, replacing warm amber+stone.

- **Neutrals** warm stone → cool `slate-*`; **accent** amber → sky-blue `sky-*`
  (a scripted, class-only reskin across `app/` + `components/` — 350 slate + 48
  sky classes, 0 amber/stone left).
- **One sunny-yellow CTA**: `Button` `primary` is now `bg-amber-400` /
  `text-sky-950` — the single warm pop in an otherwise sky-blue system.
- **Airy sky-50 background** (`#f0f9ff`) with a barely-there sky wash for depth
  without a shadow (light only); dark mode stays pure AMOLED black.
- Focus ring, `theme-color` meta, and the `colors.accent` Tailwind alias all
  moved to sky-blue.
- `DESIGN.md` updated to the new palette + rules ("the yellow is the ONE CTA").

Known follow-up: `app/mind/Map3D.tsx` still uses amber hex literals for its 3D
sentiment points (the class reskin doesn't touch hex) — to be recolored to the
sky ramp in a later phase. Motion (transcription loop, ink-draw margin rule,
count-up, view-transition navigation), component polish, and per-page layout
elevation are also later phases.

Suite 403; build clean. Visual verification needs the deployed Railway instance.

## 2026-07-11 (deep multi-agent review: 11 verified fixes)

A 6-dimension specialized codebase review (correctness / security / efficiency
/ reliability / data-integrity / quality), each finding adversarially verified
against the real code. 12 findings confirmed (0 refuted); 11 fixed here, 1
deferred as a known follow-up.

**Security (major):**
- `session_secret` — the HMAC key that signs session cookies — was NOT redacted
  from the off-site GitHub backup, even though there is no server-side session
  store, so that key alone lets an attacker forge a valid session and bypass
  the whole passcode/passkey lock. Added it to `SENSITIVE_SETTING_KEYS`
  (`lib/backup.ts`); on restore, a fresh key regenerates (safely invalidating
  stale sessions). +1 test.

**Data integrity (major):**
- reMarkable sync could silently and permanently destroy a page's diary text:
  a changed page that re-OCR'd to blank (render glitch / transient empty
  response) overwrote the prior good text with `''`, advanced the page/doc
  hash, and was never retried. Now a blank re-OCR of a page that already had
  text is **confirmed across sweeps** before it's accepted (`lib/remarkableSync.ts`,
  new pure `classifyReocr` + a `pages.blank_ocr_hash` marker): the first blank
  keeps the old text and records the page's `.rm` hash (assumed a transient
  glitch); only if the *same* hash re-OCRs blank again on a later sweep is the
  blank accepted as a genuine tablet erase. This fixes the original silent
  data loss without the opposite failure a first pass introduced — a truly
  erased page looping re-OCR forever while showing stale text (caught in
  review). +tests.

**Correctness / efficiency (minor):**
- Chat `search_diary` / `count_entries_mentioning` reported `page: null` for
  every reMarkable-synced excerpt (they parsed the page number out of the
  page_id, whose shape differs for `:rm:` ids). Now resolved from the
  authoritative `pages.page_index` (`lib/chatTools.ts`).
- `get_entries_by_date` matched only the literal date string, dropping the
  continuation pages of a multi-page day (only page 1 carries the date
  header). Now also matches the attributed `entry_date` (`lib/chatTools.ts`).
- `related_entities` scanned `entry_entities` twice per call; merged into one
  scan, deriving the canonical-name map in JS. `isDuplicateMemory` reloaded +
  decoded the whole embedding table once per extracted item; `compressBatch`
  now preloads once and dedups against the in-memory set (intra-batch dedup
  preserved).

**Reliability (minor):**
- Added the missing `.catch()` to the fire-and-forget `maybeCompressChatSessions()`
  in the memory retry + backfill-all routes (matching CLAUDE.md's own rule).
- Two in-flight guards (`lib/entityWiki.ts`, `lib/dropbox.ts`) set their flag
  before a DB write that could throw, which would leave the flag stuck true and
  silently disable that background job until restart. Flag is now set as the
  last step before the `try`.

**Quality (minor):**
- `buildNotesContext` re-inlined the discipline-exclude ternary the centralized
  helper exists to prevent — now calls `disciplineExcludeIdForChat()`.
- Removed a dead operand in `compressBatch`'s parse-failure guard.

**Deferred (known limitation):** the one-time legacy whole-PDF→per-page
restructure in `lib/remarkableSync.ts` can drop a page that was deleted on the
tablet between a Phase-1b import and the first auto-sync (legacy rows have no
page-id to preserve). Narrow trigger; a naive fix risks duplicating diary
content, so it needs a dedicated design + test rather than a rushed patch.

Suite 398.

## 2026-07-11 (security + reliability hardening)

Requested as "more solid operation" + "strengthened security." A direct
audit of the real attack surface and failure points (not a framework/library
swap — see session notes if that's confusing):

**Security:**
- **Passcode brute-force lockout.** `lib/auth.ts` now blocks further passcode
  attempts (both `action: "passcode"` and `"register-options"`) after 8 wrong
  guesses within a rolling 15-minute window, persisted in `settings` so it
  survives a Railway restart mid-attack. A correct passcode clears it
  immediately. WebAuthn `login-verify` is deliberately not gated (not
  practically guessable). +5 tests.
- **Baseline security headers** (`next.config.mjs`): `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, a `Permissions-Policy` that allows only
  the geolocation (Memory page) and microphone (chat voice input) the app
  actually uses. No CSP added — this app has no `next/image` and no
  middleware, so exposure to the open Next.js image-optimizer/middleware CVEs
  is low, and a hand-rolled CSP risks silently breaking the UI for a
  non-technical, phone-only user; that deserves its own tested pass.
- **Dependency fix**: `npm audit fix` (non-breaking) resolved the protobufjs
  high-severity advisory (transitive, via PostHog's OpenTelemetry exporter).
  The remaining Next.js CVEs all require the Next 16 major upgrade — a
  separate, deliberately-not-done-unprompted decision; Next is already on the
  latest 14.2.x patch (14.2.35).

**Reliability:**
- **Global crash safety net.** New `instrumentation.ts` installs
  `process.on('unhandledRejection'/'uncaughtException')` handlers that log
  instead of letting Node kill the whole server — this app fires a lot of
  never-awaited background work, and one unguarded failure taking down the
  process for the app's one user is worse than a logged, recoverable miss.
- **Fixed 6 fire-and-forget call sites with no `.catch()`** (the Dropbox
  ingest, chat-memory compression, and reMarkable sync triggers in
  `lib/notes.ts`'s maintenance sweep; the entity-wiki export in
  `lib/entityWiki.ts`; the chat-memory trigger in `app/api/chat/route.ts`).
  Their surrounding `try/catch` only guarded the synchronous call setup, not
  the returned promise — a real gap, since Node treats an unhandled
  rejection as fatal by default.

Suite 398. Build clean.

## 2026-07-10 (agent-sweep follow-ups: reMarkable delete tombstone + duplicate-panel hardening)

A 20-agent adversarially-verified audit of "can a deleted notebook come
back?" (run after the Dropbox tombstone fix) confirmed four follow-ups, all
fixed here:

- **reMarkable channel had the same delete-doesn't-stick bug.** The Phase-2
  zero-tap sweep derives its subscription set from live `remarkable_doc_id`
  rows, so deleting a cloud-synced notebook made the sweep see it as "new in
  an enabled folder" and silently re-import + re-OCR it. `deleteNotebook`
  now also writes a `remarkable_ingest_tombstones` row, the sweep's
  auto-import branch skips tombstoned doc ids
  (`remarkableTombstonedDocIds()`), and an explicit Import clears the
  tombstone (deliberate re-add). +4 tests.
- **Duplicates panel could overstate coverage for undated pages.** A
  transcribed page before the first dated header contributes no date, so a
  notebook could classify "FULL — all dates covered" while that page's
  content existed nowhere else. `DuplicateCandidate` now carries
  `hasUndated`; the card and the delete confirm warn explicitly. +2 tests.
- **Two UI ghost fixes on /notebooks.** Monotonic fetch counters so a slow
  stale response can't repaint a just-deleted notebook over the fresh list,
  and delete now optimistically drops the notebook from both the list and
  the duplicates panel so a failed follow-up refresh can't leave a ghost
  card.

Suite 393. The refuted findings (import crash-window, dedup-query
resurrection) are recorded in the session log, not acted on.

## 2026-07-09 (duplicate notebook kept reappearing after delete; cost snapshot mismatch)

Two fixes:

- **Deleted Dropbox notebooks no longer come back.** Deleting a notebook
  removed its `dropbox_file_id` dedup marker, so the Dropbox watcher saw the
  same source PDF as new and re-ingested it on the next poll — a deleted
  duplicate kept reappearing. `deleteNotebook` now writes a tombstone
  (`dropbox_ingest_tombstones`) for any Dropbox-ingested notebook, and the
  watcher's "already seen" set (new `ingestSkipFileIds()`) unions those
  tombstones in, so a deletion sticks. Manual uploads (no `dropbox_file_id`)
  aren't tombstoned. +3 tests.
- **Cost tab: calendar cell now matches its breakdown.** The month calendar is
  one snapshot (fetched on month load); the per-day breakdown is fetched fresh
  on tap. Background jobs add usage in between, so the tapped cell could read
  stale (e.g. $0.08) while its breakdown read current (e.g. $0.12) — same data,
  two fetch times. `/usage` now reconciles the selected day's cell and the
  "This month" total to the fresher per-day fetch, so the two numbers always
  agree. (The two `monthlyUsage`/`dailyUsage` queries were already
  mathematically identical for the same rows — verified — so this was purely a
  freshness mismatch, not a query bug.)

## 2026-07-06 (edit transcription: reparse carry-forward on header change; review #125)

When an OCR correction CHANGES a page's dated header (day A → day B),
`correctPageText` now re-runs the notebook carry-forward parse so continuation
pages that inherited day A follow to day B (they'd otherwise split one entry
across two dates), and invalidates BOTH days' cached summaries. Guarded to the
header-actually-changed case, so a plain word fix is unaffected. +1 test
(suite 384).

## 2026-07-06 (edit transcription: refresh all derived indexes; review #124)

The OCR-correction edit previously updated only `pages.ocr_text`, leaving the
separately-maintained indexes stale — so a corrected word wasn't findable in
search. New `correctPageText()` in `lib/notes.ts` mirrors the ingest path in
one transaction: rebuilds the page's `pages_fts` row (FTS is manual, so
`search_diary`/`count_entries_mentioning`/`/diary?q=` now match the fix),
clears `embedding` (→ re-embed for semantic recall) and `entry_analysis`
(→ re-derive themes/entities), reparses `entry_date` ONLY when the corrected
text has a real header (never clobbers a carried-forward date), and
invalidates the affected day's cached summary. The PATCH route calls it. +4
tests (suite 383).

## 2026-07-06 (edit transcription — correct OCR errors in the app)

Added an "Edit text" affordance on each transcribed page in `/notebooks`
(textarea + Save), backed by `PATCH /api/notebooks/[id]/pages` ({ pageId,
text }). It updates the stored `ocr_text`, drops the page's cached
`entry_analysis` so themes/mood/summary/entities re-derive on the next sweep,
and re-exports the affected day file so the fix reaches Obsidian/Dropbox. Raw
text (page view, day file, chat's date/keyword lookups) reflects the fix
immediately. For OCR slips like 정중→절충 that the model occasionally makes.

## 2026-07-06 (codebase-review batch: attachment-cleanup race + doc/naming/a11y)

Addresses a full-codebase review. (P1) The orphan chat-attachment cleanup
deleted ANY unreferenced file, but the chat route writes the file before
inserting its row (with runMaintenanceSweep running between), so a
just-uploaded attachment could be reaped before its row landed. Pass 2 now
skips files newer than a 30-minute grace window, and the misleading invariant
comment is corrected (+3 tests). (P2 docs) `SKILL.md` chat default corrected
to `claude-sonnet-5` and the maintenance-sweep list gains `maybeSyncRemarkable`
+ `maybeRefreshEntityWiki`; `AGENTS.md` drops the stale hard-coded test count.
(P3) `remarkableSync.ts:quiesced()` renamed to `isWithinQuiesceWindow` (it
returns true when too-fresh, not settled); nav active links now set
`aria-current="page"`. Deferred: per-session inactivity timeout (marginal for
a single-user app). Suite 379.

## 2026-07-06 (manual merge: enable standalone canonical promotion; Codex #121)

Two fixes so the "make this the canonical name" override works on its own.
(1) The `/mind` form rejected an empty variant list before checking the box,
so a canonical-only promotion (just promote an already-merged spelling back to
canonical, no new variants) couldn't be submitted — now allowed when the
checkbox is on. (2) A canonical-only promotion rewrites entity rows but
returns `merged: 0` (that counts variant aliases), so the export refresh —
gated on `merged > 0` — was skipped, leaving Obsidian stale; the route now
refreshes when `rewritten > 0` too. +test assertions (suite 376).

## 2026-07-06 (manual merge: resolve canonical through aliases + a "make canonical" override; Codex #120)

Fixed a bug in the manual merge: if the canonical name the user typed was
itself already merged away in an earlier run, folding variants straight into
it rewrote rows to a dead alias and resurrected the duplicate. Now the typed
canonical is resolved through the alias table first, so variants fold into the
REAL canonical by default. Added a "make this the canonical name" override
(default on in the form) that promotes the typed spelling to THE canonical and
folds the existing canonical + its whole alias cluster into it — so the user
can force which spelling wins (e.g. 야오팡 vs Yaofang). +2 tests (suite 376).

## 2026-07-05 (manual entity merge)

Added a "Merge specific names" form on `/mind` for folding an explicit list
of spellings into one canonical name — the cases the conservative Claude
auto-merge won't catch (OCR variants of one Korean name, a cross-script
pair). `mergeEntitiesManually` in `lib/entityMerge.ts` + a `{ manual }` body
on `POST /api/mind/merge-entities`; it rewrites the rows everywhere and
records an alias for EVERY variant (even one not currently extracted) so a
future ingest of that spelling auto-folds. Reuses the same stale-stub
cleanup + export refresh as the auto merge. +1 test (suite 374).

## 2026-07-05 (review-watcher: review-then-ask instead of auto-fix)

Changed the review-forwarding workflow's handoff so the spawned session
investigates a code-review finding and then REPORTS BACK + asks the owner for
a go-ahead before changing any code — rather than auto-opening a fix PR. The
owner wants every review finding surfaced for a yes/no, not applied silently.
This session also subscribes to each PR's activity so findings arrive in-chat.

## 2026-07-05 (life wiki: enforce the real excerpt budget)

`selectWikiExcerpts` chose how many pages to keep from the *average* mention
length but never checked the *actual* total of the pages it selected — so
with uneven lengths (many one-liners + some long pages) the sample could land
on the long ones and exceed `MAX_INPUT_CHARS`, breaking both the cost cap and
the hash==prompt guarantee. Now it verifies the real selected size and shrinks
the sample until it fits, with a final hard-trim if even the two endpoints
overflow — the returned set is guaranteed ≤ budget. +2 tests (suite 373).

## 2026-07-05 (wiki + extraction: profile every named thing, not just people)

Broadened both the entity extraction and the wiki so the deep profiles cover
**everything named** in the diary, not just people/places. The `project`
kind is now used broadly for any specific named subject — a work project, a
book/media, a company/organization, a named concept or method, an event, a
product, or a notable recurring object (Project Hail Mary, NVidia,
Psycho-Cybernetics…). `analyzeEntryContent`'s entity guidance was widened to
capture these; `composeEntityWiki`'s third-kind prompt now writes a grounded
"what this is + its significance to the author" profile instead of assuming a
work effort. Places got a richer prompt too. (Existing entries pick up the
new categories after a "Re-analyse in English" pass; then rebuild the wiki.)

## 2026-07-05 (life wiki — deep profiles from the whole diary history)

Redesigned the life wiki from a short blurb over the newest 12 mentions into
a real biographical profile read from the entity's ENTIRE diary history.
`mentions` now returns the whole chronological history (oldest→newest);
`composeEntityWiki` prompts for a grounded reference entry — who the person is
to the author (relationship, nationality, role), a `## Key facts` section, and
a `## Over time` arc ending on current status — with `max_tokens` 900 and a
higher output cap. Cost is bounded by a per-entity input budget: the new pure
`selectWikiExcerpts` trims each page and, only when over budget, takes an even
chronological sample keeping the first + last so the arc stays represented.
The `source_hash` still digests exactly what's sent, so for entities under
budget every mentioning page now drives regeneration (editing an old entry
about someone refreshes their profile). First full build ~$3–8; batch limits
lowered (20/tap, 4/sweep) since each call reads more. +7 tests (suite 371).

## 2026-07-05 (strip review-tool attributions from repo text)

Per `AGENTS.md`'s "no model identifiers or internal harness IDs in commits,
PRs, or code" rule: neutralized the automated-review-tool name that had
accumulated as inline attributions across the CHANGELOG and code/test
comments (~50 spots), keeping the GitHub PR numbers as plain references
(`(PR #NN)`). Extended to the review-forwarding GitHub Action too — renamed
`codex-watcher.yml` → `review-watcher.yml` and de-branded its name/comments.
The ONLY remaining reference is the bot's fixed GitHub username
`chatgpt-codex-connector` in that workflow's actor filter (+ the `CLAUDE.md`
line documenting it): it's an external service's public login the trigger
must match verbatim, not our identifier, so it stays. Vendored third-party
material under `docs/reference/**` is left untouched (it's upstream source,
not our text).

## 2026-07-05 (docs + life-wiki consistency)

Added `ARCHITECTURE.md` — the whole-app structure map (data-flow + layer
diagrams, annotated tree, lib modules by domain, data model, external
services) — wired into the `SKILL.md` companion chain. Plus two wiki fixes:
(1) the freshness hash now digests EXACTLY the excerpts sent to Claude (the
newest 12, truncated) instead of the full mention set, so a hash change
always means the profile's actual input changed — no more marking a profile
"fresh" after regenerating from an unchanged prompt. (2) The post-refresh
Dropbox push now uploads ONLY the regenerated profile stubs (new
`onlyEntityStubs` path) instead of re-syncing every day file + stub, so a
sweep that refreshes a few profiles no longer rewrites the whole vault.

## 2026-07-05 (life wiki follow-ups)

Two fixes on the wiki. (1) The maintenance-sweep auto-refresh
(`maybeRefreshEntityWiki`) regenerated profiles but never re-exported them —
the ingest export had already written the old bodies — so updated summaries
stayed in SQLite until a manual export. It now fires
`maybeExportDiaryToDropbox` when it generates anything. (2) The freshness
`source_hash` was computed from the same newest-12 pages sent to Claude, so
an edit to an older (13th+) mentioning page wouldn't flip it and the profile
was wrongly skipped. Now `mentions()` returns the full uncapped set, the hash
covers all of it, and the 12-page cap is applied only to the excerpts sent to
Claude.

## 2026-07-05 (life wiki — Claude-written entity profiles)

Each Obsidian entity note was a bare list of dates. Added a self-updating
"life wiki": Claude writes a short profile for every person/place/project
from the entries that mention them, embedded above the `## Mentions`
backlinks. New "Build life wiki" button on `/mind` (→ `POST
/api/mind/build-wiki`, batched, reports how many remain) does the initial
build; after that it's automatic — `lib/entityWiki.ts:refreshEntityWiki` is
content-addressed (each profile records a `source_hash` of its mentioning
pages, so a new/edited entry that mentions the entity regenerates only that
profile), and `maybeRefreshEntityWiki` refreshes a few per maintenance sweep
once opted in. New `entity_wiki` table; `composeEntityWiki` + pure
`cleanEntityWiki` in `lib/claude.ts`; export embeds profiles via
`allEntityWikiRows`. +12 tests (suite 365).

## 2026-07-05 (entity merge: clean up already-merged stubs)

The stub-deletion in #109 only cleaned up aliases merged in the CURRENT run,
so a stub for an entity merged on an earlier deploy (its `entry_entities`
rows already gone → `dedupeAllEntities` returns it in no group, `merged: 0`)
was never deleted and its orphaned Obsidian node survived. Fixed: the merge
endpoint now deletes stubs for EVERY recorded alias (`listAliases`), not just
this run's, and runs that cleanup even when nothing new merged. Added an
`alias_name` column to `entity_aliases` (migration) storing the merged-away
display spelling so the exact stub path can be reconstructed. +1 test.

## 2026-07-05 (entity merge follow-ups)

Two fixes on the entity-merge feature. (1) The chat entity lookups
(`related_entities`, `pages_for_entity`) normalized the raw query name but
didn't resolve it through `entity_aliases` — so after merging 야오팡 → Yaofang,
asking for "야오팡" returned "not found" even though the alias was recorded.
Now both fold the query name through `applyEntityAlias` first. (2) The
Dropbox export overwrites but never deletes, so a merged-away entity's stub
note (`People/야오팡.md`) survived as an orphaned Obsidian graph node. The
merge endpoint now deletes the stale alias stub files (new
`deleteDiaryExportFiles` in `lib/dropbox.ts` + `entityStubRelPathForName` in
`lib/diaryExportDb.ts`) before refreshing the export. +2 tests (suite 355).

## 2026-07-05 (merge duplicate entities)

Entity dedup was exact-match on `name_norm`, so one real person written two
ways (a Korean name + its romanization, "야오팡" / "Yaofang") became two graph
nodes and two chat entities. Added a Claude-driven merge: the new "Merge
duplicate names" button on `/mind` (→ `POST /api/mind/merge-entities`) has
Claude find same-real-entity spellings per kind (conservatively) and folds
each group into one canonical name. New `entity_aliases` table +
`lib/entityMerge.ts`: `mergeEntity` rewrites the `entry_entities` rows in
place (every reader keys on `name_norm`, so no read-path changes), records
the alias, and collapses chains; `applyEntityAlias` folds the same spelling
on FUTURE ingests so a merge sticks. Claude call + pure
`parseEntityDuplicates` (validates every returned name against the input, no
invented merges) in `lib/claude.ts`. +13 tests (suite 353).

## 2026-07-05 (chat: related_entities graph tool)

The chat could already read the user's people/places/projects (`top_entities`,
`pages_for_entity`) but not the *connections* between them — the edges the
Obsidian graph draws. Added a `related_entities` chat tool: given a
person/place/project, it returns the entities the user writes about on the
SAME days, ranked by shared-day count ("who appears with 엄마?", "what places
connect to this project?"). Pure co-occurrence in `lib/entityGraph.ts`
(`computeRelatedEntities`), DB glue + effective-date carry-forward in
`lib/chatTools.ts:relatedEntities`; undated pages excluded (they'd link
everything), discipline notebook follows the usual chat sharing toggle.
+13 tests (suite 340).

## 2026-07-05 (docs: Obsidian graph setup + session log)

Recorded the full Obsidian-graph integration in the repo: a user-facing
phone walkthrough (`docs/obsidian-graph-setup.md` — install → Remotely Save
→ export folder → entity stubs → graph → color groups) and a session log
(`docs/sessions/2026-07-05.md`) capturing the load-bearing gotchas (Remotely
Save's hidden `/Apps/remotely-save/<vault>` app folder, the stub-filename ↔
wikilink alignment rule, and the `Dropbox-API-Arg` non-ASCII/ByteString fix).

## 2026-07-05 (Dropbox upload of non-ASCII paths)

`maybeExportDiaryToDropbox` failed on any file whose Dropbox path contained
non-ASCII characters — the `Dropbox-API-Arg` HTTP header must be ASCII-only,
so a Korean entity-stub name like `People/김철수.md` (U+AE40) made `fetch`
throw "Cannot convert argument to a ByteString". 124 of 215 files failed on
the live app. Added `dropboxApiArg()` which `\uXXXX`-escapes every non-ASCII
char (the form Dropbox documents) and routed both the upload and download
content endpoints through it. +4 tests.

## 2026-07-05 (align entity stub filenames with wikilink text)

`sanitizeEntityName` now also collapses path-unsafe chars (`/ \ : * ? " < >`)
to spaces, so the day-file `[[wikilink]]` text and the entity stub's filename
basename derive identical normalization and always resolve in Obsidian.

## 2026-07-05 (Obsidian entity stub notes)

The diary export's `[[wikilinks]]` for people/places/projects pointed at
notes that didn't exist, so Obsidian showed them as "unresolved" graph
nodes you couldn't open. Now the Dropbox export also writes one stub note
per entity — `People/Jin.md`, `Places/Seoul.md`, `Projects/…` — each with
`type:` frontmatter and a list of `[[YYYY-MM-DD]]` links back to the days it
appears, so every graph node is clickable and opens to that entity's days.
Pure `buildEntityStubFiles`/`entityStubFileName` + `EntityStub` type in
`lib/diaryExport.ts`; DB-backed `renderEntityStubFiles` /
`affectedEntityStubFileNames` in `lib/diaryExportDb.ts` (reuse the canonical
casing + carry-forward date, exclude the discipline notebook). Stubs are
merged into `maybeExportDiaryToDropbox`'s file map — refreshed incrementally
per notebook and fully on a whole-vault sync. +13 tests (suite 322).

## 2026-07-05 (editable Dropbox diary export folder)

The diary auto-export destination was hardcoded to the
`dropbox_export_folder` setting with no UI to change it. Added an editable
"Destination folder" field on the Memory page (Dropbox export section) that
POSTs `{ folder }` to `/api/dropbox/export`, normalized by the new
`setDropboxExportFolder()` in `lib/dropbox.ts` (leading slash, no trailing
slash, empty → default). This lets the export point at an Obsidian sync
tool's app folder (e.g. `/Apps/remotely-save/Diary`) so plugins like
Remotely Save — which only read their own scoped Dropbox app folder, not
arbitrary paths — can actually see the day files. Saving with export
already on runs one export immediately so the files land in the new place.

## 2026-07-05 (detect duplicate notebooks)

Old notebooks (Dropbox-ingested or manually uploaded) can cover the same
diary dates as a notebook later imported/synced from the reMarkable cloud —
both copies then sit in the DB feeding chat/`/mind`/diary export. Added a
read-only detector (`lib/notebookDedup.ts` pure classification +
`lib/notebookDedupDb.ts` one-query DB layer) and a "Possible duplicates"
section on `/notebooks` (`GET /api/notebooks/duplicates`) so the user can
review and manually delete redundant old notebooks — never automatic.
Classifies each old notebook as `full` (every date already covered by a
cloud notebook) or `partial` (some dates would be lost), reusing the
existing `effectiveDateKeys` carry-forward helper and the existing
`remove()` delete pattern. +24 tests (suite 309).

## 2026-07-05 (diary export — scope canonical entity names to exported pages)

`fetchCanonicalEntityNames` aggregated MIN(name) across ALL of
`entry_entities`, including the excluded `github-discipline` notebook's
entities. A discipline-notebook entity with a lexicographically smaller
name could win the MIN(name) tie-break and leak an entity spelling into
the diary export that the diary's own (discipline-excluded) data never
produced. Fixed by joining through `pages` and applying the same
`notebook_id != DISCIPLINE_ID` scope the exported rows (and
`getTopEntities`/`topEntities`) already use. +1 regression test pinning
the exact leak scenario (suite 285).


## 2026-07-05 (diary export — Obsidian-native: entity wikilinks + frontmatter)

The per-day Markdown files auto-exported to Dropbox now make Obsidian's
graph view actually useful: entity mentions (person/place/project, already
extracted by `/mind`'s analysis) render as `[[wikilinks]]` instead of plain
text, and each day's YAML frontmatter gains deduped `people:`/`places:`/
`projects:` arrays. Canonicalization (`lib/diaryExportDb.ts`,
`fetchCanonicalEntityNames`) reuses the exact `MIN(name) GROUP BY name_norm`
convention already used by `/mind`'s `getTopEntities` and the
`top_entities` chat tool, so every mention of the same person across the
whole diary — regardless of casing on any given page — links to one
wikilink target and one graph node. `lib/diaryExport.ts` gains `wikilink`,
`yamlQuoted` (safe YAML string escaping), and `collectEntities`
(cross-page dedup for the frontmatter arrays); `PageEntities` now carries
canonical, sanitized names rather than raw per-page casing. No changes to
the Dropbox export path or folder structure — Obsidian resolves
`[[wikilinks]]` vault-wide regardless of folder depth, and shows
unresolved links as graph nodes with no extra "entity stub" files needed.
Tests +10 (suite 284).

Also vendored, at the owner's request, three Obsidian-related repos for
reference: `kepano/obsidian-skills` (a genuine Agent Skills repo, no
hooks) is installed live under `.claude/skills/`; `obsidian-mind` and
`obsidian-second-brain` — full agent frameworks with hooks/subagents/
auto-rewrite behavior that would conflict with Remarkabler being the sole
writer of the diary files — are vendored as inert reference material under
`docs/reference/` (their per-tool `.claude`/`.gemini`/`.shardmind`/… hook
directories stripped; decorative binary assets dropped). See
`docs/reference/README.md` for the full rationale.

## 2026-07-04 (model picker — add Sonnet 5)

The Memory page's model dropdown was a hardcoded list predating Sonnet 5, so
the new chat default couldn't be selected — and the Railway `CHAT_MODEL` env
var (claude-sonnet-4-6) was overriding the new code default anyway. Sonnet 5
is now the first option ("smartest Sonnet, best for chat"); one tap sets the
in-app override, which wins over the env var.


## 2026-07-03 (chat model — Claude Sonnet 5)

Owner-requested: chat now defaults to `claude-sonnet-5` (in-app/env overrides
still win; the overload fallback deliberately stays on `claude-sonnet-4-6` —
a different model is the point of a fallback). Compatibility checked: the
chat call sends no sampling params, no prefills, no thinking config, so it
rides Sonnet 5's defaults (adaptive thinking on). Chat `max_tokens` raised
4096 → 8192 because thinking counts toward the cap. `claude-sonnet-5`
pricing added to the usage table at list price ($3/$15; the $2/$10 intro
through 2026-08-31 means the cost calendar errs slightly high until then —
note Sonnet 5's tokenizer counts ~30% more tokens for the same text, so
token counts shift even at equal prices).


## 2026-07-03 (insights — weekly auto-generation is now an opt-in toggle, default OFF)

Owner-requested: the weekly automatic insight (an Opus call over the full
corpus — one of the most expensive recurring calls) no longer fires on its
own. `maybeGenerateWeeklyInsight` is gated on the new
`weekly_insight_enabled` setting (unset = OFF, effective immediately), a
"Weekly auto-insight: ON/off" toggle on `/insights` flips it
(`PATCH /api/insights { weeklyEnabled }`), and the manual "Generate
insights" button is unaffected.


## 2026-07-03 (reMarkable sync — versioned cursor + Sync now button)

The same-day notebook STILL didn't import after the 24h-grace fix: the last
clean sweep (under the old gate) had advanced the rootHash cursor, and with
no new tablet edits the fast-path short-circuited before the new gate ever
ran — exactly what the review flagged on #96.

- **The cursor is now versioned**: stored as gate-version + folder
  subscriptions + cloud root, so it self-invalidates when ANY of the three
  changes. Deploys that alter gating semantics bump `GATE_VERSION`; the old
  bare-hash cursor never matches the new format, forcing one full pass.
- **"Sync now" button** on `/memory` (and the folder-enable kick is now
  forced too): `maybeSyncRemarkable({ force: true })` bypasses the interval,
  failure backoff, and fast-path — a user-initiated check actually checks.
  No more waiting on an invisible background timer to see what happens.


## 2026-07-03 (reMarkable sync — enabling a folder includes today's notebook)

The user's same-day diary (edited 12:35) sat unimported with no error: the
folder's enabledAt got stamped later than the edit (re-stamped by the
legacy-format fix deploy), and the strict "from now on" gate silently
skipped it. New pure `shouldAutoImport(lastModified, enabledAt)` adds a 24h
grace before the enable time — "sync my Diary from now on" includes today's
active notebook, and one day never reaches the archive. Fails closed on
missing/garbage timestamps. +4 tests (suite 274).


## 2026-07-03 (reMarkable sync — don't fast-retry rate limits)

`withNetRetry` no longer treats HTTP 429 as a transient socket hiccup:
replaying a hundreds-of-requests fan-out one second into a rate limit
prolongs the limit. A 429 now falls through to the sweep's 10-minute
backoff (5xx and socket/DNS errors still retry in-call).


## 2026-07-03 (reMarkable sync — retry transient network failures; diagnosable errors)

The sync banner showed a bare "Sync: fetch failed" and the pending import
stalled behind a 30-minute backoff. Root cause (two-agent investigation):
rmapi-js has NO retry/timeout anywhere and fans out heavily in parallel
(listItems ≈ 2+3N requests for N items — ~400 for this account; getDocument
= one GET per file), so a single dropped connection among hundreds — most
plausibly undici's stale keep-alive socket reuse (known Node 20 behavior),
with host egress blips as co-factor — rejects the whole call as an
undiagnosable `TypeError: fetch failed`. reMarkable's hosts are IPv4-only,
ruling out happy-eyeballs.

- `withNetRetry` wraps listItems / getRootHash / getDocument: up to 2
  retries (1s/3s) on transient socket/DNS/5xx failures only.
- `safeRemarkableError` now surfaces the real errno from `err.cause` —
  including the AggregateError shape (`cause.errors[].code`) — so the next
  banner says WHY (e.g. `fetch failed (ECONNRESET)`).
- Sweep failure backoff 30 → 10 minutes (in-call retries absorb the
  sub-second races; the outer backoff is for real outages), the sync error
  gets a step prefix ("listing notebooks failed: …"), and "last check" now
  updates on failed attempts too instead of freezing at the last success.


## 2026-07-03 (reMarkable sync — defer profile folds until the notebook settles)

The review on PR #92: with the 5-minute quiesce, a premature pass can OCR a
half-written page. The PAGE text self-corrects (the settled re-OCR replaces
it wholesale) but `updateSelfModel` is append-only — a garbled half-sentence
folded into the long-lived profile can't be unfolded. Now ingest stays fast
(text reaches chat search in ~5-10 min) but the PROFILE fold waits until the
notebook has been quiet for 30 minutes: pages ingested earlier are marked
`pages.profile_fold_pending` and a later sweep folds their (by then final)
text — including leftovers whose ink never changed again, swept up on the
next settled pass. Fold failures keep the sync cursor open for retry without
blocking the doc-hash advance.


## 2026-07-03 (reMarkable sync — quiesce window 15 → 5 minutes)

Owner-requested: write → close the cover → chat-ready in ~5-10 minutes.
Safe because page-level diffing makes a premature pass cost cents (a
still-growing page simply re-OCRs once it settles), and the tablet's own
upload delay after the cover closes adds a natural buffer.


## 2026-07-03 (reMarkable sync — edits fully propagate)

Editing an already-synced page on the tablet now propagates EVERYWHERE, not
just to the page text. A stale-cache sweep of every derived store found two
gaps (all others — FTS, embeddings, /mind analysis + entities, profile fold,
per-day markdown, notebook.pdf — were already invalidated):

- **Cached daily summaries are invalidated for touched days.** The generator
  only fills days with no cached row, so chat's `get_day_summary` /
  week/month tools would have served the OLD text forever after an in-place
  re-OCR. The sync now deletes summaries for the delta (before/after date
  sets + old/new dates of re-OCR'd pages); the next sweep regenerates them.
- **A date-move rewrites the old day's Dropbox file.** If a re-OCR changes a
  page's parsed date from day A to day B, A.md was no longer in the
  notebook's affected set and kept the old text. `maybeExportDiaryToDropbox`
  accepts `extraDayFiles`; the sync passes the notebook's pre-update day
  files.
- **Review (PR #90, P1): legacy folder-setting conversion is persisted.** The
  array→map upgrade computed a fresh enabledAt on every read without saving
  it — a perpetually moving cutoff that would have skipped every new
  notebook forever. It now writes the converted map back on first read.


## 2026-07-03 (reMarkable sync — folder enablement means "from now on")

Enabling auto-sync on a folder no longer backfills its archive. The owner's
Diary folder holds 38 notebooks; the previous behavior would have silently
re-transcribed years of diaries (a surprise OCR bill + mass duplication of
notebooks already ingested via Dropbox). Enabled folders now store their
enable timestamp ({ parentId: enabledAtISO }; legacy array parses as
enabled-now), and a not-yet-imported notebook is auto-imported only when
edited AFTER that moment. Already-imported notebooks are followed regardless
(their row is the subscription); historical ones remain a deliberate Import
tap away.


## 2026-07-03 (reMarkable sync — always-visible Automatic sync toggles)

The Auto-sync switch was hidden behind selecting a folder chip and the
section intro still claimed "automatic import is the next step" — the owner
couldn't find the zero-tap feature that had already shipped. Now: honest
intro copy, and an always-visible "Automatic sync" block listing every
folder as a tappable ON/off pill (replaces the chip-gated toggle). Quiesce
window shortened 30 → 15 minutes so a finished entry reaches chat sooner —
page diffing makes a premature pass cost pennies.


## 2026-07-03 (reMarkable sync — review fixes on PR #87)

- **Enabling a folder invalidates the root cursor.** The rootHash fast-path
  compares against the CLOUD's change counter, which knows nothing about
  local subscription changes — enabling auto-sync on a folder now clears the
  stored cursor so its notebooks import on the next pass instead of waiting
  for an unrelated account edit.
- **Errored notebooks are retried by the sweep.** "Unchanged" now requires a
  hash match AND a healthy row; an import whose OCR failed (same stamped
  hash, no transcription) falls through to a fresh incremental pass instead
  of being stranded forever.
- **Sweep-discovered notebooks are per-page from birth.** New notebooks in an
  auto-synced folder now ingest through the incremental engine (per-page rows
  + sha256 hashes up front, budget-sliced) instead of the whole-PDF import
  path — whose rows would have forced a full re-OCR restructure on the first
  later edit, defeating the Phase 2 cost-control guarantee. A shared per-doc
  import lock prevents a concurrent user Import tap from duplicating the row,
  and a whole-notebook PDF is refreshed on disk after content changes so
  "View PDF" works for sweep-created notebooks too.


## 2026-07-03 (reMarkable cloud — Phase 2: zero-tap sync)

The quality gate passed (the cloud render now transcribes at parity with the
Dropbox path — remaining diffs are bidirectional OCR noise, and the cloud
copy is MORE complete than stale Dropbox exports). This ships the loop the
whole feature was for: write on the tablet → close the cover → the diary
appears in Remarkabler (and the per-day Dropbox markdown) automatically.

- **`lib/remarkableSync.ts`** — `maybeSyncRemarkable()` fired from
  `runMaintenanceSweep` (lazy-required, like the Dropbox watcher). Scope:
  previously-imported notebooks + folders the user enables via the new
  Auto-sync toggle (never all notebooks). Cost control is page-level
  diffing — `pages.remarkable_page_id` + sha256 of the raw `.rm` bytes
  (`pages.remarkable_page_hash`); only new/changed pages are rendered and
  OCR'd (a daily session = 1-2 pages), with per-page failure isolation.
  Ordering re-syncs from cloud page order every sync; tablet-deleted pages
  are kept (append-only), ordered last. Guards: in-flight flag, 5-min
  interval, 30-min failure backoff, 30-min quiesce window (don't OCR a
  mid-writing session), account rootHash fast-path whose cursor advances
  only when every candidate settled, and a per-sweep OCR budget.
- Post-ingest parity with `processNotebook`: FTS upsert, entry-date parse +
  global carry-forward, Voyage embeddings, profile fold (update-only),
  /mind analyzePending, per-day Dropbox markdown refresh — all best-effort.
- Legacy Phase-1b imports (whole-PDF page rows) restructure to
  per-tablet-page rows on their first incremental sync (one-time re-OCR).
- **`POST /api/remarkable/autosync`** `{ parent, enabled }` + Auto-sync
  toggle on `/memory` when a folder chip is selected; `/api/remarkable/status`
  now includes sync status (folders, last run, last note/error).
- Pure `diffRmPages` / `orderPagesKeepStale` with 7 tests (suite 270).
- Adversarially reviewed before merge; 6 findings fixed: atomic
  insert-then-delete swap (a crash mid-OCR can never destroy previously
  transcribed pages — all network work happens before one DB transaction),
  doc-hash advances only on a fully-clean pass (failed pages retry instead
  of silently dropping), budget slicing instead of a permanent
  over-budget throw (legacy restructures bypass the sweep budget once,
  capped at 150 pages), stale `/mind` analysis/entities cleared + embedding
  nulled on re-OCR, a per-doc-id in-flight set so the sweep and a user tap
  can't double-import, and `status='processing'` set before the download so
  a concurrent force re-import backs off.


## 2026-07-03 (reMarkable compare — carry dates forward; the "missing" section wasn't missing)

Fourth quality-gate run still reported the 2026-06-03 second half missing —
but the View PDF diagnostic had already shown it rendered. Root cause was in
the COMPARE, not the pipeline: since the tall-page split, that section lands
on its own header-less PDF page, stored with entry_date='none'; the compare
grouped by stored entry_date only, silently dropping continuation pages from
both sides. `compareImportedNotebook` now groups by EFFECTIVE date via the
same `carryForwardDates` rule as the diary export (existing side fetched
whole and filtered after carry-forward, since a continuation page's date only
exists post-carry). Per-day/total caps raised to 8K/100K chars so long days
can't tail-truncate. +3 regression tests (suite 263).


## 2026-07-03 (reMarkable renderer — darken pale ink colors for OCR)

Breakthrough via the new View PDF diagnostic: the "missing" 2026-06-03
section IS in the rendered PDF — written in pale CYAN/GRAY ink (rmc maps
CYAN to (139,208,229), GRAY to (144,144,144)), rendered thin and light,
then downscaled by vision OCR into illegibility. The transcription silently
skipped it on all three runs; reMarkable's native export renders colored
ink bolder, which is why the Dropbox path kept it. (The earlier typed-text
/fonts theory was wrong for this content — it's handwritten; the fonts stay
as insurance for genuinely typed text.)

`docker/rm2pdf` now darkens pale opaque stroke colors (luminance > 0.45 →
scaled to 0.32, hue preserved) in the SVG before PDF conversion — this copy
of the page exists only to be OCR'd, so legibility beats color fidelity.
Exceptions: semi-transparent strokes (real highlighters drawn OVER text)
and white ink (covers mistakes) are never darkened. Verified: pale
cyan/gray darken; black/blue unchanged; highlighter + white untouched;
real highlighter sample renders end-to-end unchanged.


## 2026-07-03 (reMarkable renderer — CJK fonts + View PDF diagnostic)

Third quality-gate run still lost the same 2026-06-03 section (so it wasn't
tall pages either, for that notebook). Next suspect, now backed by a local
repro: TYPED text (Type Folio / convert-to-text) on a reMarkable page renders
via SVG `<text>` + system fonts — and the slim runner image ships no fonts,
so a typed Korean passage becomes unreadable tofu boxes in the PDF and
silently vanishes from the transcription. Handwritten strokes are vector
polylines and never touch fonts, which is why everything else survived.

- **Dockerfile**: runner now installs `fontconfig` + `fonts-noto-cjk` +
  `fonts-noto-core` so typed Korean/English renders properly.
- **`GET /api/notebooks/[id]/pdf`** serves any notebook's stored source PDF
  inline (auth-gated, id must exist in `notebooks`), plus a "View PDF" link
  per notebook on `/notebooks` — the ground-truth diagnostic that separates
  "renderer dropped it" from "OCR misread it".


## 2026-07-03 (reMarkable renderer — split vertically-extended pages for OCR)

Second quality-gate run: the SAME section of 2026-06-03 was still missing
after the rmscene upgrade, and a 2026-05 notebook graded "much worse" with
entries cut off partway ("below the fold") while page counts stayed intact
(20/20). Root cause: a reMarkable page the user extends by scrolling renders
as ONE PDF page 2-3+ screens tall; vision OCR downscales each page to a fixed
resolution, so the lower half's handwriting shrinks below legibility and is
misread or skipped. reMarkable's own export splits extended pages, which is
why the Dropbox path kept that content.

- `docker/rm2pdf` now slices pages taller than 1.35 screen-heights into
  screen-height PDF pages (4% overlap so a boundary-cut line stays readable;
  a final sliver adding <15% of a screen folds into the previous slice).
  Normal pages pass through untouched. Verified: normal sample stays 1 page;
  a synthetic 3-screen page splits into 3 slices with full coverage, no gaps,
  no sliver; the renderNotebookToPdf chain handles multi-page outputs (pypdf
  append concatenates all pages).
- No app-code change needed — page_index/entry-date carry-forward already
  handle a notebook yielding more PDF pages than tablet pages.


## 2026-07-03 (reMarkable renderer — rmscene 0.8.0 + force re-import)

The first real quality-gate run (user's June diary, 6 overlapping days) came
back "B slightly worse": word-level OCR noise both ways, but one entry
(2026-06-03) lost its entire second half. Root cause suspect: `rmscene 0.6.1`
warns `data has not been read... newer format` on 2026-firmware pages and
silently drops those strokes. Fixes:

- **Dockerfile: rmscene overridden to 0.8.0** past rmc 0.3.0's `<0.7` cap —
  verified on real samples that the combo renders identical strokes (only
  z-order shifts), the unread-data warnings disappear, the rm2pdf chain works,
  and the palette patch still applies. A build-time import asserts the
  override took.
- **Force re-import**: `importRemarkableNotebook(..., { force })` +
  `force: true` on `POST /api/remarkable/import` skip the same-hash
  "unchanged" shortcut; the UI offers "Re-import anyway (re-render +
  re-transcribe)" after an unchanged result — needed because a renderer
  upgrade improves the PDF without the cloud hash changing.

## 2026-07-03 (reMarkable import — one-tap quality-gate Compare report)

The Phase 1b gate needs the user to judge whether the cloud render OCRs as
well as the Dropbox path — but the corpus lives on the server, so the
comparison should too. New `lib/remarkableCompare.ts` pairs an imported
notebook's pages with existing non-cloud pages on the SAME entry dates
(discipline notebook excluded), truncates per day, and has the chat model
judge the two transcriptions (`compareTranscriptions` in `lib/claude.ts`,
usage recorded as `remarkable_compare`). Exposed as
`POST /api/remarkable/compare` + a per-row "Compare" button on `/memory`
that prints the verdict inline (days compared, per-day differences, days
present only in the import). Fail-soft messages for every miss case (not
imported, still transcribing, errored, no dated entries, no overlapping
dates).

## 2026-07-03 (reMarkable import — review fixes on PR #78)

- **Failed imports are recoverable.** The dedupe no longer treats a same-hash
  notebook whose OCR ended in `status='error'` as "unchanged" — that made a
  failed import permanently unretryable from the UI. Error rows now fall
  through to the replace path, so tapping Import re-renders and re-OCRs them.
- **The all-`.rm` fallback is limited to unreadable `.content`.** When the
  page order parsed but yielded no importable pages (empty/all-deleted order,
  or active ids matching no `.rm` — blank pages), we now report "no drawn
  pages" instead of name-sort-importing every `.rm` blob in the ZIP, which
  could resurrect deleted pages.

## 2026-07-03 (reMarkable cloud — folder chips + readable dates on the import list)

With 134 notebooks in the account, the flat unsorted list buried the user's
Diary folder. Now: `filterNotebooks` resolves each notebook's containing
folder name from the CollectionType entries in the same listing (new `folder`
field), normalizes reMarkable's epoch-ms/s `lastModified` to ISO (it rendered
as a raw number like `1780801738496`), and sorts newest-first. `/memory` shows
tappable folder filter chips (e.g. "Diary (31)") above the list and a
`folder · edited <local time>` line per row. Old persisted lists (no folder
data) degrade gracefully until the next "Check again". Tests +3 (suite 260).

## 2026-07-02 (reMarkable cloud — Phase 1b: render + on-demand import, quality-gated)

On-demand import of ONE cloud notebook, behind a human quality gate: pull the
raw `.rm` pages, render them to a PDF, and feed that into the SAME
createNotebook/processNotebook OCR pipeline as a Dropbox export. The owner
compares the result to their trusted Dropbox path before we build scheduled
polling (Phase 2). Whole-notebook render + re-OCR; incremental page-diffing is
deliberately Phase 2, not here. The Dropbox one-tap path is untouched.

- **`lib/rmRender.ts`** — renders an ordered list of `.rm` pages to one merged
  PDF via the image's `rm2pdf` wrapper (per page) + `pypdf` (merge). Per-page
  failure isolation: a page that fails to render is skipped and reported, never
  aborting the notebook. `renderersAvailable()` is false outside the Railway
  image, so local dev / CI / `npm run build` never touch a real render and the
  importer returns an actionable "renderer not deployed" message instead of
  crashing. **Verified end-to-end** against the real toolchain (rmc + cairosvg
  + pypdf) on real firmware-3.x `.rm` samples, including a highlighter
  (color-id-9) page and the fail-isolation + all-fail paths.
- **`lib/remarkableCloud.ts`** gains `downloadNotebook(id, hash)` (getDocument
  → unzip with jszip → ordered `.rm` bytes; page order from the `.content`
  `cPages.pages[]`, legacy `pages[]` fallback, name-sorted last resort) and the
  pure, unit-tested `orderedPageIdsFromContent`. It now also persists the
  listed notebooks (bounded) so the UI can show them + Import buttons on load;
  `remarkableStatus()` returns `notebooks[]`.
- **`lib/remarkableImport.ts`** — `importRemarkableNotebook(id, hash, name)`
  orchestration + dedupe. Mirrors the Dropbox call sequence (createNotebook →
  stamp origin → un-awaited processNotebook). Dedupe via new
  `notebooks.remarkable_doc_id` / `remarkable_doc_hash` columns: same id+hash →
  skip (unchanged); same id, new hash → replace (delete old, re-import) — the
  destructive replace happens ONLY after a new PDF renders, so a failed
  re-import never destroys the prior copy.
- **`POST /api/remarkable/import`** `{ id, hash, name }`; `/memory` lists each
  paired notebook with an Import button (per-notebook busy/status, separate
  from the section-wide flag) and copy framing it as the compare-to-Dropbox
  quality check.
- `jszip` promoted to a direct dependency. New columns + partial index in
  `lib/db.ts`. Tests: +6 for `orderedPageIdsFromContent`. Suite 257; build
  clean.

## 2026-07-02 (reMarkable cloud — Phase 1a: Dockerfile + renderer toolchain)

Deploy-system switch, shipped ALONE (staged) so it can be verified on
Railway before any render/ingest code lands on top. No behavior change to
the app itself.

- **`railway.json` builder NIXPACKS → DOCKERFILE.** Railway now builds from
  the new multi-stage `Dockerfile` (base `nikolaik/python-nodejs`; builder
  compiles better-sqlite3 + runs `next build`, slim runner). Reverting is a
  one-line change back to NIXPACKS; the previous config is in git history.
- **Bundled `.rm` renderer** (unused until Phase 1b): a Python venv at
  `/opt/renderer` with `rmc` + `rmscene` + `cairosvg` (+ `svglib`/`reportlab`
  fallback), plus `docker/rm2pdf` (`.rm` → SVG → PDF wrapper on PATH) and
  `docker/patch_rm_palette.py`, which restores the firmware-≥3.14 highlighter
  color id (9). Verified against a clean PyPI `rmc==0.3.0`: its palette really
  does omit id 9 (13 keys, 9 absent; only a `#! PenColor.HIGHLIGHT` comment
  remains), so highlighter-colored strokes would `KeyError: 9`. The patch is
  necessity-gated on the *live* `RM_PALETTE` dict — it inserts only when 9 is
  missing and no-ops (no duplicate key) once present — which also fixes the
  earlier silent-no-op guard that matched that same comment string. Renderer
  proven end-to-end (build + boot + render) in a sandbox worktree earlier this
  session.
- `.dockerignore` keeps `.env`, `data/` (the SQLite diary + tokens), `.git`,
  and `node_modules` out of the image. Empty `docker/certs/` CA hook is a
  no-op on Railway.
- App suite unchanged and green (251). NOTE: the Docker image build itself
  is verified on Railway (a running Docker daemon + apt/pip egress aren't
  always available in the dev sandbox).

Next: Phase 1b — `lib/rmRender.ts` + on-demand single-notebook import behind
the quality gate.

## 2026-07-02 (reMarkable cloud — Phase 0: pair + read-only listing)

First step toward zero-tap ingest (write on the tablet → close the cover →
everything else happens automatically), without the "Export to Dropbox"
tap. Phase 0 is read-only and safe: it proves we can reach the user's
reMarkable cloud account before any ingestion/rendering is built.

- `lib/remarkableCloud.ts` on `rmapi-js` (maintained, pure-JS, ESM;
  externalized in next.config): `pairRemarkable(code)` exchanges a one-time
  code from my.remarkable.com/device/browser/connect for a long-lived
  device token (stored in `settings`, redacted from backups),
  `listRemarkableNotebooks()` lists handwritten notebooks (filtered:
  DocumentType + fileType notebook, not trash), `remarkableStatus()`,
  `unpairRemarkable()`. Fail-soft; errors recorded, never thrown.
- Routes: `POST /api/remarkable/connect` (pair + list), `/refresh`
  (re-list), `/disconnect`, `GET /status`.
- `/memory` gets a "reMarkable cloud (beta)" section: paste the code →
  "Paired ✓ — found N notebooks", with Check again / Disconnect. Clear
  copy that it's read-only for now and Dropbox keeps working.
- Groundwork validated by research + sandbox proofs (not shipped yet):
  `rmc`+`cairosvg` render real v6 `.rm` → PDF; page-level content hashes
  from rmapi-js enable incremental sync. Phase 1 (renderer + Dockerfile,
  behind a quality gate) and Phase 2 (polling) come next.
- 4 pure tests for the notebook filter (`test/remarkableCloud.test.ts`);
  suite 251. lint + build clean.

This rides reMarkable's unofficial protocol, so it's a SECONDARY source —
the Dropbox one-tap path remains the reliable fallback, untouched.

## 2026-07-02 (Date parser: tolerate spaced separators in the header)

The per-day export filed a real entry into `undated.md` instead of
`2026-07-02.md`. Cause: the user's handwritten header is
`2026-07-02 - 17 - 19 - KST` (spaces around the dashes), but
`extractEntryDate`'s pattern required tight separators, so it didn't
match → `entry_date = 'none'`.

- `extractEntryDate` now allows `\s*` around every separator, so spaced
  (`2026-07-02 - 17 - 19 - KST`), fully-spaced
  (`2026 - 07 - 02 - 17 - 19 - KST`), and the existing tight/colon/T forms
  all parse. +3 tests (12 total).
- `/api/mind/reparse-dates` now fires a background diary export when it
  actually changes any dates — so re-parsing (which moves entries out of
  `undated.md` into real day files) refreshes Dropbox in one tap instead
  of also hopping to /memory → "Export now".

To pick up an already-ingested entry that landed in `undated.md`: after
this deploys, `/mind` → "Re-parse dates" reclassifies it and pushes the
new per-day file to Dropbox automatically.

## 2026-07-02 (Diary export: resilient full sync)

The first full sync could leave the Dropbox folder incomplete: the upload
loop **aborted on the first per-file error**, so one transient Dropbox
blip (or a write-rate 429 during a bulk sync) stranded every remaining
day. Hardened:

- `uploadTextFile` now retries up to 3× on 429 / 5xx, honouring
  `Retry-After` — bulk syncs trip Dropbox's write-rate limit.
- The export loop **continues past a per-file blip** (skips + counts it)
  instead of aborting; only a scope/auth failure (which would hit every
  file identically) stops it early with the actionable message.
- 150 ms spacing between uploads to stay under the write-rate limit; the
  "last saved" marker advances per file so a long sync shows progress.
- Result reports `written` + `failed`; a partial run says
  `"N saved, M failed … tap Export now to retry the rest"`, and re-tapping
  is idempotent (overwrite), so repeated taps converge to complete.

## 2026-07-02 (Diary auto-export is now one Markdown file per day)

Changed the Dropbox auto-export from a single `diary.md` to **one file per
day** in a folder (`/Remarkabler/diary/2026-06-19.md`, … + `undated.md`) —
a proper daily-notes vault for Obsidian, and a cleaner backup layout.

- New pure builders in `lib/diaryExport.ts`: `buildDayFiles` (filename→md
  map), `effectiveDateKeys` (which days a notebook touches, via
  carry-forward). `buildDiaryMarkdown` (the combined single doc) stays for
  the download button.
- `lib/diaryExportDb.ts`: `renderDiaryDayFiles` + `affectedDayFileNames`
  alongside `renderDiaryMarkdown` (shared `fetchDiaryData`).
- **Efficient incremental upload.** After each ingest, only the day files
  that notebook actually touched are re-uploaded (usually 1–5), not the
  whole vault (`maybeExportDiaryToDropbox({ notebookId })`).
- **Timeout-safe full sync.** The `/memory` toggle / "Export now" probes
  write access with a single-file upload (instant scope feedback), then
  runs the full every-day sync in the background so a multi-year diary
  can't blow the request budget.
- Export target is now a folder setting (`dropbox_export_folder`, default
  `/Remarkabler/diary`); status exposes `exportFolder`. Any old
  single-file `diary.md` is left in place — harmless; delete it if you like.
- 11 new tests (per-day builders + DB renderers + affected-names). Suite
  244. `npm run lint` + `npm run build` clean.

The download button (`GET /api/export/diary`) is unchanged — still one
combined file (a single HTTP response can't be a folder without a zip).

## 2026-07-02 (Automatic diary Markdown export back to Dropbox — opt-in)

Makes the diary Markdown export *automatic*: after each notebook is
ingested + OCR'd, Remarkabler regenerates the diary and writes it back
into Dropbox as `/Remarkabler/diary.md` (overwrite). So the portable
text copy stays current with no manual "Download" tap.

- **Opt-in, and needs one new Dropbox scope.** The Dropbox app is
  read-only by design (`files.metadata.read` + `files.content.read`).
  Writing back needs `files.content.write` added in the Dropbox app
  console + a reconnect. Off by default (`dropbox_export_enabled`); the
  Memory → Dropbox section has a toggle + "Export now" + last-saved
  status. If the scope is missing, the export fails-open with an
  actionable message ("enable files.content.write, then reconnect") — it
  never breaks ingest.
- `maybeExportDiaryToDropbox` (in `lib/dropbox.ts`) is fired from
  `processNotebook`, so both Dropbox ingests and manual uploads refresh
  the export. Best-effort + in-flight-guarded.
- New `uploadTextFile` (Dropbox `/2/files/upload`, overwrite) — the only
  write call in the integration.
- New `POST /api/dropbox/export` (`{ enabled?, runNow? }`) toggles + tests.
- Rendering is shared with the download route via
  `lib/diaryExportDb.ts:renderDiaryMarkdown` (DRY) — same output both
  ways, discipline notebook excluded, dates carried forward.
- 4 new DB-backed tests in `test/diaryExportDb.test.ts` (discipline
  exclusion, carry-forward, entity/theme rendering, empty diary). Suite
  233. `npm run lint` + `npm run build` clean.

Ingest remains strictly read-only; only this opt-in export ever writes.

## 2026-07-02 (Diary export follow-ups from review of #69)

Two P2 correctness fixes the review caught on the diary-export PR:

1. **Exclude the discipline notebook.** The GitHub "discipline" sync
   stores repo text files as `pages` under `notebook_id = DISCIPLINE_ID`
   (`github-discipline`) — not diary content, and `/mind` already excludes
   it. The diary export selected every page, so those files leaked into the
   download (as "Undated entries"). The route now filters
   `p.notebook_id != DISCIPLINE_ID` unconditionally.
2. **Carry entry dates forward in the export.** A freshly processed
   multi-page notebook keeps `entry_date = 'none'` on continuation pages
   until a `reparseAllEntryDates` sweep runs, so exporting before that
   scattered a session's later pages into "Undated entries" out of order.
   `buildDiaryMarkdown` now carries the last-seen date forward within each
   notebook (read-only, mirroring `reparseAllEntryDates`), so continuation
   pages land under their day. New `carryForwardDates` helper, unit-tested
   (17 tests total in `test/diaryExport.test.ts`).

`npm run lint` + `npm test` (229) + `npm run build` clean.

## 2026-06-25 (Diary Markdown export — portable, tool-agnostic backup)

New **`GET /api/export/diary`** + a "Download diary (Markdown)" button in the
Memory page's Export section. Produces a single Markdown file of *just* the
transcribed diary — one YAML frontmatter block, then per-day `##` sections
ordered by `pages.entry_date` (oldest first), each page tagged with an
italic metadata line (notebook · themes · sentiment · people/places/
projects, all optional). Pages with no parseable diary timestamp land in a
dedicated "Undated entries" section grouped by notebook.

**Why:** the diary previously lived only inside SQLite on Railway. This is
a plain-text copy the user owns — drop it into Obsidian, upload it to Google
NotebookLM for an audio "podcast" overview of a month, or keep it as offline
backup insurance. No LLM calls (zero cost), no external writes.

**Why not auto-write to Dropbox** (the original idea): the Dropbox app is
deliberately scoped read-only (`files.metadata.read` + `files.content.read`)
as a hard-won least-privilege rule — writing back would require adding write
scope + re-authorising + weakening that guarantee. A download sidesteps all
of that. Auto-commit to the GitHub backup repo (which already has write
creds) remains a possible future upgrade, as does per-day file splitting via
a zip (deferred — would add a dependency).

Assembly is a pure function in **`lib/diaryExport.ts`** (`buildDiaryMarkdown`,
`isDatedEntry`, `parseThemes`) so the grouping/ordering/rendering is
unit-tested without Next — 12 tests in `test/diaryExport.test.ts`. The route
only authenticates, queries, and shapes rows. `npm run lint` + `npm test`
(224) + `npm run build` clean.

## 2026-06-21 (Fix: pending chat-memory batches stuck without recourse)

The /memory page kept showing "1 pending" for a full day. Three pieces:

- **`compressionInFlight` was a bare boolean.** If a sweep hung mid-await
  (Claude SDK has no explicit timeout, defaults to 10 minutes; process
  killed mid-call without running the `finally`) the lock stayed `true`
  for the life of the process and every subsequent sweep silently
  no-op'd. Replaced with a `compressionStartedAt` timestamp +
  `COMPRESSION_INFLIGHT_TIMEOUT_MS = 5 min` — any lock older than that
  is considered stale and the next caller proceeds.
- **`compressChatSession` had no explicit timeout** on the Anthropic
  `messages.create` call. Added a 60s timeout so a stalled HTTP fails
  loudly (increments `failed_attempts`) rather than holding the sweep
  open for the SDK's 10-minute default.
- **No UI for "just pending" (non-stuck) batches.** The existing "Retry
  stuck batches" button only fires when `failed_attempts >= 2`, so a
  batch sitting at `failed_attempts < 2` with no error had no
  surfacing and no nudge. Added:
  - `pendingBatchDetails()` exposed via the `/api/chat/memories` GET
    response (`pending_batch_details[]` — id, age, message count, char
    count, attempts, last error).
  - `POST /api/chat/memories/process` — force-clears the in-flight
    guard and awaits a sweep so the caller sees the real result.
  - `/memory` page: an amber pending-batches block with per-batch
    detail + a "Process pending now" button, plus reassurance copy
    that the underlying chat messages are preserved either way.

Chat messages are **never** deleted by the extraction flow. Clear sets
`archived_at` only; backfill `?reset=true` preserves rows and just
NULLs `archive_batch_id`; permanent-skip doesn't touch messages. The
record stays even when extraction can't recover.

## 2026-06-20 (Fix: chat memory the user can see but Claude couldn't)

**Bug:** durable chat memories were visible on `/memory` (e.g. a confirmed
Wuhan/Shanghai business trip) but Claude answered "I can't find your trip"
in chat. Root cause: recall was gated *entirely* on semantic embedding
similarity. A memory only reached Claude if Voyage was reachable that turn,
the stored row had a non-NULL embedding, AND its cosine to the current
message cleared 0.4 and made the top-5. Two ways that failed:

- **NULL embeddings on the rows.** `compressBatch` embedded each extracted
  item with a separate Voyage call in a tight loop (up to 7 per cleared
  chat). Voyage's free tier is 3 req/min, so the later calls 429'd, were
  swallowed to null, and the memory was stored with no embedding —
  permanently excluded from recall (`WHERE embedding IS NOT NULL`).
- **Phrasing/threshold mismatch.** "Where am I going tomorrow?" is about
  timing; the memory reads "Wuhan/Shanghai itinerary…". Cosine could fall
  under 0.4 and get dropped even with a good embedding.

**Fixes (`lib/chatMemory.ts`):**

- **Recall is now include-all for a small corpus.** Up to
  `RECALL_INCLUDE_ALL_MAX` (30) non-deleted memories, embeddings are used
  only to *order* (most-relevant first), never to *exclude*. They all fit
  in the prompt budget anyway, so gating could only hurt. At larger scale,
  semantic top-K still applies but always blends in a most-recent floor so
  brand-new memories are never invisible. Recall now **degrades to recency,
  not emptiness**, when Voyage is unavailable. Raised `MAX_RECALL_CHARS`
  2000 → 4000 so the include-all set fits.
- **Write side no longer trips the rate limit.** `compressBatch` embeds all
  extracted items in ONE `embedBatch` request instead of N sequential
  calls, so memories keep their embeddings.
- **Self-healing for existing bad data.** New `reembedMissingMemories` runs
  in the memory sweep (`maybeCompressChatSessions`) and fills in embeddings
  for any NULL-embedding rows, one batched Voyage call at a time.

Recall tests rewritten to pin the corrected contract (NULL-embedding and
sub-threshold items are surfaced; fail-open means recency; large-corpus
blend). `npm run lint` + `npm test` (208) + `npm run build` clean.

## 2026-06-20 (UI refresh: single-font Clear Sans + design tokens)

First pass of an editorial UI refresh. Replaces the implicit "system
fonts + inline class strings" state with an explicit design system:

- **One font, self-hosted.** Clear Sans (Intel, Apache-2.0) loaded
  via `next/font/local` from `public/fonts/` (~90 KB across four
  faces — 400 / 400 italic / 500 / 700). No build-time or runtime
  external font requests. Replaces the system-font default.
- **`.font-semibold` remapped to weight 500.** Clear Sans has no
  600 face; rather than letting the browser auto-bold from 700 (which
  reads heavier than the previous system-font semibold did), a single
  CSS rule in `app/globals.css` maps `font-semibold` to 500 Medium.
- **Amber accent.** Tailwind's built-in `amber` scale aliased as
  `accent` in the tailwind config. Used for the active-nav underline
  and the `:focus-visible` keyboard ring. Same shade the cost calendar
  already uses, so chart strokes now read as part of the system.
- **Active nav state.** New `app/Nav.tsx` (client component, extracted
  from the inline nav in `app/layout.tsx`) shows an amber underline on
  the active route. Transparent border on inactive items prevents
  layout shift on transition. `layout.tsx` stays a server component.
- **Shared UI components** under `components/`: `cn`, `Button` +
  `LinkButton`, `Card`, `Section` (lifted from `app/mind/page.tsx`),
  `Stat` (de-duplicates the inline copies on `/` and `/usage`),
  `Badge`. Server-safe, hook-free, no new deps.
- **`leading-relaxed` on long-form reading surfaces** (chat assistant
  bubbles, insight body, home insight preview, getting-started list).
  Memory profile textarea already had it.
- **44px tap-target floor on touch** (was 40px). Applied only to
  buttons / `[role=button]` / `type=button|submit` — inline `<a>`
  prose links unaffected.
- **`prefers-reduced-motion` guard** disables `scroll-behavior: smooth`
  when the user has motion reduction on.
- **New `DESIGN.md`** at repo root captures the tokens, the `font-semibold`
  remap, and the do-not-regress rules. **New `docs/design/mockup.html`**
  is a self-contained light-and-dark visual reference for the same
  tokens (open in a browser; loads Clear Sans via @fontsource on jsdelivr
  for preview only).
- Updates `SKILL.md`, `AGENTS.md`, `CLAUDE.md` to reference `DESIGN.md`
  and document the do-not-regress rules.

Verified: `npm run lint`, `npm run build`, `npm test` (206 passed) all
clean. `app/mind/Map3D.tsx` deliberately untouched.

## 2026-06-20 (Tier-2: cleanup — shared helpers, schema constraints, docs)

Follow-up to Tier-1 (PR #50). Same review pass, lower severity — cleanup
that compounds as the codebase grows.

### Tightened `pages_for_entity` ordering

Within-date tie-break changed from `p.page_index DESC` to `p.page_index ASC`
so a multi-page same-day diary entry surfaces in natural reading order
(page 1 → 2 → 3 → …) rather than reverse (last page first). Claude was
reading conclusions before setups. New regression test pins the new
behavior.

### Schema constraints: UNIQUE + CHECK on `entry_entities`

Added `CHECK(kind IN ('person', 'place', 'project'))` to the table
definition and `CREATE UNIQUE INDEX idx_entry_entities_unique
ON entry_entities(page_id, kind, name_norm)`. Includes a one-time dedup
pass before the index creation in case any existing deployment has
edge-case duplicates. Combined with `INSERT OR IGNORE` in
`analyzePending`'s entity insert, the runtime invariant ("one
(page, kind, name_norm) per page") is now enforced by the schema, not
just by the caller's discipline.

### Shared discipline-filter helper

The `excludeId = isDisciplineEnabled() ? "__none__" : DISCIPLINE_ID`
pattern was inlined at 8 sites in `chatTools.ts` plus a different
posture in `lib/mind.ts`. Extracted to two helpers in `lib/notes.ts`:

- `disciplineExcludeIdForChat()` — for chat tools, respects the toggle
- `disciplineExcludeIdForMind()` — for `/mind` surfaces, always excludes

The sentinel string `"__none__"` now lives in one place. The split
between the two helpers makes the chat-vs-mind policy difference
intentional and discoverable, instead of an accidental divergence.

### `pages_for_entity` uses the shared `normaliseEntityName`

Was inlining `rawName.toLowerCase().replace(/\s+/g, " ").trim()`. Now
calls the exported `normaliseEntityName` from `lib/mind.ts` so the
writer side and reader side can't drift.

### `EntityRank` type imported, not redeclared

`app/mind/page.tsx` was declaring its own `EntityRank` shape. Now
imports `type { EntityRank } from "@/lib/mind"`.

### Stale comment fixed in `lib/db.ts`

The `archived_at` column comment claimed "archived messages still feed
Claude so a cleared conversation continues seamlessly." That stopped
being true when Clear became a real boundary. Comment now matches
the actual posture: archived messages are filtered from chat history;
continuity is via `chat_memories`.

### `AGENTS.md` structure map synced

Per CLAUDE.md's "Keep this in sync with the structure map in AGENTS.md"
rule, the `db.ts`, `claude.ts`, `chatTools.ts`, and
`chatMemoryBackfill.ts` rows are updated for `entry_entities`,
`top_entities`, `pages_for_entity`, and the new
`chunkedBackfillForConversation` helper.

### Tests (+1, total 206)

- `test/pagesForEntity.test.ts`: new test pinning `page_index ASC`
  within-date tie-break (5-page same-day entry should surface 1,2,3,4,5
  in that order). The previous "orders by entry_date desc, then
  page_index desc" test was relabeled to drop the page_index claim
  since its data didn't actually exercise the tie-break.

## 2026-06-20 (Tier-1: chat-memory backfill + entity write correctness)

Code review found five correctness issues across the
chat-memory layer and the new entities layer. All five are regressions
of explicit "do not regress" rules or silent-data-loss class — fixing
together in one PR.

### 1. Startup orphan migration now chunks (was creating one giant batch)

`lib/db.ts`'s one-time migration for pre-chat-memory archived chats
used to do `INSERT INTO chat_archive_batches(conversation_id) VALUES(?)`
once per conversation, then stamp every orphan archived message with
that single batch_id. Combined with `compressBatch`'s 16K-char cap, a
multi-month conversation got silently truncated to its most recent
tail — the exact bug PR #45 was meant to prevent, just at a different
code path.

Fixed by sharing the chunking logic with `/api/chat/memories/backfill-all`.
New helper `chunkedBackfillForConversation` in `lib/chatMemoryBackfill.ts`
reads un-batched messages, applies `chunkMessageIds` to split them at
the 12K-char target, and creates one `chat_archive_batches` row per
chunk via the new exported `createBatchForChunk`. Startup migration
and the route both call it now — they can't drift again.

### 2. `backfill-all` only touches archived messages

The route used to filter `WHERE archive_batch_id IS NULL` without also
requiring `archived_at IS NOT NULL`. That meant default backfill would
stamp ACTIVE (visible, never-cleared) chat messages with a batch_id —
which conflicts with the Clear route's `COALESCE(archive_batch_id, ?)`:
the user's subsequent Clear would silently fail to create its own
batch.

Fixed: both SELECT queries now require `archived_at IS NOT NULL`.
Active chat is out of scope for the memory layer — Clear is the
semantic boundary, full stop. `?reset=true` still wipes and re-runs,
but only over archived messages.

### 3. Per-page entity write is now transactional

`analyzePending`'s inner loop used to run `upsert(entry_analysis)` +
`delete(entry_entities)` + `N inserts` as separate statements. A
mid-loop throw (SQLITE_BUSY, FK race on a concurrently-deleted page,
SIGTERM during a Railway redeploy) left `entry_analysis` updated but
`entry_entities` partial — and because the pending-pages query is
`WHERE entry_analysis.page_id IS NULL`, the page would never be
retried.

Fixed by wrapping the per-page block in `db().transaction(() => {...})()`.
The whole row's write commits-or-rolls-back together; a failure leaves
the page in its pre-write state and the next sweep picks it up.

### 4. `delEntities` only fires when there ARE new entities

The same code path used to call `delEntities.run(row.id)` unconditionally
before iterating over `result.entities`. A noisy Claude response with
valid JSON but `entities: []` would silently wipe a page's previously-
good entity set — losing data based on one bad model call.

Fixed: `if (result.entities.length > 0)` guards the delete-then-insert
block. Empty is now treated as "no signal, keep the old set" rather
than "explicit instruction to clear."

### 5. Clear test helper now mirrors production SQL

`test/chatMemoryFlow.test.ts`'s local `clearChat` helper used
`SET archive_batch_id = ?`, but the real route in `app/api/chat/route.ts`
uses `SET archive_batch_id = COALESCE(archive_batch_id, ?)` (preserve
any existing batch id, e.g. one written by the backfill path). The
test never exercised the path that matters — fixed to match.

### Tests (+10, total 205)

- `test/chunkedBackfill.test.ts` (7) — multi-chunk creation for long
  conversations, single-chunk for short, `onlyArchived: true` skips
  active messages, empty conversation is a no-op, 100K-char regression
  test (specifically asked for this), empty id list, denormalised
  stats.
- `test/entityWriteAtomicity.test.ts` (3) — empty entities preserves
  old set, non-empty replaces, mid-write throw rolls back entirely.

## 2026-06-19 (Entities layer — drill-down + /mind UI)

Two follow-up improvements after the entities layer landed and the live
output looked good (Taeyoon: 25 pages, Wuhan: 4 pages, Remarkabler: 6
pages, etc.).

### `pages_for_entity` chat tool

New `lib/chatTools.ts` tool that drills down from an entity name to the
actual pages mentioning it, with excerpts and `entry_date`:

```
pages_for_entity({ kind, name, limit? })
```

Beats `search_diary` for proper nouns because it uses the structured
entity index — different spellings/transliterations are coalesced by
`name_norm`, so it won't miss pages that FTS keyword search would.
Sorts by `entry_date DESC` (with `notebooks.synced_at` fallback for
older entries that lack a parsed date).

Natural follow-up flow:

> "Who do I mention most?" → `top_entities({kind: "person"})` returns
> a ranking → user asks "What did I write about Taeyoon?" →
> `pages_for_entity({kind: "person", name: "Taeyoon"})` returns
> dated excerpts.

### `/mind` "Who, where, what" section

The top entities are now visible directly on `/mind` without going
through chat — three columns (People / Places / Projects), top 10
each. Mobile-first (stacks to one column on narrow screens).

- New `lib/mind.ts:getTopEntities(limit)` returns
  `{ people, places, projects }` in one call.
- `/api/mind` includes `entities` in its response payload.
- New `EntityRankings` component in `app/mind/page.tsx`, slotted
  between the theme cloud and the sentiment timeline.

Always excludes the discipline notebook — same posture as themes and
sentiment, which never show discipline data on `/mind`. (The chat
tools still respect the per-session toggle.)

### Tests (+16, total 193)

- `test/pagesForEntity.test.ts` (10) — name_norm casing/whitespace
  match, kind filter, ordering by date (with synced_at fallback),
  limit clamping (1-20), discipline toggle, bad-input notes, 1-based
  page numbers, empty-result message.
- `test/getTopEntities.test.ts` (6) — top-N ranking per kind,
  unconditional discipline exclusion, limit + clamping, name_norm
  coalescing, empty corpus.

## 2026-06-19 (Entities layer; Graphify evaluated and rejected)

User asked whether [safishamsi/graphify](https://github.com/safishamsi/graphify)
(a CLI + MCP knowledge-graph engine) could reduce Remarkabler's chat
token usage. After fetching the README and tracing through how it
would fit, the answer is no for three reasons documented in
`SKILL.md` → "Evaluated and rejected: Graphify": the tree-sitter
innovation doesn't transfer to diary text, retrieval functionality
already exists, and the cost math is negative at our usage.

The one focused idea worth keeping — structured entity aggregation
("who do I mention most?") — was built native as the **entities
layer**:

### Schema

New table `entry_entities` (`page_id`, `kind`, `name`, `name_norm`,
`created_at`). Many-per-page, `ON DELETE CASCADE` from `pages`. Two
indexes: `(page_id)` and `(kind, name_norm)`. Mirrors the
`entry_analysis` posture.

### Extraction

`lib/claude.ts:analyzeEntryContent` now returns
`{ themes, sentiment, summary, entities }` from the same Sonnet call —
no new model invocation, no separate pass. Cost increase ~$0.001-0.002
per page (extra ~50-100 output tokens). The new `parseAnalyzeEntryContent`
pure function isolates parsing for unit tests. `max_tokens` raised
400 → 500 to give Claude room.

Prompt addition is explicit about "do NOT extract generic words —
only concrete named items (Pastor Kim, Seoul Iris Garden,
Sermorizer)" with a small stopword list (`me`, `today`, `home`, …)
applied client-side as a backstop.

### Persistence

`lib/mind.ts:analyzePending` extends its per-page upsert loop with a
delete-then-insert for entities, plus a new exported
`normaliseEntityName` (lowercase + collapsed whitespace).

### New chat tool: `top_entities`

`lib/chatTools.ts` gets one new tool —
`top_entities({kind: "person"|"place"|"project", limit})` — that does
a `GROUP BY name_norm` aggregation across all pages and returns the
top-N by page count. Respects the discipline-notebook toggle the same
way `count_entries_mentioning` does.

This is genuinely additive vs the existing `count_entries_mentioning`:
that tool counts pages mentioning a specific term (FTS); this one
returns the *top of the ranking* without needing to know the term
upfront ("who do I mention most?" couldn't be answered by FTS
without guessing names).

### Backfill

No new endpoint needed. The existing **Re-analyse** button on `/mind`
(POST `/api/mind/reanalyze`) already re-runs `analyzePending` over
every page; once it returns entities, that single tap repopulates
`entry_entities` for the whole corpus. ~$0.18 one-time at ~92 pages.

### Tests (+23, total 177)

- `test/entryEntitiesParse.test.ts` (12 cases) — `parseAnalyzeEntryContent`
  leniency: clean parse, fence stripping, kind enum filtering, case
  normalisation, empty/oversize name rejection, stopword filter, cap
  at 12, missing/wrong-shape `entities` key, non-JSON returns null,
  original casing preserved.
- `test/topEntities.test.ts` (11 cases) — DB-backed integration:
  `name_norm` aggregation coalesces casings, top-N ordering, kind
  filter, `limit` respected, clamping, discipline toggle, invalid
  kind, empty result; plus `normaliseEntityName` sanity tests.

### Hard-won decisions

- **No entity aliasing across pages.** "Sermorizer" === "the sermon app"
  would need a separate canonicalization pass. Out of scope for v1;
  exact-norm dedup is enough.
- **No dedicated `/entities` UI.** Chat tool is the primary surface.
- **No graph edges.** Co-occurrence as a queryable relation is the
  slope toward rebuilding Graphify; explicitly deferred.

## 2026-06-18 (Chat memory)

Durable memory layer for chat, inspired by claude-mem but adapted to
Remarkabler's conversational surface. Cleared chats no longer "just
disappear" — Claude extracts a small set of durable items (preferences,
facts, intents, feelings, unresolved threads) and carries them forward
into future conversations.

### Behaviour change — Clear is now a real boundary

Before: Clear hid the chat from the UI, but Claude still saw the last
12 messages of archived history on the next turn.

After: Clear archives messages into a batch AND triggers a
fire-and-forget extraction. Future POST turns filter
`archived_at IS NULL`, so Claude no longer sees those raw messages.
Continuity comes from the compact memories instead. There's a brief
(<5 sec) window after Clear when extraction is still running and
neither raw history nor new memories cover the cleared batch; the
maintenance sweep catches any batch the inline trigger missed.

### New tables

- `chat_archive_batches` — one row per Clear, with start/end message
  ids, message count, user char count, extraction state, and bounded
  retry (`failed_attempts`, `extraction_error`).
- `chat_memories` — extracted items with category (6-value enum),
  normalised text for exact dedup, embedding for semantic recall, and
  source excerpt + batch back-reference for audit.
- `chat_messages.archive_batch_id` — column ties each archived message
  to its batch.

### New module: `lib/chatMemory.ts`

- `compressBatch(batchId)` — extract, embed, dedup, insert.
  Noise-floor guards (`MIN_MESSAGES_FOR_COMPRESSION = 4`,
  `MIN_USER_CHARS_FOR_COMPRESSION = 200`) skip without an API call.
  Bounded retry: malformed JSON gets `MAX_EXTRACTION_ATTEMPTS = 2`
  before permanent skip; a permanently-skipped batch can be reset
  via `resetBatchForRetry`.
- `maybeCompressChatSessions(limit?)` — in-flight-guarded sweep
  matching `analyzePending` in shape; fires from
  `runMaintenanceSweep` AND the chat DELETE handler.
- `recallChatMemories(message, k, minSim)` — Voyage-embedded top-K
  cosine retrieval. Fail-open: any error returns an empty list so
  chat never 500s because recall failed.
- `formatRecalledMemoriesBlock(items)` — advisory framing in the
  system prompt: "if conflicts with current message, prefer current
  information." Capped at `MAX_RECALL_CHARS = 2000`.
- `normaliseChatMemoryCategory` — folds the long tail of model
  category synonyms ("preferences", "habit", "goal", "open thread"…)
  into the canonical 6-value enum.
- `isDuplicateMemory` — exact text match via `text_norm` index, then
  cosine `>= DEDUP_COSINE_THRESHOLD = 0.88` against the existing
  active set.

### `lib/claude.ts` additions

- `compressChatSession({transcript, profile, existingMemories})` —
  privacy-aware extraction with explicit "do NOT extract" list
  (passwords, transient emotions, hypotheticals as facts, third-party
  PII).
- `parseChatMemories(raw)` — pure JSON parser, lenient (same posture
  as `parseAxisLabels`). 13 unit tests cover fenced output, embedded
  preambles, trailing commas, bare arrays, missing categories.
- `modelChatMemory()` — separate knob (`model_chat_memory` setting or
  `CHAT_MEMORY_MODEL` env var) defaulting to `modelChat()` so the
  extractor can be swapped to Haiku later without touching chat.
- `chatOverNotes` accepts a new `recalledMemories` parameter and
  injects it into the dynamic context block (never cached).

### API + UI

- `GET /api/chat/memories` — list active memories + status (total,
  last extracted, pending/stuck batches, last error, stuck batch ids
  for the retry button).
- `DELETE /api/chat/memories/[id]` — soft delete (so a future
  extraction doesn't resurface the same item).
- `POST /api/chat/memories/retry/[batchId]` — reset a permanently-
  skipped batch.
- `/memory` page — new "Chat memory" section between Backup and
  Export with status pill, filter chips (All/Fact/Preference/Intent/
  Feeling/Unresolved/Other), per-row delete, source excerpt
  disclosure, and a "Retry stuck batches" button visible only when
  there are any.

### Hard-won decisions

- **Option B for Clear semantics.** POST history filters
  `archived_at IS NULL`. Trade-off vs the brief async-gap window is
  documented above and in the plan file.
- **Bounded retry, not advance-and-skip.** A single malformed
  response no longer permanently discards a batch.
- **Privacy-aware extraction prompt.** Explicit "DO NOT extract"
  list for passwords, transient venting, hypotheticals, third-party
  PII.
- **Non-authoritative recall framing.** Recalled block tells Claude
  to prefer the current message if it conflicts with a memory.
- **Smaller transcript default** (16K chars vs 32K) per the review's
  cost caution. Raise via `MAX_TRANSCRIPT_CHARS` if extraction
  misses context.

### Tests (+53, total 141)

- `chatMemoryPrompt.test.ts` (13) — parser leniency.
- `chatMemoryCategory.test.ts` (8) — alias normalisation.
- `chatMemoryDedup.test.ts` (12) — exact + cosine dedup, soft-delete
  exclusion, Voyage-outage exact-match fallback.
- `chatMemoryExtract.test.ts` (9) — noise-floor short-circuit, happy
  path, dedup, bounded retry (attempt 1 keeps pending, attempt 2
  permanent), resetBatchForRetry, already-extracted no-op,
  empty-extraction-with-no-parse-error success.
- `chatMemoryRecall.test.ts` (11) — ranking, threshold, soft-delete
  exclusion, NULL-embedding exclusion, fail-open on both null and
  thrown embed errors.
- `chatMemoryFlow.test.ts` (8) — Clear transaction populates batch
  stats; archives stamp `archive_batch_id`; empty Clear creates no
  batch; re-Clear creates a second distinct batch; **Option B
  history filter returns zero archived messages.**

### Optional env vars

- `CHAT_MEMORY_MODEL` — override the extractor model (defaults to
  `CHAT_MODEL`).

### One-time backfill migration

Chats cleared BEFORE this ships sit with `archived_at` set but
`archive_batch_id` NULL — they were never grouped into a batch (the
table didn't exist yet). On first startup after deploy, `lib/db.ts`
groups every orphan archived message by `conversation_id` into one
batch each and stamps the messages. The maintenance sweep then
extracts memories on the next tick. Idempotent — re-runs are no-ops.

## 2026-06-16 (PR #37 final-pass nits)

the review's final verification pass declared the Dropbox loop closed and
flagged three NITs (explicitly "not urgent"). Shipped all three while
the context is fresh — they're each cheap and exactly the kind of
hygiene that compounds if left.

- **NIT 1.** `dropboxDisconnect.test.ts` now restores
  `DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET` in `afterEach`, matching the
  save-original / restore pattern `dropboxBaseUrl.test.ts` already uses
  for `NODE_ENV` / `APP_BASE_URL`. Vitest isolation made this redundant
  in practice but explicit restoration survives `--no-isolate` and
  future test-ordering changes.
- **NIT 2.** `APP_BASE_URL` validation now also rejects values with a
  query string or URL fragment. Without this,
  `https://example.com?x=1` + `/api/dropbox/callback` would produce a
  broken redirect URI. Two new test cases lock both rules.
- **NIT 3.** Fixed the misleading "fetch must never be called" comment
  in `dropboxDisconnect.test.ts` — the actual behaviour is "the
  throwing default-mock catches whatever happens." Same kind of
  overstated-protection comment we cleaned up in the earlier OAuth
  state pass.

### Tests (+2, total 77)
- `dropboxBaseUrl.test.ts` — query-string and URL-fragment rejection.

## 2026-06-16 (verification follow-up)

The review verified PR #36 and flagged three real issues plus one optional
cleanup. All are fixed here.

### Fixed
- **`400` / `404` no longer default to `file-local`.** Without a recognised
  Dropbox `.error_summary`, a bare `400` could be a malformed app-level
  request just as easily as a missing path. Defaulting to `file-local`
  swallowed a class of real systemic bugs. Now defaults to `unknown` (which
  is poll-level → trips backoff). Recognised path-style summaries still
  flip back to `file-local`.
- **`dropboxDisconnect` test no longer risks hitting the real Dropbox API.**
  `fetch` is mocked via `vi.fn()` in each test. The original test avoided
  the network only by accident (early-throw in `getAccessToken`); a future
  refactor that changed the short-circuit order could have made it touch
  `api.dropboxapi.com` for real. Two new test cases added for the
  revoke-success and revoke-failure-with-credentials paths.
- **`lastRevokeWarning` is now hoisted above the connected/disconnected
  conditional in the Memory page.** Without this, a disconnect that failed
  Dropbox-side revoke would set the warning, then immediately render the
  *disconnected* branch (because local state was correctly cleared),
  hiding the warning from the user. The user would silently lose the
  signal that their token may still be live at Dropbox.

### Optional cleanup
- **`APP_BASE_URL` is now validated** at resolve time: must parse as a
  URL, must be http or https, must have a host, must not include a path,
  and must be https in production (since Dropbox redirects to it literally
  — an http origin would leak the OAuth code).
- **`lastSeenFileCount` preserves `0`.** The previous expression
  `seenCount ? Number(seenCount) || null : null` collapsed `"0"` to null
  via the `||` falsey coercion; the UI showed "never polled" for an
  empty folder. Fixed to use an explicit `Number.isFinite()` check.

### Review's other optional cleanups (not applicable)
- "Add seconds/random suffix to backup filenames" — the real
  `lib/backup.ts` already uses UTC seconds via `stampNow()`; the file
  I sent for review during paste-the-diff was mis-pasted from
  memory and didn't match the merged commit. No change needed.
- "Confirm root-level backup tarballs are intentional" — same issue;
  the real code already uploads under `backups/{stamp}.tar.gz`, not
  the root.

### Tests (+12, total 75)
- `dropboxErrors.test.ts` — locks bare-400/404 → unknown, evidence-based
  path-style → file-local.
- `dropboxBaseUrl.test.ts` — adds five validation cases (unparseable,
  non-http scheme, production http rejection, path-component rejection,
  dev http acceptance).
- `dropboxDisconnect.test.ts` — rewritten with mocked `fetch`; covers
  no-credentials, revoke-401, and revoke-200 paths.
- `dropboxStatus.test.ts` (new) — locks the `lastSeenFileCount = 0`
  preservation property.

## 2026-06-16 (Dropbox review-pass fixes from the review)

An independent review checked PR #35. None of its findings were security-
critical, but several were operationally/cost-critical and worth shipping
together as a tightening pass. This PR addresses each one in the order it
was prioritized.

### Operationally critical
- **Shared OCR concurrency budget.** Dropbox ingest now gates on
  `COUNT(*) FROM notebooks WHERE status='processing'` (cap 2 by default,
  configurable up to 5 via `OCR_CONCURRENCY_LIMIT`). Counts manual uploads
  too, so Dropbox backs off when the budget is already full instead of
  stacking 20+ concurrent Claude OCR streams on a freshly-connected
  account. Startup migration of stale 'processing' rows to 'error' is what
  makes this gate deadlock-safe.
- **Per-file Dropbox errors are now classified.** Auth (401/403),
  rate-limit (429), transient (5xx), and unknown errors propagate to the
  outer catch so they record `dropbox_last_error` and engage the failure
  backoff. Only true file-local errors (404, 409 with path/* summary) get
  swallowed. Fixes the bug where a revoked token mid-poll looked like a
  successful empty poll.
- **Size guard on Dropbox ingest.** Pre-download check on Dropbox metadata
  (`f.size > MAX_UPLOAD_BYTES`) plus a post-download `%PDF` magic-bytes
  sanity check. Skipped files surface in `/api/dropbox/status` as
  `lastSkipped`.

### Security hardening
- **Backup redaction.** New `redactSensitiveSettings(stagedDbPath)` opens
  the staged DB copy (made by `better-sqlite3.backup()`) with a separate
  handle and deletes `dropbox_refresh_token`, `dropbox_oauth_state`,
  `dropbox_oauth_redirect`, `dropbox_last_error` from it before tar+push.
  The LIVE DB is never touched — verified by a unit test that checks
  the live `dropbox_refresh_token` survives a redaction call.
- **Canonical OAuth base URL.** New `APP_BASE_URL` env var. In production
  with Dropbox configured, missing `APP_BASE_URL` is now a hard error;
  forwarded-header fallback is dev-only. `resolveAppBaseUrl()` is the one
  helper both `connect` and `callback` route handlers go through.
- **Revoke at Dropbox on disconnect.** `disconnectDropbox` is now async:
  attempts a real `POST /2/auth/token/revoke` first, then **always**
  clears local state regardless of revoke outcome. If revoke failed, the
  warning is persisted as `dropbox_last_revoke_warning` and surfaced on
  Memory so the user can revoke manually from dropbox.com. Local clearing
  is the user's hard escape hatch — never blocked by Dropbox availability.
- **Safe error persistence.** `safeDropboxError(endpoint, status, summary)`
  produces sanitised messages. Token endpoints get a generic status-coded
  message and NEVER include any response body (defence in depth against
  future code paths that might echo Authorization headers or secrets).
  File endpoints include Dropbox's own `.error_summary`, truncated.

### OAuth state hardened
- CSRF state moved from a process-wide `settings` row to a per-browser
  **httpOnly, SameSite=Lax cookie** (Secure in production, 10-min max age).
  Removes the misleading "session" comment, eliminates the two-tab race,
  and removes two settings keys from anywhere a future bug could read them.

### Visibility
- Memory page now surfaces `lastSeenFileCount` (helps the user notice the
  folder getting large), `lastSkipped` (size/format guard hits), and
  `lastRevokeWarning` (Dropbox-side revoke failure during disconnect).
- Code-level warning logs when the watched folder crosses 500 files —
  the conscious tradeoff for not yet using cursor-based polling.

### Tests (+25 vs the prior 38, total 63)
- `dropboxErrors.test.ts` — classifier covers every status class +
  the safe-error redaction property (token endpoints never include body).
- `dropboxPdfGuard.test.ts` — `%PDF` magic bytes accept/reject.
- `dropboxBaseUrl.test.ts` — production fails closed without
  `APP_BASE_URL`; dev honours forwarded headers.
- `backupRedaction.test.ts` — sensitive keys gone from staged copy,
  preserved in live DB, non-sensitive keys preserved in both.
- `dropboxDisconnect.test.ts` — local state cleared even when revoke can't
  be performed; revoke warning recorded.

## 2026-06-16 (Dropbox auto-ingest)

### Added — automatic notebook ingestion from Dropbox
The export step has been the single biggest friction point: write notebook →
manually export → download → open Remarkabler → upload → wait. This collapses
that to one tap on the device.

- **`lib/dropbox.ts`** — OAuth 2 with `token_access_type=offline` (long-lived
  refresh token, in-memory access-token cache), folder list/download via the
  v2 API, and a `maybeIngestDropbox()` watcher with the same hygiene as the
  other sweeps: in-flight guard, poll interval (5 min), failure backoff (30
  min so a revoked token doesn't hammer Dropbox), per-sweep ingest cap (10
  notebooks so a freshly-connected account doesn't trigger a Claude storm).
- **API routes** — `GET /api/dropbox/connect` kicks off OAuth (proxy-aware
  redirect URI built from request headers; CSRF state stashed in settings),
  `GET /api/dropbox/callback` exchanges the code and persists the refresh
  token, `GET /api/dropbox/status` for the UI, `POST /api/dropbox/disconnect`
  clears the token locally.
- **Memory page** — new "Auto-ingest from Dropbox" section sitting alongside
  the GitHub backup section. One-click connect / disconnect, surfaces the
  connected account name, last poll, last error, and ingested-notebook count.
- **Schema** — `notebooks.dropbox_file_id` (nullable, with a partial index)
  for dedupe so re-polls don't re-ingest the same file. NULL for manually
  uploaded notebooks.
- **Hooked into `runMaintenanceSweep`** via lazy `require` (same pattern as
  the backup module) so the watcher fires automatically without changing
  the sweep's import surface.

### Trust posture
- Dropbox app scopes are READ-ONLY (`files.metadata.read` + `files.content.read`).
  Even with bugs in this code Dropbox would refuse any write/delete from
  the app.
- `DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET` live in Railway env vars; the
  per-user refresh token lives in the SQLite settings table.

### Tests
`test/dropboxAuthUrl.test.ts` — locks the authorise URL contract, especially
`token_access_type=offline` (the only thing that gives us a refresh token at
all; if a future edit drops it the watcher would die every 4 hours).

## 2026-06-15 (review follow-through)

### Fixed
- **`/mind` discipline-filter inconsistency (the bug the review found).**
  `getEmbeddingMap` did not exclude the discipline notebook while
  `generateAxisLabels` did — so the 3D map could include synced GitHub
  content the axis labels were never derived from. The map now applies the
  same `notebook_id != DISCIPLINE_ID` filter as themes / sentiment / labels,
  so the map's point set matches the label-eligible set. Covered by a new
  integration test.
- **Backup retry loop.** A persistently-failing automatic backup retried on
  every ~5-minute maintenance sweep (failure path never recorded a
  timestamp). Now records `backup_last_attempt_at` up-front and applies a
  6-hour backoff to the automatic sweep. Manual "Backup now" still retries
  immediately. `backupStatus()` gained `lastAttemptAt`. (Long-standing known
  issue from the 2026-06-04 session log.)

### Changed
- **Single PCA implementation.** The embedding map and the axis labeller used
  to each run their own copy of power-iteration + deflation. Unified into one
  exported `computePca` + `projectOnto`; both paths now fit through it, so the
  map and its labels can't drift onto different math. PCA also now caps
  components at `min(k, dim, n-1)` (centred-data rank) instead of `min(k, dim,
  n)`, avoiding a meaningless noise component for tiny inputs.
- **Axis-label JSON parsing extracted** into a pure, exported `parseAxisLabels`
  (was inline in `labelEmbeddingAxes`) so it's unit-testable.

### Added
- **Test harness (`npm test`, Vitest).** First suites: `extractEntryDate`
  header formats, PCA invariants (orthonormality / variance ordering /
  reconstruction / direction match up to sign — no brittle coordinate
  assertions), `parseAxisLabels` leniency, and the `/mind` discipline
  exclusion (throwaway SQLite). 36 tests.

### Docs
- `CLAUDE.md` architecture section brought up to date with current modules,
  tables, routes and pages (mind, embeddings, backup, location, discipline,
  `entry_analysis`, `mind_pca_axes`, the FK pragma) and a new Tests section;
  cross-referenced with `AGENTS.md`.

## 2026-06-15 (mind: bulletproof label visibility + diagnostics)

After running 8 parallel review agents on the label flow, two real fragility
points surfaced + the most likely silent failure mode was identified:

### More tolerant Claude parser
- `labelEmbeddingAxes` previously returned `null` on any JSON deviation.
  Now it tries 3 extraction strategies (fence-strip → greedy outermost
  `{...}` → trailing-comma strip), unwraps `{axes: ...}` or
  `{labels: ...}` nesting if Claude wrapped, and accepts partial labels
  (synthesises `"(missing)"` for blank sides instead of discarding the
  whole pass). Return type changed from `AxisLabels | null` to
  `AxisLabelResult` carrying the labels (or null), the raw response,
  and a parseError string.
- Prompt updated to explicitly allow Korean labels (matching the user's
  diary language) rather than forcing English.

### Persistence verification
- `generateAxisLabels` now reads its own write back via
  `getStoredAxisLabels()` and reports a clear error if the round-trip
  fails — so a silent settings-table rejection can no longer leave the
  user staring at "no labels" with no explanation.

### User-visible diagnostics
- Success message now lists the actual six labels inline ("X: family
  ↔ business · Y: …") so the user doesn't need to scroll/orbit to
  confirm anything happened.
- Collapsible **"Last label attempt"** panel shows the raw Claude
  response + any parse error from the most recent run. Tapping it
  reveals exactly what came back, which is the right debug surface
  when the in-canvas overlay misbehaves on a particular device.

## 2026-06-15 (mind: guaranteed-visible axis legend)

### Changed
- Axis labels now also render as a **static legend below the canvas**,
  not just as a 3D overlay inside it. Three rows (X / Y / Z), each
  showing the positive label (amber pill) ↔ the negative label (blue
  pill). Plain HTML, no three.js dependency — guaranteed to show as
  long as the labels exist in the DB. The in-canvas 3D overlay stays
  as a nice-to-have on devices where it works.

## 2026-06-15 (heatmap: 6-month window)

### Changed
- "When you write" heatmap now shows the **last 26 weeks (~6 months)**
  instead of the last 52. `today` is computed from `new Date()` on every
  render, so the rightmost column is always the current week and the
  grid rolls forward automatically as days pass.
- Shade scale and "N days with entries" count are now restricted to the
  visible window — a noisy day from a year ago no longer compresses the
  current cells into one flat colour, and the count matches what you
  see on the grid.

## 2026-06-14 (mind: axis labels render in any language)

### Fixed
- **3D axis labels weren't visible.** They were rendered with drei's
  `<Text>` component, which uses an SDF font that doesn't include CJK
  glyphs — so labels Claude wrote in Korean silently rendered as
  nothing. Switched to drei's `<Html>` overlay, which uses the page's
  normal CSS font (and the system Korean font as a fallback) and works
  for any language. Positive ends use a warm amber pill, negative ends
  a cool blue one, with `pointerEvents:'none'` so they don't block
  OrbitControls' touch.

## 2026-06-14 (mind: axis labels)

### Added
- **3D map axes are now labelled.** New "Label axes" button on /mind
  picks the five entries at each extreme of each PC axis, sends their
  cached themes + summaries to Claude in one call (~$0.003 total), and
  gets back six short noun phrases like "family life ↔ business
  strategy". Labels render as floating, billboarded text at the tips of
  the three axes inside the 3D scene.
- **Persisted PC vectors.** Because PCA eigenvectors are only unique up
  to sign, naively re-deriving them on every page load would drift the
  labels onto the wrong side. `generateAxisLabels` now stores the mean +
  three PC vectors (base64-encoded Float32) in the settings table;
  `getEmbeddingMap` reuses them so the map's coordinates stay aligned
  with whatever Claude named.
- New endpoint: `POST /api/mind/axis-labels`. In-flight guard so a
  double-click doesn't double-bill.

## 2026-06-14 (mind: 3D map touch fix)

### Fixed
- **3D map was breaking after the first touch.** When the user's finger
  landed on a point, the mesh's `onPointerDown` handler called
  `e.stopPropagation()` on the very first touch event, eating it before
  OrbitControls could interpret it as a rotate gesture. Rotation then
  stopped working for the rest of the session. Switched to `onClick`,
  which r3f only fires for a clean tap (no significant movement) — so
  dragging across a point still rotates the camera, and only an
  intentional tap selects it.
- **Pinned the touch gesture mapping**: one finger → rotate, two fingers
  → dolly + pan, so the controls don't end up in a weird state after a
  previous gesture sequence.
- **`touch-action: none` on the Canvas itself**, not just the wrapper —
  some Android Chrome paths ignored the wrapper rule for the inner
  `<canvas>` element and treated one-finger drags as page scrolls.

## 2026-06-14 (mind: fix date regex + carry-forward)

### Fixed
- **Diary header regex was missing every page.** The user's actual format
  is `YYYY-MM-DD-HH-MM-KST` (a dash between hour and minute, lowercase
  `kst`); the old pattern expected `YYYY-MM-DD-HHMM-KST` (no separator,
  uppercase). Updated `extractEntryDate` in `lib/notes.ts` to a tolerant
  pattern that also handles `YYYY-MM-DD HH:MM KST` and ISO-ish `T`.
- **Carry-forward within a notebook.** The user writes the timestamp once
  per session, but a session spans many pages. New `reparseAllEntryDates`
  walks every notebook in page order and propagates the most recent
  header to subsequent pages until the next one appears. Idempotent,
  transactional, no Claude / Voyage calls.
- **One-time auto-migration.** First GET to `/api/mind` after this deploy
  runs the reparse once and sets the `mind_dates_reparsed_v2` setting flag
  so it never repeats. Best-effort — failures are logged but don't break
  the response (the SQL upload-date fallback still works).
- **Manual "Re-parse dates" button** on `/mind` for future regex tweaks.
- New endpoint: `POST /api/mind/reparse-dates`.

## 2026-06-14 (mind: fallback dates + 3D map)

### Fixed
- **Heatmap and mood timeline now populate even when entries lack a parsed
  diary date.** Both `getHeatmap` and `getSentimentSeries` now use
  `COALESCE(NULLIF(entry_date, 'none'), date(notebook.synced_at))`, so when
  the user didn't write a `YYYY-MM-DD-HHMM-KST` timestamp on every page
  (which is most of them — the regex only matches the session header),
  entries fall back to the upload date and the charts show useful signal
  immediately. Subtitle updated to call this out.

### Added — 3D interactive embedding map
- PCA refactored from 2-component to N-component (`pcaNd`) with the same
  textbook deflation. Returns `[x, y, z]` per entry.
- New `app/mind/Map3D.tsx` renders the cloud with three.js +
  `@react-three/fiber` + `@react-three/drei`'s `OrbitControls`:
  - one-finger drag → rotate
  - two-finger pinch → zoom
  - two-finger drag → pan
- Loaded with `next/dynamic` (`ssr: false`) so the three.js bundle only
  ships when the Mind page is open — other pages stay unaffected.
- Active point pulses; a billboarded date label hovers above it so the user
  doesn't lose context while rotating. Subtle axis lines for orientation.
- Tap a point → existing detail panel below the canvas (date / notebook /
  themes / sentiment / summary / preview).

### Dependencies
- Added: `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`.

## 2026-06-14 (mind: review-pass fixes)

After fanning out 11 parallel review agents (security / cost / PCA math /
API contract / schema / concurrency / frontend / a11y / perf / privacy /
robustness), addressed the real findings:

- **FK pragma now enabled.** `_db.pragma("foreign_keys = ON")` in db.ts.
  Previously, every `ON DELETE CASCADE` in the schema was silently dropped
  by SQLite. Notebook deletes now properly cascade through pages →
  entry_analysis, and message deletes cascade to attachments.
- **Discipline notebook now actually excluded.** The lookup matched on
  `name = 'discipline'`, which never hit — the row's ID is the fixed
  sentinel `DISCIPLINE_ID = 'github-discipline'`. Importing it from
  lib/notes.ts so theme/sentiment aggregates aren't polluted by synced
  GitHub content.
- **Concurrency: in-flight guard on `analyzePending`.** Two overlapping
  callers (upload auto-analysis + user clicking "Analyse next 25") could
  each pick the same rows and double-bill Claude. Second caller now
  returns `{ skipped: "in-flight" }` immediately; the UI shows a clear
  message.
- **DB writes inside the analyse loop wrapped in try/catch.** A single
  SQLite-locked / FK-violation (e.g. page deleted mid-batch) used to kill
  the entire batch; now it's logged and the loop continues.
- **Heatmap timezone fix.** Was using `toISOString().slice(0,10)` (UTC),
  causing the grid to shift by a day for users away from UTC. Now uses
  local date components.
- **Embedding-map touch targets.** Visible circles slightly larger (r=4 →
  r=5) and wrapped in a 24px transparent hit area so tapping works on a
  phone.

## 2026-06-14 (mind visualizations)

### Added — `/mind` tab: four ways to see your patterns
- **Calendar heatmap** of writing volume — last 52 weeks, GitHub-style. Pure
  SQL over `pages.entry_date`. Free.
- **Theme cloud** — top topics Claude extracted from each entry, sized by
  frequency.
- **Mood timeline** — per-day average sentiment as an SVG line chart, with
  a 3-day rolling-mean trend overlay.
- **Embedding map** — every entry projected to 2D via PCA on the existing
  Voyage embeddings stored on `pages.embedding`. Pure-JS PCA via power
  iteration with deflation; no new dependency. Tap a point for tooltip
  (date / notebook / themes / summary).

### Infra
- New `entry_analysis` table (`page_id`, `themes JSON`, `sentiment REAL`,
  `summary`, `model`, `analyzed_at`) caches one Claude call per page so the
  visualisations are free to view.
- `analyzeEntryContent` in `lib/claude.ts` uses the chat-tier model (Sonnet)
  with strict JSON output and tolerant parsing (handles stray code fences,
  bounds-checks themes/sentiment).
- `analyzePending(limit)` in `lib/mind.ts` is bounded (max 200), serial
  (no parallel Claude calls), and best-effort per entry — one failure
  doesn't poison the batch.
- Hooked into `processNotebook`: after OCR + profile fold, freshly OCR'd
  pages are auto-analysed (capped at 50 per upload).
- `POST /api/mind/analyze?limit=N` lets the user backfill older entries
  from the page; `GET /api/mind` returns all four datasets in one trip.

## 2026-06-14 (later)

### Removed
- **`/diary` tab.** Not pulling its weight — the Notebooks tab (now with
  inline page text) and the chat `/raw` command cover the same browse /
  search needs without a third top-nav destination. The `/api/diary`
  endpoint stays (it backs `/raw`).

## 2026-06-14

### Added — diary browsing (three ways, all free per check)
- **New `/diary` tab.** Browse every transcribed page directly from the
  database, grouped by `entry_date` (newest first), with full-text search
  (`pages_fts`) and date-range filter. Zero AI calls per view; same
  tokenisation as the chat `search_diary` tool.
- **Notebooks tab now shows raw page text inline.** Tapping a notebook
  expands to reveal each page's OCR transcription, lazy-loaded from a new
  `GET /api/notebooks/[id]/pages` endpoint so the list view stays light.
- **Chat `/raw` command.** Typing `/raw`, `/raw 2026-04-05`, `/raw 2026-04`
  or `/raw <keyword>` bypasses Claude entirely and returns the matching
  raw entries directly from `/api/diary`. No model call, no token cost.
  Hint added to the chat input placeholder so the shortcut is
  discoverable. Replies are marked `model: "raw (no AI)"`.

## 2026-06-05 (mobile display optimization)

### Improved
- **AMOLED-friendly dark mode** — body background is now pure black
  (`#000`) so phones with AMOLED screens (Galaxy S, Pixel, modern iPhone)
  physically turn those pixels off. Better battery + infinite contrast.
  Light mode unchanged.
- **Safe-area aware layout** — `viewport-fit=cover` plus
  `env(safe-area-inset-*)` padding on header and main, so content uses
  every pixel including around punch-hole cameras and rounded corners.
- **`themeColor` metadata** — system status bar matches the app
  (warm-stone in light, true black in dark) instead of showing a jarring
  white/black stripe at the top of the PWA.
- **`100dvh` instead of `100vh` for the chat container** — dynamic
  viewport height handles mobile browser address-bar collapse properly,
  so the chat input row no longer hides behind the bottom URL bar.
- **40px minimum tap targets on touch devices** — global CSS rule plus
  bumped chat input buttons from 36px → 40px. Matches Material / HIG
  guidance, easier thumb tapping.
- **Tighter horizontal padding on mobile** — main content was using
  `px-6` (24px each side); now `px-4 sm:px-6` so phones reclaim ~16px
  of horizontal real estate without changing desktop spacing.
- **Smooth scroll + `touch-action: manipulation`** — removes the 300ms
  tap-zoom delay and gives buttery scrolling on 120Hz screens.

## 2026-06-05

### Fixed
- **`generateInsights` now uses prompt caching.** The ~50K-token diary
  corpus is split into a cacheable static block + an uncached dynamic
  block (recent chats + prior insights). Identical output; saves ~90%
  on input tokens for back-to-back manual runs. Weekly auto-runs are
  spaced too far apart to hit a warm cache, but cost the same as before
  for the first call (no penalty).

## 2026-06-04 (chat attachment extraction)

### Added
- **Chat attachments: PDF and Word docs are now converted to plain text
  on the server before being sent to Claude.** Cuts per-chat token cost
  ~3-5x for typed documents. Uses `pdf-parse` and `mammoth` (Node.js
  equivalents of MarkItDown's PDF/DOCX paths).
- **Images skip extraction** (jpg/png/gif/webp) and continue going
  through Claude as vision blocks — text-extraction tools can't read
  image content, and Claude's vision is what's wanted there.
- **Handwritten reMarkable PDFs gracefully fall back** to the raw
  document block — pdf-parse returns near-empty text on image-based
  ink, the extractor signals `fallback`, and the original behavior
  takes over so diary content is never lost.

## 2026-06-04 (later)

### Added
- **Discipline (GitHub) auto-sync.** Pulls your discipline repo once per
  local-time day, fired from the existing maintenance sweep on first
  activity after KST midnight. No new infrastructure; piggybacks on
  chats/uploads. Manual "Sync now" still works and marks the day as
  done so the auto-sync doesn't double-fire.

## 2026-06-04

### Fixed (10-agent code review pass)

- **Chat system prompt caching.** Split the system prompt into a cached static
  block (instructions + tool policy) and a dynamic block (profile + recent
  locations). Previously the cache was invalidated every time the profile or
  locations changed, paying full price for the ~1.5KB static prefix on every
  chat turn.
- **`backfillTitles` was firing Opus on every Insights page load.** Throttled
  to once per 5 minutes, capped to 3 titles per run, switched from Opus
  (`modelMain`) to the chat model (Sonnet by default). Potential savings:
  $10-40/month on heavy use.
- **Maintenance sweep timestamp now persisted to settings.** Previously
  `lastMaintenanceAt` lived in module memory; a Railway cold-start refired
  the entire cascade (Voyage backfills, daily summaries, weekly insight).
- **Chat fallback model loop fix.** Previously gated by `iter === 0`, so a
  mid-loop 529 from Anthropic surfaced as an error. Now falls back on any
  iteration and logs the switch.
- **API route hygiene.** Added `export const dynamic = "force-dynamic"` to
  all 15 data-reading routes that were missing it. Bumped `/api/chat`
  `maxDuration` from 60s → 300s so complex tool-call chains don't get
  terminated mid-stream.
- **`COALESCE(SUM(...), 0)` in `lib/usage.ts`** so the Cost tab doesn't crash
  on days/months with zero usage.
- **Embedding BLOB length validation.** `decodeEmbedding` now returns null
  on malformed blobs instead of producing NaN vectors that silently zero out
  every cosine comparison.
- **Notebooks UI.** Added a loading skeleton, a real error surface, and a
  busy-lock on the Delete button so a slow connection doesn't flash "No
  notebooks yet" or let a double-tap fire two DELETEs.
- **Insights "Generate" double-tap guard.** Was setting state inside an async
  function, so a quick double-tap could fire two parallel full-corpus
  generations against Opus.
- **Silent catches surfaced.** Replaced bare `} catch {}` with
  `console.warn`/`console.error` in `processNotebook`, `semanticSearch`, and
  the post-OCR profile fold. Silent failures now show up in Railway logs.

## 2026-06-03

### Added
- **Memory page: Voyage / semantic-search status row.** Shows whether
  embeddings are enabled, the current model, embedded / total page count,
  and the time of the last Voyage call — so the user can confirm at a glance
  whether hybrid search is actually running for them. Backed by a new
  `/api/embeddings/status` endpoint.

## 2026-06-01

### Added
- **Tool-calling chat — Claude now fetches diary entries on demand.** Replaces
  the pre-retrieve-and-stuff pattern with proper tool use. Eleven tools cover
  semantic + keyword search (`search_diary`), specific dates
  (`get_entries_by_date`), recent entries, notebook listing and full reads,
  occurrence counts, the current KST time (so "today / yesterday / this week"
  resolve correctly), recent locations, past chat history, past insights, and
  writing stats. Claude uses tools only when the question genuinely needs a
  lookup; many turns still answer from the profile alone.
- **Semantic memory (Phase 1).** Voyage AI embeddings now indexed per page;
  `search_diary` is hybrid (FTS + cosine similarity), so "anything heavy
  lately?" finds entries about burden, exhaustion, weight — even when the word
  "heavy" never appears. New `pages.embedding` BLOB column, in-app backfill,
  Voyage pricing wired into the Cost tab. Requires `VOYAGE_API_KEY`; the
  feature is a no-op without it.
- **Weekly auto-insight.** The Insights record now grows on its own — once a
  week, when you chat or open the dashboard, a fresh reflection is written in
  the background on Opus.
- **Insights folded into memory.** Profile build/update prompts now include
  the three most recent insights under a "YOUR RECENT REFLECTIONS ABOUT ME"
  block, so the "memory of you" knows what Claude has been noticing about
  you — not just what you wrote.
- **Dashboard insight nudge.** When you have notebooks but no insights yet,
  the dashboard surfaces a clear "No insights yet" card that explains the
  feature and links to it, instead of hiding the section entirely.
- **Diary timestamp awareness in chat.** Chat's system prompt names the
  `YYYY-MM-DD-HHMM-KST` format and instructs Claude to look for it in
  excerpts. The FTS query also normalises date shorthands ("5/28", "5-28",
  "5/28th", "2026-5-28") to padded "05 28" so they hit the indexed timestamps.
- **Diagnostic share-target failure page.** When a PWA share doesn't include a
  usable PDF, the failure page now lists every form field that did come in
  (empty file entries, text fields) and points at the right reMarkable export
  flow, instead of a generic "no file" message.
- **Privacy controls — every data source is now a switch.** Toggles on the
  Memory tab let you opt out of feeding location and discipline (GitHub) data
  to Claude without touching env vars. When off, ingestion is rejected,
  retrieval excludes the source, and the chat prompt is built without it;
  past entries stay in the database untouched.
- **In-app Claude model picker** on the Memory tab. Three dropdowns (Chat,
  OCR + memory, Chat fallback) override the Railway env vars in real time —
  no restart, no console. The first option clears the in-app override and
  falls back to the env / built-in default. Resolution order is DB → env →
  default, so existing deployments keep working unchanged.
- **Weekly location distill into the evolving memory.** Once a week, when
  you chat, Remarkabler folds your recent location route into your "profile
  of you" — patterns and routines only, not raw stops. Skipped when the
  location share toggle is off. Best-effort, in the background, on Opus.
- **"via Haiku" indicator in chat.** Every reply now records which model
  answered. When the chat model is briefly overloaded and the app falls back
  to the cheaper Haiku model, the affected reply shows a small label so it's
  clear which model spoke. New `model` column on `chat_messages`.
- **Multi-file upload everywhere.** Both the Notebooks page picker and the
  reMarkable PWA share target now accept multiple PDFs at once. Each is
  validated and ingested independently, transcribing in parallel; the success
  page summarises what was added and lists anything skipped (wrong type, too
  large).
- **Public-launch package.** A polished, share-ready `README.md` with a
  screenshot gallery, a "Deploy on Railway" one-click button
  (`railway.json` + badge), and an `MIT` `LICENSE`. A new-user manual at
  `USER_GUIDE.md`, and a two-page system-architecture diagram at
  `remarkabler-architecture.pdf`.

### Changed
- Repository renamed in package + UI: `package.json` is `remarkabler`; the
  remaining "Feed Claude" references in code (insights export filename, chat
  draft storage key) are now "remarkabler". The WebAuthn user handle is
  intentionally unchanged so existing passkeys keep working.
- `lib/claude.ts` model selection refactored to resolve at call time from
  DB → env → default. No behaviour change unless an in-app override is set.

### Fixed
- **Sharing multiple PDFs from the reMarkable app to Remarkabler.** The Web
  Share Target read only the first file via `formData.get("file")`, so when
  the reMarkable app shared 2+ PDFs at once (delivered as multiple entries
  under the same field name), the rest were dropped — and depending on the
  bundling, the share could appear to fail entirely. Now uses `getAll("file")`
  and ingests each in turn.
- **Sharing a single PDF from the reMarkable mobile app on Samsung Internet.**
  The PDF was arriving correctly under the right field name, but
  `value instanceof File` returned false (the OS share intent on Android Chrome
  hands the file in via a different File constructor than the module sees), so
  the file was misclassified as a text entry and rejected as "no PDF came
  through." Both `/share` and `/api/notebooks` now duck-type — anything with
  a numeric `size` and an `arrayBuffer` method is treated as a file.
- **Chat photo attachments silently dropped on Samsung Internet.** Same
  multipart-quirk class: the resized photo blob was being delivered as a
  non-File entry the parser dropped, and chat answered as if no image was
  attached. Switched the chat attachment path from multipart to JSON+base64,
  which bypasses the multipart parser entirely (the PWA share target stays on
  multipart — the Web Share Target spec requires it). The error UX also got
  cleaner: when something does go wrong, the message appears in the input's
  red banner with your text + attachment preserved, instead of as a fake
  "assistant" reply.
- **Chat attachment hardening — robust against empty MIME, HEIC decode
  failures, and zero-byte resize blobs.** Both client and server accept by
  filename extension when MIME is missing; the resize falls back to the
  original blob when the browser can't decode it.

## 2026-05-16

### Added
- Automatic daily route via OwnTracks: set `OWNTRACKS_TOKEN` and point the free
  OwnTracks app at `/api/owntracks?token=…`. The app ingests location points in
  the background, clusters them into stays (place + arrival/leave + dwell),
  names them via reverse geocoding, and feeds the recent route to chat — no
  taps, no exports. Status + setup live on the Memory tab.
- Full daily route via Google Timeline upload: export your timeline from Google
  Maps and tap "Upload location timeline" on the Memory tab. The app parses each
  stop (place + arrival/leave times + how long you stayed), de-duplicates across
  uploads, and feeds your recent route to chat. Handles the common Google export
  formats; an unrecognized file reports its structure so the format can be added.
- Location logging: a "Log my location" button on the Memory tab records where
  you are (reverse-geocoded to a place name) with the local time. Your recent
  places are fed into chat so Claude knows where you've been. One point per tap
  — the app can't track in the background; it only logs when you tap.
- Connect a private GitHub repo as a "discipline" source. Configure it with the
  `DISCIPLINE_REPO` / `DISCIPLINE_GITHUB_TOKEN` env vars; the Memory tab's "Sync
  now" pulls the repo's text files (.md/.txt) into a notebook and folds them
  into your Memory, re-syncable on demand. (New `lib/github.ts`,
  `app/api/discipline`.)
- Memory tab: view what Remarkabler understands about you, edit/correct it, and
  rebuild it from all your notes on demand. (The profile still updates itself in
  the background when you feed a diary.)
- Evolving memory ("profile of you"). Claude now keeps an accumulating
  understanding of the person, built from their diary: it's revised in the
  background each time a notebook finishes transcribing (and seeded once from
  existing notes), using the Opus model. Chat now reasons over that compact
  profile plus a few FTS-retrieved excerpts relevant to the question — instead
  of re-sending the entire notes corpus every message. This makes chat answer
  from accumulated understanding and cuts the per-question cost by ~10x. The
  profile updates show as a "Memory" line in the Cost page. Insights still uses
  the full corpus (it's an occasional, on-demand reflection).
- Cost page (a "Cost" tab): a month calendar of estimated Claude API spend
  with this-month and all-time totals. Each call's token usage and cost is
  recorded; tap any day to see the breakdown by feature (transcription, chat,
  insights). Costs are estimated from token counts at list prices (the
  Anthropic console invoice is the source of truth) and only count usage since
  this was added.
- Optional PostHog analytics, off until `NEXT_PUBLIC_POSTHOG_KEY` is set. Sends
  only anonymous page views and explicit events; autocapture and session
  recording are disabled so no note content, chat text, or screen contents are
  sent. Events: notebook uploaded/upload-failed/deleted, chat message sent,
  chat attachment added, chat voice started, chat cleared, insight generated,
  insights copied/exported, unlock success (method), device registered.
- Private lock for the whole app. When the `APP_PASSCODE` environment variable
  is set, every page and API is gated behind a lock screen. The owner unlocks
  with a passkey — fingerprint on Android, Face ID on iPhone — registered once
  per device, with the passcode as the backup / device-registration key. A
  successful unlock keeps that device open for 7 days; a "Lock" button in the
  nav locks immediately. With `APP_PASSCODE` unset the app stays fully open,
  so the lock is turned on simply by adding that one variable.
- Chat page: a "Clear" button hides the conversation from the app for privacy.
  Cleared messages are archived (kept in the database) rather than deleted, and
  still feed Claude — so the conversation continues seamlessly on top of them.
- Chat attachments: an "Attach" button lets you send a photo or a PDF with a
  message for Claude to read. Photos are downscaled in the browser before
  upload; files are stored on the data volume and shown in the conversation.
  Video is rejected with a note, since Claude cannot process video.

### Changed
- The top nav stays on a single row (smaller text, tighter spacing, scrolls
  rather than wrapping) now that there are more tabs.
- Chat now runs on Claude Sonnet (cheaper than Opus) and caches the notes
  context it sends on every message, so follow-up questions re-read the notes
  at a fraction of the cost. OCR and insights still use the Opus model; the
  chat model can be overridden with the `CHAT_MODEL` environment variable.
- Renamed the app from "Feed Claude" to "Remarkabler" (nav, dashboard, lock
  screen, PWA manifest, passkey prompt, and share pages).
- The home page is now a dashboard: at-a-glance counts, a live "transcribing"
  indicator, quick actions, the latest insight, and recent notebooks.
- Removed the manual "Lock" button from the nav — the app now re-locks on its
  own whenever it is backgrounded, so the button was redundant.
- New app icon: a sleeker notebook-and-spark mark on a warm gradient, replacing
  the plain circle (also wired up as the favicon and Apple touch icon).
- Redesigned the chat input as a single sleek rounded bar with circular icon
  buttons (attach, mic, send), replacing the cramped row of boxy buttons.
- Insights page is simpler to read: the newest reflection is shown in full at
  the top, and each earlier reflection collapses into a tappable row showing
  its date and a short summary. All past entries are kept and still included
  in Copy/Export.
- Earlier-reflection rows now show a brief, fully visible label at a smaller
  font, instead of a cut-off sentence ending in "…".
- Each insight now gets a genuine short topic title written by Claude (2–5
  words), shown on its collapsed history row. Existing entries are
  automatically backfilled with a title the first time the page loads; the
  trimmed-opening label remains only as a fallback if titling fails.
- The Insights page is now a single uniform list of collapsed rows — the
  latest reflection is collapsed like every other entry (marked "Latest")
  and expands on tap, instead of being shown in full at the top.

### Fixed
- Transient Anthropic overload/rate-limit errors (e.g. HTTP 529) are now
  retried automatically with backoff, and if one still surfaces the chat shows
  a calm "Claude is temporarily busy — try again" message instead of a raw
  error dump.
- If the chat model is overloaded, chat automatically falls back to a second
  model (`CHAT_FALLBACK_MODEL`, default Sonnet) for that message — so a busy
  Haiku no longer blocks a reply.
- Sharing a PDF from the reMarkable app to Remarkabler no longer fails with a
  "locked" page. The share target is write-only (it accepts a PDF and starts
  transcription, returning no notes), so it is no longer gated by the lock —
  which previously rejected every share because the app auto-locks on
  background. Reading (notebooks list, chat, insights) stays locked.
- Uploading a PDF on Android failed for the same reason attachments did: the
  file picker backgrounds the app and tripped the auto-lock, and the unlock
  reload discarded the chosen file. The auto-lock is now suppressed while the
  Notebooks file picker is open.
- Attaching a file no longer loses the attachment on Android. Opening the file
  picker backgrounds the app, which triggered the auto-lock; unlocking then
  reloaded the page and discarded the picked file. The auto-lock is now
  suppressed while the file picker is open.
- Times shown in the app (notebook upload time, insight generation time) were
  off by the UTC offset because UTC timestamps were parsed as local time.
  They are now displayed in the viewer's local timezone with the timezone
  name shown.
- The lock screen's passcode field showed only a numeric keypad; it now opens
  the full keyboard so passcodes with letters and symbols can be entered.
- The lock screen now surfaces a clear "Set up this phone" button when other
  devices are already registered, so a new phone registers its own Face ID /
  fingerprint instead of being pushed into the cross-device QR-code flow.
- The app now re-locks automatically whenever it is sent to the background:
  the session is dropped and the screen is covered. On return, a device that
  has unlocked before prompts for the passkey automatically (where the browser
  allows it; otherwise the unlock button is one tap away).
- Dates now always render in English regardless of the device's language
  setting, instead of following the browser locale (e.g. Korean).
- Voice features (Speak playback and spoken-question input) now use English
  only, instead of switching to Korean based on the text.
- The notebook upload control now uses a custom English "Choose file" button
  and file-name text, instead of the browser's native file picker whose
  label was localized (e.g. Korean) by the device.
- The Notebooks list is now a uniform list of collapsed rows (name + status),
  matching the Insights page; each row expands on tap to show the upload time
  and the delete action, instead of a wide multi-column table.
- Chat page no longer plays a noisy smooth-scroll animation through the whole
  history every time it opens. The saved conversation now jumps instantly to
  the latest message on load; the smooth scroll is kept only for messages
  sent or received during the session.

## 2026-05-15

### Added
- Insights page: on demand, Claude reflects on all of your notes and your
  chat history and records what it notices about you. Each entry builds on the
  previous ones into a cumulative record, which can be exported (download as
  Markdown or copy).
- The chat box keeps an unsent draft: typing is saved and restored if the
  page reloads or the app is backgrounded.
- Voice on the Chat page: a Speak button transcribes a spoken question (via
  the browser's speech recognition), and the answer to a spoken question is
  read back aloud.
- PDF upload flow — upload a notebook PDF and Claude transcribes every page.
- Chat over all transcribed notes.
- Installable PWA with a Web Share Target: share a PDF from the reMarkable
  app directly to "Feed Claude" instead of uploading manually.
- Configurable data directory via the `DATA_DIR` environment variable, so the
  SQLite database and PDFs can live on a hosted persistent volume.
- Token-access diagnostics and force-push to the repo-split CI workflow.

### Changed
- Chat input is multi-line: Enter starts a new line; the Send button sends.
- Transcription now runs as a background job. Uploading or sharing a notebook
  returns immediately; the notebooks list shows a live `Transcribing…` status
  and refreshes itself when each notebook finishes.
- Rebuilt the app around PDF upload. The original reMarkable cloud-sync code
  was written against an `rmapi-js` API that does not exist and could never
  have worked.
- Updated `@anthropic-ai/sdk` to a version that supports PDF (`document`)
  input.
- Updated Next.js to patch a published security advisory.
- `npm start` now honors the host-provided `PORT` so the app can be hosted.

### Fixed
- Text-dense notebooks could be silently recorded with "0 pages". The
  whole-notebook transcription overflowed the model's output limit, the
  truncated reply failed to parse, and the empty result was wrongly marked
  "done". Transcription now uses a truncation-resilient delimiter format
  instead of JSON, allows a much larger response, and surfaces a clear error
  instead of a false success. The notebook list also shows the total page
  count.
- The transcription request is now streamed. With the larger output limit the
  SDK had started rejecting the request outright ("streaming is required for
  operations that may take longer than 10 minutes").
- Sharing or uploading a notebook no longer freezes the screen for the whole
  transcription. The request used to block until Claude finished (~1 minute);
  now it returns at once and transcription runs in the background.
- Notebooks interrupted by a server restart are flagged with an error on the
  next start instead of being stuck on `Transcribing…` forever.
- Share target sent the browser to the proxy-internal `localhost:8080`
  address after a successful share (`ERR_CONNECTION_REFUSED`); it now
  navigates using the real URL via a client-side redirect.
- Pre-existing TypeScript build errors that blocked any build.

### Removed
- Non-functional reMarkable cloud sync: the connect page, the sync API route,
  `lib/remarkable.ts`, and the `rmapi-js` dependency.

### Deployment
- Deployed to Railway with a 5 GB persistent volume mounted at `/data`.
