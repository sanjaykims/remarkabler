# Graph Report - remarkabler  (2026-11-26)

## Corpus Check
- 286 files · ~343,654 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 7, .woff2 4, .css 1)

## Summary
- 2402 nodes · 6372 edges · 141 communities (131 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1c7f4031`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- dropbox.ts
- diaryExportDb.ts
- remarkableCloud.ts
- owntracks.ts
- ocrLearning.ts
- mcp.ts
- remarkableTombstone.test.ts
- backup.ts
- app/page.tsx
- ChatMemorySection
- notes.ts
- MemoryPage
- claude.ts
- map/pin/route.ts
- ref_fs
- insights/route.ts
- chatMemory.ts
- db
- quality
- map/pin/route.ts
- getCurrentProfile
- remarkableSync.ts
- discipline/settings/route.ts
- ocrBackfill.ts
- mind.ts
- discipline/route.ts
- notebooks/route.ts
- notebooksPinDenied
- clearSetting
- embeddings.ts
- db
- decisionWiki.ts
- reflectionWiki.ts
- isAuthenticated
- getCurrentProfile
- DiaryGraphClient.tsx
- auth.ts
- vitest
- devDependencies
- vitest
- entityWiki.ts
- ForceGraph
- usage.ts
- insights/route.ts
- NotebooksContent
- entityMerge.ts
- notebooks/pin/route.ts
- embeddings.ts
- entityTagging.ts
- db.ts
- mcpOauth.ts
- next
- graphify_gate.py
- pendingShares.ts
- entityMerge.ts
- layout.tsx
- vaultGraph.ts
- authorize/route.ts
- usage.ts
- Map3D.tsx
- usage/page.tsx
- manifest.json
- location.ts
- register/route.ts
- analyzePending
- next
- mcp/route.ts
- package.json
- format.ts
- notebooksPin.ts
- map/route.ts
- token/route.ts
- mind/route.ts
- createPinGate
- dropboxExportLock.test.ts
- webauthn.ts
- maybeCompressChatSessions
- notes.ts
- getSetting
- relatedEntities.test.ts
- chatDiary.ts
- discipline/route.ts
- dropbox/export/route.ts
- authRoute.test.ts
- topEntities.test.ts
- owntracks.ts
- mapPin.ts
- pagesForEntity.test.ts
- memories/route.ts
- librarian/route.ts
- entityGraph.ts
- scripts
- chatToolsLocation.test.ts
- entityMerge.test.ts
- ocrLearningDb.test.ts
- usage/page.tsx
- mcp/route.ts
- api/diary/route.ts
- chatMemoryExtract.test.ts
- chatMemoryRecall.test.ts
- chatMemoryRolling.test.ts
- entityTagging.test.ts
- mind.test.ts
- token/route.ts
- ocrReviewDb.test.ts
- Nav.tsx
- chatMemoryRecall.test.ts
- db.ts
- ref_fs
- ForceGraph.tsx
- embeddingMapDiscipline.test.ts
- entityWikiExclude.test.ts
- ocrLearningDb.test.ts
- webauthn.ts
- memory/route.ts
- autosync/route.ts
- mind.test.ts
- tailwindcss
- ref_os
- chatDiary.ts
- extractText.ts
- owntracksCurrent.test.ts
- vaultStructure.test.ts
- memories/route.ts
- rm2pdf
- postcss.config.mjs
- entityWikiExclude.test.ts
- eslint
- entityGraph.ts
- api/diary/route.ts
- entityTagging.test.ts
- attachment/[id]/route.ts
- ref_path
- memories/[id]/route.ts
- chatMemoryDedup.test.ts
- cleanupAttachments.test.ts
- dropbox/disconnect/route.ts
- conversationEntities.test.ts
- dropboxDisconnect.test.ts
- dropboxStatus.test.ts

## God Nodes (most connected - your core abstractions)
1. `db()` - 319 edges
2. `isAuthenticated()` - 145 edges
3. `vitest` - 94 edges
4. `next` - 84 edges
5. `getSetting()` - 76 edges
6. `setSetting()` - 69 edges
7. `MemoryPage()` - 42 edges
8. `runMaintenanceSweep()` - 36 edges
9. `clearSetting()` - 30 edges
10. `callMcpTool()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/authorization-server/route.ts → lib/mcpOauth.ts
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/protected-resource/route.ts → lib/mcpOauth.ts
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/register/route.ts → lib/mcpOauth.ts
- `GET()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/dropbox/callback/route.ts → lib/auth.ts
- `GET()` --calls--> `setSetting()`  [EXTRACTED]
  app/api/dropbox/callback/route.ts → lib/db.ts

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

## Communities (141 total, 10 thin omitted)

### Community 0 - "dropbox.ts"
Cohesion: 0.10
Nodes (45): markConversationsFiled(), renderConversationNoteFiles(), unfiledConversationKeys(), markDecisionsFiled(), unfiledDecisionKeys(), classifyDropboxError(), deleteDiaryExportFiles(), deleteFile() (+37 more)

### Community 1 - "diaryExportDb.ts"
Cohesion: 0.07
Nodes (41): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, LOCKED(), POST() (+33 more)

### Community 2 - "remarkableCloud.ts"
Cohesion: 0.05
Nodes (53): handler, CHAT_TOOLS, AUDIT_KEEP_ROWS, authFailures, callMcpTool(), COMPANION_GUIDANCE, configuredTokens(), conversationExportEnabled() (+45 more)

### Community 3 - "owntracks.ts"
Cohesion: 0.07
Nodes (23): bash_edits_code(), main(), marker_path(), main(), _acf_pitch(), _align(), _analyze(), _band_extent() (+15 more)

### Community 4 - "ocrLearning.ts"
Cohesion: 0.07
Nodes (43): dynamic, POST(), runtime, dynamic, POST(), runtime, dynamic, POST() (+35 more)

### Community 5 - "mcp.ts"
Cohesion: 0.08
Nodes (49): analyzeEntryContent(), AxisLabelResult, CHAT_MEMORY_EXTRACTION_GUIDANCE, chatOverNotes(), cleanEntityWiki(), client(), coachWriting(), compareTranscriptions() (+41 more)

### Community 6 - "remarkableTombstone.test.ts"
Cohesion: 0.40
Nodes (3): DbMod, NotesMod, SyncMod

### Community 7 - "backup.ts"
Cohesion: 0.10
Nodes (29): BatchRow, buildTranscript(), CATEGORY_ALIASES, ChatMemoryCategory, ChatMemoryRowForDedup, compressBatch(), CompressBatchResult, DuplicateCheck (+21 more)

### Community 8 - "app/page.tsx"
Cohesion: 0.12
Nodes (22): dynamic, Home(), LatestInsight, preview(), RecentNotebook, statusLabel(), Badge(), BadgeProps (+14 more)

### Community 9 - "ChatMemorySection"
Cohesion: 0.60
Nodes (6): ChatMemorySection(), backfillAll(), load(), processPending(), remove(), retryStuck()

### Community 10 - "notes.ts"
Cohesion: 0.10
Nodes (39): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, dynamic, friendly() (+31 more)

### Community 11 - "MemoryPage"
Cohesion: 0.10
Nodes (21): dependencies, better-sqlite3@^11.3.0, jszip@^3.10.1, leaflet@^1.9.4, mcp-handler@^1.1.0, next@^16.4.6, pdf-parse@^2.4.5, react@^19.2.8 (+13 more)

### Community 12 - "claude.ts"
Cohesion: 0.09
Nodes (36): addEdge(), addEvidence(), buildDiaryGraph(), canonicalKey(), contentId(), ContentInfo, ContentKind, ContentStats (+28 more)

### Community 13 - "map/pin/route.ts"
Cohesion: 0.15
Nodes (21): dynamic, GET(), POST(), runtime, unlocked(), DELETE(), dynamic, GET() (+13 more)

### Community 14 - "ref_fs"
Cohesion: 0.08
Nodes (18): Mode, PinGate(), onChange(), post(), submit(), Card, OcrReview(), Stats (+10 more)

### Community 15 - "insights/route.ts"
Cohesion: 0.18
Nodes (16): backfillTitles(), dynamic, GET(), LOCKED(), maxDuration, PATCH(), POST(), runtime (+8 more)

### Community 16 - "chatMemory.ts"
Cohesion: 0.07
Nodes (21): formatBytes(), MemoryPage(), disconnectDropbox(), getPosition(), load(), loadBackup(), loadDisc(), loadDropbox() (+13 more)

### Community 17 - "db"
Cohesion: 0.09
Nodes (36): dynamic, PATCH(), runtime, maybeRefreshHandwritingNotes(), strip(), tokens(), WordChange, wordChanges() (+28 more)

### Community 18 - "quality"
Cohesion: 0.18
Nodes (20): MapStayDto, MapView(), RoutePointDto, Data, fmt(), Gate, MapPage(), MapView (+12 more)

### Community 19 - "map/pin/route.ts"
Cohesion: 0.16
Nodes (22): buildDayFiles(), buildDiaryMarkdown(), buildEntityStubFiles(), collectEntities(), EnrichedRow, ENTITY_INDEX_FILE, ENTITY_STUB_FOLDER, EntityIndexEntry (+14 more)

### Community 20 - "getCurrentProfile"
Cohesion: 0.20
Nodes (19): POST(), dynamic, GET(), LOCKED(), maxDuration, runtime, processChatDiaryEntry(), buildSelfModel() (+11 more)

### Community 21 - "remarkableSync.ts"
Cohesion: 0.10
Nodes (39): affectedDayFileNames(), deleteNotebook(), downloadNotebook(), listRemarkableNotebooks(), remarkablePaired(), remarkableRootHash(), withNetRetry(), ExistingRow (+31 more)

### Community 22 - "discipline/settings/route.ts"
Cohesion: 0.39
Nodes (7): dynamic, GET(), LOCKED(), POST(), runtime, isDisciplineEnabled(), setDisciplineEnabled()

### Community 23 - "ocrBackfill.ts"
Cohesion: 0.18
Nodes (19): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backfillCandidates(), Candidate (+11 more)

### Community 24 - "mind.ts"
Cohesion: 0.08
Nodes (30): dynamic, GET(), runtime, secondLook(), Block, Box, CaptureArgs, cropFile() (+22 more)

### Community 25 - "discipline/route.ts"
Cohesion: 0.14
Nodes (23): ATTACHMENT_DIR, DELETE(), dynamic, EXT, ext(), EXT_TO_MIME, GET(), IMAGE_TYPES (+15 more)

### Community 26 - "notebooks/route.ts"
Cohesion: 0.07
Nodes (27): concurrency, cancel-in-progress, group, CI, NEXT_TELEMETRY_DISABLED, jobs, quality, name (+19 more)

### Community 27 - "notebooksPinDenied"
Cohesion: 0.19
Nodes (21): GET(), DELETE(), GET(), LOCKED(), POST(), dynamic, GET(), runtime (+13 more)

### Community 28 - "clearSetting"
Cohesion: 0.15
Nodes (14): dynamic, GET(), runtime, dynamic, GET(), runtime, recordLibrarianHeartbeat(), clearSetting() (+6 more)

### Community 29 - "embeddings.ts"
Cohesion: 0.07
Nodes (26): COMMENT_BODY, COMMENT_URL, EVENT_NAME, GH_TOKEN, PR_NUMBER, REPO, if, runs-on (+18 more)

### Community 30 - "db"
Cohesion: 0.20
Nodes (29): countEntriesMentioning(), currentTimeKst(), executeTool(), ftsSearch(), getDaySummary(), getEntriesByDate(), getInsights(), getMonthSummary() (+21 more)

### Community 31 - "decisionWiki.ts"
Cohesion: 0.20
Nodes (24): allConversationNotesRows(), allConversationFileNames(), allDecisionFileNames(), buildEntityIndexNote(), buildProfileNote(), entityStubFileName(), sanitizeEntityName(), affectedEntityStubFileNames() (+16 more)

### Community 32 - "reflectionWiki.ts"
Cohesion: 0.26
Nodes (14): dynamic, POST(), runtime, escapeHtml(), GET(), page(), POST(), runtime (+6 more)

### Community 33 - "isAuthenticated"
Cohesion: 0.14
Nodes (23): AxisLabels, EmbeddingMap(), EntityRankings(), Heatmap(), HeatmapBucket, Map3D, MapPoint, MindData (+15 more)

### Community 34 - "getCurrentProfile"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.47, @types/better-sqlite3@^7.6.11, @types/d3-force@^3.0.10, @types/node@^22.7.4, @types/react@^19.2.18, @types/react-dom@^19.2.4 (+12 more)

### Community 35 - "DiaryGraphClient.tsx"
Cohesion: 0.12
Nodes (27): dynamic, GET(), LOCKED(), runtime, captureExample(), anchorPhrase(), clean(), contextSnippet() (+19 more)

### Community 36 - "auth.ts"
Cohesion: 0.14
Nodes (30): dynamic, POST(), relyingParty(), runtime, AUTH_CHALLENGE_COOKIE, authFailKey(), AuthFailState, bumpBucket() (+22 more)

### Community 37 - "vitest"
Cohesion: 0.10
Nodes (10): vitest, findRouteFiles(), PUBLIC, AuthMod, DbMod, DbMod, Mod, DbMod (+2 more)

### Community 38 - "devDependencies"
Cohesion: 0.16
Nodes (20): ensureReflectionPage(), ensureReflectionsNotebook(), KINDS, ReflectionEntityInput, tagReflectionEntities(), dateKey(), getReflectionByKey(), markReflectionsLinked() (+12 more)

### Community 39 - "vitest"
Cohesion: 0.10
Nodes (30): dynamic, GET(), LOCKED(), runtime, ConversationEntityInput, ensureConversationPage(), ensureConversationsNotebook(), getCombinedEntityWiki() (+22 more)

### Community 40 - "entityWiki.ts"
Cohesion: 0.40
Nodes (11): AutoLock(), cancelPending(), lockNow(), markHiddenIfNeeded(), onPageHide(), onVisibility(), clearHiddenSince(), readHiddenSince() (+3 more)

### Community 41 - "ForceGraph"
Cohesion: 0.16
Nodes (20): DecisionEntityInput, ensureDecisionPage(), ensureDecisionsNotebook(), KINDS, tagDecisionEntities(), dateKey(), DECISION_FOLDER, decisionNoteFileName() (+12 more)

### Community 42 - "usage.ts"
Cohesion: 0.24
Nodes (12): dynamic, GET(), runtime, dailyUsage(), FALLBACK, monthlyUsage(), Prices, PRICES (+4 more)

### Community 43 - "insights/route.ts"
Cohesion: 0.19
Nodes (13): dynamic, LOCKED(), POST(), runtime, createRollingBatch(), maybeRollConversationMemory(), BackfillMessage, CHUNK_TARGET_CHARS (+5 more)

### Community 44 - "NotebooksContent"
Cohesion: 0.22
Nodes (10): setPickingFile(), NotebooksContent(), approvePending(), load(), loadDuplicates(), loadPendingShares(), openFilePicker(), remove() (+2 more)

### Community 45 - "entityMerge.ts"
Cohesion: 0.14
Nodes (17): DiaryGraphClient(), EDGE_COLORS, EDGE_LABELS, EDGE_TYPES, formatGeneratedAt(), Inspector(), Metric(), metricLabel() (+9 more)

### Community 46 - "notebooks/pin/route.ts"
Cohesion: 0.13
Nodes (17): EntityPredicate, isEntityPredicate(), PREDICATE_LABELS, PREDICATES, CleanRelationshipInput, cleanRelationships(), EntityKind, getRelationshipsFor() (+9 more)

### Community 47 - "embeddings.ts"
Cohesion: 0.24
Nodes (16): dynamic, GET(), maxDuration, POST(), runtime, reembedMissingMemories(), callVoyage(), embed() (+8 more)

### Community 48 - "entityTagging.ts"
Cohesion: 0.22
Nodes (17): dynamic, GET(), LOCKED(), POST(), runtime, queueNotebookProcessing(), Cand, estimateRetranscribe() (+9 more)

### Community 49 - "db.ts"
Cohesion: 0.29
Nodes (10): ForceGraph(), draw(), fit(), hit(), loop(), onDown(), onMove(), onWheel() (+2 more)

### Community 50 - "mcpOauth.ts"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 51 - "next"
Cohesion: 0.10
Nodes (17): dynamic, GET(), runtime, dynamic, GET(), runtime, listCoachSessions(), RFC-8414 (+9 more)

### Community 52 - "graphify_gate.py"
Cohesion: 0.17
Nodes (13): dynamic, GET(), OPTIONS(), runtime, RFC-8414, dynamic, GET(), OPTIONS() (+5 more)

### Community 53 - "pendingShares.ts"
Cohesion: 0.14
Nodes (18): dynamic, maxDuration, POST(), runtime, EntityWikiExcerpt, candidates(), entityWikiAutoEnabled(), evenSample() (+10 more)

### Community 54 - "entityMerge.ts"
Cohesion: 0.19
Nodes (16): dynamic, Kind, KINDS, maxDuration, POST(), postMergeDropbox(), runtime, dedupeAllEntities() (+8 more)

### Community 55 - "layout.tsx"
Cohesion: 0.18
Nodes (12): clearSans, dynamic, metadata, RootLayout(), viewport, LockOffBanner(), ensurePosthog(), PostHogProvider() (+4 more)

### Community 56 - "vaultGraph.ts"
Cohesion: 0.13
Nodes (18): AuthCode, authCodes, ClientMetadataResult, ClientRegistrationMetadata, configuredSecrets(), consentSecretValid(), currentSecretHashes(), IssuedTokens (+10 more)

### Community 57 - "authorize/route.ts"
Cohesion: 0.52
Nodes (11): track(), friendly(), LockScreen(), completeUnlock(), post(), prefetchAuthOptions(), registerDevice(), rememberDevice() (+3 more)

### Community 58 - "usage.ts"
Cohesion: 0.21
Nodes (11): coachablePages(), CoachSession, MAX_BATCH_CHARS, maybeCoachWriting(), MIN_BATCH_CHARS, MIN_PAGE_CHARS, pickBatch(), RECENT_DAYS (+3 more)

### Community 59 - "Map3D.tsx"
Cohesion: 0.26
Nodes (16): wikiLinkingEnabled(), listUnlinkedConversations(), listUnlinkedDecisions(), autoTagConversation(), autoTagDecision(), autoTagExportsEnabled(), autoTagReflection(), evenSample() (+8 more)

### Community 60 - "usage/page.tsx"
Cohesion: 0.17
Nodes (16): cleanName(), createPendingShare(), filePath(), MAX_PENDING_BYTES, MAX_PENDING_SHARES, PENDING_DIR, PENDING_RETENTION_HOURS, PendingRow (+8 more)

### Community 61 - "manifest.json"
Cohesion: 0.20
Nodes (11): dynamic, GET(), runtime, DiaryGraphEdge, DiaryGraphNode, DiaryGraphPayload, VaultNoteKind, addVaultNotesToGraph() (+3 more)

### Community 62 - "location.ts"
Cohesion: 0.32
Nodes (14): consentForm(), destHost(), dynamic, esc(), GET(), OAuthParams, page(), POST() (+6 more)

### Community 63 - "register/route.ts"
Cohesion: 0.18
Nodes (14): ActiveLabel(), Axes(), AxisEndLabel(), AxisLabels, Map3D(), MapPoint, Point(), sentimentColour() (+6 more)

### Community 64 - "analyzePending"
Cohesion: 0.13
Nodes (14): background_color, description, display, icons, name, files, share_target, action (+6 more)

### Community 65 - "next"
Cohesion: 0.19
Nodes (14): dynamic, OPTIONS(), POST(), readBoundedJson(), runtime, RFC-7591, isThrottled(), recordAuthFailure() (+6 more)

### Community 66 - "mcp/route.ts"
Cohesion: 0.20
Nodes (11): dynamic, LOCKED(), maxDuration, POST(), runtime, carryForwardDates(), DiaryPageRow, DISCIPLINE_ID (+3 more)

### Community 67 - "package.json"
Cohesion: 0.12
Nodes (15): @anthropic-ai/sdk@^0.96.0, mammoth@^1.12.0, @modelcontextprotocol/sdk@^1.26.0, posthog-js@^1.374.3, @types/leaflet@^1.9.12, engines, node, name (+7 more)

### Community 68 - "format.ts"
Cohesion: 0.15
Nodes (18): Insight, InsightsPage(), copy(), download(), exportText(), generate(), load(), summarize() (+10 more)

### Community 69 - "notebooksPin.ts"
Cohesion: 0.25
Nodes (15): dynamic, GET(), POST(), runtime, unlocked(), gate, makeNotebooksUnlockToken, NOTEBOOKS_UNLOCK_COOKIE (+7 more)

### Community 70 - "map/route.ts"
Cohesion: 0.28
Nodes (8): dynamic, GET(), runtime, TZ_OFFSET_MIN, MAP_UNLOCK_COOKIE, verifyUnlockToken, fmtLocal(), mapData()

### Community 71 - "token/route.ts"
Cohesion: 0.15
Nodes (8): CeMod, CwMod, DbMod, DiaryGraphPayload, GraphMod, MindMod, NotesMod, RelMod

### Community 72 - "mind/route.ts"
Cohesion: 0.22
Nodes (7): codeFrom(), consent(), exchange(), issueAccessToken(), Mod, pkce(), register()

### Community 73 - "createPinGate"
Cohesion: 0.21
Nodes (13): dynamic, GET(), LOCKED(), runtime, effectiveDateKeys(), isDatedEntry(), buildCandidate(), buildCloudCoverage() (+5 more)

### Community 74 - "dropboxExportLock.test.ts"
Cohesion: 0.25
Nodes (13): dynamic, fmtDate(), fmtDateTime(), fmtTime(), GET(), LOCKED(), maxDuration, runtime (+5 more)

### Community 75 - "webauthn.ts"
Cohesion: 0.16
Nodes (17): dynamic, GET(), LOCKED(), POST(), runtime, dynamic, GET(), LOCKED() (+9 more)

### Community 76 - "maybeCompressChatSessions"
Cohesion: 0.19
Nodes (13): dynamic, LOCKED(), POST(), runtime, dynamic, LOCKED(), POST(), runtime (+5 more)

### Community 77 - "notes.ts"
Cohesion: 0.13
Nodes (25): dynamic, POST(), runtime, register(), encodeEmbedding(), backfillEmbeddingsLoop(), claimNextQueuedNotebook(), correctPageText() (+17 more)

### Community 78 - "getSetting"
Cohesion: 0.16
Nodes (24): dynamic, GET(), LOCKED(), POST(), resolve(), runtime, Slot, SLOTS (+16 more)

### Community 79 - "relatedEntities.test.ts"
Cohesion: 0.33
Nodes (3): ClaudeMod, CmMod, DbMod

### Community 80 - "chatDiary.ts"
Cohesion: 0.20
Nodes (7): ConversationWikiMod, DbMod, deferred(), DiaryExportDbMod, DropboxMod, mockDropboxFetch(), UploadCall

### Community 81 - "discipline/route.ts"
Cohesion: 0.22
Nodes (13): dynamic, GET(), LOCKED(), maxDuration, runtime, BINARY_EXT, disciplineConfig(), disciplineRepoName() (+5 more)

### Community 82 - "dropbox/export/route.ts"
Cohesion: 0.21
Nodes (12): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, GET(), runtime (+4 more)

### Community 84 - "topEntities.test.ts"
Cohesion: 0.20
Nodes (5): ChatToolsMod, DbMod, MergeMod, NotesMod, Result

### Community 85 - "owntracks.ts"
Cohesion: 0.17
Nodes (19): dynamic, GET(), isPlausiblePoint(), POST(), runtime, RoutePoint, addPoint(), analyzeGaps() (+11 more)

### Community 86 - "mapPin.ts"
Cohesion: 0.27
Nodes (10): gate, MAP_UNLOCK_TTL_MS, afterFailure(), FailState, isValidPin(), lockDurationMs(), MAX_ATTEMPTS, PinGateConfig (+2 more)

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

### Community 95 - "usage/page.tsx"
Cohesion: 0.21
Nodes (10): DayCost, DayData, FEATURE_LABEL, FeatureCost, money(), MonthData, pad(), UsagePage() (+2 more)

### Community 96 - "mcp/route.ts"
Cohesion: 0.23
Nodes (11): auditRequest(), dynamic, guarded(), maxDuration, runtime, RFC-9728, checkMcpAuth(), recordMcpAudit() (+3 more)

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

### Community 102 - "mind.test.ts"
Cohesion: 0.29
Nodes (3): ChatToolsMod, McpMod, RouteMod

### Community 103 - "token/route.ts"
Cohesion: 0.33
Nodes (10): dynamic, err(), OPTIONS(), POST(), readForm(), runtime, corsHeaders(), issueTokens() (+2 more)

### Community 104 - "ocrReviewDb.test.ts"
Cohesion: 0.40
Nodes (5): dynamic, GET(), LOCKED(), maxDuration, runtime

### Community 105 - "Nav.tsx"
Cohesion: 0.25
Nodes (6): LockAllButton(), LINKS, Nav(), DocWithVT, Props, TransitionLink()

### Community 106 - "chatMemoryRecall.test.ts"
Cohesion: 0.33
Nodes (3): CmMod, DbMod, EmbMod

### Community 107 - "db.ts"
Cohesion: 0.10
Nodes (10): better-sqlite3, BackupMod, DbMod, ChatMemMod, DbMod, BackfillHelpers, DbMod, proofread (+2 more)

### Community 108 - "ref_fs"
Cohesion: 0.10
Nodes (10): AuthMod, DbMod, CdMod, DbMod, MindMod, NotesMod, DbMod, WikiMod (+2 more)

### Community 109 - "ForceGraph.tsx"
Cohesion: 0.20
Nodes (9): ForceEdgeInput, ForceNodeInput, Props, radiusFor(), SimLink, SimNode, Transform, d3-force@^3.0.1 (+1 more)

### Community 110 - "embeddingMapDiscipline.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, DedupMod, NotesMod

### Community 111 - "entityWikiExclude.test.ts"
Cohesion: 0.33
Nodes (3): Db, Review, Store

### Community 112 - "ocrLearningDb.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 113 - "webauthn.ts"
Cohesion: 0.36
Nodes (8): GET(), buildAuthenticationOptions(), buildRegistrationOptions(), hasCredentials(), listCredentials(), parseTransports(), StoredCredential, verifyAuthentication()

### Community 114 - "memory/route.ts"
Cohesion: 0.36
Nodes (8): dynamic, GET(), hasNotes(), LOCKED(), maxDuration, POST(), runtime, getCurrentProfileRow()

### Community 115 - "autosync/route.ts"
Cohesion: 0.33
Nodes (8): dynamic, LOCKED(), POST(), runtime, remarkableSyncStatus(), setSyncFolder(), syncFolderMap(), syncFolders()

### Community 116 - "mind.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, MindMod, NotesMod

### Community 117 - "tailwindcss"
Cohesion: 0.40
Nodes (4): CeMod, DbMod, ReMod, RwMod

### Community 118 - "ref_os"
Cohesion: 0.09
Nodes (9): DbMod, Mod, DbMod, DropboxMod, NotesMod, AuthMod, AuthRouteMod, WebauthnMod (+1 more)

### Community 119 - "chatDiary.ts"
Cohesion: 0.33
Nodes (8): CHAT_DIARY_NOTEBOOK_NAME, ensureChatDiaryNotebook(), MAX_DIARY_ENTRY_CHARS, nextPageIndex(), normaliseDate(), saveChatDiaryEntry(), CHAT_DIARY_NOTEBOOK_ID, todayLocalDate()

### Community 120 - "extractText.ts"
Cohesion: 0.36
Nodes (7): ExtractResult, extractTextFromAttachment(), Mammoth, mammoth(), PdfParse, pdfParse(), shouldFallback()

### Community 121 - "owntracksCurrent.test.ts"
Cohesion: 0.50
Nodes (3): tailwindcss@^3.4.13, tailwindcss, config

### Community 122 - "vaultStructure.test.ts"
Cohesion: 0.22
Nodes (8): buildHomeNote(), countLine(), entityIndexFileName(), HOME_FILE, HomeStats, PROFILE_FILE, vaultStructureFileNames(), STATS

### Community 123 - "memories/route.ts"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), MemoryRow, runtime, pendingBatchDetails()

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

### Community 132 - "attachment/[id]/route.ts"
Cohesion: 0.40
Nodes (4): ATTACHMENT_DIR, dynamic, GET(), runtime

### Community 133 - "ref_path"
Cohesion: 0.09
Nodes (14): DbMod, DeMod, DwMod, DbMod, EmbMod, MindMod, NotesMod, ClaudeMod (+6 more)

### Community 134 - "memories/[id]/route.ts"
Cohesion: 0.50
Nodes (4): DELETE(), dynamic, LOCKED(), runtime

### Community 135 - "chatMemoryDedup.test.ts"
Cohesion: 0.40
Nodes (3): CmMod, DbMod, EmbMod

### Community 137 - "dropbox/disconnect/route.ts"
Cohesion: 0.50
Nodes (3): dynamic, POST(), runtime

### Community 138 - "conversationEntities.test.ts"
Cohesion: 0.50
Nodes (3): CeMod, CwMod, DbMod

## Knowledge Gaps
- **6 isolated node(s):** `RFC-8414`, `RFC-9728`, `RFC-8414`, `RFC-9728`, `RFC-9728` (+1 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 903 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db()` connect `db` to `dropbox.ts`, `api/diary/route.ts`, `remarkableCloud.ts`, `attachment/[id]/route.ts`, `ocrLearning.ts`, `memories/[id]/route.ts`, `backup.ts`, `app/page.tsx`, `mcp.ts`, `notes.ts`, `claude.ts`, `map/pin/route.ts`, `insights/route.ts`, `db`, `getCurrentProfile`, `remarkableSync.ts`, `ocrBackfill.ts`, `mind.ts`, `discipline/route.ts`, `notebooksPinDenied`, `clearSetting`, `decisionWiki.ts`, `reflectionWiki.ts`, `DiaryGraphClient.tsx`, `auth.ts`, `devDependencies`, `vitest`, `ForceGraph`, `usage.ts`, `insights/route.ts`, `notebooks/pin/route.ts`, `embeddings.ts`, `entityTagging.ts`, `next`, `pendingShares.ts`, `entityMerge.ts`, `vaultGraph.ts`, `usage.ts`, `Map3D.tsx`, `usage/page.tsx`, `location.ts`, `next`, `mcp/route.ts`, `map/route.ts`, `createPinGate`, `dropboxExportLock.test.ts`, `webauthn.ts`, `maybeCompressChatSessions`, `notes.ts`, `getSetting`, `discipline/route.ts`, `dropbox/export/route.ts`, `owntracks.ts`, `mcp/route.ts`, `mind.test.ts`, `token/route.ts`, `db.ts`, `webauthn.ts`, `memory/route.ts`, `ref_os`, `chatDiary.ts`, `memories/route.ts`?**
  _High betweenness centrality (0.174) - this node is a cross-community bridge._
- **What connects `RFC-8414`, `RFC-9728`, `RFC-8414` to the rest of the system?**
  _6 weakly-connected nodes found - possible missing edges._
- **Should `dropbox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1036734693877551 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `diaryExportDb.ts`, `api/diary/route.ts`, `attachment/[id]/route.ts`, `ocrLearning.ts`, `memories/[id]/route.ts`, `app/page.tsx`, `dropbox/disconnect/route.ts`, `notes.ts`, `MemoryPage`, `map/pin/route.ts`, `insights/route.ts`, `db`, `quality`, `getCurrentProfile`, `discipline/settings/route.ts`, `ocrBackfill.ts`, `mind.ts`, `discipline/route.ts`, `notebooksPinDenied`, `clearSetting`, `reflectionWiki.ts`, `isAuthenticated`, `DiaryGraphClient.tsx`, `auth.ts`, `vitest`, `usage.ts`, `insights/route.ts`, `embeddings.ts`, `entityTagging.ts`, `graphify_gate.py`, `pendingShares.ts`, `entityMerge.ts`, `layout.tsx`, `manifest.json`, `location.ts`, `next`, `mcp/route.ts`, `package.json`, `notebooksPin.ts`, `map/route.ts`, `createPinGate`, `dropboxExportLock.test.ts`, `webauthn.ts`, `maybeCompressChatSessions`, `notes.ts`, `getSetting`, `discipline/route.ts`, `dropbox/export/route.ts`, `owntracks.ts`, `librarian/route.ts`, `mcp/route.ts`, `token/route.ts`, `ocrReviewDb.test.ts`, `Nav.tsx`, `memory/route.ts`, `autosync/route.ts`, `ref_os`, `memories/route.ts`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Should `diaryExportDb.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06612244897959184 - nodes in this community are weakly interconnected._
- **Why does `isAuthenticated()` connect `notebooksPinDenied` to `diaryExportDb.ts`, `api/diary/route.ts`, `attachment/[id]/route.ts`, `ocrLearning.ts`, `memories/[id]/route.ts`, `dropbox/disconnect/route.ts`, `notes.ts`, `map/pin/route.ts`, `insights/route.ts`, `db`, `getCurrentProfile`, `discipline/settings/route.ts`, `ocrBackfill.ts`, `mind.ts`, `discipline/route.ts`, `clearSetting`, `db`, `reflectionWiki.ts`, `DiaryGraphClient.tsx`, `auth.ts`, `vitest`, `usage.ts`, `insights/route.ts`, `entityMerge.ts`, `embeddings.ts`, `entityTagging.ts`, `next`, `pendingShares.ts`, `entityMerge.ts`, `layout.tsx`, `manifest.json`, `mcp/route.ts`, `map/route.ts`, `createPinGate`, `dropboxExportLock.test.ts`, `webauthn.ts`, `maybeCompressChatSessions`, `notes.ts`, `getSetting`, `discipline/route.ts`, `dropbox/export/route.ts`, `owntracks.ts`, `ocrReviewDb.test.ts`, `memory/route.ts`, `autosync/route.ts`, `memories/route.ts`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Should `remarkableCloud.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04781144781144781 - nodes in this community are weakly interconnected._