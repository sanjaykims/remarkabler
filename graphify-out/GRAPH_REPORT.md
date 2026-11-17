# Graph Report - remarkabler  (2026-11-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2301 nodes · 6086 edges · 144 communities (133 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `159df4de`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- dropbox.ts
- diaryExportDb.ts
- remarkableCloud.ts
- owntracks.ts
- ocrLearning.ts
- mcp.ts
- diaryGraph.ts
- backup.ts
- app/page.tsx
- chat/route.ts
- notes.ts
- MemoryPage
- claude.ts
- remarkableSync.ts
- ref_fs
- auth.ts
- chatMemory.ts
- db
- quality
- map/pin/route.ts
- memory/page.tsx
- env
- setSetting
- layout.tsx
- mind.ts
- discipline/route.ts
- notebooks/route.ts
- notebooks/page.tsx
- mind/page.tsx
- embeddings.ts
- dependencies
- decisionWiki.ts
- reflectionWiki.ts
- isAuthenticated
- getCurrentProfile
- DiaryGraphClient.tsx
- ref_path
- entityRelationships.ts
- devDependencies
- vitest
- entityWiki.ts
- ForceGraph
- compilerOptions
- insights/route.ts
- corsHeaders
- entityMerge.ts
- notebooks/pin/route.ts
- notebooksPinDenied
- entityTagging.ts
- db.ts
- mcpOauth.ts
- backfill-all/route.ts
- graphify_gate.py
- pendingShares.ts
- package.json
- maybeCompressChatSessions
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
- AutoLock
- diaryGraph.test.ts
- mcpOauth.test.ts
- notebooks/[id]/pdf/route.ts
- token/route.ts
- mind/route.ts
- createPinGate
- dropboxExportLock.test.ts
- webauthn.ts
- api/export/route.ts
- grants/route.ts
- interruptedNotebookRecovery.test.ts
- relatedEntities.test.ts
- chatDiary.ts
- deploy
- decrypt-backup.mjs
- authRoute.test.ts
- topEntities.test.ts
- diaryExportDb.test.ts
- entityWriteAtomicity.test.ts
- pagesForEntity.test.ts
- memories/route.ts
- librarian/route.ts
- entityGraph.ts
- scripts
- chatToolsLocation.test.ts
- entityMerge.test.ts
- entityRelationships.test.ts
- getTopEntities.test.ts
- mcp.test.ts
- api/diary/route.ts
- chatMemoryExtract.test.ts
- chatMemoryRecall.test.ts
- chatMemoryRolling.test.ts
- entityTagging.test.ts
- mind.test.ts
- notebookDedupDb.test.ts
- ocrReviewDb.test.ts
- relationshipExportReconcile.test.ts
- duplicates/route.ts
- eslint
- correctPageText.test.ts
- dropboxTombstone.test.ts
- embeddingMapDiscipline.test.ts
- entityWikiExclude.test.ts
- ocrLearningDb.test.ts
- reflectionEntities.test.ts
- remarkableTombstone.test.ts
- mapPin.test.ts
- next.config.mjs
- tailwindcss
- chatMemoryFlow.test.ts
- conversationEntities.test.ts
- dropboxStatus.test.ts
- owntracksCurrent.test.ts
- session-start.sh
- entrypoint.sh
- rm2pdf
- postcss.config.mjs
- ocrReviewDb.test.ts
- relationshipExportReconcile.test.ts
- eslint
- chatDiary.test.ts
- chatMemoryDedup.test.ts
- cleanupAttachments.test.ts
- entityWikiExclude.test.ts
- ocrLearningDb.test.ts
- reflectionEntities.test.ts
- remarkableTombstone.test.ts
- webauthnChallengeSeparation.test.ts
- next.config.mjs
- tailwindcss
- chatMemoryFlow.test.ts
- session-start.sh
- entrypoint.sh
- postcss.config.mjs

## God Nodes (most connected - your core abstractions)
1. `db()` - 309 edges
2. `isAuthenticated()` - 140 edges
3. `vitest` - 90 edges
4. `next` - 82 edges
5. `getSetting()` - 73 edges
6. `setSetting()` - 66 edges
7. `MemoryPage()` - 42 edges
8. `runMaintenanceSweep()` - 34 edges
9. `callMcpTool()` - 30 edges
10. `clearSetting()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/authorization-server/route.ts → lib/mcpOauth.ts
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/protected-resource/route.ts → lib/mcpOauth.ts
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/register/route.ts → lib/mcpOauth.ts
- `GET()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/dropbox/connect/route.ts → lib/auth.ts
- `POST()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/dropbox/disconnect/route.ts → lib/auth.ts

## Import Cycles
- 2-file cycle: `lib/entityMerge.ts -> lib/mind.ts -> lib/entityMerge.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/claude.ts -> lib/chatTools.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/dropbox.ts -> lib/reflectionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/conversationWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/conversationWiki.ts`
- 4-file cycle: `lib/decisionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/decisionWiki.ts`
- 4-file cycle: `lib/diaryExportDb.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/entityMerge.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/mind.ts -> lib/claude.ts -> lib/chatTools.ts`
- 5-file cycle: `lib/conversationEntities.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts -> lib/conversationEntities.ts`
- 5-file cycle: `lib/diaryExportDb.ts -> lib/reflectionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts`
- 5-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/entityMerge.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 5-file cycle: `lib/conversationWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts -> lib/conversationWiki.ts`
- 5-file cycle: `lib/decisionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts -> lib/decisionWiki.ts`

## Communities (144 total, 11 thin omitted)

### Community 0 - "dropbox.ts"
Cohesion: 0.07
Nodes (57): dynamic, GET(), runtime, dynamic, POST(), runtime, dynamic, LOCKED() (+49 more)

### Community 1 - "diaryExportDb.ts"
Cohesion: 0.06
Nodes (50): dynamic, POST(), runtime, dynamic, POST(), runtime, dynamic, POST() (+42 more)

### Community 2 - "remarkableCloud.ts"
Cohesion: 0.05
Nodes (54): MAX_DIARY_ENTRY_CHARS, CHAT_TOOLS, recordLibrarianHeartbeat(), AUDIT_KEEP_ROWS, authFailures, callMcpTool(), COMPANION_GUIDANCE, configuredTokens() (+46 more)

### Community 3 - "owntracks.ts"
Cohesion: 0.08
Nodes (49): analyzeEntryContent(), AxisLabelResult, CHAT_MEMORY_EXTRACTION_GUIDANCE, chatOverNotes(), cleanEntityWiki(), client(), compareTranscriptions(), composeBook() (+41 more)

### Community 4 - "ocrLearning.ts"
Cohesion: 0.07
Nodes (39): dependencies, @anthropic-ai/sdk@^0.96.0, better-sqlite3@^11.3.0, d3-force@^3.0.1, jszip@^3.10.1, leaflet@^1.9.4, mammoth@^1.12.0, mcp-handler@^1.1.0 (+31 more)

### Community 5 - "mcp.ts"
Cohesion: 0.12
Nodes (34): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backupConfigured(), BackupStatus (+26 more)

### Community 6 - "diaryGraph.ts"
Cohesion: 0.15
Nodes (37): ensureChatDiaryNotebook(), nextPageIndex(), saveChatDiaryEntry(), countEntriesMentioning(), currentTimeKst(), executeTool(), ftsSearch(), getDaySummary() (+29 more)

### Community 7 - "backup.ts"
Cohesion: 0.09
Nodes (36): addEdge(), addEvidence(), buildDiaryGraph(), canonicalKey(), contentId(), ContentInfo, ContentKind, ContentStats (+28 more)

### Community 8 - "app/page.tsx"
Cohesion: 0.08
Nodes (20): MemoryPage(), disconnectDropbox(), getPosition(), load(), loadBackup(), loadDisc(), loadDropbox(), loadEmbed() (+12 more)

### Community 9 - "chat/route.ts"
Cohesion: 0.08
Nodes (22): setPickingFile(), Card, OcrReview(), Stats, Estimate, OldDiaryProofread(), DuplicateCandidate, Gate (+14 more)

### Community 10 - "notes.ts"
Cohesion: 0.12
Nodes (30): buildDayFiles(), buildDiaryMarkdown(), buildEntityStubFiles(), buildHomeNote(), collectEntities(), countLine(), effectiveDateKeys(), EnrichedRow (+22 more)

### Community 11 - "MemoryPage"
Cohesion: 0.12
Nodes (28): POST(), register(), encodeEmbedding(), recentLocationsContext(), backfillEmbeddingsLoop(), claimNextQueuedNotebook(), drainNotebookProcessingQueue(), ensureProfileSeed() (+20 more)

### Community 12 - "claude.ts"
Cohesion: 0.11
Nodes (20): LockAllButton(), LINKS, Nav(), dynamic, Home(), LatestInsight, preview(), RecentNotebook (+12 more)

### Community 13 - "remarkableSync.ts"
Cohesion: 0.11
Nodes (28): ConversationEntityInput, ensureConversationPage(), ensureConversationsNotebook(), getCombinedEntityWiki(), getConversationNotes(), KINDS, MAX_ENTITY_NOTES_CHARS, resolveConversationEntityName() (+20 more)

### Community 14 - "ref_fs"
Cohesion: 0.15
Nodes (26): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, CHAT_DIARY_NOTEBOOK_NAME, normaliseDate() (+18 more)

### Community 15 - "auth.ts"
Cohesion: 0.13
Nodes (25): backfillTitles(), dynamic, GET(), LOCKED(), maxDuration, PATCH(), POST(), runtime (+17 more)

### Community 16 - "chatMemory.ts"
Cohesion: 0.13
Nodes (26): DELETE(), dynamic, GET(), LOCKED(), POST(), runtime, cleanName(), createPendingShare() (+18 more)

### Community 17 - "db"
Cohesion: 0.07
Nodes (27): concurrency, cancel-in-progress, group, CI, NEXT_TELEMETRY_DISABLED, jobs, quality, name (+19 more)

### Community 18 - "quality"
Cohesion: 0.12
Nodes (21): ChatMemoryItem, ChatMemorySection(), backfillAll(), load(), processPending(), remove(), retryStuck(), ChatMemoryStatus (+13 more)

### Community 19 - "map/pin/route.ts"
Cohesion: 0.07
Nodes (26): COMMENT_BODY, COMMENT_URL, EVENT_NAME, GH_TOKEN, PR_NUMBER, REPO, if, runs-on (+18 more)

### Community 20 - "memory/page.tsx"
Cohesion: 0.10
Nodes (24): BatchRow, buildTranscript(), CATEGORY_ALIASES, ChatMemoryCategory, ChatMemoryRowForDedup, compressBatch(), CompressBatchResult, DuplicateCheck (+16 more)

### Community 21 - "env"
Cohesion: 0.18
Nodes (20): track(), clearSans, dynamic, metadata, RootLayout(), viewport, LockOffBanner(), friendly() (+12 more)

### Community 22 - "setSetting"
Cohesion: 0.12
Nodes (21): ATTACHMENT_DIR, dynamic, GET(), runtime, dynamic, GET(), runtime, GET() (+13 more)

### Community 23 - "layout.tsx"
Cohesion: 0.19
Nodes (25): allConversationNotesRows(), allConversationFileNames(), allDecisionFileNames(), buildEntityIndexNote(), buildProfileNote(), entityIndexFileName(), entityStubFileName(), sanitizeEntityName() (+17 more)

### Community 24 - "mind.ts"
Cohesion: 0.14
Nodes (23): AxisLabels, EmbeddingMap(), EntityRankings(), Heatmap(), HeatmapBucket, Map3D, MapPoint, MindData (+15 more)

### Community 25 - "discipline/route.ts"
Cohesion: 0.14
Nodes (23): DecisionEntityInput, ensureDecisionPage(), ensureDecisionsNotebook(), KINDS, tagDecisionEntities(), dateKey(), DECISION_FOLDER, decisionNoteFileName() (+15 more)

### Community 26 - "notebooks/route.ts"
Cohesion: 0.17
Nodes (21): dynamic, POST(), runtime, escapeHtml(), GET(), page(), POST(), runtime (+13 more)

### Community 27 - "notebooks/page.tsx"
Cohesion: 0.19
Nodes (19): MapStayDto, MapView(), RoutePointDto, Data, fmt(), Gate, MapPage(), MapView (+11 more)

### Community 28 - "mind/page.tsx"
Cohesion: 0.14
Nodes (22): ensureReflectionPage(), ensureReflectionsNotebook(), KINDS, ReflectionEntityInput, tagReflectionEntities(), dateKey(), getReflectionByKey(), markReflectionsFiled() (+14 more)

### Community 29 - "embeddings.ts"
Cohesion: 0.17
Nodes (21): affectedDayFileNames(), saveOcrFlags(), classifyReocr(), cursorValue(), diffRmPages(), foldPendingProfile(), IncrementalResult, incrementalSyncNotebook() (+13 more)

### Community 30 - "dependencies"
Cohesion: 0.12
Nodes (21): maybeRefreshHandwritingNotes(), applyFixes(), AUTOFIX_MIN, correctedPairs(), correctedPairsForNotes(), editDistance(), escapeRe(), formatHints() (+13 more)

### Community 31 - "decisionWiki.ts"
Cohesion: 0.17
Nodes (19): dynamic, GET(), POST(), relyingParty(), runtime, AUTH_CHALLENGE_COOKIE, challengeCookieOptions, consumeChallenge() (+11 more)

### Community 32 - "reflectionWiki.ts"
Cohesion: 0.18
Nodes (20): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backfillCandidates(), Candidate (+12 more)

### Community 33 - "isAuthenticated"
Cohesion: 0.18
Nodes (19): getRecentLocations(), cachedPlace(), cacheKey(), reverseGeocodePlace(), RoutePoint, analyzeGaps(), currentLocation(), durationLabel() (+11 more)

### Community 34 - "getCurrentProfile"
Cohesion: 0.13
Nodes (19): AuthCode, authCodes, ClientMetadataResult, ClientRegistrationMetadata, configuredSecrets(), consentSecretValid(), currentSecretHashes(), IssuedTokens (+11 more)

### Community 35 - "DiaryGraphClient.tsx"
Cohesion: 0.12
Nodes (19): ATTACHMENT_DIR, DELETE(), dynamic, EXT, ext(), EXT_TO_MIME, GET(), IMAGE_TYPES (+11 more)

### Community 36 - "ref_path"
Cohesion: 0.20
Nodes (19): dynamic, GET(), maxDuration, POST(), runtime, recallChatMemories(), reembedMissingMemories(), semanticSearch() (+11 more)

### Community 37 - "entityRelationships.ts"
Cohesion: 0.14
Nodes (18): dynamic, LOCKED(), POST(), runtime, dynamic, LOCKED(), maxDuration, POST() (+10 more)

### Community 38 - "devDependencies"
Cohesion: 0.15
Nodes (3): main(), marker_path(), main()

### Community 39 - "vitest"
Cohesion: 0.10
Nodes (13): recoverInterruptedNotebooks(), AuthMod, DbMod, BackupMod, DbMod, DbMod, DeMod, DwMod (+5 more)

### Community 40 - "entityWiki.ts"
Cohesion: 0.19
Nodes (19): clearSetting(), causeCodes(), DownloadedPage, downloadNotebook(), DownloadResult, filterNotebooks(), isTransientNetworkError(), listRemarkableNotebooks() (+11 more)

### Community 41 - "ForceGraph"
Cohesion: 0.18
Nodes (15): dynamic, GET(), LOCKED(), POST(), runtime, dynamic, GET(), LOCKED() (+7 more)

### Community 42 - "compilerOptions"
Cohesion: 0.15
Nodes (18): dynamic, maxDuration, POST(), runtime, EntityWikiExcerpt, candidates(), entityWikiAutoEnabled(), evenSample() (+10 more)

### Community 43 - "insights/route.ts"
Cohesion: 0.14
Nodes (17): DiaryGraphClient(), EDGE_COLORS, EDGE_LABELS, EDGE_TYPES, formatGeneratedAt(), Inspector(), Metric(), metricLabel() (+9 more)

### Community 44 - "corsHeaders"
Cohesion: 0.18
Nodes (19): authFailKey(), AuthFailState, bumpBucket(), createSessionToken(), getAuthFailState(), getRawAuthFailState(), passcodeLockRemainingMs(), pruneExpiredAuthFailBuckets() (+11 more)

### Community 45 - "entityMerge.ts"
Cohesion: 0.13
Nodes (18): EntityPredicate, isEntityPredicate(), PREDICATE_LABELS, PREDICATES, CleanRelationshipInput, cleanRelationships(), EntityKind, getRelationshipsFor() (+10 more)

### Community 46 - "notebooks/pin/route.ts"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.47, @types/better-sqlite3@^7.6.11, @types/d3-force@^3.0.10, @types/node@^22.7.4, @types/react@^19.2.18, @types/react-dom@^19.2.4 (+12 more)

### Community 47 - "notebooksPinDenied"
Cohesion: 0.10
Nodes (7): BackfillHelpers, DbMod, DbMod, DropboxMod, DbMod, OwntracksMod, queued

### Community 48 - "entityTagging.ts"
Cohesion: 0.15
Nodes (17): ForceEdgeInput, ForceGraph(), draw(), fit(), hit(), loop(), onDown(), onMove() (+9 more)

### Community 49 - "db.ts"
Cohesion: 0.11
Nodes (9): DbMod, NotesMod, DbMod, EmbMod, MindMod, NotesMod, WikiMod, DbMod (+1 more)

### Community 50 - "mcpOauth.ts"
Cohesion: 0.11
Nodes (11): vitest, AuthMod, DbMod, ChatToolsMod, DbMod, LocationMod, OwntracksMod, DbMod (+3 more)

### Community 51 - "backfill-all/route.ts"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 52 - "graphify_gate.py"
Cohesion: 0.25
Nodes (17): wikiLinkingEnabled(), getConversationByKey(), listUnlinkedConversations(), listUnlinkedDecisions(), autoTagConversation(), autoTagDecision(), autoTagExportsEnabled(), autoTagReflection() (+9 more)

### Community 53 - "pendingShares.ts"
Cohesion: 0.11
Nodes (10): findRouteFiles(), PUBLIC, CeMod, CwMod, DbMod, DbMod, Mod, DbMod (+2 more)

### Community 54 - "package.json"
Cohesion: 0.19
Nodes (13): dynamic, LOCKED(), POST(), runtime, createRollingBatch(), maybeRollConversationMemory(), BackfillMessage, CHUNK_TARGET_CHARS (+5 more)

### Community 55 - "maybeCompressChatSessions"
Cohesion: 0.25
Nodes (15): dynamic, GET(), POST(), runtime, unlocked(), gate, makeNotebooksUnlockToken, NOTEBOOKS_UNLOCK_COOKIE (+7 more)

### Community 56 - "vaultGraph.ts"
Cohesion: 0.18
Nodes (11): gate, MAP_UNLOCK_TTL_MS, mapUnlockCookieOptions, afterFailure(), FailState, isValidPin(), lockDurationMs(), MAX_ATTEMPTS (+3 more)

### Community 57 - "authorize/route.ts"
Cohesion: 0.23
Nodes (14): dynamic, GET(), POST(), runtime, unlocked(), checkPasscode(), isLockEnabled(), attemptsLeft (+6 more)

### Community 58 - "usage.ts"
Cohesion: 0.19
Nodes (13): dynamic, LOCKED(), POST(), runtime, dynamic, LOCKED(), POST(), runtime (+5 more)

### Community 59 - "Map3D.tsx"
Cohesion: 0.20
Nodes (11): dynamic, GET(), runtime, DiaryGraphEdge, DiaryGraphNode, DiaryGraphPayload, VaultNoteKind, addVaultNotesToGraph() (+3 more)

### Community 60 - "usage/page.tsx"
Cohesion: 0.32
Nodes (14): consentForm(), destHost(), dynamic, esc(), GET(), OAuthParams, page(), POST() (+6 more)

### Community 61 - "manifest.json"
Cohesion: 0.22
Nodes (14): auditRequest(), dynamic, guarded(), handler, maxDuration, runtime, RFC-9728, checkMcpAuth() (+6 more)

### Community 62 - "location.ts"
Cohesion: 0.25
Nodes (11): dynamic, GET(), LOCKED(), runtime, buildCandidate(), buildCloudCoverage(), classifyDuplicate(), CloudCoverage (+3 more)

### Community 63 - "register/route.ts"
Cohesion: 0.18
Nodes (14): ActiveLabel(), Axes(), AxisEndLabel(), AxisLabels, Map3D(), MapPoint, Point(), sentimentColour() (+6 more)

### Community 64 - "analyzePending"
Cohesion: 0.19
Nodes (11): DayCost, DayData, FEATURE_LABEL, FeatureCost, money(), MonthData, pad(), UsagePage() (+3 more)

### Community 65 - "next"
Cohesion: 0.22
Nodes (12): ExistingRow, importRemarkableNotebookInner(), ImportResult, importsInFlight, ImportStatus, lockRemarkableImport(), unlockRemarkableImport(), execFileAsync (+4 more)

### Community 66 - "mcp/route.ts"
Cohesion: 0.13
Nodes (14): background_color, description, display, icons, name, files, share_target, action (+6 more)

### Community 67 - "AutoLock"
Cohesion: 0.24
Nodes (12): dynamic, GET(), LOCKED(), POST(), runtime, Cand, estimateRetranscribe(), FILES_DIR (+4 more)

### Community 68 - "diaryGraph.test.ts"
Cohesion: 0.22
Nodes (10): dynamic, LOCKED(), maxDuration, POST(), runtime, carryForwardDates(), DiaryPageRow, compareImportedNotebook() (+2 more)

### Community 69 - "mcpOauth.test.ts"
Cohesion: 0.24
Nodes (12): dynamic, GET(), runtime, dailyUsage(), FALLBACK, monthlyUsage(), Prices, PRICES (+4 more)

### Community 70 - "notebooks/[id]/pdf/route.ts"
Cohesion: 0.26
Nodes (12): anchorPhrase(), contextSnippet(), replaceAt(), recordLearned(), captureHandwriting(), FlagRow, learn(), listReviewCards() (+4 more)

### Community 71 - "token/route.ts"
Cohesion: 0.18
Nodes (11): DELETE(), dynamic, LOCKED(), runtime, next, DbMod, NotesMod, pdf (+3 more)

### Community 72 - "mind/route.ts"
Cohesion: 0.31
Nodes (11): dynamic, fmtDate(), fmtDateTime(), fmtTime(), GET(), LOCKED(), maxDuration, runtime (+3 more)

### Community 73 - "createPinGate"
Cohesion: 0.40
Nodes (11): AutoLock(), cancelPending(), lockNow(), markHiddenIfNeeded(), onPageHide(), onVisibility(), clearHiddenSince(), readHiddenSince() (+3 more)

### Community 74 - "dropboxExportLock.test.ts"
Cohesion: 0.18
Nodes (11): Block, CaptureArgs, captureExample(), Example, examplesAvailable(), execFileAsync, FILES_DIR, MAX_EXAMPLES_TOTAL (+3 more)

### Community 75 - "webauthn.ts"
Cohesion: 0.15
Nodes (8): CeMod, CwMod, DbMod, DiaryGraphPayload, GraphMod, MindMod, NotesMod, RelMod

### Community 76 - "api/export/route.ts"
Cohesion: 0.22
Nodes (7): codeFrom(), consent(), exchange(), issueAccessToken(), Mod, pkce(), register()

### Community 77 - "grants/route.ts"
Cohesion: 0.21
Nodes (11): dynamic, OPTIONS(), POST(), readBoundedJson(), runtime, RFC-7591, REGISTER_THROTTLE_BUCKET, MAX_DCR_BODY_BYTES (+3 more)

### Community 78 - "interruptedNotebookRecovery.test.ts"
Cohesion: 0.29
Nodes (11): dynamic, err(), OPTIONS(), POST(), readForm(), runtime, corsHeaders(), issueTokens() (+3 more)

### Community 79 - "relatedEntities.test.ts"
Cohesion: 0.33
Nodes (9): dynamic, GET(), hasNotes(), LOCKED(), maxDuration, POST(), runtime, getCurrentProfileRow() (+1 more)

### Community 80 - "chatDiary.ts"
Cohesion: 0.33
Nodes (10): dynamic, GET(), isPlausiblePoint(), POST(), runtime, addPoint(), checkOwntracksToken(), owntracksConfigured() (+2 more)

### Community 81 - "deploy"
Cohesion: 0.29
Nodes (9): Insight, InsightsPage(), copy(), download(), exportText(), generate(), load(), summarize() (+1 more)

### Community 82 - "decrypt-backup.mjs"
Cohesion: 0.33
Nodes (11): createPinGate(), attemptsLeft(), configured(), cookieKey(), lockRemainingMs(), makeUnlockToken(), pinMatches(), readFail() (+3 more)

### Community 83 - "authRoute.test.ts"
Cohesion: 0.20
Nodes (7): ConversationWikiMod, DbMod, deferred(), DiaryExportDbMod, DropboxMod, mockDropboxFetch(), UploadCall

### Community 84 - "topEntities.test.ts"
Cohesion: 0.31
Nodes (9): DELETE(), dynamic, GET(), runtime, requireAuth(), clientIp(), dropAuthCodesForClient(), listOAuthAudit() (+1 more)

### Community 85 - "diaryExportDb.test.ts"
Cohesion: 0.33
Nodes (6): clean(), MAX_FLAGS_PER_CALL, OcrFlag, parseBox(), parseFlagLines(), squash()

### Community 87 - "pagesForEntity.test.ts"
Cohesion: 0.20
Nodes (5): ChatToolsMod, DbMod, MergeMod, NotesMod, Result

### Community 88 - "memories/route.ts"
Cohesion: 0.28
Nodes (8): dynamic, Kind, KINDS, maxDuration, POST(), postMergeDropbox(), runtime, listAliases()

### Community 89 - "librarian/route.ts"
Cohesion: 0.33
Nodes (8): dynamic, LOCKED(), POST(), runtime, remarkableSyncStatus(), setSyncFolder(), syncFolderMap(), syncFolders()

### Community 90 - "entityGraph.ts"
Cohesion: 0.33
Nodes (8): dynamic, GET(), LOCKED(), POST(), resolve(), runtime, Slot, SLOTS

### Community 91 - "scripts"
Cohesion: 0.22
Nodes (8): build, builder, dockerfilePath, deploy, restartPolicyMaxRetries, restartPolicyType, startCommand, $schema

### Community 92 - "chatToolsLocation.test.ts"
Cohesion: 0.22
Nodes (6): body, enc, iv, MAGIC, salt, tag

### Community 93 - "entityMerge.test.ts"
Cohesion: 0.22
Nodes (5): AuthMod, DbMod, requestCookies, RouteMod, webauthn

### Community 94 - "entityRelationships.test.ts"
Cohesion: 0.22
Nodes (4): ChatToolsMod, DbMod, MindMod, NotesMod

### Community 95 - "getTopEntities.test.ts"
Cohesion: 0.32
Nodes (7): dynamic, GET(), LOCKED(), runtime, ProofreadingStats, proofreadingStats(), ResolveAction

### Community 96 - "mcp.test.ts"
Cohesion: 0.25
Nodes (3): DbMod, ExportMod, NotesMod

### Community 98 - "chatMemoryExtract.test.ts"
Cohesion: 0.25
Nodes (3): ChatToolsMod, DbMod, NotesMod

### Community 99 - "chatMemoryRecall.test.ts"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), MemoryRow, runtime, pendingBatchDetails()

### Community 100 - "chatMemoryRolling.test.ts"
Cohesion: 0.43
Nodes (6): dynamic, GET(), LOCKED(), POST(), runtime, setDisciplineEnabled()

### Community 101 - "entityTagging.test.ts"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), maxDuration, runtime, renderDiaryMarkdown()

### Community 102 - "mind.test.ts"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), runtime, LibrarianStatus, librarianStatus()

### Community 103 - "notebookDedupDb.test.ts"
Cohesion: 0.38
Nodes (6): dynamic, GET(), runtime, clampMapDays(), MAP_UNLOCK_COOKIE, mapData()

### Community 104 - "ocrReviewDb.test.ts"
Cohesion: 0.33
Nodes (6): dynamic, GET(), OPTIONS(), runtime, RFC-8414, authorizationServerMetadata()

### Community 105 - "relationshipExportReconcile.test.ts"
Cohesion: 0.33
Nodes (6): dynamic, GET(), OPTIONS(), runtime, RFC-9728, protectedResourceMetadata()

### Community 106 - "duplicates/route.ts"
Cohesion: 0.43
Nodes (6): dynamic, PATCH(), runtime, correctPageText(), learnFromEdit(), pageTextOf()

### Community 107 - "eslint"
Cohesion: 0.38
Nodes (6): dynamic, LOCKED(), maxDuration, POST(), runtime, importRemarkableNotebook()

### Community 108 - "correctPageText.test.ts"
Cohesion: 0.38
Nodes (6): Mode, PinGate(), onChange(), post(), submit(), NotebooksPage()

### Community 109 - "dropboxTombstone.test.ts"
Cohesion: 0.38
Nodes (4): computeRelatedEntities(), DayMembership, EntityKind, RelatedEntity

### Community 110 - "embeddingMapDiscipline.test.ts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, test:watch

### Community 112 - "ocrLearningDb.test.ts"
Cohesion: 0.29
Nodes (4): CwMod, DbMod, MergeMod, RelMod

### Community 113 - "reflectionEntities.test.ts"
Cohesion: 0.29
Nodes (3): DbMod, MindMod, NotesMod

### Community 114 - "remarkableTombstone.test.ts"
Cohesion: 0.29
Nodes (3): ChatToolsMod, McpMod, RouteMod

### Community 115 - "mapPin.test.ts"
Cohesion: 0.40
Nodes (5): dynamic, Entry, GET(), LOCKED(), runtime

### Community 116 - "next.config.mjs"
Cohesion: 0.47
Nodes (5): dynamic, GET(), runtime, exchangeCodeForTokens(), fetchAccountDisplayName()

### Community 117 - "tailwindcss"
Cohesion: 0.40
Nodes (5): dynamic, GET(), LOCKED(), maxDuration, runtime

### Community 118 - "chatMemoryFlow.test.ts"
Cohesion: 0.40
Nodes (5): dynamic, LOCKED(), maxDuration, POST(), runtime

### Community 119 - "conversationEntities.test.ts"
Cohesion: 0.53
Nodes (4): strip(), tokens(), WordChange, wordChanges()

### Community 120 - "dropboxStatus.test.ts"
Cohesion: 0.33
Nodes (3): ClaudeMod, CmMod, DbMod

### Community 121 - "owntracksCurrent.test.ts"
Cohesion: 0.33
Nodes (3): CmMod, DbMod, EmbMod

### Community 123 - "entrypoint.sh"
Cohesion: 0.33
Nodes (5): ClaudeMod, CwMod, DbMod, EtMod, RwMod

### Community 124 - "rm2pdf"
Cohesion: 0.33
Nodes (3): DbMod, MindMod, NotesMod

### Community 125 - "postcss.config.mjs"
Cohesion: 0.33
Nodes (3): DbMod, DedupMod, NotesMod

### Community 126 - "ocrReviewDb.test.ts"
Cohesion: 0.33
Nodes (3): Db, Review, Store

### Community 127 - "relationshipExportReconcile.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 128 - "eslint"
Cohesion: 0.40
Nodes (4): eslint@^9.39.5, eslint-config-next@^16.3.2, eslint, eslint-config-next

### Community 129 - "chatDiary.test.ts"
Cohesion: 0.40
Nodes (4): CdMod, DbMod, MindMod, NotesMod

### Community 130 - "chatMemoryDedup.test.ts"
Cohesion: 0.40
Nodes (3): CmMod, DbMod, EmbMod

### Community 132 - "entityWikiExclude.test.ts"
Cohesion: 0.40
Nodes (3): ClaudeMod, DbMod, EwMod

### Community 133 - "ocrLearningDb.test.ts"
Cohesion: 0.40
Nodes (4): Db, L, Review, Store

### Community 134 - "reflectionEntities.test.ts"
Cohesion: 0.40
Nodes (4): CeMod, DbMod, ReMod, RwMod

### Community 135 - "remarkableTombstone.test.ts"
Cohesion: 0.40
Nodes (3): DbMod, NotesMod, SyncMod

### Community 137 - "next.config.mjs"
Cohesion: 0.50
Nodes (3): RFC-8414, RFC-9728, nextConfig

### Community 138 - "tailwindcss"
Cohesion: 0.50
Nodes (3): tailwindcss@^3.4.13, tailwindcss, config

## Knowledge Gaps
- **6 isolated node(s):** `RFC-8414`, `RFC-9728`, `RFC-8414`, `RFC-9728`, `RFC-9728` (+1 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 872 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db()` connect `diaryGraph.ts` to `dropbox.ts`, `diaryExportDb.ts`, `remarkableCloud.ts`, `owntracks.ts`, `mcp.ts`, `backup.ts`, `webauthnChallengeSeparation.test.ts`, `MemoryPage`, `claude.ts`, `remarkableSync.ts`, `ref_fs`, `auth.ts`, `chatMemory.ts`, `memory/page.tsx`, `setSetting`, `layout.tsx`, `discipline/route.ts`, `notebooks/route.ts`, `mind/page.tsx`, `embeddings.ts`, `dependencies`, `decisionWiki.ts`, `reflectionWiki.ts`, `isAuthenticated`, `getCurrentProfile`, `DiaryGraphClient.tsx`, `ref_path`, `vitest`, `entityWiki.ts`, `ForceGraph`, `compilerOptions`, `corsHeaders`, `entityMerge.ts`, `graphify_gate.py`, `package.json`, `usage.ts`, `usage/page.tsx`, `manifest.json`, `location.ts`, `next`, `AutoLock`, `diaryGraph.test.ts`, `mcpOauth.test.ts`, `notebooks/[id]/pdf/route.ts`, `token/route.ts`, `mind/route.ts`, `dropboxExportLock.test.ts`, `grants/route.ts`, `interruptedNotebookRecovery.test.ts`, `relatedEntities.test.ts`, `chatDiary.ts`, `topEntities.test.ts`, `diaryExportDb.test.ts`, `memories/route.ts`, `getTopEntities.test.ts`, `chatMemoryRecall.test.ts`, `notebookDedupDb.test.ts`, `duplicates/route.ts`, `remarkableTombstone.test.ts`, `mapPin.test.ts`, `tailwindcss`?**
  _High betweenness centrality (0.238) - this node is a cross-community bridge._
- **What connects `RFC-8414`, `RFC-9728`, `RFC-8414` to the rest of the system?**
  _6 weakly-connected nodes found - possible missing edges._
- **Should `dropbox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07374890254609306 - nodes in this community are weakly interconnected._
- **Why does `next` connect `token/route.ts` to `dropbox.ts`, `diaryExportDb.ts`, `ocrLearning.ts`, `mcp.ts`, `claude.ts`, `ref_fs`, `auth.ts`, `chatMemory.ts`, `quality`, `env`, `setSetting`, `mind.ts`, `notebooks/route.ts`, `notebooks/page.tsx`, `decisionWiki.ts`, `reflectionWiki.ts`, `DiaryGraphClient.tsx`, `ref_path`, `entityRelationships.ts`, `ForceGraph`, `compilerOptions`, `corsHeaders`, `pendingShares.ts`, `package.json`, `maybeCompressChatSessions`, `authorize/route.ts`, `usage.ts`, `Map3D.tsx`, `usage/page.tsx`, `manifest.json`, `location.ts`, `AutoLock`, `diaryGraph.test.ts`, `mcpOauth.test.ts`, `mind/route.ts`, `grants/route.ts`, `interruptedNotebookRecovery.test.ts`, `relatedEntities.test.ts`, `chatDiary.ts`, `topEntities.test.ts`, `memories/route.ts`, `librarian/route.ts`, `entityGraph.ts`, `entityMerge.test.ts`, `getTopEntities.test.ts`, `chatMemoryRecall.test.ts`, `chatMemoryRolling.test.ts`, `entityTagging.test.ts`, `mind.test.ts`, `notebookDedupDb.test.ts`, `ocrReviewDb.test.ts`, `relationshipExportReconcile.test.ts`, `duplicates/route.ts`, `eslint`, `mapPin.test.ts`, `next.config.mjs`, `tailwindcss`, `chatMemoryFlow.test.ts`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Should `diaryExportDb.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.062146892655367235 - nodes in this community are weakly interconnected._
- **Why does `isAuthenticated()` connect `setSetting` to `dropbox.ts`, `diaryExportDb.ts`, `mcp.ts`, `diaryGraph.ts`, `MemoryPage`, `ref_fs`, `auth.ts`, `chatMemory.ts`, `env`, `notebooks/route.ts`, `decisionWiki.ts`, `reflectionWiki.ts`, `DiaryGraphClient.tsx`, `ref_path`, `entityRelationships.ts`, `ForceGraph`, `compilerOptions`, `insights/route.ts`, `corsHeaders`, `package.json`, `authorize/route.ts`, `usage.ts`, `Map3D.tsx`, `location.ts`, `AutoLock`, `diaryGraph.test.ts`, `mcpOauth.test.ts`, `token/route.ts`, `mind/route.ts`, `relatedEntities.test.ts`, `chatDiary.ts`, `topEntities.test.ts`, `memories/route.ts`, `librarian/route.ts`, `entityGraph.ts`, `getTopEntities.test.ts`, `chatMemoryRecall.test.ts`, `chatMemoryRolling.test.ts`, `entityTagging.test.ts`, `mind.test.ts`, `notebookDedupDb.test.ts`, `duplicates/route.ts`, `eslint`, `mapPin.test.ts`, `next.config.mjs`, `tailwindcss`, `chatMemoryFlow.test.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Should `remarkableCloud.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.046753246753246755 - nodes in this community are weakly interconnected._