# Changelog

## 2026-06-04

### Added
- **OCR model is now its own picker on the Memory tab,** separate from the
  Memory / profile model. OCR is the single biggest charge per notebook
  upload (one full-PDF call); splitting it off means a user can keep Opus
  for the memory rebuild (where accuracy matters most) but route OCR to
  Sonnet for ~half the per-upload cost. New `model_ocr` setting +
  `OCR_MODEL` env var override; when unset, OCR falls back to whatever the
  Memory model is set to, so existing deployments behave exactly as before.

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
