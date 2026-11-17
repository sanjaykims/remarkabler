# Graph Report - remarkabler  (2026-11-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2253 nodes · 5963 edges · 131 communities (118 shown, 13 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2815e1b7`
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
- session-start.sh
- entrypoint.sh
- rm2pdf
- postcss.config.mjs
- postcss.config.mjs
- chatMemoryFlow.test.ts
- conversationEntities.test.ts
- dropboxStatus.test.ts
- owntracksCurrent.test.ts
- session-start.sh
- entrypoint.sh
- postcss.config.mjs

## God Nodes (most connected - your core abstractions)
1. `db()` - 300 edges
2. `isAuthenticated()` - 137 edges
3. `vitest` - 88 edges
4. `next` - 81 edges
5. `getSetting()` - 73 edges
6. `setSetting()` - 66 edges
7. `MemoryPage()` - 42 edges
8. `runMaintenanceSweep()` - 34 edges
9. `callMcpTool()` - 30 edges
10. `clearSetting()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/remarkable/connect/route.ts → lib/auth.ts
- `POST()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/remarkable/disconnect/route.ts → lib/auth.ts
- `POST()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/remarkable/refresh/route.ts → lib/auth.ts
- `GET()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/remarkable/status/route.ts → lib/auth.ts
- `GET()` --calls--> `remarkableSyncStatus()`  [EXTRACTED]
  app/api/remarkable/status/route.ts → lib/remarkableSync.ts

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

## Communities (131 total, 13 thin omitted)

### Community 0 - "dropbox.ts"
Cohesion: 0.06
Nodes (58): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, LOCKED(), POST() (+50 more)

### Community 1 - "diaryExportDb.ts"
Cohesion: 0.05
Nodes (55): handler, MAX_DIARY_ENTRY_CHARS, saveDecision(), getRelationshipsFor(), AUDIT_KEEP_ROWS, authFailures, callMcpTool(), COMPANION_GUIDANCE (+47 more)

### Community 2 - "remarkableCloud.ts"
Cohesion: 0.07
Nodes (42): CHAT_TOOLS, analyzeEntryContent(), AxisExtremeEntry, AxisLabelResult, AxisLabels, buildSelfModel(), CHAT_MEMORY_EXTRACTION_GUIDANCE, chatOverNotes() (+34 more)

### Community 3 - "owntracks.ts"
Cohesion: 0.11
Nodes (40): dynamic, GET(), POST(), relyingParty(), runtime, AUTH_CHALLENGE_COOKIE, authFailKey(), AuthFailState (+32 more)

### Community 4 - "ocrLearning.ts"
Cohesion: 0.07
Nodes (38): dynamic, LOCKED(), POST(), runtime, dynamic, LOCKED(), POST(), runtime (+30 more)

### Community 5 - "mcp.ts"
Cohesion: 0.09
Nodes (33): dynamic, GET(), POST(), runtime, unlocked(), DELETE(), dynamic, GET() (+25 more)

### Community 6 - "diaryGraph.ts"
Cohesion: 0.09
Nodes (35): dynamic, POST(), runtime, dynamic, GET(), reparseIfNeeded(), runtime, loadActiveMemoryEmbeddings() (+27 more)

### Community 7 - "backup.ts"
Cohesion: 0.11
Nodes (36): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, register(), BINARY_EXT (+28 more)

### Community 8 - "app/page.tsx"
Cohesion: 0.11
Nodes (35): CHAT_DIARY_NOTEBOOK_NAME, ensureChatDiaryNotebook(), nextPageIndex(), normaliseDate(), processChatDiaryEntry(), saveChatDiaryEntry(), updateSelfModel(), encodeEmbedding() (+27 more)

### Community 9 - "chat/route.ts"
Cohesion: 0.12
Nodes (34): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backupConfigured(), BackupStatus (+26 more)

### Community 10 - "notes.ts"
Cohesion: 0.09
Nodes (33): dynamic, PATCH(), runtime, composeHandwritingNotes(), maybeRefreshHandwritingNotes(), correctPageText(), strip(), tokens() (+25 more)

### Community 11 - "MemoryPage"
Cohesion: 0.10
Nodes (31): dynamic, GET(), LOCKED(), runtime, Candidate, FILES_DIR, MAX_PER_RUN, NotebookResult (+23 more)

### Community 12 - "claude.ts"
Cohesion: 0.09
Nodes (37): SavedDecisionRow, addEdge(), addEvidence(), buildDiaryGraph(), canonicalKey(), contentId(), ContentInfo, ContentKind (+29 more)

### Community 13 - "remarkableSync.ts"
Cohesion: 0.08
Nodes (26): setPickingFile(), Mode, PinGate(), onChange(), post(), submit(), Card, OcrReview() (+18 more)

### Community 14 - "ref_fs"
Cohesion: 0.08
Nodes (20): MemoryPage(), disconnectDropbox(), getPosition(), load(), loadBackup(), loadDisc(), loadDropbox(), loadEmbed() (+12 more)

### Community 15 - "auth.ts"
Cohesion: 0.16
Nodes (32): countEntriesMentioning(), currentTimeKst(), executeTool(), ftsSearch(), getDaySummary(), getEntriesByDate(), getInsights(), getMonthSummary() (+24 more)

### Community 16 - "chatMemory.ts"
Cohesion: 0.11
Nodes (29): ATTACHMENT_DIR, dynamic, GET(), runtime, dynamic, GET(), LOCKED(), runtime (+21 more)

### Community 17 - "db"
Cohesion: 0.11
Nodes (25): dynamic, Home(), LatestInsight, preview(), RecentNotebook, statusLabel(), DayCost, DayData (+17 more)

### Community 18 - "quality"
Cohesion: 0.07
Nodes (17): AuthMod, DbMod, DbMod, DeMod, DwMod, DbMod, Mod, DbMod (+9 more)

### Community 19 - "map/pin/route.ts"
Cohesion: 0.12
Nodes (28): buildDayFiles(), buildDiaryMarkdown(), buildEntityStubFiles(), buildHomeNote(), collectEntities(), countLine(), EnrichedRow, ENTITY_INDEX_FILE (+20 more)

### Community 20 - "memory/page.tsx"
Cohesion: 0.14
Nodes (25): dynamic, GET(), runtime, MapStayDto, MapView(), RoutePointDto, Data, fmt() (+17 more)

### Community 21 - "env"
Cohesion: 0.13
Nodes (26): ATTACHMENT_DIR, DELETE(), dynamic, EXT, ext(), EXT_TO_MIME, GET(), IMAGE_TYPES (+18 more)

### Community 22 - "setSetting"
Cohesion: 0.12
Nodes (25): dynamic, GET(), LOCKED(), maxDuration, runtime, backfillTitles(), dynamic, GET() (+17 more)

### Community 23 - "layout.tsx"
Cohesion: 0.07
Nodes (27): concurrency, cancel-in-progress, group, CI, NEXT_TELEMETRY_DISABLED, jobs, quality, name (+19 more)

### Community 24 - "mind.ts"
Cohesion: 0.15
Nodes (27): markConversationsFiled(), renderConversationNoteFiles(), unfiledConversationKeys(), markDecisionsFiled(), unfiledDecisionKeys(), affectedDayFileNames(), vaultStructureFileNames(), deleteDiaryExportFiles() (+19 more)

### Community 25 - "discipline/route.ts"
Cohesion: 0.12
Nodes (21): ChatMemoryItem, ChatMemorySection(), backfillAll(), load(), processPending(), remove(), retryStuck(), ChatMemoryStatus (+13 more)

### Community 26 - "notebooks/route.ts"
Cohesion: 0.07
Nodes (26): COMMENT_BODY, COMMENT_URL, EVENT_NAME, GH_TOKEN, PR_NUMBER, REPO, if, runs-on (+18 more)

### Community 27 - "notebooks/page.tsx"
Cohesion: 0.18
Nodes (20): track(), clearSans, dynamic, metadata, RootLayout(), viewport, LockOffBanner(), friendly() (+12 more)

### Community 28 - "mind/page.tsx"
Cohesion: 0.19
Nodes (25): allConversationNotesRows(), allConversationFileNames(), allDecisionFileNames(), buildEntityIndexNote(), buildProfileNote(), entityIndexFileName(), entityStubFileName(), sanitizeEntityName() (+17 more)

### Community 29 - "embeddings.ts"
Cohesion: 0.17
Nodes (21): DELETE(), dynamic, GET(), LOCKED(), POST(), runtime, escapeHtml(), GET() (+13 more)

### Community 30 - "dependencies"
Cohesion: 0.14
Nodes (23): AxisLabels, EmbeddingMap(), EntityRankings(), Heatmap(), HeatmapBucket, Map3D, MapPoint, MindData (+15 more)

### Community 31 - "decisionWiki.ts"
Cohesion: 0.18
Nodes (22): dynamic, GET(), maxDuration, POST(), runtime, recallChatMemories(), reembedMissingMemories(), semanticSearch() (+14 more)

### Community 32 - "reflectionWiki.ts"
Cohesion: 0.10
Nodes (19): DELETE(), dynamic, LOCKED(), runtime, dynamic, Entry, GET(), LOCKED() (+11 more)

### Community 33 - "isAuthenticated"
Cohesion: 0.17
Nodes (19): dynamic, GET(), isPlausiblePoint(), POST(), runtime, RoutePoint, addPoint(), analyzeGaps() (+11 more)

### Community 34 - "getCurrentProfile"
Cohesion: 0.17
Nodes (20): DecisionEntityInput, ensureDecisionPage(), ensureDecisionsNotebook(), KINDS, tagDecisionEntities(), dateKey(), DECISION_FOLDER, decisionNoteFileName() (+12 more)

### Community 35 - "DiaryGraphClient.tsx"
Cohesion: 0.16
Nodes (19): dynamic, GET(), LOCKED(), runtime, ConversationEntityInput, ensureConversationPage(), ensureConversationsNotebook(), getCombinedEntityWiki() (+11 more)

### Community 36 - "ref_path"
Cohesion: 0.16
Nodes (19): REFLECTIONS_NOTEBOOK_ID, ensureReflectionPage(), ensureReflectionsNotebook(), KINDS, ReflectionEntityInput, tagReflectionEntities(), dateKey(), markReflectionsLinked() (+11 more)

### Community 37 - "entityRelationships.ts"
Cohesion: 0.10
Nodes (21): dependencies, better-sqlite3@^11.3.0, jszip@^3.10.1, leaflet@^1.9.4, mcp-handler@^1.1.0, next@^16.4.6, pdf-parse@^2.4.5, react@^19.2.8 (+13 more)

### Community 38 - "devDependencies"
Cohesion: 0.18
Nodes (15): dynamic, GET(), LOCKED(), POST(), runtime, dynamic, GET(), LOCKED() (+7 more)

### Community 39 - "vitest"
Cohesion: 0.16
Nodes (18): dynamic, maxDuration, POST(), runtime, composeEntityWiki(), EntityWikiExcerpt, modelChat(), candidates() (+10 more)

### Community 40 - "entityWiki.ts"
Cohesion: 0.14
Nodes (17): DiaryGraphClient(), EDGE_COLORS, EDGE_LABELS, EDGE_TYPES, formatGeneratedAt(), Inspector(), Metric(), metricLabel() (+9 more)

### Community 41 - "ForceGraph"
Cohesion: 0.13
Nodes (18): getConversationByKey(), EntityPredicate, isEntityPredicate(), PREDICATE_LABELS, PREDICATES, CleanRelationshipInput, cleanRelationships(), EntityKind (+10 more)

### Community 42 - "compilerOptions"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.47, @types/better-sqlite3@^7.6.11, @types/d3-force@^3.0.10, @types/node@^22.7.4, @types/react@^19.2.18, @types/react-dom@^19.2.4 (+12 more)

### Community 43 - "insights/route.ts"
Cohesion: 0.18
Nodes (17): dynamic, Kind, KINDS, maxDuration, POST(), postMergeDropbox(), runtime, findEntityDuplicates() (+9 more)

### Community 44 - "corsHeaders"
Cohesion: 0.25
Nodes (18): extractTaggingEntities(), wikiLinkingEnabled(), listUnlinkedConversations(), listUnlinkedDecisions(), autoTagConversation(), autoTagDecision(), autoTagExportsEnabled(), autoTagReflection() (+10 more)

### Community 45 - "entityMerge.ts"
Cohesion: 0.11
Nodes (12): better-sqlite3, AuthMod, DbMod, BackupMod, DbMod, CdMod, DbMod, MindMod (+4 more)

### Community 46 - "notebooks/pin/route.ts"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 47 - "notebooksPinDenied"
Cohesion: 0.15
Nodes (13): dynamic, GET(), runtime, dynamic, GET(), runtime, recordLibrarianHeartbeat(), clearSetting() (+5 more)

### Community 48 - "entityTagging.ts"
Cohesion: 0.17
Nodes (16): dynamic, GET(), OPTIONS(), runtime, RFC-8414, dynamic, GET(), OPTIONS() (+8 more)

### Community 49 - "db.ts"
Cohesion: 0.14
Nodes (15): AuthCode, authCodes, ClientMetadataResult, ClientRegistrationMetadata, configuredSecrets(), consentSecretValid(), currentSecretHashes(), IssuedTokens (+7 more)

### Community 50 - "mcpOauth.ts"
Cohesion: 0.11
Nodes (12): vitest, findRouteFiles(), PUBLIC, CmMod, DbMod, EmbMod, DbModule, GeocodeModule (+4 more)

### Community 51 - "backfill-all/route.ts"
Cohesion: 0.25
Nodes (15): dynamic, GET(), POST(), runtime, unlocked(), gate, makeNotebooksUnlockToken, NOTEBOOKS_UNLOCK_COOKIE (+7 more)

### Community 52 - "graphify_gate.py"
Cohesion: 0.21
Nodes (3): main(), marker_path(), main()

### Community 53 - "pendingShares.ts"
Cohesion: 0.17
Nodes (16): cleanName(), createPendingShare(), filePath(), MAX_PENDING_BYTES, MAX_PENDING_SHARES, PENDING_DIR, PENDING_RETENTION_HOURS, PendingRow (+8 more)

### Community 54 - "package.json"
Cohesion: 0.20
Nodes (14): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, GET(), runtime (+6 more)

### Community 55 - "maybeCompressChatSessions"
Cohesion: 0.13
Nodes (7): ATTACHMENT_DIR, BackfillHelpers, DbMod, CleanupMod, DbMod, DbMod, Mod

### Community 56 - "vaultGraph.ts"
Cohesion: 0.27
Nodes (16): maybeCleanupOrphanAttachments(), getSetting(), setSetting(), maybeReconcileRelationshipExportRace(), autoFixPages(), createPinGate(), attemptsLeft(), configured() (+8 more)

### Community 57 - "authorize/route.ts"
Cohesion: 0.23
Nodes (15): deleteFile(), downloadFile(), dropboxApiArg(), DropboxApiError, getAccessToken(), ingestFolder(), ingestSkipFileIds(), isPollLevelError() (+7 more)

### Community 58 - "usage.ts"
Cohesion: 0.12
Nodes (15): @anthropic-ai/sdk@^0.96.0, mammoth@^1.12.0, @modelcontextprotocol/sdk@^1.26.0, posthog-js@^1.374.3, @types/leaflet@^1.9.12, engines, node, name (+7 more)

### Community 59 - "Map3D.tsx"
Cohesion: 0.20
Nodes (11): dynamic, GET(), runtime, DiaryGraphEdge, DiaryGraphNode, DiaryGraphPayload, VaultNoteKind, addVaultNotesToGraph() (+3 more)

### Community 60 - "usage/page.tsx"
Cohesion: 0.32
Nodes (14): consentForm(), destHost(), dynamic, esc(), GET(), OAuthParams, page(), POST() (+6 more)

### Community 61 - "manifest.json"
Cohesion: 0.21
Nodes (11): dynamic, LOCKED(), maxDuration, POST(), runtime, compareTranscriptions(), carryForwardDates(), DiaryPageRow (+3 more)

### Community 62 - "location.ts"
Cohesion: 0.22
Nodes (13): dynamic, GET(), runtime, dailyUsage(), FALLBACK, monthlyUsage(), priceFor(), Prices (+5 more)

### Community 63 - "register/route.ts"
Cohesion: 0.18
Nodes (14): ActiveLabel(), Axes(), AxisEndLabel(), AxisLabels, Map3D(), MapPoint, Point(), sentimentColour() (+6 more)

### Community 64 - "analyzePending"
Cohesion: 0.13
Nodes (14): background_color, description, display, icons, name, files, share_target, action (+6 more)

### Community 65 - "next"
Cohesion: 0.24
Nodes (10): dynamic, LOCKED(), POST(), runtime, BackfillMessage, CHUNK_TARGET_CHARS, chunkedBackfillForConversation(), chunkMessageIds() (+2 more)

### Community 66 - "mcp/route.ts"
Cohesion: 0.21
Nodes (13): dynamic, POST(), readBoundedJson(), runtime, RFC-7591, isThrottled(), recordAuthFailure(), REGISTER_THROTTLE_BUCKET (+5 more)

### Community 67 - "AutoLock"
Cohesion: 0.31
Nodes (11): dynamic, fmtDate(), fmtDateTime(), fmtTime(), GET(), LOCKED(), maxDuration, runtime (+3 more)

### Community 68 - "diaryGraph.test.ts"
Cohesion: 0.40
Nodes (11): AutoLock(), cancelPending(), lockNow(), markHiddenIfNeeded(), onPageHide(), onVisibility(), clearHiddenSince(), readHiddenSince() (+3 more)

### Community 69 - "mcpOauth.test.ts"
Cohesion: 0.21
Nodes (12): CONVERSATION_FOLDER, conversationNoteFileName(), dateKey(), ExportedConversationRow, MAX_CONVERSATION_CHARS, renderConversationNote(), sanitizeFileName(), saveExportedConversation() (+4 more)

### Community 70 - "notebooks/[id]/pdf/route.ts"
Cohesion: 0.15
Nodes (8): CeMod, CwMod, DbMod, DiaryGraphPayload, GraphMod, MindMod, NotesMod, RelMod

### Community 71 - "token/route.ts"
Cohesion: 0.22
Nodes (7): codeFrom(), consent(), exchange(), issueAccessToken(), Mod, pkce(), register()

### Community 72 - "mind/route.ts"
Cohesion: 0.23
Nodes (11): auditRequest(), dynamic, guarded(), maxDuration, runtime, RFC-9728, checkMcpAuth(), recordMcpAudit() (+3 more)

### Community 73 - "createPinGate"
Cohesion: 0.21
Nodes (10): dynamic, POST(), runtime, dynamic, POST(), runtime, ANALYZE_DEFAULT_LIMIT, ANALYZE_MAX_LIMIT (+2 more)

### Community 74 - "dropboxExportLock.test.ts"
Cohesion: 0.32
Nodes (9): effectiveDateKeys(), buildCandidate(), buildCloudCoverage(), classifyDuplicate(), CloudCoverage, DuplicateCandidate, DuplicateClassification, findDuplicateCandidates() (+1 more)

### Community 75 - "webauthn.ts"
Cohesion: 0.29
Nodes (10): dynamic, err(), POST(), readForm(), runtime, issueTokens(), pruneExpiredTokens(), redeemAuthCode() (+2 more)

### Community 76 - "api/export/route.ts"
Cohesion: 0.29
Nodes (10): ForceGraph(), draw(), fit(), hit(), loop(), onDown(), onMove(), onWheel() (+2 more)

### Community 77 - "grants/route.ts"
Cohesion: 0.29
Nodes (9): Insight, InsightsPage(), copy(), download(), exportText(), generate(), load(), summarize() (+1 more)

### Community 78 - "interruptedNotebookRecovery.test.ts"
Cohesion: 0.22
Nodes (6): LockAllButton(), LINKS, Nav(), DocWithVT, Props, TransitionLink()

### Community 79 - "relatedEntities.test.ts"
Cohesion: 0.20
Nodes (7): ConversationWikiMod, DbMod, deferred(), DiaryExportDbMod, DropboxMod, mockDropboxFetch(), UploadCall

### Community 80 - "chatDiary.ts"
Cohesion: 0.27
Nodes (7): dynamic, POST(), runtime, classifyDropboxError(), disconnectDropbox(), revokeAccessTokenAtDropbox(), safeDropboxError()

### Community 81 - "deploy"
Cohesion: 0.33
Nodes (9): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backfillCandidates(), estimateBackfill() (+1 more)

### Community 82 - "decrypt-backup.mjs"
Cohesion: 0.20
Nodes (9): ForceEdgeInput, ForceNodeInput, Props, radiusFor(), SimLink, SimNode, Transform, d3-force@^3.0.1 (+1 more)

### Community 84 - "topEntities.test.ts"
Cohesion: 0.20
Nodes (5): ChatToolsMod, DbMod, MergeMod, NotesMod, Result

### Community 85 - "diaryExportDb.test.ts"
Cohesion: 0.36
Nodes (8): dynamic, GET(), hasNotes(), LOCKED(), maxDuration, POST(), runtime, getCurrentProfileRow()

### Community 86 - "entityWriteAtomicity.test.ts"
Cohesion: 0.33
Nodes (8): dynamic, LOCKED(), POST(), runtime, remarkableSyncStatus(), setSyncFolder(), syncFolderMap(), syncFolders()

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
Nodes (7): ExtractResult, extractTextFromAttachment(), Mammoth, mammoth(), PdfParse, pdfParse(), shouldFallback()

### Community 93 - "entityMerge.test.ts"
Cohesion: 0.25
Nodes (3): DbMod, ExportMod, NotesMod

### Community 95 - "getTopEntities.test.ts"
Cohesion: 0.25
Nodes (3): ChatToolsMod, DbMod, NotesMod

### Community 96 - "mcp.test.ts"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), MemoryRow, runtime, pendingBatchDetails()

### Community 97 - "api/diary/route.ts"
Cohesion: 0.43
Nodes (6): dynamic, GET(), LOCKED(), POST(), runtime, setDisciplineEnabled()

### Community 98 - "chatMemoryExtract.test.ts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, test:watch

### Community 99 - "chatMemoryRecall.test.ts"
Cohesion: 0.29
Nodes (4): ChatToolsMod, DbMod, LocationMod, OwntracksMod

### Community 101 - "entityTagging.test.ts"
Cohesion: 0.29
Nodes (4): CwMod, DbMod, MergeMod, RelMod

### Community 102 - "mind.test.ts"
Cohesion: 0.29
Nodes (3): DbMod, MindMod, NotesMod

### Community 103 - "notebookDedupDb.test.ts"
Cohesion: 0.29
Nodes (3): ChatToolsMod, McpMod, RouteMod

### Community 104 - "ocrReviewDb.test.ts"
Cohesion: 0.40
Nodes (5): dynamic, GET(), LOCKED(), maxDuration, runtime

### Community 105 - "relationshipExportReconcile.test.ts"
Cohesion: 0.33
Nodes (3): ClaudeMod, CmMod, DbMod

### Community 106 - "duplicates/route.ts"
Cohesion: 0.33
Nodes (3): CmMod, DbMod, EmbMod

### Community 108 - "correctPageText.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, MindMod, NotesMod

### Community 109 - "dropboxTombstone.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, DedupMod, NotesMod

### Community 110 - "embeddingMapDiscipline.test.ts"
Cohesion: 0.33
Nodes (3): Db, Review, Store

### Community 111 - "entityWikiExclude.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 112 - "ocrLearningDb.test.ts"
Cohesion: 0.50
Nodes (4): dynamic, POST(), runtime, reparseAllEntryDates()

### Community 113 - "reflectionEntities.test.ts"
Cohesion: 0.40
Nodes (4): eslint@^9.39.5, eslint-config-next@^16.3.2, eslint, eslint-config-next

### Community 115 - "mapPin.test.ts"
Cohesion: 0.40
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 116 - "next.config.mjs"
Cohesion: 0.40
Nodes (4): DbMod, EmbMod, MindMod, NotesMod

### Community 117 - "tailwindcss"
Cohesion: 0.40
Nodes (3): ClaudeMod, DbMod, EwMod

### Community 118 - "session-start.sh"
Cohesion: 0.40
Nodes (4): Db, L, Review, Store

### Community 119 - "entrypoint.sh"
Cohesion: 0.40
Nodes (3): DbMod, NotesMod, SyncMod

### Community 121 - "postcss.config.mjs"
Cohesion: 0.50
Nodes (3): RFC-8414, RFC-9728, nextConfig

### Community 122 - "postcss.config.mjs"
Cohesion: 0.50
Nodes (3): tailwindcss@^3.4.13, tailwindcss, config

### Community 124 - "conversationEntities.test.ts"
Cohesion: 0.50
Nodes (3): CeMod, CwMod, DbMod

## Knowledge Gaps
- **6 isolated node(s):** `RFC-8414`, `RFC-9728`, `RFC-8414`, `RFC-9728`, `RFC-7591` (+1 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 851 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db()` connect `auth.ts` to `dropbox.ts`, `diaryExportDb.ts`, `remarkableCloud.ts`, `owntracks.ts`, `ocrLearning.ts`, `mcp.ts`, `diaryGraph.ts`, `backup.ts`, `app/page.tsx`, `chat/route.ts`, `notes.ts`, `MemoryPage`, `claude.ts`, `chatMemory.ts`, `db`, `memory/page.tsx`, `env`, `setSetting`, `mind.ts`, `mind/page.tsx`, `embeddings.ts`, `decisionWiki.ts`, `reflectionWiki.ts`, `isAuthenticated`, `getCurrentProfile`, `DiaryGraphClient.tsx`, `ref_path`, `devDependencies`, `vitest`, `ForceGraph`, `insights/route.ts`, `corsHeaders`, `entityMerge.ts`, `notebooksPinDenied`, `db.ts`, `pendingShares.ts`, `package.json`, `maybeCompressChatSessions`, `vaultGraph.ts`, `authorize/route.ts`, `usage/page.tsx`, `manifest.json`, `location.ts`, `next`, `mcp/route.ts`, `AutoLock`, `mcpOauth.test.ts`, `mind/route.ts`, `createPinGate`, `dropboxExportLock.test.ts`, `webauthn.ts`, `deploy`, `diaryExportDb.test.ts`, `mcp.test.ts`, `notebookDedupDb.test.ts`, `ocrLearningDb.test.ts`, `rm2pdf`?**
  _High betweenness centrality (0.205) - this node is a cross-community bridge._
- **What connects `RFC-8414`, `RFC-9728`, `RFC-8414` to the rest of the system?**
  _6 weakly-connected nodes found - possible missing edges._
- **Should `dropbox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05583972719522592 - nodes in this community are weakly interconnected._
- **Why does `next` connect `reflectionWiki.ts` to `dropbox.ts`, `owntracks.ts`, `ocrLearning.ts`, `mcp.ts`, `diaryGraph.ts`, `backup.ts`, `chat/route.ts`, `notes.ts`, `MemoryPage`, `chatMemory.ts`, `db`, `quality`, `memory/page.tsx`, `env`, `setSetting`, `discipline/route.ts`, `notebooks/page.tsx`, `embeddings.ts`, `dependencies`, `decisionWiki.ts`, `isAuthenticated`, `DiaryGraphClient.tsx`, `entityRelationships.ts`, `devDependencies`, `vitest`, `insights/route.ts`, `notebooksPinDenied`, `entityTagging.ts`, `backfill-all/route.ts`, `package.json`, `usage.ts`, `Map3D.tsx`, `usage/page.tsx`, `manifest.json`, `location.ts`, `next`, `mcp/route.ts`, `AutoLock`, `mind/route.ts`, `createPinGate`, `webauthn.ts`, `interruptedNotebookRecovery.test.ts`, `chatDiary.ts`, `deploy`, `diaryExportDb.test.ts`, `entityWriteAtomicity.test.ts`, `pagesForEntity.test.ts`, `entityGraph.ts`, `mcp.test.ts`, `api/diary/route.ts`, `ocrReviewDb.test.ts`, `ocrLearningDb.test.ts`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Should `diaryExportDb.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.046992481203007516 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `mcpOauth.ts` to `dropbox.ts`, `remarkableCloud.ts`, `ocrLearning.ts`, `mcp.ts`, `diaryGraph.ts`, `app/page.tsx`, `chat/route.ts`, `notes.ts`, `MemoryPage`, `auth.ts`, `quality`, `map/pin/route.ts`, `memory/page.tsx`, `embeddings.ts`, `reflectionWiki.ts`, `isAuthenticated`, `devDependencies`, `compilerOptions`, `entityMerge.ts`, `notebooksPinDenied`, `maybeCompressChatSessions`, `authorize/route.ts`, `usage.ts`, `Map3D.tsx`, `manifest.json`, `next`, `notebooks/[id]/pdf/route.ts`, `token/route.ts`, `dropboxExportLock.test.ts`, `relatedEntities.test.ts`, `chatDiary.ts`, `authRoute.test.ts`, `topEntities.test.ts`, `entityGraph.ts`, `scripts`, `entityMerge.test.ts`, `entityRelationships.test.ts`, `getTopEntities.test.ts`, `chatMemoryRecall.test.ts`, `chatMemoryRolling.test.ts`, `entityTagging.test.ts`, `mind.test.ts`, `notebookDedupDb.test.ts`, `relationshipExportReconcile.test.ts`, `duplicates/route.ts`, `eslint`, `correctPageText.test.ts`, `dropboxTombstone.test.ts`, `embeddingMapDiscipline.test.ts`, `entityWikiExclude.test.ts`, `remarkableTombstone.test.ts`, `mapPin.test.ts`, `next.config.mjs`, `tailwindcss`, `session-start.sh`, `entrypoint.sh`, `rm2pdf`, `chatMemoryFlow.test.ts`, `conversationEntities.test.ts`, `dropboxStatus.test.ts`, `owntracksCurrent.test.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Should `remarkableCloud.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07092198581560284 - nodes in this community are weakly interconnected._