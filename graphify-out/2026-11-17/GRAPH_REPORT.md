# Graph Report - remarkabler  (2026-11-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2312 nodes · 6131 edges · 127 communities (117 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2389652c`
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
- owntracksCurrent.test.ts
- session-start.sh
- entrypoint.sh
- rm2pdf
- ocrReviewDb.test.ts

## God Nodes (most connected - your core abstractions)
1. `db()` - 313 edges
2. `isAuthenticated()` - 142 edges
3. `vitest` - 90 edges
4. `next` - 83 edges
5. `getSetting()` - 76 edges
6. `setSetting()` - 69 edges
7. `MemoryPage()` - 42 edges
8. `runMaintenanceSweep()` - 35 edges
9. `clearSetting()` - 30 edges
10. `callMcpTool()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/register/route.ts → lib/mcpOauth.ts
- `GET()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/export/diary/route.ts → lib/auth.ts
- `POST()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/remarkable/compare/route.ts → lib/auth.ts
- `postMergeDropbox()` --calls--> `entityStubRelPathForName()`  [EXTRACTED]
  app/api/mind/merge-entities/route.ts → lib/diaryExportDb.ts
- `GET()` --calls--> `findDuplicateCandidates()`  [EXTRACTED]
  app/api/notebooks/duplicates/route.ts → lib/notebookDedupDb.ts

## Import Cycles
- 2-file cycle: `lib/entityMerge.ts -> lib/mind.ts -> lib/entityMerge.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/claude.ts -> lib/chatTools.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/dropbox.ts -> lib/reflectionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/diaryExportDb.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts`
- 4-file cycle: `lib/conversationWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/conversationWiki.ts`
- 4-file cycle: `lib/decisionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/decisionWiki.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/mind.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/entityMerge.ts -> lib/claude.ts -> lib/chatTools.ts`
- 5-file cycle: `lib/conversationEntities.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts -> lib/conversationEntities.ts`
- 5-file cycle: `lib/diaryExportDb.ts -> lib/reflectionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts`
- 5-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/entityMerge.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 5-file cycle: `lib/conversationWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts -> lib/conversationWiki.ts`
- 5-file cycle: `lib/decisionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts -> lib/decisionWiki.ts`

## Communities (127 total, 10 thin omitted)

### Community 0 - "dropbox.ts"
Cohesion: 0.05
Nodes (80): dynamic, GET(), LOCKED(), maxDuration, runtime, dynamic, LOCKED(), maxDuration (+72 more)

### Community 1 - "diaryExportDb.ts"
Cohesion: 0.06
Nodes (75): dynamic, GET(), runtime, dynamic, GET(), runtime, dynamic, POST() (+67 more)

### Community 2 - "remarkableCloud.ts"
Cohesion: 0.05
Nodes (64): dynamic, GET(), OPTIONS(), runtime, RFC-8414, consentForm(), destHost(), dynamic (+56 more)

### Community 3 - "owntracks.ts"
Cohesion: 0.05
Nodes (57): handler, MAX_DIARY_ENTRY_CHARS, recordLibrarianHeartbeat(), AUDIT_KEEP_ROWS, authFailures, callMcpTool(), checkMcpAuth(), COMPANION_GUIDANCE (+49 more)

### Community 4 - "ocrLearning.ts"
Cohesion: 0.07
Nodes (44): dynamic, POST(), runtime, dynamic, POST(), runtime, dynamic, POST() (+36 more)

### Community 5 - "mcp.ts"
Cohesion: 0.07
Nodes (40): dynamic, LOCKED(), POST(), runtime, dynamic, LOCKED(), POST(), runtime (+32 more)

### Community 6 - "diaryGraph.ts"
Cohesion: 0.11
Nodes (37): POST(), dynamic, GET(), runtime, dynamic, GET(), isPlausiblePoint(), POST() (+29 more)

### Community 7 - "backup.ts"
Cohesion: 0.06
Nodes (22): CeMod, CwMod, DbMod, DbMod, Mod, DbMod, DeMod, DwMod (+14 more)

### Community 8 - "app/page.tsx"
Cohesion: 0.12
Nodes (34): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backupConfigured(), BackupStatus (+26 more)

### Community 9 - "chat/route.ts"
Cohesion: 0.07
Nodes (22): setPickingFile(), Card, OcrReview(), Stats, Estimate, OldDiaryProofread(), DuplicateCandidate, Gate (+14 more)

### Community 10 - "notes.ts"
Cohesion: 0.10
Nodes (27): LINKS, dynamic, Home(), LatestInsight, preview(), RecentNotebook, statusLabel(), DayCost (+19 more)

### Community 11 - "MemoryPage"
Cohesion: 0.08
Nodes (31): CHAT_TOOLS, analyzeEntryContent(), AxisLabelResult, CHAT_MEMORY_EXTRACTION_GUIDANCE, chatOverNotes(), cleanEntityWiki(), client(), compressChatSession() (+23 more)

### Community 12 - "claude.ts"
Cohesion: 0.09
Nodes (36): addEdge(), addEvidence(), buildDiaryGraph(), canonicalKey(), contentId(), ContentInfo, ContentKind, ContentStats (+28 more)

### Community 13 - "remarkableSync.ts"
Cohesion: 0.08
Nodes (20): MemoryPage(), disconnectDropbox(), getPosition(), load(), loadBackup(), loadDisc(), loadDropbox(), loadEmbed() (+12 more)

### Community 14 - "ref_fs"
Cohesion: 0.08
Nodes (35): dependencies, @anthropic-ai/sdk@^0.96.0, better-sqlite3@^11.3.0, jszip@^3.10.1, leaflet@^1.9.4, mammoth@^1.12.0, mcp-handler@^1.1.0, @modelcontextprotocol/sdk@^1.26.0 (+27 more)

### Community 15 - "auth.ts"
Cohesion: 0.10
Nodes (30): dynamic, GET(), LOCKED(), runtime, ConversationEntityInput, ensureConversationPage(), ensureConversationsNotebook(), getCombinedEntityWiki() (+22 more)

### Community 16 - "chatMemory.ts"
Cohesion: 0.18
Nodes (29): countEntriesMentioning(), currentTimeKst(), executeTool(), ftsSearch(), getDaySummary(), getEntriesByDate(), getInsights(), getMonthSummary() (+21 more)

### Community 17 - "db"
Cohesion: 0.14
Nodes (25): MapStayDto, MapView(), RoutePointDto, Data, fmt(), Gate, MapPage(), MapView (+17 more)

### Community 18 - "quality"
Cohesion: 0.13
Nodes (26): dynamic, GET(), POST(), runtime, unlocked(), checkPasscode(), isLockEnabled(), attemptsLeft (+18 more)

### Community 19 - "map/pin/route.ts"
Cohesion: 0.12
Nodes (25): dynamic, LOCKED(), POST(), runtime, unlockRemarkableImport(), classifyReocr(), cursorValue(), diffRmPages() (+17 more)

### Community 20 - "memory/page.tsx"
Cohesion: 0.07
Nodes (27): concurrency, cancel-in-progress, group, CI, NEXT_TELEMETRY_DISABLED, jobs, quality, name (+19 more)

### Community 21 - "env"
Cohesion: 0.12
Nodes (21): ChatMemoryItem, ChatMemorySection(), backfillAll(), load(), processPending(), remove(), retryStuck(), ChatMemoryStatus (+13 more)

### Community 22 - "setSetting"
Cohesion: 0.07
Nodes (26): COMMENT_BODY, COMMENT_URL, EVENT_NAME, GH_TOKEN, PR_NUMBER, REPO, if, runs-on (+18 more)

### Community 23 - "layout.tsx"
Cohesion: 0.12
Nodes (24): composeHandwritingNotes(), maybeRefreshHandwritingNotes(), applyFixes(), AUTOFIX_MIN, autoFixablePairs(), buildOcrHints(), confirmedTerms(), correctedPairs() (+16 more)

### Community 24 - "mind.ts"
Cohesion: 0.12
Nodes (21): dynamic, GET(), LOCKED(), POST(), runtime, dynamic, GET(), LOCKED() (+13 more)

### Community 25 - "discipline/route.ts"
Cohesion: 0.14
Nodes (23): AxisLabels, EmbeddingMap(), EntityRankings(), Heatmap(), HeatmapBucket, Map3D, MapPoint, MindData (+15 more)

### Community 26 - "notebooks/route.ts"
Cohesion: 0.08
Nodes (24): devDependencies, autoprefixer@^10.4.20, eslint@^9.39.5, eslint-config-next@^16.3.2, postcss@^8.4.47, @types/better-sqlite3@^7.6.11, @types/d3-force@^3.0.10, @types/node@^22.7.4 (+16 more)

### Community 27 - "notebooks/page.tsx"
Cohesion: 0.15
Nodes (23): register(), summarizeDay(), backfillEmbeddingsLoop(), claimNextQueuedNotebook(), countMissingEmbeddings(), drainNotebookProcessingQueue(), ensureProfileSeed(), FILES_DIR (+15 more)

### Community 28 - "mind/page.tsx"
Cohesion: 0.14
Nodes (23): resolveConversationEntityName(), updateConversationNotes(), entityStubWikiTarget(), REFLECTIONS_NOTEBOOK_ID, ensureReflectionPage(), ensureReflectionsNotebook(), KINDS, ReflectionEntityInput (+15 more)

### Community 29 - "embeddings.ts"
Cohesion: 0.12
Nodes (14): clearSans, dynamic, metadata, RootLayout(), viewport, LockAllButton(), LockOffBanner(), Nav() (+6 more)

### Community 30 - "dependencies"
Cohesion: 0.23
Nodes (19): track(), Insight, InsightsPage(), copy(), download(), exportText(), generate(), load() (+11 more)

### Community 31 - "decisionWiki.ts"
Cohesion: 0.17
Nodes (19): dynamic, GET(), POST(), relyingParty(), runtime, AUTH_CHALLENGE_COOKIE, challengeCookieOptions, consumeChallenge() (+11 more)

### Community 32 - "reflectionWiki.ts"
Cohesion: 0.15
Nodes (20): dynamic, OPTIONS(), POST(), readBoundedJson(), runtime, auditRequest(), dynamic, guarded() (+12 more)

### Community 33 - "isAuthenticated"
Cohesion: 0.20
Nodes (19): DELETE(), dynamic, GET(), LOCKED(), POST(), runtime, escapeHtml(), GET() (+11 more)

### Community 34 - "getCurrentProfile"
Cohesion: 0.16
Nodes (20): DecisionEntityInput, ensureDecisionPage(), ensureDecisionsNotebook(), KINDS, tagDecisionEntities(), dateKey(), DECISION_FOLDER, decisionNoteFileName() (+12 more)

### Community 35 - "DiaryGraphClient.tsx"
Cohesion: 0.12
Nodes (19): ATTACHMENT_DIR, DELETE(), dynamic, EXT, ext(), EXT_TO_MIME, GET(), IMAGE_TYPES (+11 more)

### Community 36 - "ref_path"
Cohesion: 0.22
Nodes (19): dynamic, GET(), maxDuration, POST(), runtime, recallChatMemories(), reembedMissingMemories(), semanticSearch() (+11 more)

### Community 37 - "entityRelationships.ts"
Cohesion: 0.18
Nodes (19): backfillTitles(), dynamic, GET(), LOCKED(), maxDuration, PATCH(), POST(), runtime (+11 more)

### Community 38 - "devDependencies"
Cohesion: 0.18
Nodes (18): dynamic, GET(), LOCKED(), runtime, dynamic, GET(), runtime, DELETE() (+10 more)

### Community 39 - "vitest"
Cohesion: 0.14
Nodes (18): dynamic, LOCKED(), POST(), runtime, dynamic, LOCKED(), maxDuration, POST() (+10 more)

### Community 40 - "entityWiki.ts"
Cohesion: 0.13
Nodes (18): DiaryGraphClient(), EDGE_COLORS, EDGE_LABELS, EDGE_TYPES, formatGeneratedAt(), Inspector(), Metric(), metricLabel() (+10 more)

### Community 41 - "ForceGraph"
Cohesion: 0.15
Nodes (3): main(), marker_path(), main()

### Community 42 - "compilerOptions"
Cohesion: 0.18
Nodes (19): causeCodes(), DownloadedPage, downloadNotebook(), DownloadResult, filterNotebooks(), isTransientNetworkError(), listRemarkableNotebooks(), ListResult (+11 more)

### Community 43 - "insights/route.ts"
Cohesion: 0.16
Nodes (13): dynamic, LOCKED(), POST(), runtime, BackfillMessage, CHUNK_TARGET_CHARS, chunkedBackfillForConversation(), chunkMessageIds() (+5 more)

### Community 44 - "corsHeaders"
Cohesion: 0.16
Nodes (18): dynamic, maxDuration, POST(), runtime, composeEntityWiki(), EntityWikiExcerpt, modelChat(), candidates() (+10 more)

### Community 45 - "entityMerge.ts"
Cohesion: 0.18
Nodes (19): authFailKey(), AuthFailState, bumpBucket(), createSessionToken(), getAuthFailState(), getRawAuthFailState(), passcodeLockRemainingMs(), pruneExpiredAuthFailBuckets() (+11 more)

### Community 46 - "notebooks/pin/route.ts"
Cohesion: 0.22
Nodes (17): CHAT_DIARY_NOTEBOOK_NAME, ensureChatDiaryNotebook(), nextPageIndex(), normaliseDate(), processChatDiaryEntry(), saveChatDiaryEntry(), updateSelfModel(), encodeEmbedding() (+9 more)

### Community 47 - "notebooksPinDenied"
Cohesion: 0.21
Nodes (19): ATTACHMENT_DIR, cleanupOrphanChatAttachments(), maybeCleanupOrphanAttachments(), getSetting(), setSetting(), maybeReconcileRelationshipExportRace(), autoFixPages(), createPinGate() (+11 more)

### Community 48 - "entityTagging.ts"
Cohesion: 0.13
Nodes (18): EntityPredicate, isEntityPredicate(), PREDICATE_LABELS, PREDICATES, CleanRelationshipInput, cleanRelationships(), EntityKind, getRelationshipsFor() (+10 more)

### Community 49 - "db.ts"
Cohesion: 0.20
Nodes (17): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, buildSelfModel(), BINARY_EXT (+9 more)

### Community 50 - "mcpOauth.ts"
Cohesion: 0.18
Nodes (17): dynamic, Kind, KINDS, maxDuration, POST(), postMergeDropbox(), runtime, findEntityDuplicates() (+9 more)

### Community 51 - "backfill-all/route.ts"
Cohesion: 0.11
Nodes (9): findRouteFiles(), PUBLIC, CleanupMod, DbMod, ClaudeMod, DbMod, EwMod, DbMod (+1 more)

### Community 52 - "graphify_gate.py"
Cohesion: 0.11
Nodes (7): vitest, DbMod, WikiMod, DbMod, Mod, AuthRouteMod, WebauthnMod

### Community 53 - "pendingShares.ts"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 54 - "package.json"
Cohesion: 0.24
Nodes (16): dynamic, GET(), LOCKED(), POST(), runtime, queueNotebookProcessing(), Cand, estimateRetranscribe() (+8 more)

### Community 55 - "maybeCompressChatSessions"
Cohesion: 0.26
Nodes (17): extractTaggingEntities(), wikiLinkingEnabled(), listUnlinkedConversations(), listUnlinkedDecisions(), autoTagConversation(), autoTagDecision(), autoTagExportsEnabled(), autoTagReflection() (+9 more)

### Community 56 - "vaultGraph.ts"
Cohesion: 0.22
Nodes (15): modelMain(), ocrNotebookPdf(), ocrNotebookPdfWithFlags(), parsePages(), proofreadExistingPdf(), exampleBlocks(), anchorPhrase(), clean() (+7 more)

### Community 57 - "authorize/route.ts"
Cohesion: 0.12
Nodes (11): recoverInterruptedNotebooks(), better-sqlite3, AuthMod, DbMod, AuthMod, DbMod, BackupMod, DbMod (+3 more)

### Community 58 - "usage.ts"
Cohesion: 0.18
Nodes (15): dynamic, PATCH(), runtime, captureExample(), correctPageText(), learnFromEdit(), pageTextOf(), recordLearned() (+7 more)

### Community 59 - "Map3D.tsx"
Cohesion: 0.25
Nodes (15): dynamic, GET(), POST(), runtime, unlocked(), gate, makeNotebooksUnlockToken, NOTEBOOKS_UNLOCK_COOKIE (+7 more)

### Community 60 - "usage/page.tsx"
Cohesion: 0.17
Nodes (16): cleanName(), createPendingShare(), filePath(), MAX_PENDING_BYTES, MAX_PENDING_SHARES, PENDING_DIR, PENDING_RETENTION_HOURS, PendingRow (+8 more)

### Community 61 - "manifest.json"
Cohesion: 0.21
Nodes (11): dynamic, GET(), runtime, DiaryGraphEdge, DiaryGraphPayload, VaultNoteKind, insightDropboxFolders(), addVaultNotesToGraph() (+3 more)

### Community 62 - "location.ts"
Cohesion: 0.18
Nodes (14): ActiveLabel(), Axes(), AxisEndLabel(), AxisLabels, Map3D(), MapPoint, Point(), sentimentColour() (+6 more)

### Community 63 - "register/route.ts"
Cohesion: 0.23
Nodes (12): createNotebook(), ExistingRow, importRemarkableNotebookInner(), ImportResult, importsInFlight, ImportStatus, lockRemarkableImport(), execFileAsync (+4 more)

### Community 64 - "analyzePending"
Cohesion: 0.25
Nodes (14): backfillCandidates(), Candidate, estimateBackfill(), FILES_DIR, MAX_PER_RUN, NotebookResult, pdfPath(), PENDING_CAP (+6 more)

### Community 65 - "next"
Cohesion: 0.13
Nodes (14): background_color, description, display, icons, name, files, share_target, action (+6 more)

### Community 66 - "mcp/route.ts"
Cohesion: 0.24
Nodes (12): dynamic, GET(), runtime, dailyUsage(), FALLBACK, monthlyUsage(), Prices, PRICES (+4 more)

### Community 67 - "AutoLock"
Cohesion: 0.18
Nodes (11): DELETE(), dynamic, LOCKED(), runtime, next, DbMod, NotesMod, pdf (+3 more)

### Community 68 - "diaryGraph.test.ts"
Cohesion: 0.31
Nodes (11): dynamic, fmtDate(), fmtDateTime(), fmtTime(), GET(), LOCKED(), maxDuration, runtime (+3 more)

### Community 69 - "mcpOauth.test.ts"
Cohesion: 0.26
Nodes (9): dynamic, GET(), LOCKED(), POST(), runtime, addLocation(), listRecentLocations(), recentLocationsContext() (+1 more)

### Community 70 - "notebooks/[id]/pdf/route.ts"
Cohesion: 0.40
Nodes (11): AutoLock(), cancelPending(), lockNow(), markHiddenIfNeeded(), onPageHide(), onVisibility(), clearHiddenSince(), readHiddenSince() (+3 more)

### Community 71 - "token/route.ts"
Cohesion: 0.18
Nodes (11): Block, CaptureArgs, cropPng(), Example, examplesAvailable(), execFileAsync, FILES_DIR, MAX_EXAMPLES_TOTAL (+3 more)

### Community 72 - "mind/route.ts"
Cohesion: 0.15
Nodes (8): CeMod, CwMod, DbMod, DiaryGraphPayload, GraphMod, MindMod, NotesMod, RelMod

### Community 73 - "createPinGate"
Cohesion: 0.20
Nodes (8): ATTACHMENT_DIR, dynamic, GET(), runtime, dynamic, GET(), LOCKED(), runtime

### Community 74 - "dropboxExportLock.test.ts"
Cohesion: 0.29
Nodes (10): ForceGraph(), draw(), fit(), hit(), loop(), onDown(), onMove(), onWheel() (+2 more)

### Community 75 - "webauthn.ts"
Cohesion: 0.20
Nodes (7): ConversationWikiMod, DbMod, deferred(), DiaryExportDbMod, DropboxMod, mockDropboxFetch(), UploadCall

### Community 76 - "api/export/route.ts"
Cohesion: 0.31
Nodes (9): DELETE(), dynamic, GET(), runtime, requireAuth(), clientIp(), dropAuthCodesForClient(), listOAuthAudit() (+1 more)

### Community 77 - "grants/route.ts"
Cohesion: 0.20
Nodes (9): ForceEdgeInput, ForceNodeInput, Props, radiusFor(), SimLink, SimNode, Transform, d3-force@^3.0.1 (+1 more)

### Community 78 - "interruptedNotebookRecovery.test.ts"
Cohesion: 0.20
Nodes (5): AuthMod, DbMod, requestCookies, RouteMod, webauthn

### Community 80 - "chatDiary.ts"
Cohesion: 0.20
Nodes (5): ChatToolsMod, DbMod, MergeMod, NotesMod, Result

### Community 81 - "deploy"
Cohesion: 0.36
Nodes (8): dynamic, GET(), hasNotes(), LOCKED(), maxDuration, POST(), runtime, getCurrentProfileRow()

### Community 82 - "decrypt-backup.mjs"
Cohesion: 0.31
Nodes (8): dynamic, GET(), LOCKED(), POST(), runtime, ProofreadingStats, proofreadingStats(), ResolveAction

### Community 83 - "authRoute.test.ts"
Cohesion: 0.33
Nodes (8): dynamic, GET(), LOCKED(), POST(), resolve(), runtime, Slot, SLOTS

### Community 84 - "topEntities.test.ts"
Cohesion: 0.22
Nodes (8): build, builder, dockerfilePath, deploy, restartPolicyMaxRetries, restartPolicyType, startCommand, $schema

### Community 85 - "diaryExportDb.test.ts"
Cohesion: 0.22
Nodes (6): body, enc, iv, MAGIC, salt, tag

### Community 86 - "entityWriteAtomicity.test.ts"
Cohesion: 0.22
Nodes (4): ChatToolsMod, DbMod, MindMod, NotesMod

### Community 87 - "pagesForEntity.test.ts"
Cohesion: 0.25
Nodes (3): DbMod, ExportMod, NotesMod

### Community 89 - "librarian/route.ts"
Cohesion: 0.25
Nodes (3): ChatToolsMod, DbMod, NotesMod

### Community 90 - "entityGraph.ts"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), MemoryRow, runtime, pendingBatchDetails()

### Community 91 - "scripts"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), maxDuration, runtime, composeBook()

### Community 92 - "chatToolsLocation.test.ts"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime

### Community 93 - "entityMerge.test.ts"
Cohesion: 0.38
Nodes (6): dynamic, LOCKED(), maxDuration, POST(), runtime, importRemarkableNotebook()

### Community 94 - "entityRelationships.test.ts"
Cohesion: 0.33
Nodes (6): MAX_FLAGS_PER_CALL, OcrFlag, clearPendingFlagsForNotebook(), saveOcrFlags(), norm(), rankCandidates()

### Community 95 - "getTopEntities.test.ts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, test:watch

### Community 96 - "mcp.test.ts"
Cohesion: 0.29
Nodes (4): ChatToolsMod, DbMod, LocationMod, OwntracksMod

### Community 98 - "chatMemoryExtract.test.ts"
Cohesion: 0.29
Nodes (4): CwMod, DbMod, MergeMod, RelMod

### Community 99 - "chatMemoryRecall.test.ts"
Cohesion: 0.29
Nodes (3): DbMod, MindMod, NotesMod

### Community 100 - "chatMemoryRolling.test.ts"
Cohesion: 0.29
Nodes (3): ChatToolsMod, McpMod, RouteMod

### Community 101 - "entityTagging.test.ts"
Cohesion: 0.40
Nodes (5): dynamic, Entry, GET(), LOCKED(), runtime

### Community 102 - "mind.test.ts"
Cohesion: 0.40
Nodes (5): dynamic, LOCKED(), maxDuration, POST(), runtime

### Community 103 - "notebookDedupDb.test.ts"
Cohesion: 0.53
Nodes (4): strip(), tokens(), WordChange, wordChanges()

### Community 104 - "ocrReviewDb.test.ts"
Cohesion: 0.33
Nodes (3): ClaudeMod, CmMod, DbMod

### Community 105 - "relationshipExportReconcile.test.ts"
Cohesion: 0.33
Nodes (3): CmMod, DbMod, EmbMod

### Community 107 - "eslint"
Cohesion: 0.33
Nodes (3): DbMod, MindMod, NotesMod

### Community 108 - "correctPageText.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, DedupMod, NotesMod

### Community 109 - "dropboxTombstone.test.ts"
Cohesion: 0.33
Nodes (3): Db, Review, Store

### Community 110 - "embeddingMapDiscipline.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 111 - "entityWikiExclude.test.ts"
Cohesion: 0.50
Nodes (4): dynamic, POST(), runtime, reparseAllEntryDates()

### Community 112 - "ocrLearningDb.test.ts"
Cohesion: 0.40
Nodes (4): CdMod, DbMod, MindMod, NotesMod

### Community 113 - "reflectionEntities.test.ts"
Cohesion: 0.40
Nodes (3): CmMod, DbMod, EmbMod

### Community 115 - "mapPin.test.ts"
Cohesion: 0.40
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 116 - "next.config.mjs"
Cohesion: 0.40
Nodes (4): DbMod, EmbMod, MindMod, NotesMod

### Community 117 - "tailwindcss"
Cohesion: 0.40
Nodes (4): Db, L, Review, Store

### Community 118 - "chatMemoryFlow.test.ts"
Cohesion: 0.40
Nodes (4): CeMod, DbMod, ReMod, RwMod

### Community 119 - "conversationEntities.test.ts"
Cohesion: 0.40
Nodes (3): DbMod, NotesMod, SyncMod

### Community 121 - "owntracksCurrent.test.ts"
Cohesion: 0.50
Nodes (3): RFC-8414, RFC-9728, nextConfig

### Community 122 - "session-start.sh"
Cohesion: 0.50
Nodes (3): tailwindcss@^3.4.13, tailwindcss, config

## Knowledge Gaps
- **6 isolated node(s):** `RFC-8414`, `RFC-9728`, `RFC-8414`, `RFC-9728`, `RFC-9728` (+1 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 876 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db()` connect `chatMemory.ts` to `dropbox.ts`, `diaryExportDb.ts`, `remarkableCloud.ts`, `owntracks.ts`, `ocrLearning.ts`, `mcp.ts`, `diaryGraph.ts`, `app/page.tsx`, `notes.ts`, `MemoryPage`, `claude.ts`, `auth.ts`, `map/pin/route.ts`, `layout.tsx`, `mind.ts`, `notebooks/page.tsx`, `mind/page.tsx`, `decisionWiki.ts`, `reflectionWiki.ts`, `isAuthenticated`, `getCurrentProfile`, `DiaryGraphClient.tsx`, `ref_path`, `entityRelationships.ts`, `devDependencies`, `insights/route.ts`, `corsHeaders`, `entityMerge.ts`, `notebooks/pin/route.ts`, `notebooksPinDenied`, `entityTagging.ts`, `db.ts`, `mcpOauth.ts`, `graphify_gate.py`, `package.json`, `maybeCompressChatSessions`, `vaultGraph.ts`, `authorize/route.ts`, `usage.ts`, `usage/page.tsx`, `register/route.ts`, `analyzePending`, `mcp/route.ts`, `AutoLock`, `diaryGraph.test.ts`, `mcpOauth.test.ts`, `token/route.ts`, `createPinGate`, `api/export/route.ts`, `deploy`, `decrypt-backup.mjs`, `entityGraph.ts`, `scripts`, `entityRelationships.test.ts`, `chatMemoryRolling.test.ts`, `entityTagging.test.ts`, `entityWikiExclude.test.ts`?**
  _High betweenness centrality (0.187) - this node is a cross-community bridge._
- **What connects `RFC-8414`, `RFC-9728`, `RFC-8414` to the rest of the system?**
  _6 weakly-connected nodes found - possible missing edges._
- **Should `dropbox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.052594670406732116 - nodes in this community are weakly interconnected._
- **Why does `next` connect `AutoLock` to `dropbox.ts`, `diaryExportDb.ts`, `remarkableCloud.ts`, `ocrLearning.ts`, `mcp.ts`, `diaryGraph.ts`, `backup.ts`, `app/page.tsx`, `notes.ts`, `ref_fs`, `auth.ts`, `db`, `quality`, `map/pin/route.ts`, `env`, `mind.ts`, `discipline/route.ts`, `embeddings.ts`, `decisionWiki.ts`, `reflectionWiki.ts`, `isAuthenticated`, `DiaryGraphClient.tsx`, `ref_path`, `entityRelationships.ts`, `devDependencies`, `vitest`, `insights/route.ts`, `corsHeaders`, `entityMerge.ts`, `db.ts`, `mcpOauth.ts`, `package.json`, `usage.ts`, `Map3D.tsx`, `manifest.json`, `mcp/route.ts`, `diaryGraph.test.ts`, `mcpOauth.test.ts`, `createPinGate`, `api/export/route.ts`, `interruptedNotebookRecovery.test.ts`, `deploy`, `decrypt-backup.mjs`, `authRoute.test.ts`, `entityGraph.ts`, `scripts`, `chatToolsLocation.test.ts`, `entityMerge.test.ts`, `entityTagging.test.ts`, `mind.test.ts`, `entityWikiExclude.test.ts`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Should `diaryExportDb.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05693664795509222 - nodes in this community are weakly interconnected._
- **Why does `isAuthenticated()` connect `mind.ts` to `dropbox.ts`, `diaryExportDb.ts`, `ocrLearning.ts`, `mcp.ts`, `diaryGraph.ts`, `app/page.tsx`, `auth.ts`, `chatMemory.ts`, `quality`, `map/pin/route.ts`, `embeddings.ts`, `decisionWiki.ts`, `isAuthenticated`, `DiaryGraphClient.tsx`, `ref_path`, `entityRelationships.ts`, `devDependencies`, `vitest`, `entityWiki.ts`, `insights/route.ts`, `corsHeaders`, `entityMerge.ts`, `db.ts`, `mcpOauth.ts`, `package.json`, `usage.ts`, `manifest.json`, `mcp/route.ts`, `AutoLock`, `diaryGraph.test.ts`, `mcpOauth.test.ts`, `createPinGate`, `api/export/route.ts`, `deploy`, `decrypt-backup.mjs`, `authRoute.test.ts`, `entityGraph.ts`, `scripts`, `chatToolsLocation.test.ts`, `entityMerge.test.ts`, `entityTagging.test.ts`, `mind.test.ts`, `entityWikiExclude.test.ts`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Should `remarkableCloud.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.052289815447710185 - nodes in this community are weakly interconnected._