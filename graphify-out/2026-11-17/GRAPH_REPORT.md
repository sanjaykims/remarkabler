# Graph Report - remarkabler  (2026-11-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2361 nodes · 6259 edges · 138 communities (127 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6c79ff12`
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
- entityWikiExclude.test.ts
- reflectionEntities.test.ts
- remarkableTombstone.test.ts
- mapPin.test.ts
- next.config.mjs
- tailwindcss
- chatMemoryFlow.test.ts
- owntracksCurrent.test.ts
- session-start.sh
- postcss.config.mjs

## God Nodes (most connected - your core abstractions)
1. `db()` - 315 edges
2. `isAuthenticated()` - 142 edges
3. `vitest` - 91 edges
4. `next` - 83 edges
5. `getSetting()` - 76 edges
6. `setSetting()` - 69 edges
7. `MemoryPage()` - 42 edges
8. `runMaintenanceSweep()` - 35 edges
9. `callMcpTool()` - 30 edges
10. `clearSetting()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/protected-resource/route.ts → lib/mcpOauth.ts
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/register/route.ts → lib/mcpOauth.ts
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/authorization-server/route.ts → lib/mcpOauth.ts
- `GET()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/location/route.ts → lib/auth.ts
- `POST()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/location/route.ts → lib/auth.ts

## Import Cycles
- 2-file cycle: `lib/entityMerge.ts -> lib/mind.ts -> lib/entityMerge.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/claude.ts -> lib/chatTools.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/dropbox.ts -> lib/reflectionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/diaryExportDb.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts`
- 4-file cycle: `lib/decisionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/decisionWiki.ts`
- 4-file cycle: `lib/conversationWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/conversationWiki.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/mind.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/entityMerge.ts -> lib/claude.ts -> lib/chatTools.ts`
- 5-file cycle: `lib/conversationEntities.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts -> lib/conversationEntities.ts`
- 5-file cycle: `lib/diaryExportDb.ts -> lib/reflectionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts`
- 5-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/entityMerge.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 5-file cycle: `lib/conversationWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts -> lib/conversationWiki.ts`
- 5-file cycle: `lib/decisionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts -> lib/decisionWiki.ts`

## Communities (138 total, 11 thin omitted)

### Community 0 - "dropbox.ts"
Cohesion: 0.06
Nodes (65): ATTACHMENT_DIR, DELETE(), dynamic, EXT, ext(), EXT_TO_MIME, GET(), IMAGE_TYPES (+57 more)

### Community 1 - "diaryExportDb.ts"
Cohesion: 0.07
Nodes (21): main(), marker_path(), main(), _align(), _analyze(), _band_extent(), _cw(), _est_pitch() (+13 more)

### Community 2 - "remarkableCloud.ts"
Cohesion: 0.07
Nodes (44): dynamic, POST(), runtime, dynamic, POST(), runtime, dynamic, POST() (+36 more)

### Community 3 - "owntracks.ts"
Cohesion: 0.05
Nodes (51): CHAT_TOOLS, AUDIT_KEEP_ROWS, authFailures, callMcpTool(), COMPANION_GUIDANCE, configuredTokens(), conversationExportEnabled(), DECISION_TOOL (+43 more)

### Community 4 - "ocrLearning.ts"
Cohesion: 0.09
Nodes (45): POST(), analyzeEntryContent(), AxisLabelResult, CHAT_MEMORY_EXTRACTION_GUIDANCE, chatOverNotes(), cleanEntityWiki(), client(), compareTranscriptions() (+37 more)

### Community 5 - "mcp.ts"
Cohesion: 0.10
Nodes (42): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, GET(), runtime (+34 more)

### Community 6 - "diaryGraph.ts"
Cohesion: 0.07
Nodes (31): LockAllButton(), LINKS, Nav(), dynamic, Home(), LatestInsight, preview(), RecentNotebook (+23 more)

### Community 7 - "backup.ts"
Cohesion: 0.12
Nodes (34): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backupConfigured(), BackupStatus (+26 more)

### Community 8 - "app/page.tsx"
Cohesion: 0.07
Nodes (20): vitest, findRouteFiles(), PUBLIC, DbMod, Mod, DbMod, NotesMod, DbMod (+12 more)

### Community 9 - "chat/route.ts"
Cohesion: 0.09
Nodes (29): Insight, InsightsPage(), copy(), download(), exportText(), generate(), load(), summarize() (+21 more)

### Community 10 - "notes.ts"
Cohesion: 0.07
Nodes (22): setPickingFile(), Card, OcrReview(), Stats, Estimate, OldDiaryProofread(), DuplicateCandidate, Gate (+14 more)

### Community 11 - "MemoryPage"
Cohesion: 0.07
Nodes (21): formatBytes(), MemoryPage(), disconnectDropbox(), getPosition(), load(), loadBackup(), loadDisc(), loadDropbox() (+13 more)

### Community 12 - "claude.ts"
Cohesion: 0.09
Nodes (36): addEdge(), addEvidence(), buildDiaryGraph(), canonicalKey(), contentId(), ContentInfo, ContentKind, ContentStats (+28 more)

### Community 13 - "remarkableSync.ts"
Cohesion: 0.10
Nodes (32): dynamic, PATCH(), runtime, maybeRefreshHandwritingNotes(), correctPageText(), applyFixes(), AUTOFIX_MIN, autoFixablePairs() (+24 more)

### Community 14 - "ref_fs"
Cohesion: 0.16
Nodes (31): countEntriesMentioning(), currentTimeKst(), executeTool(), ftsSearch(), getDaySummary(), getEntriesByDate(), getInsights(), getMonthSummary() (+23 more)

### Community 15 - "auth.ts"
Cohesion: 0.11
Nodes (31): buildDayFiles(), buildDiaryMarkdown(), buildEntityStubFiles(), buildHomeNote(), collectEntities(), countLine(), effectiveDateKeys(), EnrichedRow (+23 more)

### Community 16 - "chatMemory.ts"
Cohesion: 0.11
Nodes (29): dynamic, POST(), runtime, register(), cleanupOrphanChatAttachments(), maybeCleanupOrphanAttachments(), backfillEmbeddingsLoop(), CHAT_DIARY_NOTEBOOK_ID (+21 more)

### Community 17 - "db"
Cohesion: 0.11
Nodes (28): dynamic, maxDuration, POST(), runtime, EntityWikiExcerpt, ConversationEntityInput, getCombinedEntityWiki(), getConversationNotes() (+20 more)

### Community 18 - "quality"
Cohesion: 0.14
Nodes (25): MapStayDto, MapView(), RoutePointDto, Data, fmt(), Gate, MapPage(), MapView (+17 more)

### Community 19 - "map/pin/route.ts"
Cohesion: 0.10
Nodes (28): BatchRow, buildTranscript(), CATEGORY_ALIASES, ChatMemoryCategory, ChatMemoryRowForDedup, compressBatch(), CompressBatchResult, DuplicateCheck (+20 more)

### Community 20 - "memory/page.tsx"
Cohesion: 0.12
Nodes (22): dynamic, GET(), POST(), runtime, unlocked(), attemptsLeft, gate, makeUnlockToken (+14 more)

### Community 21 - "env"
Cohesion: 0.14
Nodes (25): dynamic, GET(), LOCKED(), maxDuration, runtime, CHAT_DIARY_NOTEBOOK_NAME, ensureChatDiaryNotebook(), MAX_DIARY_ENTRY_CHARS (+17 more)

### Community 22 - "setSetting"
Cohesion: 0.07
Nodes (27): concurrency, cancel-in-progress, group, CI, NEXT_TELEMETRY_DISABLED, jobs, quality, name (+19 more)

### Community 23 - "layout.tsx"
Cohesion: 0.13
Nodes (24): dynamic, LOCKED(), POST(), runtime, classifyReocr(), cursorValue(), diffRmPages(), IncrementalResult (+16 more)

### Community 24 - "mind.ts"
Cohesion: 0.07
Nodes (26): COMMENT_BODY, COMMENT_URL, EVENT_NAME, GH_TOKEN, PR_NUMBER, REPO, if, runs-on (+18 more)

### Community 25 - "discipline/route.ts"
Cohesion: 0.19
Nodes (26): allConversationNotesRows(), allConversationFileNames(), allDecisionFileNames(), buildEntityIndexNote(), buildProfileNote(), entityIndexFileName(), entityStubFileName(), sanitizeEntityName() (+18 more)

### Community 26 - "notebooks/route.ts"
Cohesion: 0.18
Nodes (20): track(), clearSans, dynamic, metadata, RootLayout(), viewport, LockOffBanner(), friendly() (+12 more)

### Community 27 - "notebooks/page.tsx"
Cohesion: 0.10
Nodes (22): ATTACHMENT_DIR, dynamic, GET(), runtime, dynamic, Entry, GET(), LOCKED() (+14 more)

### Community 28 - "mind/page.tsx"
Cohesion: 0.12
Nodes (23): dynamic, runtime, secondLook(), Block, Box, CaptureArgs, captureExample(), cropFile() (+15 more)

### Community 29 - "embeddings.ts"
Cohesion: 0.14
Nodes (23): AxisLabels, EmbeddingMap(), EntityRankings(), Heatmap(), HeatmapBucket, Map3D, MapPoint, MindData (+15 more)

### Community 30 - "dependencies"
Cohesion: 0.18
Nodes (21): DELETE(), dynamic, GET(), LOCKED(), POST(), runtime, escapeHtml(), GET() (+13 more)

### Community 31 - "decisionWiki.ts"
Cohesion: 0.15
Nodes (22): resolveConversationEntityName(), DecisionEntityInput, ensureDecisionPage(), ensureDecisionsNotebook(), KINDS, tagDecisionEntities(), dateKey(), DECISION_FOLDER (+14 more)

### Community 32 - "reflectionWiki.ts"
Cohesion: 0.17
Nodes (20): dynamic, GET(), POST(), relyingParty(), runtime, AUTH_CHALLENGE_COOKIE, consumeChallenge(), isLockEnabled() (+12 more)

### Community 33 - "isAuthenticated"
Cohesion: 0.16
Nodes (21): REFLECTIONS_NOTEBOOK_ID, ensureReflectionPage(), ensureReflectionsNotebook(), KINDS, ReflectionEntityInput, tagReflectionEntities(), dateKey(), getReflectionByKey() (+13 more)

### Community 34 - "getCurrentProfile"
Cohesion: 0.09
Nodes (23): dependencies, better-sqlite3@^11.3.0, d3-force@^3.0.1, jszip@^3.10.1, mammoth@^1.12.0, mcp-handler@^1.1.0, next@^16.4.6, pdf-parse@^2.4.5 (+15 more)

### Community 35 - "DiaryGraphClient.tsx"
Cohesion: 0.18
Nodes (20): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, buildSelfModel(), recentInsightsBlock() (+12 more)

### Community 36 - "ref_path"
Cohesion: 0.17
Nodes (19): dynamic, GET(), LOCKED(), runtime, anchorPhrase(), contextSnippet(), replaceAt(), ProofreadingStats (+11 more)

### Community 37 - "entityRelationships.ts"
Cohesion: 0.13
Nodes (19): AuthCode, authCodes, ClientMetadataResult, ClientRegistrationMetadata, configuredSecrets(), consentSecretValid(), currentSecretHashes(), IssuedTokens (+11 more)

### Community 38 - "devDependencies"
Cohesion: 0.17
Nodes (17): dynamic, POST(), runtime, classifyDropboxError(), deleteFile(), disconnectDropbox(), downloadFile(), dropboxApiArg() (+9 more)

### Community 39 - "vitest"
Cohesion: 0.19
Nodes (19): clearSetting(), causeCodes(), DownloadedPage, downloadNotebook(), DownloadResult, filterNotebooks(), isTransientNetworkError(), listRemarkableNotebooks() (+11 more)

### Community 40 - "entityWiki.ts"
Cohesion: 0.19
Nodes (18): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backfillCandidates(), Candidate (+10 more)

### Community 41 - "ForceGraph"
Cohesion: 0.18
Nodes (19): authFailKey(), AuthFailState, bumpBucket(), challengeCookieOptions, createSessionToken(), getAuthFailState(), getRawAuthFailState(), passcodeLockRemainingMs() (+11 more)

### Community 42 - "compilerOptions"
Cohesion: 0.13
Nodes (18): EntityPredicate, isEntityPredicate(), PREDICATE_LABELS, PREDICATES, CleanRelationshipInput, cleanRelationships(), EntityKind, getRelationshipsFor() (+10 more)

### Community 43 - "insights/route.ts"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.47, @types/better-sqlite3@^7.6.11, @types/d3-force@^3.0.10, @types/node@^22.7.4, @types/react@^19.2.18, @types/react-dom@^19.2.4 (+12 more)

### Community 44 - "corsHeaders"
Cohesion: 0.18
Nodes (17): dynamic, Kind, KINDS, maxDuration, POST(), postMergeDropbox(), runtime, dedupeAllEntities() (+9 more)

### Community 45 - "entityMerge.ts"
Cohesion: 0.19
Nodes (16): dynamic, GET(), LOCKED(), runtime, dynamic, GET(), runtime, DELETE() (+8 more)

### Community 46 - "notebooks/pin/route.ts"
Cohesion: 0.13
Nodes (17): DiaryGraphClient(), EDGE_COLORS, EDGE_LABELS, EDGE_TYPES, formatGeneratedAt(), Inspector(), Metric(), metricLabel() (+9 more)

### Community 47 - "notebooksPinDenied"
Cohesion: 0.15
Nodes (17): ForceEdgeInput, ForceGraph(), draw(), fit(), hit(), loop(), onDown(), onMove() (+9 more)

### Community 48 - "entityTagging.ts"
Cohesion: 0.11
Nodes (12): better-sqlite3, AuthMod, DbMod, BackupMod, DbMod, CdMod, DbMod, MindMod (+4 more)

### Community 49 - "db.ts"
Cohesion: 0.16
Nodes (18): cleanName(), createPendingShare(), filePath(), listPendingShares(), MAX_PENDING_BYTES, MAX_PENDING_SHARES, PENDING_DIR, PENDING_RETENTION_HOURS (+10 more)

### Community 50 - "mcpOauth.ts"
Cohesion: 0.11
Nodes (11): AuthMod, DbMod, CeMod, CwMod, DbMod, Db, L, Review (+3 more)

### Community 51 - "backfill-all/route.ts"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 52 - "graphify_gate.py"
Cohesion: 0.24
Nodes (16): dynamic, GET(), maxDuration, POST(), runtime, reembedMissingMemories(), callVoyage(), embed() (+8 more)

### Community 53 - "pendingShares.ts"
Cohesion: 0.18
Nodes (13): dynamic, GET(), runtime, dynamic, GraphPage(), DiaryGraphPayload, VaultNoteKind, readDropboxTextFiles() (+5 more)

### Community 54 - "package.json"
Cohesion: 0.24
Nodes (16): dynamic, GET(), POST(), runtime, unlocked(), checkPasscode(), gate, makeNotebooksUnlockToken (+8 more)

### Community 55 - "maybeCompressChatSessions"
Cohesion: 0.24
Nodes (16): dynamic, GET(), LOCKED(), POST(), runtime, Cand, estimateRetranscribe(), FILES_DIR (+8 more)

### Community 56 - "vaultGraph.ts"
Cohesion: 0.18
Nodes (17): ensureConversationPage(), ensureConversationsNotebook(), CONVERSATION_FOLDER, conversationNoteFileName(), conversationPageId(), dateKey(), ExportedConversationRow, getConversationByKey() (+9 more)

### Community 57 - "authorize/route.ts"
Cohesion: 0.12
Nodes (6): ATTACHMENT_DIR, CleanupMod, DbMod, DbMod, DropboxMod, queued

### Community 58 - "usage.ts"
Cohesion: 0.26
Nodes (16): wikiLinkingEnabled(), listUnlinkedConversations(), listUnlinkedDecisions(), autoTagConversation(), autoTagDecision(), autoTagExportsEnabled(), autoTagReflection(), evenSample() (+8 more)

### Community 59 - "Map3D.tsx"
Cohesion: 0.18
Nodes (12): ExistingRow, importRemarkableNotebookInner(), ImportResult, importsInFlight, ImportStatus, lockRemarkableImport(), unlockRemarkableImport(), execFileAsync (+4 more)

### Community 60 - "usage/page.tsx"
Cohesion: 0.17
Nodes (11): dynamic, GET(), runtime, dynamic, GET(), runtime, buildAuthUrl(), exchangeCodeForTokens() (+3 more)

### Community 61 - "manifest.json"
Cohesion: 0.12
Nodes (15): @anthropic-ai/sdk@^0.96.0, leaflet@^1.9.4, @modelcontextprotocol/sdk@^1.26.0, @types/leaflet@^1.9.12, zod@^4.4.3, engines, node, name (+7 more)

### Community 62 - "location.ts"
Cohesion: 0.32
Nodes (14): consentForm(), destHost(), dynamic, esc(), GET(), OAuthParams, page(), POST() (+6 more)

### Community 63 - "register/route.ts"
Cohesion: 0.22
Nodes (14): auditRequest(), dynamic, guarded(), handler, maxDuration, runtime, RFC-9728, checkMcpAuth() (+6 more)

### Community 64 - "analyzePending"
Cohesion: 0.25
Nodes (11): dynamic, GET(), LOCKED(), runtime, buildCandidate(), buildCloudCoverage(), classifyDuplicate(), CloudCoverage (+3 more)

### Community 65 - "next"
Cohesion: 0.18
Nodes (14): ActiveLabel(), Axes(), AxisEndLabel(), AxisLabels, Map3D(), MapPoint, Point(), sentimentColour() (+6 more)

### Community 66 - "mcp/route.ts"
Cohesion: 0.27
Nodes (15): getSetting(), createPinGate(), attemptsLeft(), configured(), cookieKey(), lockRemainingMs(), makeUnlockToken(), pinMatches() (+7 more)

### Community 67 - "AutoLock"
Cohesion: 0.13
Nodes (14): background_color, description, display, icons, name, files, share_target, action (+6 more)

### Community 68 - "diaryGraph.test.ts"
Cohesion: 0.19
Nodes (12): backfillTitles(), dynamic, GET(), LOCKED(), maxDuration, PATCH(), runtime, blocksFor() (+4 more)

### Community 69 - "mcpOauth.test.ts"
Cohesion: 0.22
Nodes (10): dynamic, LOCKED(), maxDuration, POST(), runtime, carryForwardDates(), DiaryPageRow, compareImportedNotebook() (+2 more)

### Community 70 - "notebooks/[id]/pdf/route.ts"
Cohesion: 0.24
Nodes (12): dynamic, GET(), runtime, dailyUsage(), FALLBACK, monthlyUsage(), Prices, PRICES (+4 more)

### Community 71 - "token/route.ts"
Cohesion: 0.18
Nodes (11): DELETE(), dynamic, LOCKED(), runtime, next, DbMod, NotesMod, pdf (+3 more)

### Community 72 - "mind/route.ts"
Cohesion: 0.31
Nodes (11): dynamic, fmtDate(), fmtDateTime(), fmtTime(), GET(), LOCKED(), maxDuration, runtime (+3 more)

### Community 73 - "createPinGate"
Cohesion: 0.19
Nodes (11): dynamic, LOCKED(), POST(), runtime, dynamic, LOCKED(), maxDuration, POST() (+3 more)

### Community 74 - "dropboxExportLock.test.ts"
Cohesion: 0.40
Nodes (11): AutoLock(), cancelPending(), lockNow(), markHiddenIfNeeded(), onPageHide(), onVisibility(), clearHiddenSince(), readHiddenSince() (+3 more)

### Community 75 - "webauthn.ts"
Cohesion: 0.27
Nodes (11): ocrNotebookPdf(), ocrNotebookPdfWithFlags(), parsePages(), proofreadExistingPdf(), exampleBlocks(), clean(), parseBox(), parseFlagLines() (+3 more)

### Community 76 - "api/export/route.ts"
Cohesion: 0.15
Nodes (8): CeMod, CwMod, DbMod, DiaryGraphPayload, GraphMod, MindMod, NotesMod, RelMod

### Community 77 - "grants/route.ts"
Cohesion: 0.22
Nodes (7): codeFrom(), consent(), exchange(), issueAccessToken(), Mod, pkce(), register()

### Community 78 - "interruptedNotebookRecovery.test.ts"
Cohesion: 0.21
Nodes (11): dynamic, OPTIONS(), POST(), readBoundedJson(), runtime, RFC-7591, REGISTER_THROTTLE_BUCKET, MAX_DCR_BODY_BYTES (+3 more)

### Community 79 - "relatedEntities.test.ts"
Cohesion: 0.29
Nodes (11): dynamic, err(), OPTIONS(), POST(), readForm(), runtime, corsHeaders(), issueTokens() (+3 more)

### Community 80 - "chatDiary.ts"
Cohesion: 0.20
Nodes (7): ConversationWikiMod, DbMod, deferred(), DiaryExportDbMod, DropboxMod, mockDropboxFetch(), UploadCall

### Community 81 - "deploy"
Cohesion: 0.24
Nodes (9): dynamic, LOCKED(), POST(), runtime, compressionInFlight(), createRollingBatch(), maybeCompressChatSessions(), maybeRollConversationMemory() (+1 more)

### Community 82 - "decrypt-backup.mjs"
Cohesion: 0.31
Nodes (9): DELETE(), dynamic, GET(), runtime, requireAuth(), clientIp(), dropAuthCodesForClient(), listOAuthAudit() (+1 more)

### Community 83 - "authRoute.test.ts"
Cohesion: 0.36
Nodes (7): BackfillMessage, CHUNK_TARGET_CHARS, chunkedBackfillForConversation(), chunkMessageIds(), createBatchForChunk(), estimateTranscriptCost(), chunkCost()

### Community 85 - "diaryExportDb.test.ts"
Cohesion: 0.20
Nodes (5): ChatToolsMod, DbMod, MergeMod, NotesMod, Result

### Community 86 - "entityWriteAtomicity.test.ts"
Cohesion: 0.36
Nodes (8): dynamic, GET(), hasNotes(), LOCKED(), maxDuration, POST(), runtime, getCurrentProfileRow()

### Community 87 - "pagesForEntity.test.ts"
Cohesion: 0.33
Nodes (8): dynamic, GET(), LOCKED(), POST(), resolve(), runtime, Slot, SLOTS

### Community 88 - "memories/route.ts"
Cohesion: 0.22
Nodes (8): build, builder, dockerfilePath, deploy, restartPolicyMaxRetries, restartPolicyType, startCommand, $schema

### Community 89 - "librarian/route.ts"
Cohesion: 0.22
Nodes (6): body, enc, iv, MAGIC, salt, tag

### Community 90 - "entityGraph.ts"
Cohesion: 0.22
Nodes (5): AuthMod, DbMod, requestCookies, RouteMod, webauthn

### Community 91 - "scripts"
Cohesion: 0.22
Nodes (4): ChatToolsMod, DbMod, MindMod, NotesMod

### Community 92 - "chatToolsLocation.test.ts"
Cohesion: 0.36
Nodes (7): dynamic, GET(), runtime, clampMapDays(), MAP_UNLOCK_COOKIE, verifyUnlockToken, mapData()

### Community 93 - "entityMerge.test.ts"
Cohesion: 0.32
Nodes (5): OcrFlag, applySecondLook(), LookAnswer, LookItem, parseLookAnswers()

### Community 94 - "entityRelationships.test.ts"
Cohesion: 0.25
Nodes (3): DbMod, ExportMod, NotesMod

### Community 96 - "mcp.test.ts"
Cohesion: 0.25
Nodes (3): ChatToolsMod, DbMod, NotesMod

### Community 97 - "api/diary/route.ts"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), MemoryRow, runtime, pendingBatchDetails()

### Community 98 - "chatMemoryExtract.test.ts"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), runtime, LibrarianStatus, librarianStatus()

### Community 99 - "chatMemoryRecall.test.ts"
Cohesion: 0.33
Nodes (6): dynamic, GET(), OPTIONS(), runtime, RFC-8414, authorizationServerMetadata()

### Community 100 - "chatMemoryRolling.test.ts"
Cohesion: 0.33
Nodes (6): dynamic, GET(), OPTIONS(), runtime, RFC-9728, protectedResourceMetadata()

### Community 101 - "entityTagging.test.ts"
Cohesion: 0.38
Nodes (6): dynamic, LOCKED(), maxDuration, POST(), runtime, importRemarkableNotebook()

### Community 102 - "mind.test.ts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, test:watch

### Community 103 - "notebookDedupDb.test.ts"
Cohesion: 0.29
Nodes (4): ChatToolsMod, DbMod, LocationMod, OwntracksMod

### Community 105 - "relationshipExportReconcile.test.ts"
Cohesion: 0.29
Nodes (4): CwMod, DbMod, MergeMod, RelMod

### Community 106 - "duplicates/route.ts"
Cohesion: 0.29
Nodes (3): DbMod, MindMod, NotesMod

### Community 107 - "eslint"
Cohesion: 0.29
Nodes (3): ChatToolsMod, McpMod, RouteMod

### Community 108 - "correctPageText.test.ts"
Cohesion: 0.47
Nodes (5): dynamic, LOCKED(), POST(), runtime, clearCompressionInFlight()

### Community 109 - "dropboxTombstone.test.ts"
Cohesion: 0.47
Nodes (5): dynamic, LOCKED(), POST(), runtime, resetBatchForRetry()

### Community 110 - "embeddingMapDiscipline.test.ts"
Cohesion: 0.40
Nodes (5): dynamic, GET(), LOCKED(), maxDuration, runtime

### Community 111 - "entityWikiExclude.test.ts"
Cohesion: 0.40
Nodes (5): dynamic, LOCKED(), maxDuration, POST(), runtime

### Community 112 - "ocrLearningDb.test.ts"
Cohesion: 0.53
Nodes (4): strip(), tokens(), WordChange, wordChanges()

### Community 113 - "reflectionEntities.test.ts"
Cohesion: 0.33
Nodes (3): ClaudeMod, CmMod, DbMod

### Community 114 - "remarkableTombstone.test.ts"
Cohesion: 0.33
Nodes (3): CmMod, DbMod, EmbMod

### Community 116 - "next.config.mjs"
Cohesion: 0.33
Nodes (5): ClaudeMod, CwMod, DbMod, EtMod, RwMod

### Community 117 - "tailwindcss"
Cohesion: 0.33
Nodes (3): DbMod, MindMod, NotesMod

### Community 118 - "chatMemoryFlow.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, DedupMod, NotesMod

### Community 119 - "conversationEntities.test.ts"
Cohesion: 0.33
Nodes (3): Db, Review, Store

### Community 120 - "dropboxStatus.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 121 - "owntracksCurrent.test.ts"
Cohesion: 0.50
Nodes (4): dynamic, GET(), LOCKED(), runtime

### Community 122 - "session-start.sh"
Cohesion: 0.40
Nodes (4): eslint@^9.39.5, eslint-config-next@^16.3.2, eslint, eslint-config-next

### Community 123 - "entrypoint.sh"
Cohesion: 0.40
Nodes (3): CmMod, DbMod, EmbMod

### Community 125 - "postcss.config.mjs"
Cohesion: 0.40
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 126 - "ocrReviewDb.test.ts"
Cohesion: 0.40
Nodes (3): ClaudeMod, DbMod, EwMod

### Community 127 - "entityWikiExclude.test.ts"
Cohesion: 0.40
Nodes (4): CeMod, DbMod, ReMod, RwMod

### Community 128 - "reflectionEntities.test.ts"
Cohesion: 0.40
Nodes (3): DbMod, NotesMod, SyncMod

### Community 129 - "remarkableTombstone.test.ts"
Cohesion: 0.50
Nodes (3): RFC-8414, RFC-9728, nextConfig

### Community 130 - "mapPin.test.ts"
Cohesion: 0.50
Nodes (3): tailwindcss@^3.4.13, tailwindcss, config

### Community 132 - "tailwindcss"
Cohesion: 0.50
Nodes (3): DbMod, DeMod, DwMod

## Knowledge Gaps
- **6 isolated node(s):** `RFC-9728`, `RFC-8414`, `RFC-9728`, `RFC-9728`, `RFC-7591` (+1 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 887 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db()` connect `ref_fs` to `dropbox.ts`, `remarkableCloud.ts`, `owntracks.ts`, `ocrLearning.ts`, `mcp.ts`, `diaryGraph.ts`, `backup.ts`, `claude.ts`, `remarkableSync.ts`, `auth.ts`, `chatMemory.ts`, `db`, `map/pin/route.ts`, `env`, `layout.tsx`, `discipline/route.ts`, `notebooks/page.tsx`, `mind/page.tsx`, `dependencies`, `decisionWiki.ts`, `reflectionWiki.ts`, `isAuthenticated`, `DiaryGraphClient.tsx`, `ref_path`, `entityRelationships.ts`, `vitest`, `entityWiki.ts`, `ForceGraph`, `compilerOptions`, `corsHeaders`, `entityMerge.ts`, `entityTagging.ts`, `db.ts`, `mcpOauth.ts`, `graphify_gate.py`, `maybeCompressChatSessions`, `vaultGraph.ts`, `authorize/route.ts`, `usage.ts`, `Map3D.tsx`, `location.ts`, `register/route.ts`, `analyzePending`, `mcp/route.ts`, `diaryGraph.test.ts`, `mcpOauth.test.ts`, `notebooks/[id]/pdf/route.ts`, `token/route.ts`, `mind/route.ts`, `interruptedNotebookRecovery.test.ts`, `relatedEntities.test.ts`, `deploy`, `decrypt-backup.mjs`, `authRoute.test.ts`, `entityWriteAtomicity.test.ts`, `chatToolsLocation.test.ts`, `api/diary/route.ts`, `eslint`, `dropboxTombstone.test.ts`?**
  _High betweenness centrality (0.190) - this node is a cross-community bridge._
- **What connects `RFC-9728`, `RFC-8414`, `RFC-9728` to the rest of the system?**
  _6 weakly-connected nodes found - possible missing edges._
- **Should `dropbox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.055087719298245616 - nodes in this community are weakly interconnected._
- **Why does `next` connect `token/route.ts` to `dropbox.ts`, `remarkableCloud.ts`, `mcp.ts`, `diaryGraph.ts`, `backup.ts`, `app/page.tsx`, `chat/route.ts`, `remarkableSync.ts`, `chatMemory.ts`, `db`, `quality`, `memory/page.tsx`, `env`, `layout.tsx`, `notebooks/route.ts`, `notebooks/page.tsx`, `mind/page.tsx`, `embeddings.ts`, `dependencies`, `reflectionWiki.ts`, `getCurrentProfile`, `DiaryGraphClient.tsx`, `ref_path`, `devDependencies`, `entityWiki.ts`, `ForceGraph`, `corsHeaders`, `entityMerge.ts`, `graphify_gate.py`, `pendingShares.ts`, `package.json`, `maybeCompressChatSessions`, `usage/page.tsx`, `manifest.json`, `location.ts`, `register/route.ts`, `analyzePending`, `diaryGraph.test.ts`, `mcpOauth.test.ts`, `notebooks/[id]/pdf/route.ts`, `mind/route.ts`, `createPinGate`, `interruptedNotebookRecovery.test.ts`, `relatedEntities.test.ts`, `deploy`, `decrypt-backup.mjs`, `entityWriteAtomicity.test.ts`, `pagesForEntity.test.ts`, `entityGraph.ts`, `chatToolsLocation.test.ts`, `api/diary/route.ts`, `chatMemoryExtract.test.ts`, `chatMemoryRecall.test.ts`, `chatMemoryRolling.test.ts`, `entityTagging.test.ts`, `correctPageText.test.ts`, `dropboxTombstone.test.ts`, `embeddingMapDiscipline.test.ts`, `entityWikiExclude.test.ts`, `owntracksCurrent.test.ts`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Should `diaryExportDb.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06936026936026936 - nodes in this community are weakly interconnected._
- **Why does `isAuthenticated()` connect `notebooks/page.tsx` to `dropbox.ts`, `remarkableCloud.ts`, `ocrLearning.ts`, `mcp.ts`, `backup.ts`, `remarkableSync.ts`, `ref_fs`, `chatMemory.ts`, `db`, `env`, `layout.tsx`, `notebooks/route.ts`, `mind/page.tsx`, `dependencies`, `reflectionWiki.ts`, `DiaryGraphClient.tsx`, `ref_path`, `devDependencies`, `entityWiki.ts`, `ForceGraph`, `corsHeaders`, `entityMerge.ts`, `graphify_gate.py`, `pendingShares.ts`, `maybeCompressChatSessions`, `usage/page.tsx`, `analyzePending`, `diaryGraph.test.ts`, `mcpOauth.test.ts`, `notebooks/[id]/pdf/route.ts`, `token/route.ts`, `mind/route.ts`, `createPinGate`, `deploy`, `decrypt-backup.mjs`, `entityWriteAtomicity.test.ts`, `pagesForEntity.test.ts`, `chatToolsLocation.test.ts`, `api/diary/route.ts`, `chatMemoryExtract.test.ts`, `entityTagging.test.ts`, `correctPageText.test.ts`, `dropboxTombstone.test.ts`, `embeddingMapDiscipline.test.ts`, `entityWikiExclude.test.ts`, `owntracksCurrent.test.ts`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Should `remarkableCloud.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07111756168359942 - nodes in this community are weakly interconnected._