# Graph Report - remarkabler  (2026-11-22)

## Corpus Check
- 286 files · ~342,573 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 7, .woff2 4, .css 1)

## Summary
- 2398 nodes · 6360 edges · 136 communities (124 shown, 12 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a5385f87`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- dropbox.ts
- diaryExportDb.ts
- remarkableCloud.ts
- owntracks.ts
- ocrLearning.ts
- mcp.ts
- vitest
- backup.ts
- app/page.tsx
- chat/route.ts
- notes.ts
- MemoryPage
- claude.ts
- map/pin/route.ts
- ref_fs
- notes.ts
- chatMemory.ts
- db
- quality
- map/pin/route.ts
- memory/page.tsx
- env
- isAuthenticated
- ocrBackfill.ts
- mind.ts
- discipline/route.ts
- notebooks/route.ts
- notebooks/page.tsx
- remarkableImport.ts
- embeddings.ts
- dependencies
- decisionWiki.ts
- reflectionWiki.ts
- isAuthenticated
- getCurrentProfile
- DiaryGraphClient.tsx
- auth.ts
- db.ts
- devDependencies
- vitest
- entityWiki.ts
- ForceGraph
- chatMemoryFlow.test.ts
- insights/route.ts
- corsHeaders
- entityMerge.ts
- notebooks/pin/route.ts
- merge-entities/route.ts
- entityTagging.ts
- db.ts
- mcpOauth.ts
- next
- graphify_gate.py
- pendingShares.ts
- package.json
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
- ref_crypto
- notebooks/[id]/pdf/route.ts
- token/route.ts
- mind/route.ts
- createPinGate
- dropboxExportLock.test.ts
- webauthn.ts
- api/export/route.ts
- chatDiary.ts
- getSetting
- relatedEntities.test.ts
- chatDiary.ts
- mapPin.ts
- decrypt-backup.mjs
- authRoute.test.ts
- topEntities.test.ts
- owntracks/route.ts
- Nav.tsx
- pagesForEntity.test.ts
- memories/route.ts
- librarian/route.ts
- entityGraph.ts
- scripts
- chatToolsLocation.test.ts
- entityMerge.test.ts
- entityRelationships.test.ts
- getTopEntities.test.ts
- maybeCompressChatSessions
- api/diary/route.ts
- chatMemoryExtract.test.ts
- chatMemoryRecall.test.ts
- chatMemoryRolling.test.ts
- entityTagging.test.ts
- mind.test.ts
- notebookDedupDb.test.ts
- ocrReviewDb.test.ts
- relationshipExportReconcile.test.ts
- ref_os
- eslint
- correctPageText.test.ts
- dropboxTombstone.test.ts
- embeddingMapDiscipline.test.ts
- entityWikiExclude.test.ts
- ocrLearningDb.test.ts
- dropbox/disconnect/route.ts
- vaultStructure.test.ts
- mapPin.test.ts
- ref_fs
- tailwindcss
- chatMemoryFlow.test.ts
- ocrFlags.ts
- extractText.ts
- owntracksCurrent.test.ts
- [batchId]/route.ts
- handwritingNotes.ts
- rm2pdf
- postcss.config.mjs
- entityWikiExclude.test.ts
- eslint
- chatDiary.test.ts
- chatMemoryDedup.test.ts
- chunkedBackfill.test.ts
- correctPageText.test.ts
- embeddingMapDiscipline.test.ts
- entityWikiExclude.test.ts
- maybeRollConversationMemory

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
- `Nav()` --calls--> `cn()`  [EXTRACTED]
  app/Nav.tsx → components/cn.ts
- `POST()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/auth/route.ts → lib/auth.ts

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

## Communities (136 total, 12 thin omitted)

### Community 0 - "dropbox.ts"
Cohesion: 0.10
Nodes (48): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, GET(), runtime (+40 more)

### Community 1 - "diaryExportDb.ts"
Cohesion: 0.09
Nodes (37): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, LOCKED(), POST() (+29 more)

### Community 2 - "remarkableCloud.ts"
Cohesion: 0.05
Nodes (57): MAX_DIARY_ENTRY_CHARS, CHAT_TOOLS, getRelationshipsFor(), AUDIT_KEEP_ROWS, authFailures, callMcpTool(), checkMcpAuth(), COMPANION_GUIDANCE (+49 more)

### Community 3 - "owntracks.ts"
Cohesion: 0.07
Nodes (21): main(), marker_path(), main(), _align(), _analyze(), _band_extent(), _cw(), _est_pitch() (+13 more)

### Community 4 - "ocrLearning.ts"
Cohesion: 0.06
Nodes (49): dynamic, POST(), runtime, dynamic, POST(), runtime, dynamic, POST() (+41 more)

### Community 5 - "mcp.ts"
Cohesion: 0.09
Nodes (31): analyzeEntryContent(), AxisLabelResult, CHAT_MEMORY_EXTRACTION_GUIDANCE, chatOverNotes(), cleanEntityWiki(), composeEntityWiki(), compressChatSession(), ENTITY_KIND_GUIDANCE (+23 more)

### Community 6 - "vitest"
Cohesion: 0.10
Nodes (10): vitest, findRouteFiles(), PUBLIC, DbMod, OwntracksMod, DbMod, NotesMod, SyncMod (+2 more)

### Community 7 - "backup.ts"
Cohesion: 0.10
Nodes (25): BatchRow, buildTranscript(), CATEGORY_ALIASES, ChatMemoryCategory, ChatMemoryRowForDedup, compressBatch(), CompressBatchResult, DuplicateCheck (+17 more)

### Community 8 - "app/page.tsx"
Cohesion: 0.11
Nodes (25): dynamic, Home(), LatestInsight, preview(), RecentNotebook, statusLabel(), DayCost, DayData (+17 more)

### Community 9 - "chat/route.ts"
Cohesion: 0.12
Nodes (20): ChatMemoryItem, ChatMemorySection(), backfillAll(), load(), processPending(), remove(), retryStuck(), ChatMemoryStatus (+12 more)

### Community 10 - "notes.ts"
Cohesion: 0.12
Nodes (34): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backupConfigured(), BackupStatus (+26 more)

### Community 11 - "MemoryPage"
Cohesion: 0.09
Nodes (23): dependencies, better-sqlite3@^11.3.0, d3-force@^3.0.1, jszip@^3.10.1, mammoth@^1.12.0, mcp-handler@^1.1.0, next@^16.4.6, pdf-parse@^2.4.5 (+15 more)

### Community 12 - "claude.ts"
Cohesion: 0.09
Nodes (37): ExportedConversationRow, addEdge(), addEvidence(), buildDiaryGraph(), canonicalKey(), contentId(), ContentInfo, ContentKind (+29 more)

### Community 13 - "map/pin/route.ts"
Cohesion: 0.11
Nodes (25): dynamic, GET(), runtime, unlocked(), dynamic, GET(), runtime, DELETE() (+17 more)

### Community 14 - "ref_fs"
Cohesion: 0.07
Nodes (28): setPickingFile(), Mode, PinGate(), onChange(), post(), submit(), Card, OcrReview() (+20 more)

### Community 15 - "notes.ts"
Cohesion: 0.09
Nodes (38): backfillTitles(), dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, register() (+30 more)

### Community 16 - "chatMemory.ts"
Cohesion: 0.07
Nodes (21): formatBytes(), MemoryPage(), disconnectDropbox(), getPosition(), load(), loadBackup(), loadDisc(), loadDropbox() (+13 more)

### Community 17 - "db"
Cohesion: 0.11
Nodes (27): dynamic, PATCH(), runtime, applyFixes(), AUTOFIX_MIN, autoFixablePairs(), autoFixPages(), buildOcrHints() (+19 more)

### Community 18 - "quality"
Cohesion: 0.19
Nodes (19): MapStayDto, MapView(), RoutePointDto, Data, fmt(), Gate, MapPage(), MapView (+11 more)

### Community 19 - "map/pin/route.ts"
Cohesion: 0.15
Nodes (25): buildDayFiles(), buildDiaryMarkdown(), buildEntityStubFiles(), carryForwardDates(), collectEntities(), effectiveDateKeys(), EnrichedRow, ENTITY_INDEX_FILE (+17 more)

### Community 20 - "memory/page.tsx"
Cohesion: 0.19
Nodes (17): cachedPlace(), cacheKey(), reverseGeocodePlace(), RoutePoint, analyzeGaps(), durationLabel(), fmtLocal(), GapStats (+9 more)

### Community 21 - "env"
Cohesion: 0.10
Nodes (31): dynamic, LOCKED(), POST(), runtime, dynamic, GET(), LOCKED(), runtime (+23 more)

### Community 22 - "isAuthenticated"
Cohesion: 0.10
Nodes (26): ATTACHMENT_DIR, dynamic, GET(), runtime, dynamic, POST(), runtime, GET() (+18 more)

### Community 23 - "ocrBackfill.ts"
Cohesion: 0.27
Nodes (11): modelMain(), backfillCandidates(), Candidate, estimateBackfill(), FILES_DIR, MAX_PER_RUN, NotebookResult, pdfPath() (+3 more)

### Community 24 - "mind.ts"
Cohesion: 0.11
Nodes (22): dynamic, runtime, Block, Box, CaptureArgs, cropFile(), cropPng(), Example (+14 more)

### Community 25 - "discipline/route.ts"
Cohesion: 0.16
Nodes (18): ATTACHMENT_DIR, DELETE(), dynamic, EXT, ext(), EXT_TO_MIME, GET(), IMAGE_TYPES (+10 more)

### Community 26 - "notebooks/route.ts"
Cohesion: 0.07
Nodes (27): concurrency, cancel-in-progress, group, CI, NEXT_TELEMETRY_DISABLED, jobs, quality, name (+19 more)

### Community 27 - "notebooks/page.tsx"
Cohesion: 0.25
Nodes (16): dynamic, GET(), maxDuration, POST(), runtime, callVoyage(), embed(), embedBatch() (+8 more)

### Community 28 - "remarkableImport.ts"
Cohesion: 0.16
Nodes (18): dynamic, LOCKED(), maxDuration, POST(), runtime, createNotebook(), queueNotebookProcessing(), ExistingRow (+10 more)

### Community 29 - "embeddings.ts"
Cohesion: 0.07
Nodes (26): COMMENT_BODY, COMMENT_URL, EVENT_NAME, GH_TOKEN, PR_NUMBER, REPO, if, runs-on (+18 more)

### Community 30 - "dependencies"
Cohesion: 0.11
Nodes (43): countEntriesMentioning(), currentTimeKst(), executeTool(), ftsSearch(), getDaySummary(), getEntriesByDate(), getInsights(), getMonthSummary() (+35 more)

### Community 31 - "decisionWiki.ts"
Cohesion: 0.20
Nodes (24): allConversationNotesRows(), allConversationFileNames(), allDecisionFileNames(), buildEntityIndexNote(), buildProfileNote(), entityStubFileName(), sanitizeEntityName(), affectedEntityStubFileNames() (+16 more)

### Community 32 - "reflectionWiki.ts"
Cohesion: 0.19
Nodes (18): DELETE(), dynamic, LOCKED(), POST(), runtime, escapeHtml(), GET(), page() (+10 more)

### Community 33 - "isAuthenticated"
Cohesion: 0.14
Nodes (23): AxisLabels, EmbeddingMap(), EntityRankings(), Heatmap(), HeatmapBucket, Map3D, MapPoint, MindData (+15 more)

### Community 34 - "getCurrentProfile"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.47, @types/better-sqlite3@^7.6.11, @types/d3-force@^3.0.10, @types/node@^22.7.4, @types/react@^19.2.18, @types/react-dom@^19.2.4 (+12 more)

### Community 35 - "DiaryGraphClient.tsx"
Cohesion: 0.15
Nodes (23): dynamic, GET(), LOCKED(), POST(), runtime, captureExample(), examplesAvailable(), anchorPhrase() (+15 more)

### Community 36 - "auth.ts"
Cohesion: 0.10
Nodes (44): dynamic, GET(), POST(), relyingParty(), runtime, POST(), RootLayout(), appIsFailClosed() (+36 more)

### Community 37 - "db.ts"
Cohesion: 0.07
Nodes (20): ATTACHMENT_DIR, recoverInterruptedNotebooks(), better-sqlite3, AuthMod, DbMod, BackupMod, DbMod, CleanupMod (+12 more)

### Community 38 - "devDependencies"
Cohesion: 0.14
Nodes (22): ensureReflectionPage(), ensureReflectionsNotebook(), KINDS, ReflectionEntityInput, tagReflectionEntities(), dateKey(), getReflectionByKey(), markReflectionsFiled() (+14 more)

### Community 39 - "vitest"
Cohesion: 0.15
Nodes (20): dynamic, GET(), LOCKED(), runtime, ConversationEntityInput, ensureConversationPage(), ensureConversationsNotebook(), getCombinedEntityWiki() (+12 more)

### Community 40 - "entityWiki.ts"
Cohesion: 0.40
Nodes (11): AutoLock(), cancelPending(), lockNow(), markHiddenIfNeeded(), onPageHide(), onVisibility(), clearHiddenSince(), readHiddenSince() (+3 more)

### Community 41 - "ForceGraph"
Cohesion: 0.14
Nodes (22): DecisionEntityInput, ensureDecisionPage(), ensureDecisionsNotebook(), KINDS, tagDecisionEntities(), dateKey(), DECISION_FOLDER, decisionNoteFileName() (+14 more)

### Community 43 - "insights/route.ts"
Cohesion: 0.24
Nodes (10): dynamic, LOCKED(), POST(), runtime, BackfillMessage, CHUNK_TARGET_CHARS, chunkedBackfillForConversation(), chunkMessageIds() (+2 more)

### Community 44 - "corsHeaders"
Cohesion: 0.20
Nodes (16): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, BINARY_EXT, disciplineConfig() (+8 more)

### Community 45 - "entityMerge.ts"
Cohesion: 0.13
Nodes (18): DiaryGraphClient(), EDGE_COLORS, EDGE_LABELS, EDGE_TYPES, formatGeneratedAt(), Inspector(), Metric(), metricLabel() (+10 more)

### Community 46 - "notebooks/pin/route.ts"
Cohesion: 0.13
Nodes (18): getConversationByKey(), EntityPredicate, isEntityPredicate(), PREDICATE_LABELS, PREDICATES, CleanRelationshipInput, cleanRelationships(), EntityKind (+10 more)

### Community 47 - "merge-entities/route.ts"
Cohesion: 0.28
Nodes (8): dynamic, Kind, KINDS, maxDuration, POST(), postMergeDropbox(), runtime, listAliases()

### Community 48 - "entityTagging.ts"
Cohesion: 0.12
Nodes (28): dynamic, GET(), LOCKED(), POST(), runtime, dynamic, GET(), runtime (+20 more)

### Community 49 - "db.ts"
Cohesion: 0.15
Nodes (17): ForceEdgeInput, ForceGraph(), draw(), fit(), hit(), loop(), onDown(), onMove() (+9 more)

### Community 50 - "mcpOauth.ts"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 51 - "next"
Cohesion: 0.10
Nodes (17): DELETE(), dynamic, LOCKED(), runtime, dynamic, GET(), runtime, RFC-8414 (+9 more)

### Community 52 - "graphify_gate.py"
Cohesion: 0.17
Nodes (13): dynamic, GET(), OPTIONS(), runtime, RFC-8414, dynamic, GET(), OPTIONS() (+5 more)

### Community 53 - "pendingShares.ts"
Cohesion: 0.15
Nodes (18): dynamic, maxDuration, POST(), runtime, EntityWikiExcerpt, candidates(), entityWikiAutoEnabled(), evenSample() (+10 more)

### Community 54 - "package.json"
Cohesion: 0.25
Nodes (15): dynamic, GET(), POST(), runtime, unlocked(), gate, makeNotebooksUnlockToken, NOTEBOOKS_UNLOCK_COOKIE (+7 more)

### Community 55 - "layout.tsx"
Cohesion: 0.17
Nodes (9): clearSans, dynamic, metadata, viewport, LockOffBanner(), ensurePosthog(), PostHogProvider(), trackEvent() (+1 more)

### Community 56 - "vaultGraph.ts"
Cohesion: 0.13
Nodes (18): AuthCode, authCodes, ClientMetadataResult, ClientRegistrationMetadata, configuredSecrets(), consentSecretValid(), currentSecretHashes(), IssuedTokens (+10 more)

### Community 57 - "authorize/route.ts"
Cohesion: 0.52
Nodes (11): track(), friendly(), LockScreen(), completeUnlock(), post(), prefetchAuthOptions(), registerDevice(), rememberDevice() (+3 more)

### Community 58 - "usage.ts"
Cohesion: 0.15
Nodes (16): dynamic, GET(), runtime, coachWriting(), coachablePages(), CoachSession, listCoachSessions(), MAX_BATCH_CHARS (+8 more)

### Community 59 - "Map3D.tsx"
Cohesion: 0.26
Nodes (17): extractTaggingEntities(), wikiLinkingEnabled(), listUnlinkedConversations(), listUnlinkedDecisions(), autoTagConversation(), autoTagDecision(), autoTagExportsEnabled(), autoTagReflection() (+9 more)

### Community 60 - "usage/page.tsx"
Cohesion: 0.13
Nodes (26): DELETE(), dynamic, GET(), LOCKED(), POST(), runtime, cleanName(), createPendingShare() (+18 more)

### Community 61 - "manifest.json"
Cohesion: 0.21
Nodes (11): dynamic, GET(), runtime, DiaryGraphEdge, DiaryGraphPayload, VaultNoteKind, insightDropboxFolders(), addVaultNotesToGraph() (+3 more)

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
Cohesion: 0.13
Nodes (23): dynamic, OPTIONS(), POST(), readBoundedJson(), runtime, auditRequest(), dynamic, guarded() (+15 more)

### Community 66 - "mcp/route.ts"
Cohesion: 0.22
Nodes (10): dynamic, LOCKED(), maxDuration, POST(), runtime, compareTranscriptions(), DiaryPageRow, compareImportedNotebook() (+2 more)

### Community 67 - "package.json"
Cohesion: 0.12
Nodes (15): @anthropic-ai/sdk@^0.96.0, leaflet@^1.9.4, @modelcontextprotocol/sdk@^1.26.0, @types/leaflet@^1.9.12, zod@^4.4.3, engines, node, name (+7 more)

### Community 68 - "format.ts"
Cohesion: 0.25
Nodes (11): Insight, InsightsPage(), copy(), download(), exportText(), generate(), load(), summarize() (+3 more)

### Community 69 - "ref_crypto"
Cohesion: 0.15
Nodes (11): dynamic, GET(), runtime, dynamic, GET(), runtime, buildAuthUrl(), exchangeCodeForTokens() (+3 more)

### Community 70 - "notebooks/[id]/pdf/route.ts"
Cohesion: 0.22
Nodes (12): CONVERSATION_FOLDER, conversationNoteFileName(), MAX_CONVERSATION_CHARS, renderConversationNote(), renderConversationNoteFiles(), sanitizeFileName(), saveExportedConversation(), unfiledConversationCount() (+4 more)

### Community 71 - "token/route.ts"
Cohesion: 0.15
Nodes (8): CeMod, CwMod, DbMod, DiaryGraphPayload, GraphMod, MindMod, NotesMod, RelMod

### Community 72 - "mind/route.ts"
Cohesion: 0.22
Nodes (7): codeFrom(), consent(), exchange(), issueAccessToken(), Mod, pkce(), register()

### Community 73 - "createPinGate"
Cohesion: 0.25
Nodes (11): dynamic, GET(), LOCKED(), runtime, buildCandidate(), buildCloudCoverage(), classifyDuplicate(), CloudCoverage (+3 more)

### Community 74 - "dropboxExportLock.test.ts"
Cohesion: 0.32
Nodes (11): dynamic, fmtDate(), fmtDateTime(), fmtTime(), GET(), LOCKED(), maxDuration, runtime (+3 more)

### Community 75 - "webauthn.ts"
Cohesion: 0.18
Nodes (15): dynamic, GET(), LOCKED(), POST(), runtime, dynamic, GET(), LOCKED() (+7 more)

### Community 76 - "api/export/route.ts"
Cohesion: 0.33
Nodes (10): dynamic, err(), OPTIONS(), POST(), readForm(), runtime, corsHeaders(), issueTokens() (+2 more)

### Community 77 - "chatDiary.ts"
Cohesion: 0.12
Nodes (35): dynamic, GET(), LOCKED(), maxDuration, runtime, dynamic, GET(), hasNotes() (+27 more)

### Community 78 - "getSetting"
Cohesion: 0.14
Nodes (28): PATCH(), dynamic, GET(), LOCKED(), POST(), resolve(), runtime, Slot (+20 more)

### Community 79 - "relatedEntities.test.ts"
Cohesion: 0.33
Nodes (3): ClaudeMod, CmMod, DbMod

### Community 80 - "chatDiary.ts"
Cohesion: 0.20
Nodes (7): ConversationWikiMod, DbMod, deferred(), DiaryExportDbMod, DropboxMod, mockDropboxFetch(), UploadCall

### Community 81 - "mapPin.ts"
Cohesion: 0.27
Nodes (10): gate, MAP_UNLOCK_TTL_MS, afterFailure(), FailState, isValidPin(), lockDurationMs(), MAX_ATTEMPTS, PinGateConfig (+2 more)

### Community 82 - "decrypt-backup.mjs"
Cohesion: 0.27
Nodes (7): secondLook(), examplesForTexts(), OcrFlag, applySecondLook(), LookAnswer, LookItem, parseLookAnswers()

### Community 84 - "topEntities.test.ts"
Cohesion: 0.20
Nodes (5): ChatToolsMod, DbMod, MergeMod, NotesMod, Result

### Community 85 - "owntracks/route.ts"
Cohesion: 0.33
Nodes (10): dynamic, GET(), isPlausiblePoint(), POST(), runtime, addPoint(), checkOwntracksToken(), owntracksConfigured() (+2 more)

### Community 86 - "Nav.tsx"
Cohesion: 0.25
Nodes (6): LockAllButton(), LINKS, Nav(), DocWithVT, Props, TransitionLink()

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

### Community 94 - "entityRelationships.test.ts"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), MemoryRow, runtime, pendingBatchDetails()

### Community 95 - "getTopEntities.test.ts"
Cohesion: 0.43
Nodes (6): dynamic, GET(), LOCKED(), POST(), runtime, setDisciplineEnabled()

### Community 96 - "maybeCompressChatSessions"
Cohesion: 0.27
Nodes (9): dynamic, LOCKED(), POST(), runtime, clearCompressionInFlight(), compressionInFlight(), maybeCompressChatSessions(), pendingBatchCount() (+1 more)

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

### Community 103 - "notebookDedupDb.test.ts"
Cohesion: 0.40
Nodes (5): dynamic, Entry, GET(), LOCKED(), runtime

### Community 104 - "ocrReviewDb.test.ts"
Cohesion: 0.40
Nodes (5): dynamic, GET(), LOCKED(), maxDuration, runtime

### Community 105 - "relationshipExportReconcile.test.ts"
Cohesion: 0.53
Nodes (4): strip(), tokens(), WordChange, wordChanges()

### Community 106 - "ref_os"
Cohesion: 0.09
Nodes (11): AuthMod, DbMod, CmMod, DbMod, EmbMod, DbMod, DeMod, DwMod (+3 more)

### Community 108 - "correctPageText.test.ts"
Cohesion: 0.33
Nodes (5): ClaudeMod, CwMod, DbMod, EtMod, RwMod

### Community 109 - "dropboxTombstone.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, MindMod, NotesMod

### Community 110 - "embeddingMapDiscipline.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, DedupMod, NotesMod

### Community 111 - "entityWikiExclude.test.ts"
Cohesion: 0.33
Nodes (3): Db, Review, Store

### Community 112 - "ocrLearningDb.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 113 - "dropbox/disconnect/route.ts"
Cohesion: 0.27
Nodes (7): dynamic, POST(), runtime, classifyDropboxError(), disconnectDropbox(), revokeAccessTokenAtDropbox(), safeDropboxError()

### Community 114 - "vaultStructure.test.ts"
Cohesion: 0.22
Nodes (8): buildHomeNote(), countLine(), entityIndexFileName(), HOME_FILE, HomeStats, PROFILE_FILE, vaultStructureFileNames(), STATS

### Community 115 - "mapPin.test.ts"
Cohesion: 0.40
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 116 - "ref_fs"
Cohesion: 0.11
Nodes (10): CeMod, CwMod, DbMod, DbMod, DropboxMod, AuthMod, Db, L (+2 more)

### Community 117 - "tailwindcss"
Cohesion: 0.40
Nodes (4): CeMod, DbMod, ReMod, RwMod

### Community 119 - "ocrFlags.ts"
Cohesion: 0.25
Nodes (11): ocrNotebookPdf(), ocrNotebookPdfWithFlags(), parsePages(), proofreadExistingPdf(), exampleBlocks(), clean(), MAX_FLAGS_PER_CALL, parseBox() (+3 more)

### Community 120 - "extractText.ts"
Cohesion: 0.36
Nodes (7): ExtractResult, extractTextFromAttachment(), Mammoth, mammoth(), PdfParse, pdfParse(), shouldFallback()

### Community 121 - "owntracksCurrent.test.ts"
Cohesion: 0.50
Nodes (3): tailwindcss@^3.4.13, tailwindcss, config

### Community 122 - "[batchId]/route.ts"
Cohesion: 0.47
Nodes (5): dynamic, LOCKED(), POST(), runtime, resetBatchForRetry()

### Community 123 - "handwritingNotes.ts"
Cohesion: 0.60
Nodes (5): composeHandwritingNotes(), maybeRefreshHandwritingNotes(), correctedPairsForNotes(), handwritingNotesDue(), saveHandwritingNotes()

### Community 128 - "eslint"
Cohesion: 0.40
Nodes (4): eslint@^9.39.5, eslint-config-next@^16.3.2, eslint, eslint-config-next

### Community 129 - "chatDiary.test.ts"
Cohesion: 0.40
Nodes (4): CdMod, DbMod, MindMod, NotesMod

### Community 130 - "chatMemoryDedup.test.ts"
Cohesion: 0.40
Nodes (3): CmMod, DbMod, EmbMod

### Community 133 - "embeddingMapDiscipline.test.ts"
Cohesion: 0.40
Nodes (4): DbMod, EmbMod, MindMod, NotesMod

### Community 134 - "entityWikiExclude.test.ts"
Cohesion: 0.40
Nodes (3): ClaudeMod, DbMod, EwMod

### Community 135 - "maybeRollConversationMemory"
Cohesion: 0.67
Nodes (3): createRollingBatch(), maybeRollConversationMemory(), createBatchForChunk()

## Knowledge Gaps
- **6 isolated node(s):** `RFC-8414`, `RFC-9728`, `RFC-7591`, `RFC-9728`, `RFC-9728` (+1 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 901 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db()` connect `dependencies` to `dropbox.ts`, `remarkableCloud.ts`, `ocrLearning.ts`, `mcp.ts`, `backup.ts`, `app/page.tsx`, `maybeRollConversationMemory`, `notes.ts`, `claude.ts`, `map/pin/route.ts`, `notes.ts`, `db`, `memory/page.tsx`, `env`, `isAuthenticated`, `ocrBackfill.ts`, `mind.ts`, `discipline/route.ts`, `notebooks/page.tsx`, `remarkableImport.ts`, `decisionWiki.ts`, `reflectionWiki.ts`, `DiaryGraphClient.tsx`, `auth.ts`, `db.ts`, `devDependencies`, `vitest`, `ForceGraph`, `insights/route.ts`, `corsHeaders`, `notebooks/pin/route.ts`, `merge-entities/route.ts`, `entityTagging.ts`, `next`, `pendingShares.ts`, `vaultGraph.ts`, `usage.ts`, `Map3D.tsx`, `usage/page.tsx`, `location.ts`, `next`, `mcp/route.ts`, `notebooks/[id]/pdf/route.ts`, `createPinGate`, `dropboxExportLock.test.ts`, `webauthn.ts`, `api/export/route.ts`, `chatDiary.ts`, `getSetting`, `decrypt-backup.mjs`, `owntracks/route.ts`, `entityRelationships.test.ts`, `maybeCompressChatSessions`, `mind.test.ts`, `notebookDedupDb.test.ts`, `chatMemoryFlow.test.ts`, `[batchId]/route.ts`, `handwritingNotes.ts`?**
  _High betweenness centrality (0.240) - this node is a cross-community bridge._
- **What connects `RFC-8414`, `RFC-9728`, `RFC-7591` to the rest of the system?**
  _6 weakly-connected nodes found - possible missing edges._
- **Should `dropbox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10030165912518854 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `dropbox.ts`, `diaryExportDb.ts`, `ocrLearning.ts`, `app/page.tsx`, `chat/route.ts`, `notes.ts`, `MemoryPage`, `map/pin/route.ts`, `notes.ts`, `db`, `quality`, `env`, `isAuthenticated`, `mind.ts`, `discipline/route.ts`, `notebooks/page.tsx`, `remarkableImport.ts`, `reflectionWiki.ts`, `isAuthenticated`, `DiaryGraphClient.tsx`, `auth.ts`, `vitest`, `insights/route.ts`, `corsHeaders`, `merge-entities/route.ts`, `entityTagging.ts`, `graphify_gate.py`, `pendingShares.ts`, `package.json`, `layout.tsx`, `usage.ts`, `usage/page.tsx`, `manifest.json`, `location.ts`, `next`, `mcp/route.ts`, `package.json`, `ref_crypto`, `createPinGate`, `dropboxExportLock.test.ts`, `webauthn.ts`, `api/export/route.ts`, `chatDiary.ts`, `getSetting`, `owntracks/route.ts`, `Nav.tsx`, `librarian/route.ts`, `entityRelationships.test.ts`, `getTopEntities.test.ts`, `maybeCompressChatSessions`, `notebookDedupDb.test.ts`, `ocrReviewDb.test.ts`, `ref_os`, `dropbox/disconnect/route.ts`, `[batchId]/route.ts`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Should `diaryExportDb.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08562367864693446 - nodes in this community are weakly interconnected._
- **Why does `isAuthenticated()` connect `isAuthenticated` to `dropbox.ts`, `diaryExportDb.ts`, `ocrLearning.ts`, `notes.ts`, `map/pin/route.ts`, `notes.ts`, `db`, `env`, `mind.ts`, `discipline/route.ts`, `notebooks/page.tsx`, `remarkableImport.ts`, `dependencies`, `reflectionWiki.ts`, `DiaryGraphClient.tsx`, `auth.ts`, `vitest`, `insights/route.ts`, `corsHeaders`, `entityMerge.ts`, `merge-entities/route.ts`, `entityTagging.ts`, `next`, `pendingShares.ts`, `layout.tsx`, `usage.ts`, `usage/page.tsx`, `manifest.json`, `mcp/route.ts`, `ref_crypto`, `createPinGate`, `dropboxExportLock.test.ts`, `webauthn.ts`, `chatDiary.ts`, `getSetting`, `owntracks/route.ts`, `entityRelationships.test.ts`, `getTopEntities.test.ts`, `maybeCompressChatSessions`, `notebookDedupDb.test.ts`, `ocrReviewDb.test.ts`, `dropbox/disconnect/route.ts`, `[batchId]/route.ts`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Should `remarkableCloud.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04558737580362361 - nodes in this community are weakly interconnected._