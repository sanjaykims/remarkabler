# Graph Report - remarkabler  (2026-11-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2310 nodes · 6125 edges · 136 communities (125 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0fce7abc`
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
- chatMemoryFlow.test.ts
- decisionEntities.test.ts
- owntracksCurrent.test.ts
- session-start.sh
- entrypoint.sh
- postcss.config.mjs

## God Nodes (most connected - your core abstractions)
1. `db()` - 312 edges
2. `isAuthenticated()` - 142 edges
3. `vitest` - 90 edges
4. `next` - 83 edges
5. `getSetting()` - 76 edges
6. `setSetting()` - 69 edges
7. `MemoryPage()` - 42 edges
8. `runMaintenanceSweep()` - 35 edges
9. `callMcpTool()` - 30 edges
10. `notebooksPinDenied()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/authorization-server/route.ts → lib/mcpOauth.ts
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/protected-resource/route.ts → lib/mcpOauth.ts
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/register/route.ts → lib/mcpOauth.ts
- `POST()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/dropbox/disconnect/route.ts → lib/auth.ts
- `GET()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/dropbox/callback/route.ts → lib/auth.ts

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

## Communities (136 total, 11 thin omitted)

### Community 0 - "dropbox.ts"
Cohesion: 0.06
Nodes (70): dynamic, GET(), runtime, dynamic, GET(), runtime, dynamic, POST() (+62 more)

### Community 1 - "diaryExportDb.ts"
Cohesion: 0.05
Nodes (52): saveDecision(), AUDIT_KEEP_ROWS, authFailures, callMcpTool(), COMPANION_GUIDANCE, configuredTokens(), conversationExportEnabled(), DECISION_TOOL (+44 more)

### Community 2 - "remarkableCloud.ts"
Cohesion: 0.10
Nodes (44): POST(), dynamic, GET(), LOCKED(), maxDuration, runtime, dynamic, GET() (+36 more)

### Community 3 - "owntracks.ts"
Cohesion: 0.07
Nodes (42): dynamic, LOCKED(), POST(), runtime, dynamic, LOCKED(), POST(), runtime (+34 more)

### Community 4 - "ocrLearning.ts"
Cohesion: 0.08
Nodes (41): backfillTitles(), dynamic, GET(), LOCKED(), maxDuration, PATCH(), POST(), runtime (+33 more)

### Community 5 - "mcp.ts"
Cohesion: 0.10
Nodes (38): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, LOCKED(), POST() (+30 more)

### Community 6 - "diaryGraph.ts"
Cohesion: 0.12
Nodes (34): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backupConfigured(), BackupStatus (+26 more)

### Community 7 - "backup.ts"
Cohesion: 0.10
Nodes (28): dynamic, GET(), POST(), runtime, unlocked(), dynamic, GET(), runtime (+20 more)

### Community 8 - "app/page.tsx"
Cohesion: 0.10
Nodes (27): Insight, dynamic, Home(), LatestInsight, preview(), RecentNotebook, statusLabel(), DayCost (+19 more)

### Community 9 - "chat/route.ts"
Cohesion: 0.07
Nodes (21): formatBytes(), MemoryPage(), disconnectDropbox(), getPosition(), load(), loadBackup(), loadDisc(), loadDropbox() (+13 more)

### Community 10 - "notes.ts"
Cohesion: 0.09
Nodes (36): addEdge(), addEvidence(), buildDiaryGraph(), canonicalKey(), contentId(), ContentInfo, ContentKind, ContentStats (+28 more)

### Community 11 - "MemoryPage"
Cohesion: 0.13
Nodes (32): ext(), POST(), dynamic, GET(), isPlausiblePoint(), POST(), runtime, getRecentLocations() (+24 more)

### Community 12 - "claude.ts"
Cohesion: 0.07
Nodes (22): setPickingFile(), Card, OcrReview(), Stats, Estimate, OldDiaryProofread(), DuplicateCandidate, Gate (+14 more)

### Community 13 - "remarkableSync.ts"
Cohesion: 0.11
Nodes (32): buildDayFiles(), buildDiaryMarkdown(), buildEntityIndexNote(), buildEntityStubFiles(), buildHomeNote(), buildProfileNote(), collectEntities(), countLine() (+24 more)

### Community 14 - "ref_fs"
Cohesion: 0.10
Nodes (31): dynamic, LOCKED(), POST(), runtime, dynamic, GET(), LOCKED(), runtime (+23 more)

### Community 15 - "auth.ts"
Cohesion: 0.17
Nodes (31): countEntriesMentioning(), currentTimeKst(), executeTool(), ftsSearch(), getDaySummary(), getEntriesByDate(), getInsights(), getMonthSummary() (+23 more)

### Community 16 - "chatMemory.ts"
Cohesion: 0.08
Nodes (29): CHAT_TOOLS, analyzeEntryContent(), AxisLabelResult, AxisLabels, CHAT_MEMORY_EXTRACTION_GUIDANCE, chatOverNotes(), cleanEntityWiki(), compressChatSession() (+21 more)

### Community 17 - "db"
Cohesion: 0.11
Nodes (27): dynamic, GET(), runtime, AxisExtremeEntry, AxisLabelsResult, computePca(), countAnalyzed(), countPending() (+19 more)

### Community 18 - "quality"
Cohesion: 0.13
Nodes (26): MapStayDto, MapView(), RoutePointDto, Data, fmt(), Gate, MapPage(), MapView (+18 more)

### Community 19 - "map/pin/route.ts"
Cohesion: 0.07
Nodes (27): concurrency, cancel-in-progress, group, CI, NEXT_TELEMETRY_DISABLED, jobs, quality, name (+19 more)

### Community 20 - "memory/page.tsx"
Cohesion: 0.18
Nodes (27): allConversationNotesRows(), allConversationFileNames(), allDecisionFileNames(), entityIndexFileName(), entityStubFileName(), sanitizeEntityName(), affectedDayFileNames(), affectedEntityStubFileNames() (+19 more)

### Community 21 - "env"
Cohesion: 0.09
Nodes (22): ATTACHMENT_DIR, dynamic, GET(), runtime, DELETE(), dynamic, LOCKED(), runtime (+14 more)

### Community 22 - "setSetting"
Cohesion: 0.11
Nodes (23): dynamic, GET(), runtime, AuthCode, authCodes, ClientMetadataResult, ClientRegistrationMetadata, configuredSecrets() (+15 more)

### Community 23 - "layout.tsx"
Cohesion: 0.07
Nodes (26): COMMENT_BODY, COMMENT_URL, EVENT_NAME, GH_TOKEN, PR_NUMBER, REPO, if, runs-on (+18 more)

### Community 24 - "mind.ts"
Cohesion: 0.12
Nodes (20): ChatMemoryItem, ChatMemorySection(), backfillAll(), load(), processPending(), remove(), retryStuck(), ChatMemoryStatus (+12 more)

### Community 25 - "discipline/route.ts"
Cohesion: 0.12
Nodes (15): clearSans, dynamic, metadata, RootLayout(), viewport, LockAllButton(), LockOffBanner(), LINKS (+7 more)

### Community 26 - "notebooks/route.ts"
Cohesion: 0.14
Nodes (23): AxisLabels, EmbeddingMap(), EntityRankings(), Heatmap(), HeatmapBucket, Map3D, MapPoint, MindData (+15 more)

### Community 27 - "notebooks/page.tsx"
Cohesion: 0.16
Nodes (22): dynamic, GET(), POST(), relyingParty(), runtime, AUTH_CHALLENGE_COOKIE, challengeCookieOptions, consumeChallenge() (+14 more)

### Community 28 - "mind/page.tsx"
Cohesion: 0.19
Nodes (19): DELETE(), dynamic, GET(), LOCKED(), POST(), runtime, escapeHtml(), GET() (+11 more)

### Community 29 - "embeddings.ts"
Cohesion: 0.16
Nodes (21): DecisionEntityInput, ensureDecisionPage(), ensureDecisionsNotebook(), KINDS, tagDecisionEntities(), dateKey(), DECISION_FOLDER, decisionNoteFileName() (+13 more)

### Community 30 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, better-sqlite3@^11.3.0, d3-force@^3.0.1, jszip@^3.10.1, mammoth@^1.12.0, mcp-handler@^1.1.0, next@^16.4.6, pdf-parse@^2.4.5 (+15 more)

### Community 31 - "decisionWiki.ts"
Cohesion: 0.15
Nodes (20): dynamic, GET(), LOCKED(), runtime, ConversationEntityInput, ensureConversationPage(), ensureConversationsNotebook(), getCombinedEntityWiki() (+12 more)

### Community 32 - "reflectionWiki.ts"
Cohesion: 0.19
Nodes (19): DELETE(), dynamic, GET(), POST(), runtime, unlocked(), checkPasscode(), requireAuth() (+11 more)

### Community 33 - "isAuthenticated"
Cohesion: 0.16
Nodes (20): REFLECTIONS_NOTEBOOK_ID, ensureReflectionPage(), ensureReflectionsNotebook(), KINDS, ReflectionEntityInput, tagReflectionEntities(), dateKey(), getReflectionByKey() (+12 more)

### Community 34 - "getCurrentProfile"
Cohesion: 0.13
Nodes (21): applyFixes(), AUTOFIX_MIN, autoFixablePairs(), buildOcrHints(), confirmedTerms(), correctedPairs(), editDistance(), escapeRe() (+13 more)

### Community 35 - "DiaryGraphClient.tsx"
Cohesion: 0.16
Nodes (16): dynamic, LOCKED(), maxDuration, POST(), runtime, ExistingRow, importRemarkableNotebook(), importRemarkableNotebookInner() (+8 more)

### Community 36 - "ref_path"
Cohesion: 0.13
Nodes (18): DiaryGraphClient(), EDGE_COLORS, EDGE_LABELS, EDGE_TYPES, formatGeneratedAt(), Inspector(), Metric(), metricLabel() (+10 more)

### Community 37 - "entityRelationships.ts"
Cohesion: 0.15
Nodes (3): main(), marker_path(), main()

### Community 38 - "devDependencies"
Cohesion: 0.10
Nodes (15): recoverInterruptedNotebooks(), better-sqlite3, BackupMod, DbMod, CeMod, CwMod, DbMod, DbMod (+7 more)

### Community 39 - "vitest"
Cohesion: 0.25
Nodes (18): track(), InsightsPage(), copy(), download(), exportText(), generate(), load(), summarize() (+10 more)

### Community 40 - "entityWiki.ts"
Cohesion: 0.13
Nodes (18): ATTACHMENT_DIR, DELETE(), dynamic, EXT, EXT_TO_MIME, GET(), IMAGE_TYPES, LOCKED() (+10 more)

### Community 41 - "ForceGraph"
Cohesion: 0.16
Nodes (18): dynamic, maxDuration, POST(), runtime, composeEntityWiki(), EntityWikiExcerpt, modelChat(), candidates() (+10 more)

### Community 42 - "compilerOptions"
Cohesion: 0.17
Nodes (18): dynamic, Kind, KINDS, maxDuration, POST(), postMergeDropbox(), runtime, findEntityDuplicates() (+10 more)

### Community 43 - "insights/route.ts"
Cohesion: 0.13
Nodes (18): EntityPredicate, isEntityPredicate(), PREDICATE_LABELS, PREDICATES, CleanRelationshipInput, cleanRelationships(), EntityKind, getRelationshipsFor() (+10 more)

### Community 44 - "corsHeaders"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.47, @types/better-sqlite3@^7.6.11, @types/d3-force@^3.0.10, @types/node@^22.7.4, @types/react@^19.2.18, @types/react-dom@^19.2.4 (+12 more)

### Community 45 - "entityMerge.ts"
Cohesion: 0.10
Nodes (10): DbMod, DropboxMod, DbMod, DropboxMod, NotesMod, DbMod, Mod, DbMod (+2 more)

### Community 46 - "notebooks/pin/route.ts"
Cohesion: 0.10
Nodes (8): AuthMod, DbMod, DbMod, NotesMod, DbMod, Mod, WikiMod, queued

### Community 47 - "notebooksPinDenied"
Cohesion: 0.15
Nodes (17): ForceEdgeInput, ForceGraph(), draw(), fit(), hit(), loop(), onDown(), onMove() (+9 more)

### Community 48 - "entityTagging.ts"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 49 - "db.ts"
Cohesion: 0.25
Nodes (16): dynamic, GET(), maxDuration, POST(), runtime, callVoyage(), embed(), embedBatch() (+8 more)

### Community 50 - "mcpOauth.ts"
Cohesion: 0.21
Nodes (17): authFailKey(), AuthFailState, bumpBucket(), createSessionToken(), getAuthFailState(), getRawAuthFailState(), passcodeLockRemainingMs(), pruneExpiredAuthFailBuckets() (+9 more)

### Community 51 - "backfill-all/route.ts"
Cohesion: 0.26
Nodes (17): extractTaggingEntities(), wikiLinkingEnabled(), listUnlinkedConversations(), listUnlinkedDecisions(), autoTagConversation(), autoTagDecision(), autoTagExportsEnabled(), autoTagReflection() (+9 more)

### Community 52 - "graphify_gate.py"
Cohesion: 0.11
Nodes (9): vitest, AuthMod, DbMod, DbMod, DropboxMod, DbMod, MindMod, AuthRouteMod (+1 more)

### Community 53 - "pendingShares.ts"
Cohesion: 0.19
Nodes (13): dynamic, LOCKED(), POST(), runtime, createRollingBatch(), maybeRollConversationMemory(), BackfillMessage, CHUNK_TARGET_CHARS (+5 more)

### Community 54 - "package.json"
Cohesion: 0.24
Nodes (15): dynamic, GET(), LOCKED(), POST(), runtime, queueNotebookProcessing(), Cand, estimateRetranscribe() (+7 more)

### Community 55 - "maybeCompressChatSessions"
Cohesion: 0.24
Nodes (15): dynamic, GET(), runtime, DELETE(), dynamic, GET(), LOCKED(), POST() (+7 more)

### Community 56 - "vaultGraph.ts"
Cohesion: 0.17
Nodes (16): cleanName(), createPendingShare(), filePath(), MAX_PENDING_BYTES, MAX_PENDING_SHARES, PENDING_DIR, PENDING_RETENTION_HOURS, PendingRow (+8 more)

### Community 57 - "authorize/route.ts"
Cohesion: 0.19
Nodes (15): auditRequest(), dynamic, guarded(), handler, maxDuration, runtime, RFC-9728, checkMcpAuth() (+7 more)

### Community 58 - "usage.ts"
Cohesion: 0.13
Nodes (6): ATTACHMENT_DIR, findRouteFiles(), PUBLIC, CleanupMod, DbMod, proofread

### Community 59 - "Map3D.tsx"
Cohesion: 0.23
Nodes (14): captureExample(), examplesAvailable(), anchorPhrase(), contextSnippet(), replaceAt(), recordLearned(), captureHandwriting(), FlagRow (+6 more)

### Community 60 - "usage/page.tsx"
Cohesion: 0.12
Nodes (15): @anthropic-ai/sdk@^0.96.0, leaflet@^1.9.4, @modelcontextprotocol/sdk@^1.26.0, @types/leaflet@^1.9.12, zod@^4.4.3, engines, node, name (+7 more)

### Community 61 - "manifest.json"
Cohesion: 0.22
Nodes (13): dynamic, GET(), LOCKED(), maxDuration, runtime, BINARY_EXT, disciplineConfig(), disciplineRepoName() (+5 more)

### Community 62 - "location.ts"
Cohesion: 0.21
Nodes (11): dynamic, GET(), runtime, DiaryGraphEdge, DiaryGraphPayload, VaultNoteKind, insightDropboxFolders(), addVaultNotesToGraph() (+3 more)

### Community 63 - "register/route.ts"
Cohesion: 0.17
Nodes (13): dynamic, GET(), OPTIONS(), runtime, RFC-8414, dynamic, GET(), OPTIONS() (+5 more)

### Community 64 - "analyzePending"
Cohesion: 0.32
Nodes (14): consentForm(), destHost(), dynamic, esc(), GET(), OAuthParams, page(), POST() (+6 more)

### Community 65 - "next"
Cohesion: 0.25
Nodes (11): dynamic, GET(), LOCKED(), runtime, buildCandidate(), buildCloudCoverage(), classifyDuplicate(), CloudCoverage (+3 more)

### Community 66 - "mcp/route.ts"
Cohesion: 0.21
Nodes (11): dynamic, LOCKED(), maxDuration, POST(), runtime, compareTranscriptions(), carryForwardDates(), DiaryPageRow (+3 more)

### Community 67 - "AutoLock"
Cohesion: 0.18
Nodes (14): ActiveLabel(), Axes(), AxisEndLabel(), AxisLabels, Map3D(), MapPoint, Point(), sentimentColour() (+6 more)

### Community 68 - "diaryGraph.test.ts"
Cohesion: 0.25
Nodes (14): backfillCandidates(), Candidate, estimateBackfill(), FILES_DIR, MAX_PER_RUN, NotebookResult, pdfPath(), PENDING_CAP (+6 more)

### Community 69 - "mcpOauth.test.ts"
Cohesion: 0.13
Nodes (14): background_color, description, display, icons, name, files, share_target, action (+6 more)

### Community 70 - "notebooks/[id]/pdf/route.ts"
Cohesion: 0.22
Nodes (13): reparseIfNeeded(), dynamic, GET(), LOCKED(), POST(), resolve(), runtime, Slot (+5 more)

### Community 71 - "token/route.ts"
Cohesion: 0.24
Nodes (12): dynamic, GET(), runtime, dailyUsage(), FALLBACK, monthlyUsage(), Prices, PRICES (+4 more)

### Community 72 - "mind/route.ts"
Cohesion: 0.31
Nodes (11): dynamic, fmtDate(), fmtDateTime(), fmtTime(), GET(), LOCKED(), maxDuration, runtime (+3 more)

### Community 73 - "createPinGate"
Cohesion: 0.26
Nodes (9): dynamic, GET(), LOCKED(), POST(), runtime, addLocation(), listRecentLocations(), recentLocationsContext() (+1 more)

### Community 74 - "dropboxExportLock.test.ts"
Cohesion: 0.17
Nodes (11): dynamic, GET(), runtime, Box, next, DbMod, NotesMod, pdf (+3 more)

### Community 75 - "webauthn.ts"
Cohesion: 0.40
Nodes (11): AutoLock(), cancelPending(), lockNow(), markHiddenIfNeeded(), onPageHide(), onVisibility(), clearHiddenSince(), readHiddenSince() (+3 more)

### Community 76 - "api/export/route.ts"
Cohesion: 0.26
Nodes (10): proofreadExistingPdf(), exampleBlocks(), clean(), MAX_FLAGS_PER_CALL, OcrFlag, parseBox(), parseFlagLines(), splitFlagsBlock() (+2 more)

### Community 77 - "grants/route.ts"
Cohesion: 0.21
Nodes (12): CONVERSATION_FOLDER, conversationNoteFileName(), dateKey(), ExportedConversationRow, MAX_CONVERSATION_CHARS, renderConversationNote(), sanitizeFileName(), saveExportedConversation() (+4 more)

### Community 78 - "interruptedNotebookRecovery.test.ts"
Cohesion: 0.15
Nodes (8): CeMod, CwMod, DbMod, DiaryGraphPayload, GraphMod, MindMod, NotesMod, RelMod

### Community 79 - "relatedEntities.test.ts"
Cohesion: 0.22
Nodes (7): codeFrom(), consent(), exchange(), issueAccessToken(), Mod, pkce(), register()

### Community 80 - "chatDiary.ts"
Cohesion: 0.21
Nodes (11): dynamic, OPTIONS(), POST(), readBoundedJson(), runtime, RFC-7591, REGISTER_THROTTLE_BUCKET, MAX_DCR_BODY_BYTES (+3 more)

### Community 81 - "deploy"
Cohesion: 0.30
Nodes (11): dynamic, err(), OPTIONS(), POST(), readForm(), runtime, corsHeaders(), issueTokens() (+3 more)

### Community 82 - "decrypt-backup.mjs"
Cohesion: 0.21
Nodes (10): dynamic, POST(), runtime, dynamic, POST(), runtime, ANALYZE_DEFAULT_LIMIT, ANALYZE_MAX_LIMIT (+2 more)

### Community 83 - "authRoute.test.ts"
Cohesion: 0.18
Nodes (10): Block, CaptureArgs, cropPng(), Example, execFileAsync, FILES_DIR, MAX_EXAMPLES_TOTAL, MAX_PER_TEXT (+2 more)

### Community 84 - "topEntities.test.ts"
Cohesion: 0.33
Nodes (11): createPinGate(), attemptsLeft(), configured(), cookieKey(), lockRemainingMs(), makeUnlockToken(), pinMatches(), readFail() (+3 more)

### Community 85 - "diaryExportDb.test.ts"
Cohesion: 0.20
Nodes (7): ConversationWikiMod, DbMod, deferred(), DiaryExportDbMod, DropboxMod, mockDropboxFetch(), UploadCall

### Community 86 - "entityWriteAtomicity.test.ts"
Cohesion: 0.22
Nodes (8): dynamic, POST(), runtime, labelEmbeddingAxes(), parseAxisLabels(), encodeVec(), generateAxisLabels(), clean

### Community 87 - "pagesForEntity.test.ts"
Cohesion: 0.20
Nodes (5): AuthMod, DbMod, requestCookies, RouteMod, webauthn

### Community 89 - "librarian/route.ts"
Cohesion: 0.20
Nodes (5): ChatToolsMod, DbMod, MergeMod, NotesMod, Result

### Community 90 - "entityGraph.ts"
Cohesion: 0.22
Nodes (8): build, builder, dockerfilePath, deploy, restartPolicyMaxRetries, restartPolicyType, startCommand, $schema

### Community 91 - "scripts"
Cohesion: 0.22
Nodes (6): body, enc, iv, MAGIC, salt, tag

### Community 92 - "chatToolsLocation.test.ts"
Cohesion: 0.22
Nodes (4): ChatToolsMod, DbMod, MindMod, NotesMod

### Community 93 - "entityMerge.test.ts"
Cohesion: 0.32
Nodes (7): dynamic, GET(), LOCKED(), runtime, ProofreadingStats, proofreadingStats(), ResolveAction

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
Cohesion: 0.43
Nodes (6): dynamic, GET(), LOCKED(), POST(), runtime, setDisciplineEnabled()

### Community 99 - "chatMemoryRecall.test.ts"
Cohesion: 0.43
Nodes (6): dynamic, GET(), LOCKED(), POST(), runtime, setLocationEnabled()

### Community 100 - "chatMemoryRolling.test.ts"
Cohesion: 0.43
Nodes (6): dynamic, PATCH(), runtime, correctPageText(), learnFromEdit(), pageTextOf()

### Community 101 - "entityTagging.test.ts"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime

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
Cohesion: 0.40
Nodes (5): dynamic, GET(), LOCKED(), maxDuration, runtime

### Community 109 - "dropboxTombstone.test.ts"
Cohesion: 0.60
Nodes (5): composeHandwritingNotes(), maybeRefreshHandwritingNotes(), correctedPairsForNotes(), handwritingNotesDue(), saveHandwritingNotes()

### Community 110 - "embeddingMapDiscipline.test.ts"
Cohesion: 0.53
Nodes (4): strip(), tokens(), WordChange, wordChanges()

### Community 111 - "entityWikiExclude.test.ts"
Cohesion: 0.33
Nodes (3): ClaudeMod, CmMod, DbMod

### Community 112 - "ocrLearningDb.test.ts"
Cohesion: 0.33
Nodes (3): CmMod, DbMod, EmbMod

### Community 114 - "remarkableTombstone.test.ts"
Cohesion: 0.33
Nodes (5): ClaudeMod, CwMod, DbMod, EtMod, RwMod

### Community 115 - "mapPin.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, MindMod, NotesMod

### Community 116 - "next.config.mjs"
Cohesion: 0.33
Nodes (3): DbMod, DedupMod, NotesMod

### Community 117 - "tailwindcss"
Cohesion: 0.33
Nodes (3): Db, Review, Store

### Community 118 - "chatMemoryFlow.test.ts"
Cohesion: 0.50
Nodes (4): dynamic, GET(), LOCKED(), runtime

### Community 119 - "conversationEntities.test.ts"
Cohesion: 0.40
Nodes (4): eslint@^9.39.5, eslint-config-next@^16.3.2, eslint, eslint-config-next

### Community 120 - "dropboxStatus.test.ts"
Cohesion: 0.40
Nodes (4): CdMod, DbMod, MindMod, NotesMod

### Community 121 - "owntracksCurrent.test.ts"
Cohesion: 0.40
Nodes (3): CmMod, DbMod, EmbMod

### Community 123 - "entrypoint.sh"
Cohesion: 0.40
Nodes (4): DbMod, EmbMod, MindMod, NotesMod

### Community 124 - "rm2pdf"
Cohesion: 0.40
Nodes (3): ClaudeMod, DbMod, EwMod

### Community 125 - "postcss.config.mjs"
Cohesion: 0.40
Nodes (4): Db, L, Review, Store

### Community 126 - "ocrReviewDb.test.ts"
Cohesion: 0.40
Nodes (3): DbMod, NotesMod, SyncMod

### Community 127 - "relationshipExportReconcile.test.ts"
Cohesion: 0.50
Nodes (3): RFC-8414, RFC-9728, nextConfig

### Community 128 - "eslint"
Cohesion: 0.50
Nodes (3): tailwindcss@^3.4.13, tailwindcss, config

### Community 130 - "decisionEntities.test.ts"
Cohesion: 0.50
Nodes (3): DbMod, DeMod, DwMod

## Knowledge Gaps
- **6 isolated node(s):** `RFC-8414`, `RFC-9728`, `RFC-9728`, `RFC-8414`, `RFC-9728` (+1 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 875 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db()` connect `auth.ts` to `dropbox.ts`, `diaryExportDb.ts`, `remarkableCloud.ts`, `owntracks.ts`, `ocrLearning.ts`, `mcp.ts`, `diaryGraph.ts`, `app/page.tsx`, `notes.ts`, `MemoryPage`, `ref_fs`, `chatMemory.ts`, `db`, `memory/page.tsx`, `env`, `setSetting`, `notebooks/page.tsx`, `mind/page.tsx`, `embeddings.ts`, `decisionWiki.ts`, `isAuthenticated`, `getCurrentProfile`, `DiaryGraphClient.tsx`, `devDependencies`, `entityWiki.ts`, `ForceGraph`, `compilerOptions`, `insights/route.ts`, `db.ts`, `mcpOauth.ts`, `backfill-all/route.ts`, `graphify_gate.py`, `pendingShares.ts`, `package.json`, `maybeCompressChatSessions`, `vaultGraph.ts`, `authorize/route.ts`, `usage.ts`, `Map3D.tsx`, `manifest.json`, `analyzePending`, `next`, `mcp/route.ts`, `diaryGraph.test.ts`, `notebooks/[id]/pdf/route.ts`, `token/route.ts`, `mind/route.ts`, `createPinGate`, `dropboxExportLock.test.ts`, `api/export/route.ts`, `grants/route.ts`, `chatDiary.ts`, `deploy`, `decrypt-backup.mjs`, `authRoute.test.ts`, `entityWriteAtomicity.test.ts`, `entityMerge.test.ts`, `api/diary/route.ts`, `chatMemoryRolling.test.ts`, `eslint`, `dropboxTombstone.test.ts`, `chatMemoryFlow.test.ts`?**
  _High betweenness centrality (0.230) - this node is a cross-community bridge._
- **What connects `RFC-8414`, `RFC-9728`, `RFC-9728` to the rest of the system?**
  _6 weakly-connected nodes found - possible missing edges._
- **Should `dropbox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.056910569105691054 - nodes in this community are weakly interconnected._
- **Why does `next` connect `dropboxExportLock.test.ts` to `dropbox.ts`, `remarkableCloud.ts`, `owntracks.ts`, `ocrLearning.ts`, `mcp.ts`, `diaryGraph.ts`, `backup.ts`, `app/page.tsx`, `MemoryPage`, `ref_fs`, `db`, `quality`, `env`, `setSetting`, `mind.ts`, `discipline/route.ts`, `notebooks/route.ts`, `notebooks/page.tsx`, `mind/page.tsx`, `dependencies`, `decisionWiki.ts`, `reflectionWiki.ts`, `DiaryGraphClient.tsx`, `entityWiki.ts`, `ForceGraph`, `compilerOptions`, `notebooks/pin/route.ts`, `db.ts`, `mcpOauth.ts`, `pendingShares.ts`, `package.json`, `maybeCompressChatSessions`, `authorize/route.ts`, `usage/page.tsx`, `manifest.json`, `location.ts`, `register/route.ts`, `analyzePending`, `next`, `mcp/route.ts`, `notebooks/[id]/pdf/route.ts`, `token/route.ts`, `mind/route.ts`, `createPinGate`, `chatDiary.ts`, `deploy`, `decrypt-backup.mjs`, `entityWriteAtomicity.test.ts`, `pagesForEntity.test.ts`, `entityMerge.test.ts`, `api/diary/route.ts`, `chatMemoryExtract.test.ts`, `chatMemoryRecall.test.ts`, `chatMemoryRolling.test.ts`, `entityTagging.test.ts`, `correctPageText.test.ts`, `chatMemoryFlow.test.ts`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Should `diaryExportDb.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04891684136967156 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `graphify_gate.py` to `dropbox.ts`, `chatMemoryFlow.test.ts`, `decisionEntities.test.ts`, `owntracks.ts`, `ocrLearning.ts`, `owntracksCurrent.test.ts`, `diaryGraph.ts`, `backup.ts`, `mcp.ts`, `MemoryPage`, `remarkableSync.ts`, `ref_fs`, `auth.ts`, `chatMemory.ts`, `db`, `quality`, `mind/page.tsx`, `devDependencies`, `corsHeaders`, `entityMerge.ts`, `notebooks/pin/route.ts`, `pendingShares.ts`, `usage.ts`, `Map3D.tsx`, `usage/page.tsx`, `location.ts`, `next`, `mcp/route.ts`, `createPinGate`, `dropboxExportLock.test.ts`, `api/export/route.ts`, `interruptedNotebookRecovery.test.ts`, `relatedEntities.test.ts`, `diaryExportDb.test.ts`, `entityWriteAtomicity.test.ts`, `pagesForEntity.test.ts`, `memories/route.ts`, `librarian/route.ts`, `chatToolsLocation.test.ts`, `entityRelationships.test.ts`, `getTopEntities.test.ts`, `mcp.test.ts`, `notebookDedupDb.test.ts`, `ocrReviewDb.test.ts`, `relationshipExportReconcile.test.ts`, `duplicates/route.ts`, `eslint`, `embeddingMapDiscipline.test.ts`, `entityWikiExclude.test.ts`, `ocrLearningDb.test.ts`, `reflectionEntities.test.ts`, `remarkableTombstone.test.ts`, `mapPin.test.ts`, `next.config.mjs`, `tailwindcss`, `dropboxStatus.test.ts`, `owntracksCurrent.test.ts`, `session-start.sh`, `entrypoint.sh`, `rm2pdf`, `postcss.config.mjs`, `ocrReviewDb.test.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Should `remarkableCloud.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10106382978723404 - nodes in this community are weakly interconnected._