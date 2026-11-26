# Graph Report - remarkabler  (2026-11-26)

## Corpus Check
- 333 files · ~345,571 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 7, .woff2 4, .css 1)

## Summary
- 3244 nodes · 8016 edges · 213 communities (182 shown, 31 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 837 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b0a2860d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- dropbox.ts
- diaryExportDb.ts
- remarkableCloud.ts
- owntracks.ts
- ocrLearning.ts
- mcp.ts
- Changelog
- backup.ts
- app/page.tsx
- chat/route.ts
- notes.ts
- MemoryPage
- claude.ts
- secondLook.ts
- ref_fs
- insights/route.ts
- chatMemory.ts
- db
- quality
- map/pin/route.ts
- memory/page.tsx
- env
- isAuthenticated
- retranscribe.ts
- mind.ts
- discipline/route.ts
- notebooks/route.ts
- notebooks/page.tsx
- map/pin/route.ts
- embeddings.ts
- dependencies
- decisionWiki.ts
- reflectionWiki.ts
- isAuthenticated
- getCurrentProfile
- DiaryGraphClient.tsx
- auth.ts
- Worked example: Agent Teams for competing-hypothesis debugging
- devDependencies
- vitest
- entityWiki.ts
- ForceGraph
- notebooksPin.ts
- backfill-all/route.ts
- dropbox/export/route.ts
- entityMerge.ts
- notebooks/pin/route.ts
- chatDiary.ts
- remarkable/status/route.ts
- db.ts
- mcpOauth.ts
- next
- Codex Response to Claude Code's Verification
- pendingShares.ts
- entityMerge.ts
- track
- vaultGraph.ts
- authorize/route.ts
- usage.ts
- Map3D.tsx
- pendingShares.ts
- manifest.json
- location.ts
- register/route.ts
- analyzePending
- next
- extractEntryDate
- package.json
- react
- Nav.tsx
- notebooks/[id]/pdf/route.ts
- token/route.ts
- mind/route.ts
- createPinGate
- dropboxExportLock.test.ts
- webauthn.ts
- api/export/route.ts
- notes.ts
- setSetting
- relatedEntities.test.ts
- chatDiary.ts
- models/route.ts
- Performance Checklist
- authRoute.test.ts
- topEntities.test.ts
- Remarkabler — User Guide
- recordSuccessfulAuth
- pagesForEntity.test.ts
- memories/route.ts
- librarian/route.ts
- entityGraph.ts
- scripts
- chatToolsLocation.test.ts
- entityMerge.test.ts
- ocrLearningDb.test.ts
- Claude Code — Response to Codex's Reply
- mcp/route.ts
- api/diary/route.ts
- chatMemoryExtract.test.ts
- chatMemoryRecall.test.ts
- chatMemoryRolling.test.ts
- entityTagging.test.ts
- Accessibility Checklist
- corsHeaders
- Security Checklist
- Web Performance Auditor
- chatMemoryRecall.test.ts
- eslint
- correctPageText.test.ts
- decodeEmbedding
- embeddingMapDiscipline.test.ts
- entityWikiExclude.test.ts
- ocrLearningDb.test.ts
- chatDiary.test.ts
- owntracks/route.ts
- ref_fs
- mind.test.ts
- vitest
- dropboxTombstone.test.ts
- Remarkabler
- usage.ts
- owntracksCurrent.test.ts
- Testing Patterns Reference (JavaScript/TypeScript)
- Chat with your diary on your Claude subscription (MCP setup)
- rm2pdf
- postcss.config.mjs
- entityWikiExclude.test.ts
- eslint
- entityGraph.ts
- api/diary/route.ts
- entityTagging.test.ts
- notebooksPinDenied
- db.ts
- 2026-06-19 (Entities layer; Graphify evaluated and rejected)
- chatMemoryDedup.test.ts
- Review Scope
- Layer by layer
- ref_path
- clientIp
- shares/route.ts
- CLAUDE.md
- Review Framework
- Design
- Approach
- The Standing Checklist
- Observability Checklist
- Session log — 2026-08-25
- Remarkabler — one-page project index
- Remarkabler — architecture & structure map
- merge-entities/route.ts
- 2026-06-18 (Chat memory)
- Impeccable — design anti-pattern checklist
- Connect Remarkabler to an Obsidian graph (phone guide)
- Remarkabler Full Code Review
- AGENTS.md — onboarding for any AI working on this repo
- map/route.ts
- Issue tracker: GitHub
- Bug: relationship data can be silently dropped from the exported vault
- mcp.test.ts
- README.md
- process/route.ts
- librarian/route.ts
- 2026-05-15
- 2026-06-16 (Dropbox review-pass fixes from the review)
- Domain Docs
- Graphify Phase A
- Audit: typed entity relationships (shipped by Codex) + what's actually next
- [batchId]/route.ts
- ship.md
- Findings
- 1. [P1] Public share target can trigger unauthenticated OCR and storage abuse
- 2. [P1] OAuth dynamic registration enables consent phishing
- 7. [P2] `/memory` has a reproducible hydration failure
- Configuration
- webauthnChallengeSeparation.test.ts
- 2026-05-16
- 2026-06-01
- 2026-06-15 (mind: bulletproof label visibility + diagnostics)
- 2026-06-16 (Dropbox auto-ingest)
- build.md
- webperf.md
- Share-target designs that work without the normal session
- 3. [P2] Precise location is disclosed to an undocumented third party
- 4. [P2] Production framework is unsupported and dependencies have an audit backlog
- 5. [P2] Logout cannot revoke copied sessions and inactivity is global
- 6. [P2] Global passcode lockout permits unauthenticated denial of service
- 8. [P2] Auto-deployment has no automated quality gate
- 9. [P3] Entity filename sanitization can merge distinct entities
- 2026-08-24 - Full review remediation
- conversationEntities.test.ts
- dropboxStatus.test.ts
- writingCoach.test.ts
- 6. Extra memory sources (optional)
- 2026-06-03
- 2026-06-04 (chat attachment extraction)
- 2026-06-04 (later)
- 2026-06-05
- 2026-06-05 (mobile display optimization)
- 2026-06-14
- 2026-06-14 (later)
- 2026-06-14 (mind: 3D map touch fix)
- 2026-06-14 (mind: axis labels render in any language)
- 2026-06-14 (mind visualizations)
- 2026-06-15 (heatmap: 6-month window)
- 2026-06-15 (mind: guaranteed-visible axis legend)
- 2026-06-16 (PR #37 final-pass nits)
- triage-labels.md

## God Nodes (most connected - your core abstractions)
1. `db()` - 323 edges
2. `Architecture` - 190 edges
3. `Changelog` - 184 edges
4. `isAuthenticated()` - 153 edges
5. `vitest` - 94 edges
6. `next` - 84 edges
7. ``lib/` — the core logic` - 82 edges
8. `getSetting()` - 76 edges
9. `Hard-won rules — do not regress these` - 72 edges
10. `setSetting()` - 69 edges

## Surprising Connections (you probably didn't know these)
- `Do not regress` --references--> `isAuthenticated()`  [INFERRED]
  DESIGN.md → lib/auth.ts
- `Share-session certainty` --references--> `requireAuth()`  [INFERRED]
  docs/reviews/2026-08-23-codex-response-to-claude-verification.md → lib/auth.ts
- `Agreement with Codex's direct answers` --references--> `recordSuccessfulAuth()`  [INFERRED]
  docs/reviews/2026-08-23-claude-response-to-codex.md → lib/auth.ts
- `Finding 6 — "half wrong" was unfair` --references--> `recordSuccessfulAuth()`  [INFERRED]
  docs/reviews/2026-08-23-claude-response-to-codex.md → lib/auth.ts
- `Proposed PR breakdown` --references--> `recordSuccessfulAuth()`  [INFERRED]
  docs/reviews/2026-08-23-claude-response-to-codex.md → lib/auth.ts

## Import Cycles
- 2-file cycle: `lib/entityMerge.ts -> lib/mind.ts -> lib/entityMerge.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/claude.ts -> lib/chatTools.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/dropbox.ts -> lib/reflectionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/conversationWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/conversationWiki.ts`
- 4-file cycle: `lib/decisionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/decisionWiki.ts`
- 4-file cycle: `lib/diaryExportDb.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/mind.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/entityMerge.ts -> lib/claude.ts -> lib/chatTools.ts`
- 5-file cycle: `lib/conversationEntities.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts -> lib/conversationEntities.ts`
- 5-file cycle: `lib/diaryExportDb.ts -> lib/reflectionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts`
- 5-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/entityMerge.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 5-file cycle: `lib/conversationWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts -> lib/conversationWiki.ts`
- 5-file cycle: `lib/decisionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts -> lib/decisionWiki.ts`

## Communities (213 total, 31 thin omitted)

### Community 0 - "dropbox.ts"
Cohesion: 0.07
Nodes (43): dynamic, GET(), runtime, dynamic, GET(), runtime, dynamic, POST() (+35 more)

### Community 1 - "diaryExportDb.ts"
Cohesion: 0.08
Nodes (42): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, LOCKED(), POST() (+34 more)

### Community 2 - "remarkableCloud.ts"
Cohesion: 0.04
Nodes (58): MAX_DIARY_ENTRY_CHARS, CHAT_TOOLS, MAX_ENTITY_NOTES_CHARS, AUDIT_KEEP_ROWS, authFailures, COMPANION_GUIDANCE, configuredTokens(), conversationExportEnabled() (+50 more)

### Community 3 - "owntracks.ts"
Cohesion: 0.06
Nodes (26): Unreleased - Marker exactly one line too high (equal band/line counts), Unreleased - Proofreading card: marker and open-PDF fixes, bash_edits_code(), main(), marker_path(), main(), _acf_pitch(), _align() (+18 more)

### Community 4 - "ocrLearning.ts"
Cohesion: 0.07
Nodes (53): dynamic, POST(), runtime, dynamic, GET(), reparseIfNeeded(), runtime, 2026-06-14 (mind: axis labels) (+45 more)

### Community 5 - "mcp.ts"
Cohesion: 0.08
Nodes (69): `lib/` — the core logic, 4. `lib/` modules by domain, 2026-07-05 (life wiki — Claude-written entity profiles), 2026-07-05 (wiki + extraction: profile every named thing, not just people), Infra, `lib/claude.ts` additions, Unreleased - Phase 5: handwriting examples, Working with this user (+61 more)

### Community 6 - "Changelog"
Cohesion: 0.02
Nodes (87): 2026-06-14 (mind: review-pass fixes), 2026-06-20 (UI refresh: single-font Clear Sans + design tokens), 2026-07-02 (reMarkable cloud — Phase 1a: Dockerfile + renderer toolchain), 2026-07-03 (chat model — Claude Sonnet 5), 2026-07-03 (insights — weekly auto-generation is now an opt-in toggle, default OFF), 2026-07-03 (reMarkable cloud — folder chips + readable dates on the import list), 2026-07-03 (reMarkable import — one-tap quality-gate Compare report), 2026-07-03 (reMarkable import — review fixes on PR #78) (+79 more)

### Community 7 - "backup.ts"
Cohesion: 0.07
Nodes (44): dynamic, GET(), LOCKED(), MemoryRow, runtime, 2026-06-20 (Fix: chat memory the user can see but Claude couldn't), 2026-06-21 (Fix: pending chat-memory batches stuck without recourse), 2026-07-11 (deep multi-agent review: 11 verified fixes) (+36 more)

### Community 8 - "app/page.tsx"
Cohesion: 0.10
Nodes (26): dynamic, Home(), LatestInsight, preview(), RecentNotebook, statusLabel(), DayCost, DayData (+18 more)

### Community 9 - "chat/route.ts"
Cohesion: 0.17
Nodes (22): 2026-07-13 (location: chat now sees your current position for a stationary user), 2026-07-15 (MCP endpoint: enforce read-only literally — Codex review fix), 2026-11-13 (Map tab), getRecentLocations(), cachedPlace(), cacheKey(), reverseGeocodePlace(), RoutePoint (+14 more)

### Community 10 - "notes.ts"
Cohesion: 0.10
Nodes (41): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, 2026-06-16 (verification follow-up), Fixed (+33 more)

### Community 11 - "MemoryPage"
Cohesion: 0.10
Nodes (21): dependencies, better-sqlite3@^11.3.0, jszip@^3.10.1, leaflet@^1.9.4, mcp-handler@^1.1.0, next@^16.4.6, pdf-parse@^2.4.5, react@^19.2.8 (+13 more)

### Community 12 - "claude.ts"
Cohesion: 0.09
Nodes (38): ExportedConversationRow, addEdge(), addEvidence(), buildDiaryGraph(), canonicalKey(), contentId(), ContentInfo, ContentKind (+30 more)

### Community 13 - "secondLook.ts"
Cohesion: 0.32
Nodes (5): OcrFlag, applySecondLook(), LookAnswer, LookItem, parseLookAnswers()

### Community 14 - "ref_fs"
Cohesion: 0.07
Nodes (28): setPickingFile(), Mode, PinGate(), onChange(), post(), submit(), Card, OcrReview() (+20 more)

### Community 15 - "insights/route.ts"
Cohesion: 0.17
Nodes (16): dynamic, GET(), LOCKED(), maxDuration, PATCH(), POST(), runtime, 2026-11-11 (Insights: also read saved Claude sessions, Records and claude's lens) (+8 more)

### Community 16 - "chatMemory.ts"
Cohesion: 0.07
Nodes (22): formatBytes(), MemoryPage(), disconnectDropbox(), getPosition(), load(), loadBackup(), loadDisc(), loadDropbox() (+14 more)

### Community 17 - "db"
Cohesion: 0.13
Nodes (22): 2026-11-17 (Transcription proofreading, Phase 2: learning), 2026-11-17 (Transcription proofreading, Phase 3: auto-fix and handwriting notes), applyFixes(), AUTOFIX_MIN, autoFixablePairs(), autoFixPages(), buildOcrHints(), confirmedTerms() (+14 more)

### Community 18 - "quality"
Cohesion: 0.15
Nodes (24): MapStayDto, MapView(), RoutePointDto, Data, fmt(), Gate, MapPage(), MapView (+16 more)

### Community 19 - "map/pin/route.ts"
Cohesion: 0.08
Nodes (43): dynamic, LOCKED(), maxDuration, POST(), runtime, 2026-06-25 (Diary Markdown export — portable, tool-agnostic backup), 2026-07-02 (Diary export follow-ups from review of #69), 2026-07-03 (reMarkable compare — carry dates forward; the "missing" section wasn't missing) (+35 more)

### Community 20 - "memory/page.tsx"
Cohesion: 0.21
Nodes (15): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, BINARY_EXT, disciplineConfig() (+7 more)

### Community 21 - "env"
Cohesion: 0.13
Nodes (29): dynamic, LOCKED(), POST(), runtime, 2026-07-03 (reMarkable cloud — Phase 2: zero-tap sync), 2026-07-06 (codebase-review batch: attachment-cleanup race + doc/naming/a11y), classifyReocr(), cursorValue() (+21 more)

### Community 22 - "isAuthenticated"
Cohesion: 0.06
Nodes (38): 5. Hard-won rules — do not regress these, ATTACHMENT_DIR, dynamic, GET(), runtime, dynamic, GET(), LOCKED() (+30 more)

### Community 23 - "retranscribe.ts"
Cohesion: 0.24
Nodes (16): dynamic, GET(), LOCKED(), POST(), runtime, Cand, estimateRetranscribe(), FILES_DIR (+8 more)

### Community 24 - "mind.ts"
Cohesion: 0.11
Nodes (24): dynamic, GET(), runtime, Unreleased - "view page" replaces "open PDF" on proofreading cards, Block, Box, CaptureArgs, cropFile() (+16 more)

### Community 25 - "discipline/route.ts"
Cohesion: 0.13
Nodes (21): ATTACHMENT_DIR, DELETE(), dynamic, EXT, ext(), EXT_TO_MIME, GET(), IMAGE_TYPES (+13 more)

### Community 26 - "notebooks/route.ts"
Cohesion: 0.07
Nodes (27): concurrency, cancel-in-progress, group, CI, NEXT_TELEMETRY_DISABLED, jobs, quality, name (+19 more)

### Community 27 - "notebooks/page.tsx"
Cohesion: 0.13
Nodes (18): dynamic, LOCKED(), maxDuration, POST(), runtime, ExistingRow, importRemarkableNotebook(), importRemarkableNotebookInner() (+10 more)

### Community 28 - "map/pin/route.ts"
Cohesion: 0.16
Nodes (22): dynamic, GET(), POST(), runtime, unlocked(), attemptsLeft, gate, makeUnlockToken (+14 more)

### Community 29 - "embeddings.ts"
Cohesion: 0.07
Nodes (26): COMMENT_BODY, COMMENT_URL, EVENT_NAME, GH_TOKEN, PR_NUMBER, REPO, if, runs-on (+18 more)

### Community 30 - "dependencies"
Cohesion: 0.20
Nodes (29): 2026-08-24 (Fix: interrupted reMarkable syncs no longer lose their pages), 1. Interrupted reMarkable syncs destroyed diary pages (introduced), 2. Unauthenticated passkey enrollment (pre-existing, live), What independent verification found, countEntriesMentioning(), currentTimeKst(), executeTool(), ftsSearch() (+21 more)

### Community 31 - "decisionWiki.ts"
Cohesion: 0.15
Nodes (36): 2026-07-02 (Diary auto-export is now one Markdown file per day), 2026-07-05 (Obsidian entity stub notes), 2026-07-20 (Second-brain vault structure: Home dashboard + entity indexes + Profile note), Root cause, The fix, Entity stub notes — clickable graph nodes (shipped, PR #104), allConversationFileNames(), allDecisionFileNames() (+28 more)

### Community 32 - "reflectionWiki.ts"
Cohesion: 0.19
Nodes (18): DELETE(), dynamic, GET(), LOCKED(), POST(), runtime, escapeHtml(), GET() (+10 more)

### Community 33 - "isAuthenticated"
Cohesion: 0.12
Nodes (26): AxisLabels, EmbeddingMap(), EntityRankings(), Heatmap(), HeatmapBucket, Map3D, MapPoint, MindData (+18 more)

### Community 34 - "getCurrentProfile"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.47, @types/better-sqlite3@^7.6.11, @types/d3-force@^3.0.10, @types/node@^22.7.4, @types/react@^19.2.18, @types/react-dom@^19.2.4 (+12 more)

### Community 35 - "DiaryGraphClient.tsx"
Cohesion: 0.19
Nodes (18): captureExample(), anchorPhrase(), clean(), contextSnippet(), insideLatinWord(), parseBox(), parseFlagLines(), replaceAt() (+10 more)

### Community 36 - "auth.ts"
Cohesion: 0.11
Nodes (39): dynamic, GET(), POST(), relyingParty(), runtime, 2026-08-25 (Security: bind WebAuthn challenges server-side), Finding 5 — No session revocation [P2 → P3], AUTH_CHALLENGE_COOKIE (+31 more)

### Community 37 - "Worked example: Agent Teams for competing-hypothesis debugging"
Cohesion: 0.06
Nodes (31): 1. Direct invocation (no orchestration), 2. Single-persona slash command, 3. Parallel fan-out with merge, 4. Sequential pipeline as user-driven slash commands, 5. Research isolation (context preservation), A. Router persona ("meta-orchestrator"), Anti-pattern in this scenario, Anti-patterns (+23 more)

### Community 38 - "devDependencies"
Cohesion: 0.14
Nodes (24): 2026-07-19 (Guaranteed entity-tagging + bidirectional Obsidian links for conversations & reflections), 2026-07-19 (MCP: save_reflection — a standalone reflection tool, shared across every Claude surface), entityStubWikiTarget(), maybeExportReflectionsToDropbox(), REFLECTIONS_NOTEBOOK_ID, ensureReflectionPage(), ensureReflectionsNotebook(), KINDS (+16 more)

### Community 39 - "vitest"
Cohesion: 0.09
Nodes (44): New module: `lib/chatMemory.ts`, Architecture, B2. Write tool `relate_entities` (`lib/mcp.ts`), B3. Extend `get_entity_wiki` read (compose in `lib/mcp.ts`, NOT the data layer), Step 2 — MCP surface, Verdict: all seven SATISFIED. No corrective work required., normaliseChatMemoryCategory(), resetBatchForRetry() (+36 more)

### Community 40 - "entityWiki.ts"
Cohesion: 0.40
Nodes (11): AutoLock(), cancelPending(), lockNow(), markHiddenIfNeeded(), onPageHide(), onVisibility(), clearHiddenSince(), readHiddenSince() (+3 more)

### Community 41 - "ForceGraph"
Cohesion: 0.16
Nodes (16): 2026-07-20 (Decision Records: the save_decision MCP write tool), DECISION_FOLDER, decisionNoteFileName(), markDecisionsFiled(), MAX_DECISION_CHARS, renderDecisionNote(), renderDecisionNoteFiles(), sanitizeFileName() (+8 more)

### Community 42 - "notebooksPin.ts"
Cohesion: 0.24
Nodes (16): dynamic, GET(), POST(), runtime, unlocked(), checkPasscode(), gate, makeNotebooksUnlockToken (+8 more)

### Community 43 - "backfill-all/route.ts"
Cohesion: 0.09
Nodes (28): dynamic, LOCKED(), POST(), runtime, 1. Startup orphan migration now chunks (was creating one giant batch), 2026-06-20 (Tier-1: chat-memory backfill + entity write correctness), 2026-06-20 (Tier-2: cleanup — shared helpers, schema constraints, docs), 2026-07-19 (Whole-app code review fixes: OAuth cap, dedup SQL, Button consolidation, /mind stuck-page bug) (+20 more)

### Community 44 - "dropbox/export/route.ts"
Cohesion: 0.10
Nodes (25): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, GET(), runtime (+17 more)

### Community 45 - "entityMerge.ts"
Cohesion: 0.13
Nodes (17): DiaryGraphClient(), EDGE_COLORS, EDGE_LABELS, EDGE_TYPES, formatGeneratedAt(), Inspector(), Metric(), metricLabel() (+9 more)

### Community 46 - "notebooks/pin/route.ts"
Cohesion: 0.14
Nodes (16): EntityPredicate, isEntityPredicate(), PREDICATE_LABELS, PREDICATES, CleanRelationshipInput, cleanRelationships(), EntityKind, isEntityKind() (+8 more)

### Community 47 - "chatDiary.ts"
Cohesion: 0.14
Nodes (27): dynamic, GET(), maxDuration, POST(), runtime, 2026-07-20 (Write your diary by conversation: the save_diary_entry MCP tool), Hard-won rules around embedding backfill, CHAT_DIARY_NOTEBOOK_NAME (+19 more)

### Community 48 - "remarkable/status/route.ts"
Cohesion: 0.50
Nodes (4): dynamic, GET(), LOCKED(), runtime

### Community 49 - "db.ts"
Cohesion: 0.29
Nodes (10): ForceGraph(), draw(), fit(), hit(), loop(), onDown(), onMove(), onWheel() (+2 more)

### Community 50 - "mcpOauth.ts"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 51 - "next"
Cohesion: 0.08
Nodes (22): DELETE(), dynamic, LOCKED(), runtime, dynamic, GET(), LOCKED(), maxDuration (+14 more)

### Community 52 - "Codex Response to Claude Code's Verification"
Cohesion: 0.09
Nodes (22): 2. Should OAuth consent phishing be P2 rather than P1?, 3. Are the downgrades for Findings 5, 6, 7, and 9 appropriate?, 4. Is the missing `recordSuccessfulAuth()` the real Finding 6 defect?, 5. Is collision detection preferable to changing entity mapping?, 6. What about Docker digest construction and Railway volume permissions?, Assessment of Claude's additional findings, Change-control note, CI impact wording (+14 more)

### Community 53 - "pendingShares.ts"
Cohesion: 0.16
Nodes (14): 2026-07-05 (life wiki — deep profiles from the whole diary history), 2026-07-05 (life wiki follow-ups), EntityWikiExcerpt, allEntityWikiRows(), candidates(), evenSample(), excerptHash(), excerptsLen() (+6 more)

### Community 54 - "entityMerge.ts"
Cohesion: 0.12
Nodes (26): POST(), 2026-07-05 (merge duplicate entities), B0. Schema (`lib/db.ts`, in the `SCHEMA` string after `entity_conversation_notes`), B1. Data layer — new file `lib/entityRelationships.ts`, B5. Tests (extend existing), B6. Docs, B7. Deferred (do NOT build now — note in CHANGELOG), Build order (per review) (+18 more)

### Community 55 - "track"
Cohesion: 0.18
Nodes (21): track(), InsightsPage(), copy(), download(), exportText(), generate(), load(), summarize() (+13 more)

### Community 56 - "vaultGraph.ts"
Cohesion: 0.11
Nodes (27): dynamic, err(), POST(), readForm(), runtime, 2026-07-18 (MCP OAuth: rotating the token now truly revokes — Codex P1 fix), Finding 2 — OAuth consent phishing [P1 → P2], AuthCode (+19 more)

### Community 57 - "authorize/route.ts"
Cohesion: 0.19
Nodes (14): dynamic, GET(), LOCKED(), maxDuration, runtime, dynamic, GET(), hasNotes() (+6 more)

### Community 58 - "usage.ts"
Cohesion: 0.21
Nodes (11): coachablePages(), CoachSession, MAX_BATCH_CHARS, maybeCoachWriting(), MIN_BATCH_CHARS, MIN_PAGE_CHARS, pickBatch(), RECENT_DAYS (+3 more)

### Community 59 - "Map3D.tsx"
Cohesion: 0.17
Nodes (25): extractTaggingEntities(), listUnlinkedConversations(), DecisionEntityInput, ensureDecisionPage(), ensureDecisionsNotebook(), KINDS, tagDecisionEntities(), dateKey() (+17 more)

### Community 60 - "pendingShares.ts"
Cohesion: 0.17
Nodes (15): cleanName(), createPendingShare(), MAX_PENDING_BYTES, MAX_PENDING_SHARES, PENDING_DIR, PENDING_RETENTION_HOURS, PendingRow, PendingShare (+7 more)

### Community 61 - "manifest.json"
Cohesion: 0.18
Nodes (13): dynamic, GET(), runtime, dynamic, GraphPage(), DiaryGraphPayload, VaultNoteKind, readDropboxTextFiles() (+5 more)

### Community 62 - "location.ts"
Cohesion: 0.26
Nodes (17): consentForm(), destHost(), dynamic, esc(), GET(), OAuthParams, page(), POST() (+9 more)

### Community 63 - "register/route.ts"
Cohesion: 0.18
Nodes (14): ActiveLabel(), Axes(), AxisEndLabel(), AxisLabels, Map3D(), MapPoint, Point(), sentimentColour() (+6 more)

### Community 64 - "analyzePending"
Cohesion: 0.13
Nodes (14): background_color, description, display, icons, name, files, share_target, action (+6 more)

### Community 65 - "next"
Cohesion: 0.24
Nodes (10): dynamic, POST(), readBoundedJson(), runtime, RFC-7591, REGISTER_THROTTLE_BUCKET, MAX_DCR_BODY_BYTES, parseClientRegistrationMetadata() (+2 more)

### Community 66 - "extractEntryDate"
Cohesion: 0.12
Nodes (17): dynamic, POST(), runtime, 2026-06-14 (mind: fix date regex + carry-forward), 2026-06-15 (review follow-through), 2026-07-02 (Date parser: tolerate spaced separators in the header), 2026-07-06 (edit transcription: refresh all derived indexes; review #124), 2026-07-06 (edit transcription: reparse carry-forward on header change; review #125) (+9 more)

### Community 67 - "package.json"
Cohesion: 0.12
Nodes (15): @anthropic-ai/sdk@^0.96.0, mammoth@^1.12.0, @modelcontextprotocol/sdk@^1.26.0, posthog-js@^1.374.3, @types/leaflet@^1.9.12, engines, node, name (+7 more)

### Community 68 - "react"
Cohesion: 0.11
Nodes (24): Insight, Session, WritingCoach(), ChatMemoryItem, ChatMemorySection(), backfillAll(), load(), processPending() (+16 more)

### Community 69 - "Nav.tsx"
Cohesion: 0.25
Nodes (6): LockAllButton(), LINKS, Nav(), DocWithVT, Props, TransitionLink()

### Community 70 - "notebooks/[id]/pdf/route.ts"
Cohesion: 0.20
Nodes (9): ForceEdgeInput, ForceNodeInput, Props, radiusFor(), SimLink, SimNode, Transform, d3-force@^3.0.1 (+1 more)

### Community 71 - "token/route.ts"
Cohesion: 0.15
Nodes (8): CeMod, CwMod, DbMod, DiaryGraphPayload, GraphMod, MindMod, NotesMod, RelMod

### Community 72 - "mind/route.ts"
Cohesion: 0.22
Nodes (7): codeFrom(), consent(), exchange(), issueAccessToken(), Mod, pkce(), register()

### Community 73 - "createPinGate"
Cohesion: 0.23
Nodes (12): Duplicate-notebook detection (shipped, PR #103), Open / next ideas (not started), Session log — 2026-07-05, User-facing setup guide, buildCandidate(), buildCloudCoverage(), classifyDuplicate(), CloudCoverage (+4 more)

### Community 74 - "dropboxExportLock.test.ts"
Cohesion: 0.33
Nodes (11): dynamic, fmtDate(), fmtDateTime(), fmtTime(), GET(), LOCKED(), maxDuration, runtime (+3 more)

### Community 75 - "webauthn.ts"
Cohesion: 0.18
Nodes (15): dynamic, GET(), LOCKED(), POST(), runtime, dynamic, GET(), LOCKED() (+7 more)

### Community 76 - "api/export/route.ts"
Cohesion: 0.20
Nodes (14): dynamic, GET(), LOCKED(), POST(), runtime, maybeRefreshHandwritingNotes(), correctedPairsForNotes(), handwritingNotesDue() (+6 more)

### Community 77 - "notes.ts"
Cohesion: 0.11
Nodes (33): 2026-07-19 (Zero-tap sync actually runs zero-tap: a real background timer), 1. Is corpus injection the operative severity driver for Finding 1?, register(), cleanupOrphanChatAttachments(), maybeCleanupOrphanAttachments(), claimNextQueuedNotebook(), drainNotebookProcessingQueue(), ensureProfileSeed() (+25 more)

### Community 78 - "setSetting"
Cohesion: 0.25
Nodes (14): 2026-11-17 (Notebooks tab: its own 4-digit PIN), setSetting(), maybeIngestDropbox(), createPinGate(), attemptsLeft(), configured(), cookieKey(), lockRemainingMs() (+6 more)

### Community 79 - "relatedEntities.test.ts"
Cohesion: 0.33
Nodes (3): ClaudeMod, CmMod, DbMod

### Community 80 - "chatDiary.ts"
Cohesion: 0.20
Nodes (7): ConversationWikiMod, DbMod, deferred(), DiaryExportDbMod, DropboxMod, mockDropboxFetch(), UploadCall

### Community 81 - "models/route.ts"
Cohesion: 0.33
Nodes (8): dynamic, GET(), LOCKED(), POST(), resolve(), runtime, Slot, SLOTS

### Community 82 - "Performance Checklist"
Cohesion: 0.11
Nodes (18): API, Backend Checklist, Common Anti-Patterns, Core Web Vitals Targets, CSS, Database, Fonts, Frontend Checklist (+10 more)

### Community 84 - "topEntities.test.ts"
Cohesion: 0.20
Nodes (5): ChatToolsMod, DbMod, MergeMod, NotesMod, Result

### Community 85 - "Remarkabler — User Guide"
Cohesion: 0.11
Nodes (19): 1. Feeding your notes (the core loop), 2. Chatting with it, 3. Insights, 4. Mind — your diary, visualized, 5. Memory — the "profile of you", Appendix — for whoever sets up the app, Choosing your Claude models, Cost (+11 more)

### Community 86 - "recordSuccessfulAuth"
Cohesion: 0.13
Nodes (17): 2026-08-24 (Restore a global floor under the passcode lockout), Executive summary, Finding 10 — Root container, mutable base tag [P3-low], Finding 4 — Next.js unsupported + dependency backlog [P2 confirmed], Finding 6 — Global passcode lockout DoS [P2 → P3, PARTIAL], Finding 7 — `/memory` hydration failure [P2 → P3], Finding 8 — No CI quality gate [P2 confirmed], Finding 9 — Entity filename collision [P3 → P4] (+9 more)

### Community 87 - "pagesForEntity.test.ts"
Cohesion: 0.22
Nodes (8): build, builder, dockerfilePath, deploy, restartPolicyMaxRetries, restartPolicyType, startCommand, $schema

### Community 88 - "memories/route.ts"
Cohesion: 0.22
Nodes (6): body, enc, iv, MAGIC, salt, tag

### Community 89 - "librarian/route.ts"
Cohesion: 0.22
Nodes (5): AuthMod, DbMod, requestCookies, RouteMod, webauthn

### Community 90 - "entityGraph.ts"
Cohesion: 0.22
Nodes (4): ChatToolsMod, DbMod, MindMod, NotesMod

### Community 91 - "scripts"
Cohesion: 0.25
Nodes (3): DbMod, ExportMod, NotesMod

### Community 93 - "entityMerge.test.ts"
Cohesion: 0.25
Nodes (3): ChatToolsMod, DbMod, NotesMod

### Community 94 - "ocrLearningDb.test.ts"
Cohesion: 0.18
Nodes (7): ClaudeMod, DbMod, EwMod, Db, L, Review, Store

### Community 95 - "Claude Code — Response to Codex's Reply"
Cohesion: 0.11
Nodes (17): 1. Dependency characterization — I was wrong, 2. "Guaranteed 100%" on the share session — overstated, 3. Location privacy after moving geocoding server-side — incomplete fix, 4. CI impact wording — corrected, Agreement with Codex's direct answers, Change-control note, Characterizations I withdraw, Claude Code — Response to Codex's Reply (+9 more)

### Community 96 - "mcp/route.ts"
Cohesion: 0.19
Nodes (14): auditRequest(), dynamic, guarded(), handler, maxDuration, runtime, RFC-9728, 2026-07-18 (MCP: OAuth so the claude.ai app connector can connect) (+6 more)

### Community 97 - "api/diary/route.ts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, test:watch

### Community 98 - "chatMemoryExtract.test.ts"
Cohesion: 0.29
Nodes (4): ChatToolsMod, DbMod, LocationMod, OwntracksMod

### Community 100 - "chatMemoryRolling.test.ts"
Cohesion: 0.29
Nodes (4): CwMod, DbMod, MergeMod, RelMod

### Community 101 - "entityTagging.test.ts"
Cohesion: 0.29
Nodes (3): DbMod, MindMod, NotesMod

### Community 102 - "Accessibility Checklist"
Cohesion: 0.12
Nodes (16): Accessibility Checklist, Accessible Lists, ARIA Roles, Buttons vs. Links, Common Anti-Patterns, Common HTML Patterns, Content, Essential Checks (+8 more)

### Community 103 - "corsHeaders"
Cohesion: 0.17
Nodes (16): dynamic, GET(), OPTIONS(), runtime, RFC-8414, dynamic, GET(), OPTIONS() (+8 more)

### Community 104 - "Security Checklist"
Cohesion: 0.12
Nodes (16): AI / LLM Security, Authentication, Authorization, CORS Configuration, Data Protection, Dependency Security, Error Handling, Input Validation (+8 more)

### Community 105 - "Web Performance Auditor"
Cohesion: 0.12
Nodes (15): 1. Core Web Vitals, 2. Loading, 3. Rendering / JavaScript, 4. Network, Composition, Deep mode (activated when tool artifacts or live measurement are available), Metric-Honesty Rule, Operating Modes (+7 more)

### Community 106 - "chatMemoryRecall.test.ts"
Cohesion: 0.33
Nodes (3): CmMod, DbMod, EmbMod

### Community 108 - "correctPageText.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 109 - "decodeEmbedding"
Cohesion: 0.16
Nodes (14): backfillTitles(), 2026-06-04, Fixed (10-agent code review pass), Code review pass (PR #7 — merged 2026-06-04), Don't forget, How we tested, OCR stays on Opus — validated against Sonnet, Session log — 2026-06-04 (+6 more)

### Community 110 - "embeddingMapDiscipline.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, DedupMod, NotesMod

### Community 111 - "entityWikiExclude.test.ts"
Cohesion: 0.33
Nodes (3): Db, Review, Store

### Community 112 - "ocrLearningDb.test.ts"
Cohesion: 0.53
Nodes (4): strip(), tokens(), WordChange, wordChanges()

### Community 113 - "chatDiary.test.ts"
Cohesion: 0.40
Nodes (4): CdMod, DbMod, MindMod, NotesMod

### Community 114 - "owntracks/route.ts"
Cohesion: 0.24
Nodes (13): dynamic, GET(), isPlausiblePoint(), POST(), runtime, 2026-07-15 (location: diagnose WHY tracking gaps form), addPoint(), analyzeGaps() (+5 more)

### Community 115 - "ref_fs"
Cohesion: 0.11
Nodes (8): AuthMod, DbMod, DbMod, DbMod, MindMod, DbMod, NotesMod, SyncMod

### Community 116 - "mind.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, MindMod, NotesMod

### Community 117 - "vitest"
Cohesion: 0.06
Nodes (19): vitest, AuthMod, DbMod, BackfillHelpers, DbMod, DbMod, NotesMod, DbMod (+11 more)

### Community 118 - "dropboxTombstone.test.ts"
Cohesion: 0.40
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 119 - "Remarkabler"
Cohesion: 0.13
Nodes (15): Architecture, Before you start: cost, privacy, and a lock, Chat with your diary from your Claude subscription (optional), Deployment, Design notes (don't regress these), Getting your notes in — three ways, Honest cost, Hosted (Railway) — recommended (+7 more)

### Community 120 - "usage.ts"
Cohesion: 0.24
Nodes (12): dynamic, GET(), runtime, dailyUsage(), FALLBACK, monthlyUsage(), Prices, PRICES (+4 more)

### Community 121 - "owntracksCurrent.test.ts"
Cohesion: 0.50
Nodes (3): tailwindcss@^3.4.13, tailwindcss, config

### Community 122 - "Testing Patterns Reference (JavaScript/TypeScript)"
Cohesion: 0.14
Nodes (13): API / Integration Testing, Common Assertions, E2E Testing (Playwright), Mock at Boundaries Only, Mock Functions, Mock Modules, Mocking Patterns, React/Component Testing (+5 more)

### Community 123 - "Chat with your diary on your Claude subscription (MCP setup)"
Cohesion: 0.14
Nodes (14): Chat with your diary on your Claude subscription (MCP setup), Linking conversations, reflections, and decisions into your entity wiki (OFF by default), Saving a Decision Record (OFF by default), Saving an independent reflection (OFF by default), Saving conversations into your Obsidian wiki (OFF by default), Security notes, Sensitive tools are OFF by default, Step 1 — Create the secret token (once) (+6 more)

### Community 128 - "eslint"
Cohesion: 0.40
Nodes (4): eslint@^9.39.5, eslint-config-next@^16.3.2, eslint, eslint-config-next

### Community 129 - "entityGraph.ts"
Cohesion: 0.40
Nodes (3): DayMembership, EntityKind, RelatedEntity

### Community 130 - "api/diary/route.ts"
Cohesion: 0.40
Nodes (5): dynamic, Entry, GET(), LOCKED(), runtime

### Community 131 - "entityTagging.test.ts"
Cohesion: 0.33
Nodes (5): ClaudeMod, CwMod, DbMod, EtMod, RwMod

### Community 132 - "notebooksPinDenied"
Cohesion: 0.09
Nodes (32): dynamic, GET(), LOCKED(), runtime, dynamic, GET(), PATCH(), runtime (+24 more)

### Community 133 - "db.ts"
Cohesion: 0.11
Nodes (10): ATTACHMENT_DIR, better-sqlite3, BackupMod, DbMod, CleanupMod, DbMod, DbMod, DropboxMod (+2 more)

### Community 134 - "2026-06-19 (Entities layer; Graphify evaluated and rejected)"
Cohesion: 0.17
Nodes (12): 2026-06-19 (Entities layer; Graphify evaluated and rejected), Backfill, Extraction, Hard-won decisions, New chat tool: `top_entities`, Persistence, Schema, Tests (+23, total 177) (+4 more)

### Community 135 - "chatMemoryDedup.test.ts"
Cohesion: 0.40
Nodes (3): CmMod, DbMod, EmbMod

### Community 136 - "Review Scope"
Cohesion: 0.15
Nodes (12): 1. Input Handling, 2. Authentication & Authorization, 3. Data Protection, 4. Infrastructure, 5. Third-Party Integrations, 6. AI / LLM Features (if present), Composition, Output Format (+4 more)

### Community 137 - "Layer by layer"
Cohesion: 0.15
Nodes (12): 1. The execution environment, 2. The context window, 3. The model, 4. Tools, 5. Subagents, 6. Deferred tools & MCP lifecycle, 7. Governance: permissions & hooks, 8. GitHub integration (+4 more)

### Community 138 - "ref_path"
Cohesion: 0.10
Nodes (13): findRouteFiles(), PUBLIC, DbMod, Mod, DbMod, DeMod, DwMod, DbMod (+5 more)

### Community 139 - "clientIp"
Cohesion: 0.26
Nodes (11): DELETE(), dynamic, GET(), runtime, 2026-07-22 (Security hardening: loud lock-off warning, HSTS/isolation headers, guard regression test), requireAuth(), clientIp(), dropAuthCodesForClient() (+3 more)

### Community 140 - "shares/route.ts"
Cohesion: 0.32
Nodes (11): DELETE(), dynamic, GET(), LOCKED(), POST(), runtime, discardPendingShare(), filePath() (+3 more)

### Community 141 - "CLAUDE.md"
Cohesion: 0.17
Nodes (11): Agent skills, Codex, Claude Code, and Antigravity must use Graphify first, Domain docs, GitHub Actions, Issue tracker, Known limits (intentional), Session logs, Stack (+3 more)

### Community 142 - "Review Framework"
Cohesion: 0.17
Nodes (11): 1. Correctness, 2. Readability, 3. Architecture, 4. Security, 5. Performance, Composition, Output Format, Review Framework (+3 more)

### Community 143 - "Design"
Cohesion: 0.17
Nodes (11): Color, Components, Design, Do not regress, Identity in one line, Interactivity, Loading, Long-form reading (+3 more)

### Community 144 - "Approach"
Cohesion: 0.18
Nodes (10): 1. Analyze Before Writing, 2. Test at the Right Level, 3. Follow the Prove-It Pattern for Bugs, 4. Write Descriptive Tests, 5. Cover These Scenarios, Approach, Composition, Output Format (+2 more)

### Community 145 - "The Standing Checklist"
Cohesion: 0.18
Nodes (10): Correctness, Definition of Done, Definition of Done vs. Acceptance Criteria, Documentation, How to Apply, Integration, Quality, Red Flags (+2 more)

### Community 146 - "Observability Checklist"
Cohesion: 0.18
Nodes (10): Alerting, Dashboards, Distributed Tracing, Metrics, Observability Checklist, On-Call Questions (Start Here), Pre-Launch Gate, Structured Logging (+2 more)

### Community 147 - "Session log — 2026-08-25"
Cohesion: 0.18
Nodes (10): Decisions, Known-open, Mistakes made in this session, Session log — 2026-08-25, Shipped, Starting point, The part worth remembering: two fixes, two misses, The split, and why the obvious cut was wrong (+2 more)

### Community 148 - "Remarkabler — one-page project index"
Cohesion: 0.18
Nodes (10): API routes (`app/api/*`), At a glance, Environment variables, Graphify Phase A, Known intentional limits, Models, Remarkabler — one-page project index, UI pages (`app/*`) (+2 more)

### Community 149 - "Remarkabler — architecture & structure map"
Cohesion: 0.20
Nodes (9): 1. What it does (data flow), 2. Layers, 3. Directory tree (annotated), 5. API routes (`app/api/**`), 6. UI pages (`app/*`), 7. Data model (`lib/db.ts`, 20 tables + `pages_fts`), 8. External services & the env vars that gate them, 9. Background work (`runMaintenanceSweep`, gated ≤ once / 5 min) (+1 more)

### Community 150 - "merge-entities/route.ts"
Cohesion: 0.25
Nodes (8): dynamic, Kind, KINDS, maxDuration, postMergeDropbox(), runtime, 2026-07-05 (entity merge: clean up already-merged stubs), listAliases()

### Community 151 - "2026-06-18 (Chat memory)"
Cohesion: 0.25
Nodes (8): 2026-06-18 (Chat memory), API + UI, Behaviour change — Clear is now a real boundary, Hard-won decisions, New tables, One-time backfill migration, Optional env vars, Tests (+53, total 141)

### Community 152 - "Impeccable — design anti-pattern checklist"
Cohesion: 0.25
Nodes (7): AI-slop / overused tells — avoid, Components & structure, Impeccable — design anti-pattern checklist, Motion & state, Spacing, rhythm & layout, Themes & a11y, Typography & color

### Community 153 - "Connect Remarkabler to an Obsidian graph (phone guide)"
Cohesion: 0.25
Nodes (7): 1. Install Obsidian + create a vault, 2. Install the Remotely Save sync plugin, 3. Point Remarkabler's export at that folder, 4. Sync into Obsidian and open the graph, 5. Color-code the graph (optional, ~1 min), Connect Remarkabler to an Obsidian graph (phone guide), Troubleshooting

### Community 154 - "Remarkabler Full Code Review"
Cohesion: 0.25
Nodes (7): Change-control note, Executive summary, Ready-to-paste Claude Code handoff, Remarkabler Full Code Review, Scope and method, Suggested review order, Verification results

### Community 155 - "AGENTS.md — onboarding for any AI working on this repo"
Cohesion: 0.29
Nodes (7): 1. What this app is, 2. Architecture map, 3. How to work here, 4. What you (the AI) CAN and CANNOT do in this environment, 6. Known intentional limits, AGENTS.md — onboarding for any AI working on this repo, `app/` — UI + API

### Community 156 - "map/route.ts"
Cohesion: 0.33
Nodes (6): dynamic, GET(), runtime, TZ_OFFSET_MIN, MAP_UNLOCK_COOKIE, verifyUnlockToken

### Community 157 - "Issue tracker: GitHub"
Cohesion: 0.29
Nodes (6): Conventions, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 158 - "Bug: relationship data can be silently dropped from the exported vault"
Cohesion: 0.29
Nodes (6): Bug: relationship data can be silently dropped from the exported vault, Constraints (repo-wide, still apply), Live evidence (already verified, do not re-derive), Repairing the currently-stuck data, Tests added, Verification

### Community 159 - "mcp.test.ts"
Cohesion: 0.29
Nodes (3): ChatToolsMod, McpMod, RouteMod

### Community 161 - "process/route.ts"
Cohesion: 0.47
Nodes (5): dynamic, LOCKED(), POST(), runtime, clearCompressionInFlight()

### Community 162 - "librarian/route.ts"
Cohesion: 0.40
Nodes (5): dynamic, GET(), LOCKED(), runtime, LibrarianStatus

### Community 163 - "2026-05-15"
Cohesion: 0.33
Nodes (6): 2026-05-15, Added, Changed, Deployment, Fixed, Removed

### Community 164 - "2026-06-16 (Dropbox review-pass fixes from the review)"
Cohesion: 0.33
Nodes (6): 2026-06-16 (Dropbox review-pass fixes from the review), OAuth state hardened, Operationally critical, Security hardening, Tests (+25 vs the prior 38, total 63), Visibility

### Community 165 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 166 - "Graphify Phase A"
Cohesion: 0.33
Nodes (5): Current Snapshot, Generation Command, Graphify Phase A, Refreshing, What Is Committed

### Community 167 - "Audit: typed entity relationships (shipped by Codex) + what's actually next"
Cohesion: 0.33
Nodes (5): Audit: typed entity relationships (shipped by Codex) + what's actually next, HAND-OFF INSTRUCTIONS FOR CODEX, The one open tradeoff (decision, not a bug), What's genuinely next (nothing is blocking), Why this document

### Community 168 - "[batchId]/route.ts"
Cohesion: 0.50
Nodes (4): dynamic, LOCKED(), POST(), runtime

### Community 169 - "ship.md"
Cohesion: 0.40
Nodes (4): Phase A — Parallel fan-out, Phase B — Merge in main context, Phase C — Decision and rollback, Rules

### Community 170 - "Findings"
Cohesion: 0.40
Nodes (5): 10. [P3] Production container runs as root from a mutable base tag, Evidence, Findings, Impact, Recommended remediation

### Community 171 - "1. [P1] Public share target can trigger unauthenticated OCR and storage abuse"
Cohesion: 0.40
Nodes (5): 1. [P1] Public share target can trigger unauthenticated OCR and storage abuse, Evidence, Impact, Recommended remediation, Validation

### Community 172 - "2. [P1] OAuth dynamic registration enables consent phishing"
Cohesion: 0.40
Nodes (5): 2. [P1] OAuth dynamic registration enables consent phishing, Evidence, Impact, Recommended remediation, Validation

### Community 173 - "7. [P2] `/memory` has a reproducible hydration failure"
Cohesion: 0.40
Nodes (5): 7. [P2] `/memory` has a reproducible hydration failure, Evidence, Impact, Recommended remediation, Validation

### Community 174 - "Configuration"
Cohesion: 0.40
Nodes (5): Analytics, Configuration, Core, Sources & sync, Subscription-Claude / Obsidian connector (MCP)

### Community 176 - "2026-05-16"
Cohesion: 0.50
Nodes (4): 2026-05-16, Added, Changed, Fixed

### Community 177 - "2026-06-01"
Cohesion: 0.50
Nodes (4): 2026-06-01, Added, Changed, Fixed

### Community 178 - "2026-06-15 (mind: bulletproof label visibility + diagnostics)"
Cohesion: 0.50
Nodes (4): 2026-06-15 (mind: bulletproof label visibility + diagnostics), More tolerant Claude parser, User-visible diagnostics, AxisLabelResult

### Community 179 - "2026-06-16 (Dropbox auto-ingest)"
Cohesion: 0.50
Nodes (4): 2026-06-16 (Dropbox auto-ingest), Added — automatic notebook ingestion from Dropbox, Tests, Trust posture

### Community 180 - "build.md"
Cohesion: 0.50
Nodes (3): Autonomous: the whole plan (`/build auto`), Default: one task, Modes

### Community 181 - "webperf.md"
Cohesion: 0.50
Nodes (3): Determine the mode, Output, Run the audit

### Community 182 - "Share-target designs that work without the normal session"
Cohesion: 0.50
Nodes (4): Design A — Service-worker-mediated device capability, Design B — Unauthenticated quarantine, Recommendation — B first, A only as an optional accelerator, Share-target designs that work without the normal session

### Community 183 - "3. [P2] Precise location is disclosed to an undocumented third party"
Cohesion: 0.50
Nodes (4): 3. [P2] Precise location is disclosed to an undocumented third party, Evidence, Impact, Recommended remediation

### Community 184 - "4. [P2] Production framework is unsupported and dependencies have an audit backlog"
Cohesion: 0.50
Nodes (4): 4. [P2] Production framework is unsupported and dependencies have an audit backlog, Evidence, Recommended remediation, Triage note

### Community 185 - "5. [P2] Logout cannot revoke copied sessions and inactivity is global"
Cohesion: 0.50
Nodes (4): 5. [P2] Logout cannot revoke copied sessions and inactivity is global, Evidence, Impact, Recommended remediation

### Community 186 - "6. [P2] Global passcode lockout permits unauthenticated denial of service"
Cohesion: 0.50
Nodes (4): 6. [P2] Global passcode lockout permits unauthenticated denial of service, Evidence, Impact, Recommended remediation

### Community 187 - "8. [P2] Auto-deployment has no automated quality gate"
Cohesion: 0.50
Nodes (4): 8. [P2] Auto-deployment has no automated quality gate, Evidence, Impact, Recommended remediation

### Community 188 - "9. [P3] Entity filename sanitization can merge distinct entities"
Cohesion: 0.50
Nodes (4): 9. [P3] Entity filename sanitization can merge distinct entities, Evidence, Impact, Recommended remediation

### Community 189 - "2026-08-24 - Full review remediation"
Cohesion: 0.50
Nodes (3): 2026-08-24 - Full review remediation, Decisions, Verification

### Community 190 - "conversationEntities.test.ts"
Cohesion: 0.50
Nodes (3): CeMod, CwMod, DbMod

### Community 193 - "6. Extra memory sources (optional)"
Cohesion: 0.67
Nodes (3): 6. Extra memory sources (optional), Discipline (GitHub), Location — two ways

## Knowledge Gaps
- **6 isolated node(s):** `RFC-8414`, `RFC-9728`, `RFC-7591`, `RFC-9728`, `RFC-9728` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1429 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db()` connect `dependencies` to `dropbox.ts`, `diaryExportDb.ts`, `api/diary/route.ts`, `remarkableCloud.ts`, `notebooksPinDenied`, `mcp.ts`, `db.ts`, `backup.ts`, `app/page.tsx`, `ocrLearning.ts`, `notes.ts`, `chat/route.ts`, `shares/route.ts`, `claude.ts`, `clientIp`, `insights/route.ts`, `db`, `map/pin/route.ts`, `memory/page.tsx`, `env`, `isAuthenticated`, `merge-entities/route.ts`, `mind.ts`, `discipline/route.ts`, `retranscribe.ts`, `notebooks/page.tsx`, `decisionWiki.ts`, `reflectionWiki.ts`, `mcp.test.ts`, `DiaryGraphClient.tsx`, `auth.ts`, `devDependencies`, `vitest`, `ForceGraph`, `backfill-all/route.ts`, `dropbox/export/route.ts`, `notebooks/pin/route.ts`, `chatDiary.ts`, `webauthnChallengeSeparation.test.ts`, `next`, `pendingShares.ts`, `entityMerge.ts`, `vaultGraph.ts`, `authorize/route.ts`, `usage.ts`, `Map3D.tsx`, `pendingShares.ts`, `location.ts`, `next`, `extractEntryDate`, `createPinGate`, `dropboxExportLock.test.ts`, `webauthn.ts`, `api/export/route.ts`, `notes.ts`, `setSetting`, `mcp/route.ts`, `decodeEmbedding`, `owntracks/route.ts`, `usage.ts`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `db()` (e.g. with `2026-08-24 (Fix: interrupted reMarkable syncs no longer lose their pages)` and `1. Interrupted reMarkable syncs destroyed diary pages (introduced)`) actually correct?**
  _`db()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-8414`, `RFC-9728`, `RFC-7591` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dropbox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06918238993710692 - nodes in this community are weakly interconnected._
- **Why does `Changelog` connect `Changelog` to `dropbox.ts`, `diaryExportDb.ts`, `owntracks.ts`, `ocrLearning.ts`, `mcp.ts`, `2026-06-19 (Entities layer; Graphify evaluated and rejected)`, `backup.ts`, `app/page.tsx`, `chat/route.ts`, `notes.ts`, `clientIp`, `insights/route.ts`, `db`, `quality`, `map/pin/route.ts`, `env`, `merge-entities/route.ts`, `2026-06-18 (Chat memory)`, `isAuthenticated`, `mind.ts`, `dependencies`, `decisionWiki.ts`, `isAuthenticated`, `2026-05-15`, `2026-06-16 (Dropbox review-pass fixes from the review)`, `auth.ts`, `devDependencies`, `ForceGraph`, `backfill-all/route.ts`, `dropbox/export/route.ts`, `chatDiary.ts`, `2026-05-16`, `2026-06-01`, `2026-06-15 (mind: bulletproof label visibility + diagnostics)`, `2026-06-16 (Dropbox auto-ingest)`, `pendingShares.ts`, `entityMerge.ts`, `vaultGraph.ts`, `2026-06-03`, `2026-06-04 (chat attachment extraction)`, `2026-06-04 (later)`, `2026-06-05`, `2026-06-05 (mobile display optimization)`, `2026-06-14`, `2026-06-14 (later)`, `2026-06-14 (mind: 3D map touch fix)`, `2026-06-14 (mind: axis labels render in any language)`, `extractEntryDate`, `2026-06-14 (mind visualizations)`, `2026-06-15 (heatmap: 6-month window)`, `2026-06-15 (mind: guaranteed-visible axis legend)`, `2026-06-16 (PR #37 final-pass nits)`, `notes.ts`, `setSetting`, `recordSuccessfulAuth`, `mcp/route.ts`, `decodeEmbedding`, `owntracks/route.ts`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Are the 189 inferred relationships involving `Architecture` (e.g. with `passcodeLockRemainingMs()` and `recordFailedPasscodeAttempt()`) actually correct?**
  _`Architecture` has 189 INFERRED edges - model-reasoned connections that need verification._
- **Should `diaryExportDb.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0824829931972789 - nodes in this community are weakly interconnected._