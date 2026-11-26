# Graph Report - remarkabler  (2026-11-26)

## Corpus Check
- 335 files · ~346,983 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 7, .woff2 4, .css 1)

## Summary
- 3256 nodes · 8048 edges · 211 communities (177 shown, 34 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 836 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `728d3f95`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- dropbox.ts
- diaryExportDb.ts
- remarkableCloud.ts
- owntracks.ts
- ocrLearning.ts
- claude.ts
- Changelog
- backup.ts
- app/page.tsx
- chat/route.ts
- notes.ts
- MemoryPage
- claude.ts
- secondLook.ts
- ref_fs
- insightSources.ts
- chatMemory.ts
- db
- quality
- map/pin/route.ts
- processNotebook
- env
- isAuthenticated
- callback/route.ts
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
- Architecture
- entityWiki.ts
- ForceGraph
- notebooksPin.ts
- backfill-all/route.ts
- dropbox/export/route.ts
- entityMerge.ts
- notebooks/pin/route.ts
- carryForwardDates
- remarkableStatus
- db.ts
- mcpOauth.ts
- export/diary/route.ts
- Codex Response to Claude Code's Verification
- `lib/` — the core logic
- entityMerge.ts
- track
- vaultGraph.ts
- conversationWiki.ts
- usage.ts
- Map3D.tsx
- notebooksPinDenied
- manifest.json
- location.ts
- register/route.ts
- analyzePending
- next
- usage/page.tsx
- notebooks/[id]/pdf/route.ts
- react
- Nav.tsx
- notebooks/[id]/pdf/route.ts
- token/route.ts
- mind/route.ts
- createPinGate
- api/export/route.ts
- webauthn.ts
- api/export/route.ts
- notes.ts
- setSetting
- relatedEntities.test.ts
- chatDiary.ts
- Step 3 — Obsidian rendering + docs + tests
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
- exampleRepair.ts
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
- memories/route.ts
- eslint
- correctPageText.test.ts
- decodeEmbedding
- vitest
- entityWikiExclude.test.ts
- pages/route.ts
- chatDiary.test.ts
- owntracks/route.ts
- chatMemoryFlow.test.ts
- mind.test.ts
- ref_fs
- extractText.ts
- Remarkabler
- memories/[id]/route.ts
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
- ocrBackfill.ts
- db.ts
- 2026-06-19 (Entities layer; Graphify evaluated and rejected)
- build-wiki/route.ts
- Review Scope
- Layer by layer
- ref_path
- 2026-06-16 (verification follow-up)
- next.config.mjs
- CLAUDE.md
- Review Framework
- Design
- Approach
- The Standing Checklist
- Observability Checklist
- Session log — 2026-08-25
- Remarkabler — one-page project index
- Remarkabler — architecture & structure map
- chunkedBackfill.test.ts
- 2026-06-18 (Chat memory)
- Impeccable — design anti-pattern checklist
- Connect Remarkabler to an Obsidian graph (phone guide)
- Remarkabler Full Code Review
- AGENTS.md — onboarding for any AI working on this repo
- cleanupAttachments.test.ts
- Issue tracker: GitHub
- Bug: relationship data can be silently dropped from the exported vault
- mcp.test.ts
- README.md
- correctPageText.test.ts
- reflectionEntities.test.ts
- 2026-05-15
- 2026-06-16 (Dropbox review-pass fixes from the review)
- Domain Docs
- Graphify Phase A
- 2026-06-19 (Entities layer — drill-down + /mind UI)
- jszip
- ship.md
- Findings
- 1. [P1] Public share target can trigger unauthenticated OCR and storage abuse
- 2. [P1] OAuth dynamic registration enables consent phishing
- 7. [P2] `/memory` has a reproducible hydration failure
- Configuration
- mindPendingBlank.test.ts
- 2026-05-16
- 2026-06-01
- 2026-06-15 (mind: bulletproof label visibility + diagnostics)
- 2026-06-16 (Dropbox auto-ingest)
- build.md
- webperf.md
- 2026-06-14 (mind: fallback dates + 3D map)
- 3. [P2] Precise location is disclosed to an undocumented third party
- 4. [P2] Production framework is unsupported and dependencies have an audit backlog
- 5. [P2] Logout cannot revoke copied sessions and inactivity is global
- 6. [P2] Global passcode lockout permits unauthenticated denial of service
- 8. [P2] Auto-deployment has no automated quality gate
- 9. [P3] Entity filename sanitization can merge distinct entities
- 2026-08-24 - Full review remediation
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
1. `db()` - 325 edges
2. `Architecture` - 190 edges
3. `Changelog` - 185 edges
4. `isAuthenticated()` - 153 edges
5. `vitest` - 95 edges
6. `next` - 84 edges
7. ``lib/` — the core logic` - 82 edges
8. `getSetting()` - 76 edges
9. `Hard-won rules — do not regress these` - 72 edges
10. `setSetting()` - 69 edges

## Surprising Connections (you probably didn't know these)
- `Evidence` --references--> `processNotebook()`  [INFERRED]
  docs/reviews/2026-08-23-full-code-review.md → lib/notes.ts
- `Validation` --references--> `processNotebook()`  [INFERRED]
  docs/reviews/2026-08-23-full-code-review.md → lib/notes.ts
- `2026-07-06 (edit transcription: refresh all derived indexes; review #124)` --references--> `correctPageText()`  [INFERRED]
  CHANGELOG.md → lib/notes.ts
- `2026-07-06 (edit transcription: reparse carry-forward on header change; review #125)` --references--> `correctPageText()`  [INFERRED]
  CHANGELOG.md → lib/notes.ts
- `2026-08-25 (Fix: a skipped export is not a completed repair)` --references--> `maybeReconcileRelationshipExportRace()`  [INFERRED]
  CHANGELOG.md → lib/notes.ts

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

## Communities (211 total, 34 thin omitted)

### Community 0 - "dropbox.ts"
Cohesion: 0.09
Nodes (43): dynamic, POST(), runtime, 2026-07-02 (Diary export: resilient full sync), 2026-07-05 (Dropbox upload of non-ASCII paths), 2026-07-19 (MCP: save_reflection — a standalone reflection tool, shared across every Claude surface), 2026-07-20 (Decision Records: the save_decision MCP write tool), The fix (+35 more)

### Community 1 - "diaryExportDb.ts"
Cohesion: 0.11
Nodes (26): dynamic, LOCKED(), maxDuration, POST(), runtime, 2026-07-02 (reMarkable cloud — Phase 1b: render + on-demand import, quality-gated), 2026-07-03 (reMarkable cloud — folder chips + readable dates on the import list), 2026-07-03 (reMarkable sync — don't fast-retry rate limits) (+18 more)

### Community 2 - "remarkableCloud.ts"
Cohesion: 0.04
Nodes (56): MAX_DIARY_ENTRY_CHARS, MAX_ENTITY_NOTES_CHARS, AUDIT_KEEP_ROWS, authFailures, COMPANION_GUIDANCE, configuredTokens(), conversationExportEnabled(), DECISION_TOOL (+48 more)

### Community 3 - "owntracks.ts"
Cohesion: 0.06
Nodes (26): Unreleased - Marker exactly one line too high (equal band/line counts), Unreleased - Proofreading card: marker and open-PDF fixes, bash_edits_code(), main(), marker_path(), main(), _acf_pitch(), _align() (+18 more)

### Community 4 - "ocrLearning.ts"
Cohesion: 0.07
Nodes (47): dynamic, POST(), runtime, dynamic, POST(), runtime, dynamic, GET() (+39 more)

### Community 5 - "claude.ts"
Cohesion: 0.10
Nodes (30): dynamic, GET(), LOCKED(), maxDuration, runtime, Infra, CHAT_TOOLS, analyzeEntryContent() (+22 more)

### Community 6 - "Changelog"
Cohesion: 0.02
Nodes (92): 2026-06-04, 2026-06-14 (mind: axis labels), 2026-06-14 (mind: fix date regex + carry-forward), 2026-06-14 (mind: review-pass fixes), 2026-06-20 (UI refresh: single-font Clear Sans + design tokens), 2026-07-02 (Date parser: tolerate spaced separators in the header), 2026-07-02 (reMarkable cloud — Phase 1a: Dockerfile + renderer toolchain), 2026-07-03 (chat model — Claude Sonnet 5) (+84 more)

### Community 7 - "backup.ts"
Cohesion: 0.06
Nodes (61): dynamic, LOCKED(), POST(), runtime, dynamic, GET(), maxDuration, POST() (+53 more)

### Community 8 - "app/page.tsx"
Cohesion: 0.12
Nodes (21): dynamic, Home(), LatestInsight, preview(), RecentNotebook, statusLabel(), Badge(), BadgeProps (+13 more)

### Community 9 - "chat/route.ts"
Cohesion: 0.17
Nodes (23): POST(), 2026-07-13 (location: chat now sees your current position for a stationary user), 2026-07-15 (MCP endpoint: enforce read-only literally — Codex review fix), 2026-11-13 (Map tab), getRecentLocations(), cachedPlace(), cacheKey(), reverseGeocodePlace() (+15 more)

### Community 10 - "notes.ts"
Cohesion: 0.12
Nodes (36): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, Deferred for future sessions, backupConfigured() (+28 more)

### Community 11 - "MemoryPage"
Cohesion: 0.08
Nodes (25): dependencies, @anthropic-ai/sdk@^0.96.0, better-sqlite3@^11.3.0, leaflet@^1.9.4, mammoth@^1.12.0, @modelcontextprotocol/sdk@^1.26.0, next@^16.4.6, pdf-parse@^2.4.5 (+17 more)

### Community 12 - "claude.ts"
Cohesion: 0.09
Nodes (36): addEdge(), addEvidence(), buildDiaryGraph(), canonicalKey(), contentId(), ContentInfo, ContentKind, ContentStats (+28 more)

### Community 13 - "secondLook.ts"
Cohesion: 0.20
Nodes (11): Unreleased - Phase 5: handwriting examples, Working with this user, secondLook(), examplesForTexts(), imageBlock(), pageExampleBlocks(), OcrFlag, applySecondLook() (+3 more)

### Community 14 - "ref_fs"
Cohesion: 0.06
Nodes (30): setPickingFile(), Mode, PinGate(), onChange(), post(), submit(), Card, OcrReview() (+22 more)

### Community 15 - "insightSources.ts"
Cohesion: 0.31
Nodes (8): 2026-11-11 (Insights: also read saved Claude sessions, Records and claude's lens), readDropboxTextFolders(), blocksFor(), buildInsightExtraContext(), buildSavedSessionsContext(), DEFAULT_INSIGHT_DROPBOX_FOLDERS, InsightExtraContext, SavedRow

### Community 16 - "chatMemory.ts"
Cohesion: 0.07
Nodes (21): MemoryPage(), disconnectDropbox(), getPosition(), load(), loadBackup(), loadDisc(), loadDropbox(), loadEmbed() (+13 more)

### Community 17 - "db"
Cohesion: 0.12
Nodes (24): 2026-11-17 (Transcription proofreading, Phase 2: learning), 2026-11-17 (Transcription proofreading, Phase 3: auto-fix and handwriting notes), composeHandwritingNotes(), maybeRefreshHandwritingNotes(), applyFixes(), AUTOFIX_MIN, autoFixPages(), buildOcrHints() (+16 more)

### Community 18 - "quality"
Cohesion: 0.15
Nodes (23): MapStayDto, MapView(), RoutePointDto, Data, fmt(), Gate, MapPage(), MapView (+15 more)

### Community 19 - "map/pin/route.ts"
Cohesion: 0.12
Nodes (31): 2026-06-25 (Diary Markdown export — portable, tool-agnostic backup), 2026-07-02 (Diary auto-export is now one Markdown file per day), 2026-07-05 (diary export — Obsidian-native: entity wikilinks + frontmatter), buildDayFiles(), buildDiaryMarkdown(), buildHomeNote(), collectEntities(), countLine() (+23 more)

### Community 20 - "processNotebook"
Cohesion: 0.08
Nodes (51): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, dynamic, GET() (+43 more)

### Community 21 - "env"
Cohesion: 0.12
Nodes (28): dynamic, LOCKED(), POST(), runtime, 2026-07-03 (reMarkable cloud — Phase 2: zero-tap sync), 2026-07-06 (codebase-review batch: attachment-cleanup race + doc/naming/a11y), remarkablePaired(), classifyReocr() (+20 more)

### Community 22 - "isAuthenticated"
Cohesion: 0.06
Nodes (40): 5. Hard-won rules — do not regress these, dynamic, LOCKED(), POST(), runtime, dynamic, GET(), LOCKED() (+32 more)

### Community 23 - "callback/route.ts"
Cohesion: 0.15
Nodes (13): dynamic, GET(), runtime, dynamic, GET(), runtime, Security hardening, buildAuthUrl() (+5 more)

### Community 24 - "mind.ts"
Cohesion: 0.11
Nodes (25): dynamic, GET(), runtime, Unreleased - "view page" replaces "open PDF" on proofreading cards, Block, Box, CaptureArgs, cropFile() (+17 more)

### Community 25 - "discipline/route.ts"
Cohesion: 0.18
Nodes (12): ATTACHMENT_DIR, DELETE(), dynamic, EXT, ext(), EXT_TO_MIME, GET(), IMAGE_TYPES (+4 more)

### Community 26 - "notebooks/route.ts"
Cohesion: 0.07
Nodes (27): concurrency, cancel-in-progress, group, CI, NEXT_TELEMETRY_DISABLED, jobs, quality, name (+19 more)

### Community 27 - "notebooks/page.tsx"
Cohesion: 0.14
Nodes (18): dynamic, LOCKED(), maxDuration, POST(), runtime, ExistingRow, importRemarkableNotebook(), importRemarkableNotebookInner() (+10 more)

### Community 28 - "map/pin/route.ts"
Cohesion: 0.12
Nodes (29): dynamic, GET(), POST(), runtime, unlocked(), dynamic, GET(), runtime (+21 more)

### Community 29 - "embeddings.ts"
Cohesion: 0.07
Nodes (26): COMMENT_BODY, COMMENT_URL, EVENT_NAME, GH_TOKEN, PR_NUMBER, REPO, if, runs-on (+18 more)

### Community 30 - "dependencies"
Cohesion: 0.12
Nodes (44): 2026-07-15 (chat: rolling memory so long chats don't forget the middle), 2026-07-15 (MCP endpoint: chat with the diary on the Claude subscription), 2026-08-24 (Fix: interrupted reMarkable syncs no longer lose their pages), 2026-08-25 (Security: bind WebAuthn challenges server-side), Hard-won rules — do not regress these, 1. Interrupted reMarkable syncs destroyed diary pages (introduced), consumeChallenge(), pruneExpiredAuthFailBuckets() (+36 more)

### Community 31 - "decisionWiki.ts"
Cohesion: 0.14
Nodes (36): 2026-07-02 (Automatic diary Markdown export back to Dropbox — opt-in), 2026-07-05 (entity merge follow-ups), 2026-07-05 (Obsidian entity stub notes), 2026-07-20 (Second-brain vault structure: Home dashboard + entity indexes + Profile note), B4. Render (`lib/diaryExport.ts` + `lib/diaryExportDb.ts`), Entity stub notes — clickable graph nodes (shipped, PR #104), allConversationFileNames(), allDecisionFileNames() (+28 more)

### Community 32 - "reflectionWiki.ts"
Cohesion: 0.14
Nodes (25): DELETE(), dynamic, GET(), LOCKED(), POST(), runtime, escapeHtml(), GET() (+17 more)

### Community 33 - "isAuthenticated"
Cohesion: 0.15
Nodes (22): AxisLabels, EmbeddingMap(), EntityRankings(), Heatmap(), HeatmapBucket, Map3D, MapPoint, MindData (+14 more)

### Community 34 - "getCurrentProfile"
Cohesion: 0.10
Nodes (25): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.47, @types/better-sqlite3@^7.6.11, @types/d3-force@^3.0.10, @types/node@^22.7.4, @types/react@^19.2.18, @types/react-dom@^19.2.4 (+17 more)

### Community 35 - "DiaryGraphClient.tsx"
Cohesion: 0.19
Nodes (18): captureExample(), anchorPhrase(), clean(), contextSnippet(), insideLatinWord(), MAX_FLAGS_PER_CALL, parseBox(), parseFlagLines() (+10 more)

### Community 36 - "auth.ts"
Cohesion: 0.11
Nodes (39): dynamic, GET(), POST(), relyingParty(), runtime, Finding 5 — No session revocation [P2 → P3], AUTH_CHALLENGE_COOKIE, authFailKey() (+31 more)

### Community 37 - "Worked example: Agent Teams for competing-hypothesis debugging"
Cohesion: 0.06
Nodes (31): 1. Direct invocation (no orchestration), 2. Single-persona slash command, 3. Parallel fan-out with merge, 4. Sequential pipeline as user-driven slash commands, 5. Research isolation (context preservation), A. Router persona ("meta-orchestrator"), Anti-pattern in this scenario, Anti-patterns (+23 more)

### Community 38 - "devDependencies"
Cohesion: 0.16
Nodes (21): 2026-07-19 (Guaranteed entity-tagging + bidirectional Obsidian links for conversations & reflections), REFLECTIONS_NOTEBOOK_ID, ensureReflectionPage(), ensureReflectionsNotebook(), KINDS, ReflectionEntityInput, tagReflectionEntities(), dateKey() (+13 more)

### Community 39 - "Architecture"
Cohesion: 0.17
Nodes (26): Architecture, B1. Data layer — new file `lib/entityRelationships.ts`, B2. Write tool `relate_entities` (`lib/mcp.ts`), B3. Extend `get_entity_wiki` read (compose in `lib/mcp.ts`, NOT the data layer), Context / why, Plan: (B) typed-relationship enrichment of the diary knowledge graph + (A) Graphify pilot, Step 2 — MCP surface, allConversationNotesRows() (+18 more)

### Community 40 - "entityWiki.ts"
Cohesion: 0.40
Nodes (11): AutoLock(), cancelPending(), lockNow(), markHiddenIfNeeded(), onPageHide(), onVisibility(), clearHiddenSince(), readHiddenSince() (+3 more)

### Community 41 - "ForceGraph"
Cohesion: 0.16
Nodes (21): DecisionEntityInput, ensureDecisionPage(), ensureDecisionsNotebook(), KINDS, tagDecisionEntities(), dateKey(), DECISION_FOLDER, decisionNoteFileName() (+13 more)

### Community 42 - "notebooksPin.ts"
Cohesion: 0.21
Nodes (17): DELETE(), dynamic, GET(), POST(), runtime, unlocked(), clientIp(), gate (+9 more)

### Community 43 - "backfill-all/route.ts"
Cohesion: 0.08
Nodes (29): dynamic, LOCKED(), POST(), runtime, 1. Startup orphan migration now chunks (was creating one giant batch), 2026-06-20 (Tier-1: chat-memory backfill + entity write correctness), 2026-06-20 (Tier-2: cleanup — shared helpers, schema constraints, docs), 2026-07-19 (Whole-app code review fixes: OAuth cap, dedup SQL, Button consolidation, /mind stuck-page bug) (+21 more)

### Community 44 - "dropbox/export/route.ts"
Cohesion: 0.12
Nodes (20): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, GET(), runtime (+12 more)

### Community 45 - "entityMerge.ts"
Cohesion: 0.13
Nodes (18): DiaryGraphClient(), EDGE_COLORS, EDGE_LABELS, EDGE_TYPES, formatGeneratedAt(), Inspector(), Metric(), metricLabel() (+10 more)

### Community 46 - "notebooks/pin/route.ts"
Cohesion: 0.10
Nodes (24): Audit: typed entity relationships (shipped by Codex) + what's actually next, HAND-OFF INSTRUCTIONS FOR CODEX, The one open tradeoff (decision, not a bug), Verdict: all seven SATISFIED. No corrective work required., What's genuinely next (nothing is blocking), Why this document, getConversationByKey(), EntityPredicate (+16 more)

### Community 47 - "carryForwardDates"
Cohesion: 0.18
Nodes (13): dynamic, LOCKED(), maxDuration, POST(), runtime, 2026-07-02 (Diary export follow-ups from review of #69), 2026-07-03 (reMarkable compare — carry dates forward; the "missing" section wasn't missing), carryForwardDates() (+5 more)

### Community 48 - "remarkableStatus"
Cohesion: 0.14
Nodes (19): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, LOCKED(), POST() (+11 more)

### Community 49 - "db.ts"
Cohesion: 0.29
Nodes (10): ForceGraph(), draw(), fit(), hit(), loop(), onDown(), onMove(), onWheel() (+2 more)

### Community 50 - "mcpOauth.ts"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 51 - "export/diary/route.ts"
Cohesion: 0.40
Nodes (5): dynamic, GET(), LOCKED(), maxDuration, runtime

### Community 52 - "Codex Response to Claude Code's Verification"
Cohesion: 0.09
Nodes (22): 2. Should OAuth consent phishing be P2 rather than P1?, 3. Are the downgrades for Findings 5, 6, 7, and 9 appropriate?, 4. Is the missing `recordSuccessfulAuth()` the real Finding 6 defect?, 5. Is collision detection preferable to changing entity mapping?, 6. What about Docker digest construction and Railway volume permissions?, Assessment of Claude's additional findings, Change-control note, CI impact wording (+14 more)

### Community 53 - "`lib/` — the core logic"
Cohesion: 0.11
Nodes (38): `lib/` — the core logic, 4. `lib/` modules by domain, 2026-06-15 (review follow-through), 2026-07-05 (life wiki — Claude-written entity profiles), 2026-07-05 (life wiki — deep profiles from the whole diary history), 2026-07-05 (life wiki: enforce the real excerpt budget), 2026-07-05 (life wiki follow-ups), Added (+30 more)

### Community 54 - "entityMerge.ts"
Cohesion: 0.16
Nodes (20): dynamic, Kind, KINDS, maxDuration, POST(), postMergeDropbox(), runtime, 2026-07-05 (entity merge: clean up already-merged stubs) (+12 more)

### Community 55 - "track"
Cohesion: 0.29
Nodes (14): track(), friendly(), LockScreen(), completeUnlock(), post(), prefetchAuthOptions(), registerDevice(), rememberDevice() (+6 more)

### Community 56 - "vaultGraph.ts"
Cohesion: 0.09
Nodes (35): dynamic, GET(), runtime, dynamic, err(), POST(), readForm(), runtime (+27 more)

### Community 57 - "conversationWiki.ts"
Cohesion: 0.19
Nodes (15): CONVERSATION_FOLDER, conversationNoteFileName(), dateKey(), ExportedConversationRow, markConversationsFiled(), MAX_CONVERSATION_CHARS, renderConversationNote(), renderConversationNoteFiles() (+7 more)

### Community 58 - "usage.ts"
Cohesion: 0.21
Nodes (11): coachablePages(), CoachSession, MAX_BATCH_CHARS, maybeCoachWriting(), MIN_BATCH_CHARS, MIN_PAGE_CHARS, pickBatch(), RECENT_DAYS (+3 more)

### Community 59 - "Map3D.tsx"
Cohesion: 0.16
Nodes (23): dynamic, GET(), LOCKED(), runtime, extractTaggingEntities(), LibrarianStatus, librarianStatus(), wikiLinkingEnabled() (+15 more)

### Community 60 - "notebooksPinDenied"
Cohesion: 0.12
Nodes (30): dynamic, GET(), runtime, DELETE(), dynamic, GET(), LOCKED(), POST() (+22 more)

### Community 61 - "manifest.json"
Cohesion: 0.21
Nodes (11): dynamic, GET(), runtime, DiaryGraphEdge, DiaryGraphPayload, VaultNoteKind, insightDropboxFolders(), addVaultNotesToGraph() (+3 more)

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

### Community 66 - "usage/page.tsx"
Cohesion: 0.21
Nodes (10): DayCost, DayData, FEATURE_LABEL, FeatureCost, money(), MonthData, pad(), UsagePage() (+2 more)

### Community 67 - "notebooks/[id]/pdf/route.ts"
Cohesion: 0.20
Nodes (9): ATTACHMENT_DIR, dynamic, GET(), runtime, dynamic, friendly(), GET(), LOCKED() (+1 more)

### Community 68 - "react"
Cohesion: 0.18
Nodes (14): ChatMemoryItem, ChatMemorySection(), backfillAll(), load(), processPending(), remove(), retryStuck(), ChatMemoryStatus (+6 more)

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
Cohesion: 0.18
Nodes (15): dynamic, GET(), LOCKED(), runtime, Duplicate-notebook detection (shipped, PR #103), Open / next ideas (not started), Session log — 2026-07-05, User-facing setup guide (+7 more)

### Community 74 - "api/export/route.ts"
Cohesion: 0.15
Nodes (21): dynamic, fmtDate(), fmtDateTime(), fmtTime(), GET(), LOCKED(), maxDuration, runtime (+13 more)

### Community 75 - "webauthn.ts"
Cohesion: 0.17
Nodes (16): dynamic, GET(), LOCKED(), POST(), runtime, dynamic, GET(), LOCKED() (+8 more)

### Community 76 - "api/export/route.ts"
Cohesion: 0.27
Nodes (10): dynamic, GET(), LOCKED(), POST(), runtime, ProofreadingStats, proofreadingStats(), listReviewCards() (+2 more)

### Community 77 - "notes.ts"
Cohesion: 0.10
Nodes (40): backfillTitles(), dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, 2026-07-19 (Zero-tap sync actually runs zero-tap: a real background timer) (+32 more)

### Community 78 - "setSetting"
Cohesion: 0.16
Nodes (23): PATCH(), dynamic, GET(), LOCKED(), POST(), resolve(), runtime, Slot (+15 more)

### Community 79 - "relatedEntities.test.ts"
Cohesion: 0.33
Nodes (3): ClaudeMod, CmMod, DbMod

### Community 80 - "chatDiary.ts"
Cohesion: 0.20
Nodes (7): ConversationWikiMod, DbMod, deferred(), DiaryExportDbMod, DropboxMod, mockDropboxFetch(), UploadCall

### Community 81 - "Step 3 — Obsidian rendering + docs + tests"
Cohesion: 0.18
Nodes (10): B0. Schema (`lib/db.ts`, in the `SCHEMA` string after `entity_conversation_notes`), B5. Tests (extend existing), B6. Docs, B7. Deferred (do NOT build now — note in CHANGELOG), Build order (per review), PHASE A — Graphify pilot (separate, unvalidated; do AFTER Phase B), PHASE B — typed relationships (build in the numbered order below), Step 1 — Assertions: schema + data layer + merge support + tests (+2 more)

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
Cohesion: 0.06
Nodes (38): 2026-08-24 (Restore a global floor under the passcode lockout), 1. Dependency characterization — I was wrong, 2. "Guaranteed 100%" on the share session — overstated, 3. Location privacy after moving geocoding server-side — incomplete fix, 4. CI impact wording — corrected, Agreement with Codex's direct answers, Change-control note, Characterizations I withdraw (+30 more)

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
Cohesion: 0.40
Nodes (4): Db, L, Review, Store

### Community 95 - "exampleRepair.ts"
Cohesion: 0.31
Nodes (8): flagForExample(), maybeRepairExamples(), norm(), parseBox(), REPAIR_BATCH, RepairFlag, Row, examplesAvailable()

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

### Community 106 - "memories/route.ts"
Cohesion: 0.28
Nodes (8): dynamic, GET(), LOCKED(), MemoryRow, runtime, 2026-06-21 (Fix: pending chat-memory batches stuck without recourse), compressionInFlight(), pendingBatchDetails()

### Community 108 - "correctPageText.test.ts"
Cohesion: 0.16
Nodes (7): DbMod, EmbMod, MindMod, NotesMod, DbMod, DropboxMod, NotesMod

### Community 109 - "decodeEmbedding"
Cohesion: 0.22
Nodes (8): Don't forget, How we tested, OCR stays on Opus — validated against Sonnet, Session log — 2026-06-04, Voyage AI is wired up and working, What's still possible, What we found, Why this matters

### Community 110 - "vitest"
Cohesion: 0.08
Nodes (13): vitest, findRouteFiles(), PUBLIC, AuthMod, DbMod, INPUT, DbMod, DedupMod (+5 more)

### Community 111 - "entityWikiExclude.test.ts"
Cohesion: 0.33
Nodes (3): Db, Review, Store

### Community 112 - "pages/route.ts"
Cohesion: 0.22
Nodes (10): dynamic, GET(), PATCH(), runtime, strip(), tokens(), WordChange, wordChanges() (+2 more)

### Community 113 - "chatDiary.test.ts"
Cohesion: 0.40
Nodes (4): CdMod, DbMod, MindMod, NotesMod

### Community 114 - "owntracks/route.ts"
Cohesion: 0.24
Nodes (13): dynamic, GET(), isPlausiblePoint(), POST(), runtime, 2026-07-15 (location: diagnose WHY tracking gaps form), addPoint(), analyzeGaps() (+5 more)

### Community 116 - "mind.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, MindMod, NotesMod

### Community 117 - "ref_fs"
Cohesion: 0.06
Nodes (18): AuthMod, DbMod, CmMod, DbMod, EmbMod, CmMod, DbMod, EmbMod (+10 more)

### Community 118 - "extractText.ts"
Cohesion: 0.36
Nodes (7): ExtractResult, extractTextFromAttachment(), Mammoth, mammoth(), PdfParse, pdfParse(), shouldFallback()

### Community 119 - "Remarkabler"
Cohesion: 0.13
Nodes (15): Architecture, Before you start: cost, privacy, and a lock, Chat with your diary from your Claude subscription (optional), Deployment, Design notes (don't regress these), Getting your notes in — three ways, Honest cost, Hosted (Railway) — recommended (+7 more)

### Community 120 - "memories/[id]/route.ts"
Cohesion: 0.50
Nodes (4): DELETE(), dynamic, LOCKED(), runtime

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
Cohesion: 0.38
Nodes (4): computeRelatedEntities(), DayMembership, EntityKind, RelatedEntity

### Community 130 - "api/diary/route.ts"
Cohesion: 0.40
Nodes (5): dynamic, Entry, GET(), LOCKED(), runtime

### Community 131 - "entityTagging.test.ts"
Cohesion: 0.33
Nodes (5): ClaudeMod, CwMod, DbMod, EtMod, RwMod

### Community 132 - "ocrBackfill.ts"
Cohesion: 0.07
Nodes (46): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, dynamic, GET() (+38 more)

### Community 133 - "db.ts"
Cohesion: 0.09
Nodes (14): better-sqlite3, BackupMod, DbMod, DbMod, Mod, DbMod, Mod, DbMod (+6 more)

### Community 134 - "2026-06-19 (Entities layer; Graphify evaluated and rejected)"
Cohesion: 0.17
Nodes (12): 2026-06-19 (Entities layer; Graphify evaluated and rejected), Backfill, Extraction, Hard-won decisions, New chat tool: `top_entities`, Persistence, Schema, Tests (+23, total 177) (+4 more)

### Community 135 - "build-wiki/route.ts"
Cohesion: 0.40
Nodes (4): dynamic, maxDuration, POST(), runtime

### Community 136 - "Review Scope"
Cohesion: 0.15
Nodes (12): 1. Input Handling, 2. Authentication & Authorization, 3. Data Protection, 4. Infrastructure, 5. Third-Party Integrations, 6. AI / LLM Features (if present), Composition, Output Format (+4 more)

### Community 137 - "Layer by layer"
Cohesion: 0.15
Nodes (12): 1. The execution environment, 2. The context window, 3. The model, 4. Tools, 5. Subagents, 6. Deferred tools & MCP lifecycle, 7. Governance: permissions & hooks, 8. GitHub integration (+4 more)

### Community 138 - "ref_path"
Cohesion: 0.09
Nodes (11): DbMod, DeMod, DwMod, ClaudeMod, DbMod, EwMod, AuthMod, DbModule (+3 more)

### Community 139 - "2026-06-16 (verification follow-up)"
Cohesion: 0.40
Nodes (5): 2026-06-16 (verification follow-up), Fixed, Optional cleanup, Review's other optional cleanups (not applicable), Tests (+12, total 75)

### Community 140 - "next.config.mjs"
Cohesion: 0.40
Nodes (3): RFC-8414, RFC-9728, nextConfig

### Community 141 - "CLAUDE.md"
Cohesion: 0.15
Nodes (12): Agent skills, Codex, Claude Code, and Antigravity must use Graphify first, Domain docs, GitHub Actions, Issue tracker, Known limits (intentional), Session logs, Stack (+4 more)

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
Cohesion: 0.15
Nodes (12): 2. Unauthenticated passkey enrollment (pre-existing, live), Decisions, Known-open, Mistakes made in this session, Session log — 2026-08-25, Shipped, Starting point, The part worth remembering: two fixes, two misses (+4 more)

### Community 148 - "Remarkabler — one-page project index"
Cohesion: 0.18
Nodes (10): API routes (`app/api/*`), At a glance, Environment variables, Graphify Phase A, Known intentional limits, Models, Remarkabler — one-page project index, UI pages (`app/*`) (+2 more)

### Community 149 - "Remarkabler — architecture & structure map"
Cohesion: 0.20
Nodes (9): 1. What it does (data flow), 2. Layers, 3. Directory tree (annotated), 5. API routes (`app/api/**`), 6. UI pages (`app/*`), 7. Data model (`lib/db.ts`, 20 tables + `pages_fts`), 8. External services & the env vars that gate them, 9. Background work (`runMaintenanceSweep`, gated ≤ once / 5 min) (+1 more)

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

### Community 157 - "Issue tracker: GitHub"
Cohesion: 0.29
Nodes (6): Conventions, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 158 - "Bug: relationship data can be silently dropped from the exported vault"
Cohesion: 0.22
Nodes (8): Bug: relationship data can be silently dropped from the exported vault, Constraints (repo-wide, still apply), Live evidence (already verified, do not re-derive), Repairing the currently-stuck data, Root cause, Tests added, Verification, refreshRelationshipStubs()

### Community 159 - "mcp.test.ts"
Cohesion: 0.29
Nodes (3): ChatToolsMod, McpMod, RouteMod

### Community 162 - "reflectionEntities.test.ts"
Cohesion: 0.40
Nodes (4): CeMod, DbMod, ReMod, RwMod

### Community 163 - "2026-05-15"
Cohesion: 0.33
Nodes (6): 2026-05-15, Added, Changed, Deployment, Fixed, Removed

### Community 164 - "2026-06-16 (Dropbox review-pass fixes from the review)"
Cohesion: 0.40
Nodes (5): 2026-06-16 (Dropbox review-pass fixes from the review), OAuth state hardened, Operationally critical, Tests (+25 vs the prior 38, total 63), Visibility

### Community 165 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 166 - "Graphify Phase A"
Cohesion: 0.33
Nodes (5): Current Snapshot, Generation Command, Graphify Phase A, Refreshing, What Is Committed

### Community 167 - "2026-06-19 (Entities layer — drill-down + /mind UI)"
Cohesion: 0.50
Nodes (4): 2026-06-19 (Entities layer — drill-down + /mind UI), `/mind` "Who, where, what" section, `pages_for_entity` chat tool, Tests (+16, total 193)

### Community 168 - "jszip"
Cohesion: 0.33
Nodes (4): jszip@^3.10.1, mcp-handler@^1.1.0, jszip, mcp-handler

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

### Community 182 - "2026-06-14 (mind: fallback dates + 3D map)"
Cohesion: 0.67
Nodes (3): 2026-06-14 (mind: fallback dates + 3D map), Added — 3D interactive embedding map, Dependencies

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

### Community 193 - "6. Extra memory sources (optional)"
Cohesion: 0.67
Nodes (3): 6. Extra memory sources (optional), Discipline (GitHub), Location — two ways

## Knowledge Gaps
- **6 isolated node(s):** `RFC-8414`, `RFC-9728`, `RFC-8414`, `RFC-9728`, `RFC-7591` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1434 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db()` connect `dependencies` to `dropbox.ts`, `api/diary/route.ts`, `remarkableCloud.ts`, `ocrLearning.ts`, `claude.ts`, `db.ts`, `backup.ts`, `app/page.tsx`, `chat/route.ts`, `notes.ts`, `ocrBackfill.ts`, `claude.ts`, `secondLook.ts`, `ref_path`, `insightSources.ts`, `db`, `map/pin/route.ts`, `processNotebook`, `env`, `isAuthenticated`, `mind.ts`, `discipline/route.ts`, `notebooks/page.tsx`, `decisionWiki.ts`, `reflectionWiki.ts`, `mcp.test.ts`, `DiaryGraphClient.tsx`, `auth.ts`, `devDependencies`, `Architecture`, `ForceGraph`, `backfill-all/route.ts`, `dropbox/export/route.ts`, `notebooks/pin/route.ts`, `carryForwardDates`, ``lib/` — the core logic`, `entityMerge.ts`, `vaultGraph.ts`, `conversationWiki.ts`, `usage.ts`, `Map3D.tsx`, `notebooksPinDenied`, `location.ts`, `next`, `notebooks/[id]/pdf/route.ts`, `createPinGate`, `api/export/route.ts`, `webauthn.ts`, `api/export/route.ts`, `notes.ts`, `setSetting`, `exampleRepair.ts`, `mcp/route.ts`, `memories/route.ts`, `pages/route.ts`, `owntracks/route.ts`, `memories/[id]/route.ts`?**
  _High betweenness centrality (0.169) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `db()` (e.g. with `2026-08-24 (Fix: interrupted reMarkable syncs no longer lose their pages)` and `1. Interrupted reMarkable syncs destroyed diary pages (introduced)`) actually correct?**
  _`db()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-8414`, `RFC-9728`, `RFC-8414` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dropbox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09042553191489362 - nodes in this community are weakly interconnected._
- **Why does `Changelog` connect `Changelog` to `dropbox.ts`, `diaryExportDb.ts`, `owntracks.ts`, `ocrLearning.ts`, `ocrBackfill.ts`, `2026-06-19 (Entities layer; Graphify evaluated and rejected)`, `backup.ts`, `chat/route.ts`, `2026-06-16 (verification follow-up)`, `secondLook.ts`, `ref_fs`, `insightSources.ts`, `db`, `quality`, `map/pin/route.ts`, `processNotebook`, `env`, `isAuthenticated`, `2026-06-18 (Chat memory)`, `mind.ts`, `dependencies`, `decisionWiki.ts`, `2026-05-15`, `2026-06-16 (Dropbox review-pass fixes from the review)`, `devDependencies`, `2026-06-19 (Entities layer — drill-down + /mind UI)`, `backfill-all/route.ts`, `dropbox/export/route.ts`, `carryForwardDates`, `2026-05-16`, `2026-06-01`, `2026-06-15 (mind: bulletproof label visibility + diagnostics)`, `2026-06-16 (Dropbox auto-ingest)`, `remarkableStatus`, ``lib/` — the core logic`, `2026-06-14 (mind: fallback dates + 3D map)`, `entityMerge.ts`, `vaultGraph.ts`, `2026-06-03`, `2026-06-04 (chat attachment extraction)`, `2026-06-04 (later)`, `2026-06-05`, `2026-06-05 (mobile display optimization)`, `2026-06-14`, `2026-06-14 (later)`, `2026-06-14 (mind: 3D map touch fix)`, `2026-06-14 (mind: axis labels render in any language)`, `2026-06-14 (mind visualizations)`, `2026-06-15 (heatmap: 6-month window)`, `2026-06-15 (mind: guaranteed-visible axis legend)`, `2026-06-16 (PR #37 final-pass nits)`, `notes.ts`, `setSetting`, `recordSuccessfulAuth`, `mcp/route.ts`, `memories/route.ts`, `owntracks/route.ts`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **Are the 189 inferred relationships involving `Architecture` (e.g. with `passcodeLockRemainingMs()` and `recordFailedPasscodeAttempt()`) actually correct?**
  _`Architecture` has 189 INFERRED edges - model-reasoned connections that need verification._
- **Should `diaryExportDb.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1053763440860215 - nodes in this community are weakly interconnected._