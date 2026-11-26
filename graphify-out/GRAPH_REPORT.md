# Graph Report - remarkabler  (2026-11-26)

## Corpus Check
- 286 files · ~344,035 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 7, .woff2 4, .css 1)

## Summary
- 2404 nodes · 6379 edges · 136 communities (124 shown, 12 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f6fd4790`
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
- owntracks.ts
- notes.ts
- MemoryPage
- claude.ts
- ocrNotebookPdfWithFlags
- ref_fs
- insights/route.ts
- chatMemory.ts
- db
- quality
- map/pin/route.ts
- chatDiary.ts
- remarkableSync.ts
- discipline/settings/route.ts
- ocrBackfill.ts
- mind.ts
- discipline/route.ts
- notebooks/route.ts
- remarkableImport.ts
- clearSetting
- embeddings.ts
- db
- decisionWiki.ts
- reflectionWiki.ts
- isAuthenticated
- getCurrentProfile
- DiaryGraphClient.tsx
- auth.ts
- correctPageText.test.ts
- devDependencies
- vitest
- entityWiki.ts
- ForceGraph
- usage.ts
- insights/route.ts
- analyzePending
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
- getAccessToken
- map/route.ts
- token/route.ts
- mind/route.ts
- createPinGate
- dropboxExportLock.test.ts
- webauthn.ts
- ocr-review/route.ts
- notes.ts
- createPinGate
- relatedEntities.test.ts
- chatDiary.ts
- models/route.ts
- dropbox/export/route.ts
- authRoute.test.ts
- topEntities.test.ts
- owntracks/route.ts
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
- insightSources.ts
- chatMemoryRecall.test.ts
- chatMemoryRolling.test.ts
- ref_os
- librarian/route.ts
- embeddingMapDiscipline.test.ts
- entityWikiExclude.test.ts
- ocrDiff.ts
- chatDiary.test.ts
- chunkedBackfill.test.ts
- writingCoach.test.ts
- mind.test.ts
- tailwindcss
- ref_path
- extractText.ts
- owntracksCurrent.test.ts
- memories/route.ts
- rm2pdf
- postcss.config.mjs
- entityWikiExclude.test.ts
- eslint
- entityGraph.ts
- api/diary/route.ts
- entityTagging.test.ts
- isAuthenticated
- db.ts
- chatMemoryDedup.test.ts
- dropbox/disconnect/route.ts
- vitest
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
9. `callMcpTool()` - 30 edges
10. `notebooksPinDenied()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/authorization-server/route.ts → lib/mcpOauth.ts
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/register/route.ts → lib/mcpOauth.ts
- `GET()` --calls--> `db()`  [EXTRACTED]
  app/api/ocr-review/crop/route.ts → lib/db.ts
- `GET()` --calls--> `cropPng()`  [EXTRACTED]
  app/api/ocr-review/crop/route.ts → lib/handwritingExamples.ts
- `GET()` --calls--> `pagePicture()`  [EXTRACTED]
  app/api/ocr-review/crop/route.ts → lib/handwritingExamples.ts

## Import Cycles
- 2-file cycle: `lib/entityMerge.ts -> lib/mind.ts -> lib/entityMerge.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/claude.ts -> lib/chatTools.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/dropbox.ts -> lib/reflectionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts`
- 4-file cycle: `lib/conversationWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/conversationWiki.ts`
- 4-file cycle: `lib/decisionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/decisionWiki.ts`
- 4-file cycle: `lib/diaryExportDb.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/mind.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/entityMerge.ts -> lib/claude.ts -> lib/chatTools.ts`
- 5-file cycle: `lib/conversationEntities.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts -> lib/conversationEntities.ts`
- 5-file cycle: `lib/diaryExportDb.ts -> lib/reflectionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts`
- 5-file cycle: `lib/conversationWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts -> lib/conversationWiki.ts`
- 5-file cycle: `lib/decisionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts -> lib/decisionWiki.ts`
- 5-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/entityMerge.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`

## Communities (136 total, 12 thin omitted)

### Community 0 - "dropbox.ts"
Cohesion: 0.14
Nodes (24): markConversationsFiled(), unfiledConversationKeys(), markDecisionsFiled(), unfiledDecisionKeys(), deleteDiaryExportFiles(), DiaryExportResult, DropboxErrorKind, dropboxExportEnabled() (+16 more)

### Community 1 - "diaryExportDb.ts"
Cohesion: 0.08
Nodes (39): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, LOCKED(), POST() (+31 more)

### Community 2 - "remarkableCloud.ts"
Cohesion: 0.05
Nodes (55): CHAT_TOOLS, saveExportedConversation(), saveDecision(), getRelationshipsFor(), AUDIT_KEEP_ROWS, authFailures, callMcpTool(), COMPANION_GUIDANCE (+47 more)

### Community 3 - "owntracks.ts"
Cohesion: 0.07
Nodes (23): bash_edits_code(), main(), marker_path(), main(), _acf_pitch(), _align(), _analyze(), _band_extent() (+15 more)

### Community 4 - "ocrLearning.ts"
Cohesion: 0.10
Nodes (34): dynamic, POST(), runtime, dynamic, GET(), runtime, AxisExtremeEntry, AxisLabels (+26 more)

### Community 5 - "mcp.ts"
Cohesion: 0.09
Nodes (43): analyzeEntryContent(), AxisLabelResult, buildSelfModel(), CHAT_MEMORY_EXTRACTION_GUIDANCE, chatOverNotes(), cleanEntityWiki(), client(), coachWriting() (+35 more)

### Community 6 - "remarkableTombstone.test.ts"
Cohesion: 0.40
Nodes (3): DbMod, NotesMod, SyncMod

### Community 7 - "backup.ts"
Cohesion: 0.07
Nodes (42): dynamic, LOCKED(), POST(), runtime, dynamic, LOCKED(), POST(), runtime (+34 more)

### Community 8 - "app/page.tsx"
Cohesion: 0.12
Nodes (21): dynamic, Home(), LatestInsight, preview(), RecentNotebook, statusLabel(), Badge(), BadgeProps (+13 more)

### Community 9 - "owntracks.ts"
Cohesion: 0.21
Nodes (16): cachedPlace(), cacheKey(), reverseGeocodePlace(), analyzeGaps(), durationLabel(), fmtLocal(), GapStats, gapStatsForWindow() (+8 more)

### Community 10 - "notes.ts"
Cohesion: 0.12
Nodes (34): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backupConfigured(), BackupStatus (+26 more)

### Community 11 - "MemoryPage"
Cohesion: 0.09
Nodes (23): dependencies, better-sqlite3@^11.3.0, d3-force@^3.0.1, jszip@^3.10.1, mammoth@^1.12.0, mcp-handler@^1.1.0, next@^16.4.6, pdf-parse@^2.4.5 (+15 more)

### Community 12 - "claude.ts"
Cohesion: 0.09
Nodes (38): SavedDecisionRow, addEdge(), addEvidence(), buildDiaryGraph(), canonicalKey(), contentId(), ContentInfo, ContentKind (+30 more)

### Community 13 - "ocrNotebookPdfWithFlags"
Cohesion: 0.16
Nodes (14): ocrNotebookPdf(), ocrNotebookPdfWithFlags(), parsePages(), proofreadExistingPdf(), secondLook(), exampleBlocks(), examplesForTexts(), imageBlock() (+6 more)

### Community 14 - "ref_fs"
Cohesion: 0.07
Nodes (24): setPickingFile(), Card, OcrReview(), Stats, Estimate, OldDiaryProofread(), DuplicateCandidate, Gate (+16 more)

### Community 15 - "insights/route.ts"
Cohesion: 0.33
Nodes (9): backfillTitles(), dynamic, GET(), LOCKED(), maxDuration, PATCH(), POST(), runtime (+1 more)

### Community 16 - "chatMemory.ts"
Cohesion: 0.08
Nodes (20): MemoryPage(), disconnectDropbox(), getPosition(), load(), loadBackup(), loadDisc(), loadDropbox(), loadEmbed() (+12 more)

### Community 17 - "db"
Cohesion: 0.10
Nodes (32): dynamic, PATCH(), runtime, maybeRefreshHandwritingNotes(), correctPageText(), applyFixes(), AUTOFIX_MIN, autoFixablePairs() (+24 more)

### Community 18 - "quality"
Cohesion: 0.14
Nodes (25): MapStayDto, MapView(), RoutePointDto, Data, fmt(), Gate, MapPage(), MapView (+17 more)

### Community 19 - "map/pin/route.ts"
Cohesion: 0.13
Nodes (26): buildDayFiles(), buildDiaryMarkdown(), buildEntityIndexNote(), buildHomeNote(), buildProfileNote(), collectEntities(), countLine(), EnrichedRow (+18 more)

### Community 20 - "chatDiary.ts"
Cohesion: 0.11
Nodes (36): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, dynamic, GET() (+28 more)

### Community 21 - "remarkableSync.ts"
Cohesion: 0.10
Nodes (33): dynamic, LOCKED(), POST(), runtime, dynamic, GET(), LOCKED(), runtime (+25 more)

### Community 22 - "discipline/settings/route.ts"
Cohesion: 0.43
Nodes (6): dynamic, GET(), LOCKED(), POST(), runtime, setDisciplineEnabled()

### Community 23 - "ocrBackfill.ts"
Cohesion: 0.19
Nodes (19): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backfillCandidates(), Candidate (+11 more)

### Community 24 - "mind.ts"
Cohesion: 0.11
Nodes (22): dynamic, runtime, Block, Box, CaptureArgs, cropFile(), cropPng(), Example (+14 more)

### Community 25 - "discipline/route.ts"
Cohesion: 0.17
Nodes (17): ATTACHMENT_DIR, DELETE(), dynamic, EXT, ext(), EXT_TO_MIME, GET(), IMAGE_TYPES (+9 more)

### Community 26 - "notebooks/route.ts"
Cohesion: 0.07
Nodes (27): concurrency, cancel-in-progress, group, CI, NEXT_TELEMETRY_DISABLED, jobs, quality, name (+19 more)

### Community 27 - "remarkableImport.ts"
Cohesion: 0.13
Nodes (21): dynamic, LOCKED(), maxDuration, POST(), runtime, maybeIngestDropbox(), createNotebook(), queueNotebookProcessing() (+13 more)

### Community 28 - "clearSetting"
Cohesion: 0.17
Nodes (11): dynamic, GET(), runtime, dynamic, GET(), runtime, buildAuthUrl(), exchangeCodeForTokens() (+3 more)

### Community 29 - "embeddings.ts"
Cohesion: 0.07
Nodes (26): COMMENT_BODY, COMMENT_URL, EVENT_NAME, GH_TOKEN, PR_NUMBER, REPO, if, runs-on (+18 more)

### Community 30 - "db"
Cohesion: 0.22
Nodes (28): countEntriesMentioning(), currentTimeKst(), executeTool(), ftsSearch(), getDaySummary(), getEntriesByDate(), getInsights(), getMonthSummary() (+20 more)

### Community 31 - "decisionWiki.ts"
Cohesion: 0.20
Nodes (25): allConversationNotesRows(), allConversationFileNames(), allDecisionFileNames(), buildEntityStubFiles(), entityStubFileName(), sanitizeEntityName(), affectedDayFileNames(), affectedEntityStubFileNames() (+17 more)

### Community 32 - "reflectionWiki.ts"
Cohesion: 0.20
Nodes (18): DELETE(), dynamic, GET(), LOCKED(), POST(), runtime, escapeHtml(), GET() (+10 more)

### Community 33 - "isAuthenticated"
Cohesion: 0.14
Nodes (23): AxisLabels, EmbeddingMap(), EntityRankings(), Heatmap(), HeatmapBucket, Map3D, MapPoint, MindData (+15 more)

### Community 34 - "getCurrentProfile"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.47, @types/better-sqlite3@^7.6.11, @types/d3-force@^3.0.10, @types/node@^22.7.4, @types/react@^19.2.18, @types/react-dom@^19.2.4 (+12 more)

### Community 35 - "DiaryGraphClient.tsx"
Cohesion: 0.18
Nodes (19): captureExample(), examplesAvailable(), anchorPhrase(), clean(), contextSnippet(), insideLatinWord(), MAX_FLAGS_PER_CALL, parseBox() (+11 more)

### Community 36 - "auth.ts"
Cohesion: 0.06
Nodes (72): dynamic, GET(), POST(), relyingParty(), runtime, dynamic, GET(), POST() (+64 more)

### Community 38 - "devDependencies"
Cohesion: 0.17
Nodes (20): REFLECTIONS_NOTEBOOK_ID, ensureReflectionPage(), ensureReflectionsNotebook(), KINDS, ReflectionEntityInput, tagReflectionEntities(), dateKey(), getReflectionByKey() (+12 more)

### Community 39 - "vitest"
Cohesion: 0.14
Nodes (24): ConversationEntityInput, ensureConversationPage(), ensureConversationsNotebook(), getCombinedEntityWiki(), getConversationNotes(), KINDS, MAX_ENTITY_NOTES_CHARS, resolveConversationEntityName() (+16 more)

### Community 40 - "entityWiki.ts"
Cohesion: 0.40
Nodes (11): AutoLock(), cancelPending(), lockNow(), markHiddenIfNeeded(), onPageHide(), onVisibility(), clearHiddenSince(), readHiddenSince() (+3 more)

### Community 41 - "ForceGraph"
Cohesion: 0.18
Nodes (19): DecisionEntityInput, ensureDecisionPage(), ensureDecisionsNotebook(), KINDS, tagDecisionEntities(), dateKey(), DECISION_FOLDER, decisionNoteFileName() (+11 more)

### Community 42 - "usage.ts"
Cohesion: 0.24
Nodes (12): dynamic, GET(), runtime, dailyUsage(), FALLBACK, monthlyUsage(), Prices, PRICES (+4 more)

### Community 43 - "insights/route.ts"
Cohesion: 0.23
Nodes (11): dynamic, LOCKED(), POST(), runtime, BackfillMessage, CHUNK_TARGET_CHARS, chunkedBackfillForConversation(), chunkMessageIds() (+3 more)

### Community 44 - "analyzePending"
Cohesion: 0.21
Nodes (10): dynamic, POST(), runtime, dynamic, POST(), runtime, ANALYZE_DEFAULT_LIMIT, ANALYZE_MAX_LIMIT (+2 more)

### Community 45 - "entityMerge.ts"
Cohesion: 0.14
Nodes (17): DiaryGraphClient(), EDGE_COLORS, EDGE_LABELS, EDGE_TYPES, formatGeneratedAt(), Inspector(), Metric(), metricLabel() (+9 more)

### Community 46 - "notebooks/pin/route.ts"
Cohesion: 0.13
Nodes (18): getConversationByKey(), EntityPredicate, isEntityPredicate(), PREDICATE_LABELS, PREDICATES, CleanRelationshipInput, cleanRelationships(), EntityKind (+10 more)

### Community 47 - "embeddings.ts"
Cohesion: 0.20
Nodes (19): dynamic, GET(), maxDuration, POST(), runtime, reembedMissingMemories(), callVoyage(), embed() (+11 more)

### Community 48 - "entityTagging.ts"
Cohesion: 0.24
Nodes (16): dynamic, GET(), LOCKED(), POST(), runtime, Cand, estimateRetranscribe(), FILES_DIR (+8 more)

### Community 49 - "db.ts"
Cohesion: 0.15
Nodes (17): ForceEdgeInput, ForceGraph(), draw(), fit(), hit(), loop(), onDown(), onMove() (+9 more)

### Community 50 - "mcpOauth.ts"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 51 - "next"
Cohesion: 0.12
Nodes (14): dynamic, GET(), runtime, listCoachSessions(), RFC-8414, RFC-9728, nextConfig, next (+6 more)

### Community 52 - "graphify_gate.py"
Cohesion: 0.32
Nodes (7): dynamic, GET(), OPTIONS(), runtime, RFC-8414, authorizationServerMetadata(), publicOrigin()

### Community 53 - "pendingShares.ts"
Cohesion: 0.18
Nodes (14): EntityWikiExcerpt, candidates(), entityWikiAutoEnabled(), evenSample(), excerptHash(), excerptsLen(), Kind, KINDS (+6 more)

### Community 54 - "entityMerge.ts"
Cohesion: 0.18
Nodes (17): dynamic, Kind, KINDS, maxDuration, POST(), postMergeDropbox(), runtime, dedupeAllEntities() (+9 more)

### Community 55 - "layout.tsx"
Cohesion: 0.11
Nodes (17): clearSans, dynamic, metadata, RootLayout(), viewport, LockAllButton(), LockOffBanner(), LINKS (+9 more)

### Community 56 - "vaultGraph.ts"
Cohesion: 0.11
Nodes (24): DELETE(), dynamic, GET(), runtime, AuthCode, authCodes, ClientMetadataResult, ClientRegistrationMetadata (+16 more)

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
Cohesion: 0.12
Nodes (30): dynamic, GET(), runtime, DELETE(), dynamic, GET(), LOCKED(), POST() (+22 more)

### Community 61 - "manifest.json"
Cohesion: 0.19
Nodes (12): dynamic, GET(), runtime, DiaryGraphEdge, DiaryGraphNode, DiaryGraphPayload, VaultNoteKind, readDropboxTextFiles() (+4 more)

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
Cohesion: 0.14
Nodes (15): dynamic, LOCKED(), maxDuration, POST(), runtime, carryForwardDates(), DiaryPageRow, EntityStub (+7 more)

### Community 67 - "package.json"
Cohesion: 0.12
Nodes (15): @anthropic-ai/sdk@^0.96.0, leaflet@^1.9.4, @modelcontextprotocol/sdk@^1.26.0, @types/leaflet@^1.9.12, zod@^4.4.3, engines, node, name (+7 more)

### Community 68 - "format.ts"
Cohesion: 0.12
Nodes (25): Insight, InsightsPage(), copy(), download(), exportText(), generate(), load(), summarize() (+17 more)

### Community 69 - "getAccessToken"
Cohesion: 0.40
Nodes (9): deleteFile(), downloadFile(), dropboxApiArg(), DropboxApiError, getAccessToken(), listFolder(), listTextFilesRecursive(), parseErrorSummary() (+1 more)

### Community 70 - "map/route.ts"
Cohesion: 0.32
Nodes (7): dynamic, GET(), runtime, TZ_OFFSET_MIN, clampMapDays(), MAP_UNLOCK_COOKIE, verifyUnlockToken

### Community 71 - "token/route.ts"
Cohesion: 0.15
Nodes (8): CeMod, CwMod, DbMod, DiaryGraphPayload, GraphMod, MindMod, NotesMod, RelMod

### Community 72 - "mind/route.ts"
Cohesion: 0.22
Nodes (7): codeFrom(), consent(), exchange(), issueAccessToken(), Mod, pkce(), register()

### Community 73 - "createPinGate"
Cohesion: 0.23
Nodes (12): dynamic, GET(), LOCKED(), runtime, effectiveDateKeys(), buildCandidate(), buildCloudCoverage(), classifyDuplicate() (+4 more)

### Community 74 - "dropboxExportLock.test.ts"
Cohesion: 0.18
Nodes (18): dynamic, fmtDate(), fmtDateTime(), fmtTime(), GET(), LOCKED(), maxDuration, runtime (+10 more)

### Community 75 - "webauthn.ts"
Cohesion: 0.18
Nodes (15): dynamic, GET(), LOCKED(), POST(), runtime, dynamic, GET(), LOCKED() (+7 more)

### Community 76 - "ocr-review/route.ts"
Cohesion: 0.31
Nodes (8): dynamic, GET(), LOCKED(), POST(), runtime, ProofreadingStats, proofreadingStats(), ResolveAction

### Community 77 - "notes.ts"
Cohesion: 0.13
Nodes (30): reparseIfNeeded(), register(), cleanupOrphanChatAttachments(), maybeCleanupOrphanAttachments(), getSetting(), setSetting(), buildChatContext(), claimNextQueuedNotebook() (+22 more)

### Community 78 - "createPinGate"
Cohesion: 0.33
Nodes (11): createPinGate(), attemptsLeft(), configured(), cookieKey(), lockRemainingMs(), makeUnlockToken(), pinMatches(), readFail() (+3 more)

### Community 79 - "relatedEntities.test.ts"
Cohesion: 0.33
Nodes (3): ClaudeMod, CmMod, DbMod

### Community 80 - "chatDiary.ts"
Cohesion: 0.20
Nodes (7): ConversationWikiMod, DbMod, deferred(), DiaryExportDbMod, DropboxMod, mockDropboxFetch(), UploadCall

### Community 81 - "models/route.ts"
Cohesion: 0.33
Nodes (8): dynamic, GET(), LOCKED(), POST(), resolve(), runtime, Slot, SLOTS

### Community 82 - "dropbox/export/route.ts"
Cohesion: 0.18
Nodes (15): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, GET(), runtime (+7 more)

### Community 84 - "topEntities.test.ts"
Cohesion: 0.20
Nodes (5): ChatToolsMod, DbMod, MergeMod, NotesMod, Result

### Community 85 - "owntracks/route.ts"
Cohesion: 0.33
Nodes (10): dynamic, GET(), isPlausiblePoint(), POST(), runtime, addPoint(), checkOwntracksToken(), owntracksConfigured() (+2 more)

### Community 86 - "mapPin.ts"
Cohesion: 0.28
Nodes (9): gate, MAP_UNLOCK_TTL_MS, afterFailure(), FailState, lockDurationMs(), MAX_ATTEMPTS, PinGateConfig, UNLOCK_TTL_MS (+1 more)

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
Cohesion: 0.22
Nodes (12): auditRequest(), dynamic, guarded(), handler, maxDuration, runtime, RFC-9728, checkMcpAuth() (+4 more)

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
Cohesion: 0.18
Nodes (17): dynamic, GET(), OPTIONS(), runtime, RFC-9728, dynamic, err(), OPTIONS() (+9 more)

### Community 104 - "ocrReviewDb.test.ts"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), maxDuration, runtime, renderDiaryMarkdown()

### Community 105 - "insightSources.ts"
Cohesion: 0.33
Nodes (8): readDropboxTextFolders(), blocksFor(), buildInsightExtraContext(), buildSavedSessionsContext(), DEFAULT_INSIGHT_DROPBOX_FOLDERS, insightDropboxFolders(), InsightExtraContext, SavedRow

### Community 106 - "chatMemoryRecall.test.ts"
Cohesion: 0.33
Nodes (3): CmMod, DbMod, EmbMod

### Community 108 - "ref_os"
Cohesion: 0.11
Nodes (7): DbMod, WikiMod, DbMod, Mod, DbMod, DropboxMod, NotesMod

### Community 109 - "librarian/route.ts"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), runtime, LibrarianStatus, librarianStatus()

### Community 110 - "embeddingMapDiscipline.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, DedupMod, NotesMod

### Community 111 - "entityWikiExclude.test.ts"
Cohesion: 0.33
Nodes (3): Db, Review, Store

### Community 112 - "ocrDiff.ts"
Cohesion: 0.53
Nodes (4): strip(), tokens(), WordChange, wordChanges()

### Community 113 - "chatDiary.test.ts"
Cohesion: 0.40
Nodes (4): CdMod, DbMod, MindMod, NotesMod

### Community 116 - "mind.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, MindMod, NotesMod

### Community 117 - "tailwindcss"
Cohesion: 0.40
Nodes (4): CeMod, DbMod, ReMod, RwMod

### Community 118 - "ref_path"
Cohesion: 0.11
Nodes (9): DbMod, DeMod, DwMod, DbMod, DropboxMod, NotesMod, AuthMod, DbMod (+1 more)

### Community 120 - "extractText.ts"
Cohesion: 0.36
Nodes (7): ExtractResult, extractTextFromAttachment(), Mammoth, mammoth(), PdfParse, pdfParse(), shouldFallback()

### Community 121 - "owntracksCurrent.test.ts"
Cohesion: 0.50
Nodes (3): tailwindcss@^3.4.13, tailwindcss, config

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

### Community 132 - "isAuthenticated"
Cohesion: 0.08
Nodes (26): ATTACHMENT_DIR, dynamic, GET(), runtime, DELETE(), dynamic, LOCKED(), runtime (+18 more)

### Community 133 - "db.ts"
Cohesion: 0.07
Nodes (22): ATTACHMENT_DIR, better-sqlite3, AuthMod, DbMod, AuthMod, DbMod, BackupMod, DbMod (+14 more)

### Community 135 - "chatMemoryDedup.test.ts"
Cohesion: 0.40
Nodes (3): CmMod, DbMod, EmbMod

### Community 137 - "dropbox/disconnect/route.ts"
Cohesion: 0.24
Nodes (8): dynamic, POST(), runtime, classifyDropboxError(), disconnectDropbox(), isPollLevelError(), revokeAccessTokenAtDropbox(), safeDropboxError()

### Community 138 - "vitest"
Cohesion: 0.10
Nodes (13): vitest, findRouteFiles(), PUBLIC, CeMod, CwMod, DbMod, DbMod, DropboxMod (+5 more)

## Knowledge Gaps
- **6 isolated node(s):** `RFC-8414`, `RFC-9728`, `RFC-8414`, `RFC-9728`, `RFC-7591` (+1 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 903 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db()` connect `db` to `dropbox.ts`, `diaryExportDb.ts`, `api/diary/route.ts`, `remarkableCloud.ts`, `isAuthenticated`, `mcp.ts`, `db.ts`, `backup.ts`, `app/page.tsx`, `owntracks.ts`, `notes.ts`, `ocrLearning.ts`, `claude.ts`, `ocrNotebookPdfWithFlags`, `insights/route.ts`, `db`, `chatDiary.ts`, `remarkableSync.ts`, `ocrBackfill.ts`, `mind.ts`, `discipline/route.ts`, `remarkableImport.ts`, `decisionWiki.ts`, `reflectionWiki.ts`, `DiaryGraphClient.tsx`, `auth.ts`, `devDependencies`, `vitest`, `ForceGraph`, `usage.ts`, `insights/route.ts`, `analyzePending`, `notebooks/pin/route.ts`, `embeddings.ts`, `entityTagging.ts`, `next`, `pendingShares.ts`, `entityMerge.ts`, `vaultGraph.ts`, `usage.ts`, `Map3D.tsx`, `usage/page.tsx`, `location.ts`, `next`, `mcp/route.ts`, `createPinGate`, `dropboxExportLock.test.ts`, `webauthn.ts`, `ocr-review/route.ts`, `notes.ts`, `dropbox/export/route.ts`, `owntracks/route.ts`, `mcp/route.ts`, `mind.test.ts`, `token/route.ts`, `insightSources.ts`, `memories/route.ts`?**
  _High betweenness centrality (0.194) - this node is a cross-community bridge._
- **What connects `RFC-8414`, `RFC-9728`, `RFC-8414` to the rest of the system?**
  _6 weakly-connected nodes found - possible missing edges._
- **Should `dropbox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14153846153846153 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `diaryExportDb.ts`, `api/diary/route.ts`, `isAuthenticated`, `ocrLearning.ts`, `backup.ts`, `app/page.tsx`, `dropbox/disconnect/route.ts`, `notes.ts`, `MemoryPage`, `insights/route.ts`, `db`, `quality`, `chatDiary.ts`, `remarkableSync.ts`, `discipline/settings/route.ts`, `ocrBackfill.ts`, `mind.ts`, `discipline/route.ts`, `remarkableImport.ts`, `clearSetting`, `reflectionWiki.ts`, `isAuthenticated`, `auth.ts`, `usage.ts`, `insights/route.ts`, `analyzePending`, `embeddings.ts`, `entityTagging.ts`, `graphify_gate.py`, `entityMerge.ts`, `layout.tsx`, `vaultGraph.ts`, `usage/page.tsx`, `manifest.json`, `location.ts`, `next`, `mcp/route.ts`, `package.json`, `map/route.ts`, `createPinGate`, `dropboxExportLock.test.ts`, `webauthn.ts`, `ocr-review/route.ts`, `models/route.ts`, `dropbox/export/route.ts`, `owntracks/route.ts`, `librarian/route.ts`, `mcp/route.ts`, `token/route.ts`, `ocrReviewDb.test.ts`, `ref_os`, `librarian/route.ts`, `memories/route.ts`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Should `diaryExportDb.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08309178743961353 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `vitest` to `dropbox.ts`, `entityGraph.ts`, `diaryExportDb.ts`, `entityTagging.test.ts`, `ocrLearning.ts`, `db.ts`, `mcp.ts`, `backup.ts`, `chatMemoryDedup.test.ts`, `dropbox/disconnect/route.ts`, `notes.ts`, `owntracks.ts`, `dropboxStatus.test.ts`, `remarkableTombstone.test.ts`, `ocrNotebookPdfWithFlags`, `quality`, `map/pin/route.ts`, `remarkableSync.ts`, `mind.ts`, `clearSetting`, `getCurrentProfile`, `DiaryGraphClient.tsx`, `auth.ts`, `correctPageText.test.ts`, `insights/route.ts`, `next`, `manifest.json`, `mcp/route.ts`, `package.json`, `getAccessToken`, `token/route.ts`, `mind/route.ts`, `createPinGate`, `webauthn.ts`, `notes.ts`, `relatedEntities.test.ts`, `chatDiary.ts`, `authRoute.test.ts`, `topEntities.test.ts`, `mapPin.ts`, `librarian/route.ts`, `entityGraph.ts`, `scripts`, `chatToolsLocation.test.ts`, `entityMerge.test.ts`, `ocrLearningDb.test.ts`, `chatMemoryExtract.test.ts`, `chatMemoryRecall.test.ts`, `chatMemoryRolling.test.ts`, `entityTagging.test.ts`, `mind.test.ts`, `chatMemoryRecall.test.ts`, `chatMemoryRolling.test.ts`, `ref_os`, `embeddingMapDiscipline.test.ts`, `entityWikiExclude.test.ts`, `ocrDiff.ts`, `chatDiary.test.ts`, `chunkedBackfill.test.ts`, `writingCoach.test.ts`, `mind.test.ts`, `tailwindcss`, `ref_path`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Should `remarkableCloud.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.046992481203007516 - nodes in this community are weakly interconnected._