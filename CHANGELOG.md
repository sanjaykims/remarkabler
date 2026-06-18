# Changelog

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
- **Smaller transcript default** (16K chars vs 32K) per Codex's
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

## 2026-06-16 (Codex PR #37 final-pass nits)

Codex's final verification pass declared the Dropbox loop closed and
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

## 2026-06-16 (Codex verification follow-up)

Codex verified PR #36 and flagged three real issues plus one optional
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

### Codex's other optional cleanups (not applicable)
- "Add seconds/random suffix to backup filenames" — the real
  `lib/backup.ts` already uses UTC seconds via `stampNow()`; the file
  I sent Codex for review during paste-the-diff was mis-pasted from
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

## 2026-06-16 (Dropbox review-pass fixes from Codex)

Codex independently reviewed PR #35. None of its findings were security-
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

## 2026-06-15 (Codex review follow-through)

### Fixed
- **`/mind` discipline-filter inconsistency (the bug Codex found).**
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
