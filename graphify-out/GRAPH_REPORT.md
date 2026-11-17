# Graph Report - remarkabler  (2026-11-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2277 nodes · 6015 edges · 117 communities (105 shown, 12 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1cc8f292`
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
- next.config.mjs

## God Nodes (most connected - your core abstractions)
1. `db()` - 303 edges
2. `isAuthenticated()` - 137 edges
3. `vitest` - 89 edges
4. `next` - 81 edges
5. `getSetting()` - 73 edges
6. `setSetting()` - 66 edges
7. `MemoryPage()` - 42 edges
8. `runMaintenanceSweep()` - 34 edges
9. `callMcpTool()` - 30 edges
10. `clearSetting()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/register/route.ts → lib/mcpOauth.ts
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/authorization-server/route.ts → lib/mcpOauth.ts
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/protected-resource/route.ts → lib/mcpOauth.ts
- `GET()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/notebooks/duplicates/route.ts → lib/auth.ts
- `GET()` --calls--> `notebooksPinDenied()`  [EXTRACTED]
  app/api/notebooks/duplicates/route.ts → lib/notebooksPin.ts

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

## Communities (117 total, 12 thin omitted)

### Community 0 - "dropbox.ts"
Cohesion: 0.05
Nodes (82): dynamic, GET(), LOCKED(), maxDuration, runtime, dynamic, GET(), LOCKED() (+74 more)

### Community 1 - "diaryExportDb.ts"
Cohesion: 0.04
Nodes (46): vitest, findRouteFiles(), PUBLIC, CmMod, DbMod, EmbMod, ClaudeMod, CmMod (+38 more)

### Community 2 - "remarkableCloud.ts"
Cohesion: 0.06
Nodes (72): dynamic, GET(), runtime, dynamic, GET(), runtime, dynamic, POST() (+64 more)

### Community 3 - "owntracks.ts"
Cohesion: 0.05
Nodes (54): handler, MAX_DIARY_ENTRY_CHARS, recordLibrarianHeartbeat(), AUDIT_KEEP_ROWS, authFailures, callMcpTool(), COMPANION_GUIDANCE, configuredTokens() (+46 more)

### Community 4 - "ocrLearning.ts"
Cohesion: 0.07
Nodes (44): dynamic, POST(), runtime, dynamic, POST(), runtime, dynamic, POST() (+36 more)

### Community 5 - "mcp.ts"
Cohesion: 0.06
Nodes (39): ATTACHMENT_DIR, dynamic, GET(), runtime, DELETE(), dynamic, LOCKED(), runtime (+31 more)

### Community 6 - "diaryGraph.ts"
Cohesion: 0.07
Nodes (31): LockAllButton(), LINKS, Nav(), dynamic, Home(), LatestInsight, preview(), RecentNotebook (+23 more)

### Community 7 - "backup.ts"
Cohesion: 0.11
Nodes (38): dynamic, GET(), POST(), relyingParty(), runtime, AUTH_CHALLENGE_COOKIE, authFailKey(), AuthFailState (+30 more)

### Community 8 - "app/page.tsx"
Cohesion: 0.12
Nodes (34): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backupConfigured(), BackupStatus (+26 more)

### Community 9 - "chat/route.ts"
Cohesion: 0.07
Nodes (34): dynamic, LOCKED(), POST(), runtime, dynamic, LOCKED(), POST(), runtime (+26 more)

### Community 10 - "notes.ts"
Cohesion: 0.10
Nodes (35): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, dynamic, GET() (+27 more)

### Community 11 - "MemoryPage"
Cohesion: 0.09
Nodes (38): SavedDecisionRow, addEdge(), addEvidence(), buildDiaryGraph(), canonicalKey(), contentId(), ContentInfo, ContentKind (+30 more)

### Community 12 - "claude.ts"
Cohesion: 0.09
Nodes (30): Insight, InsightsPage(), copy(), download(), exportText(), generate(), load(), summarize() (+22 more)

### Community 13 - "remarkableSync.ts"
Cohesion: 0.08
Nodes (26): setPickingFile(), Mode, PinGate(), onChange(), post(), submit(), Card, OcrReview() (+18 more)

### Community 14 - "ref_fs"
Cohesion: 0.08
Nodes (31): CHAT_TOOLS, analyzeEntryContent(), AxisLabelResult, CHAT_MEMORY_EXTRACTION_GUIDANCE, cleanEntityWiki(), composeEntityWiki(), compressChatSession(), ENTITY_KIND_GUIDANCE (+23 more)

### Community 15 - "auth.ts"
Cohesion: 0.11
Nodes (31): dynamic, GET(), runtime, dynamic, GET(), isPlausiblePoint(), POST(), runtime (+23 more)

### Community 16 - "chatMemory.ts"
Cohesion: 0.08
Nodes (20): MemoryPage(), disconnectDropbox(), getPosition(), load(), loadBackup(), loadDisc(), loadDropbox(), loadEmbed() (+12 more)

### Community 17 - "db"
Cohesion: 0.09
Nodes (29): dynamic, PATCH(), runtime, correctPageText(), strip(), tokens(), WordChange, wordChanges() (+21 more)

### Community 18 - "quality"
Cohesion: 0.12
Nodes (30): dynamic, GET(), runtime, DELETE(), dynamic, GET(), LOCKED(), POST() (+22 more)

### Community 19 - "map/pin/route.ts"
Cohesion: 0.15
Nodes (28): countEntriesMentioning(), currentTimeKst(), executeTool(), ftsSearch(), getDaySummary(), getEntriesByDate(), getInsights(), getMonthSummary() (+20 more)

### Community 20 - "memory/page.tsx"
Cohesion: 0.12
Nodes (23): dynamic, GET(), POST(), runtime, unlocked(), attemptsLeft, gate, makeUnlockToken (+15 more)

### Community 21 - "env"
Cohesion: 0.14
Nodes (27): register(), ATTACHMENT_DIR, cleanupOrphanChatAttachments(), maybeCleanupOrphanAttachments(), setSetting(), claimNextQueuedNotebook(), drainNotebookProcessingQueue(), ensureProfileSeed() (+19 more)

### Community 22 - "setSetting"
Cohesion: 0.07
Nodes (27): concurrency, cancel-in-progress, group, CI, NEXT_TELEMETRY_DISABLED, jobs, quality, name (+19 more)

### Community 23 - "layout.tsx"
Cohesion: 0.11
Nodes (25): ATTACHMENT_DIR, DELETE(), dynamic, EXT, ext(), EXT_TO_MIME, GET(), IMAGE_TYPES (+17 more)

### Community 24 - "mind.ts"
Cohesion: 0.12
Nodes (25): dynamic, OPTIONS(), POST(), readBoundedJson(), runtime, auditRequest(), dynamic, guarded() (+17 more)

### Community 25 - "discipline/route.ts"
Cohesion: 0.16
Nodes (22): DELETE(), dynamic, GET(), LOCKED(), POST(), runtime, escapeHtml(), GET() (+14 more)

### Community 26 - "notebooks/route.ts"
Cohesion: 0.07
Nodes (26): COMMENT_BODY, COMMENT_URL, EVENT_NAME, GH_TOKEN, PR_NUMBER, REPO, if, runs-on (+18 more)

### Community 27 - "notebooks/page.tsx"
Cohesion: 0.18
Nodes (20): track(), clearSans, dynamic, metadata, RootLayout(), viewport, LockOffBanner(), friendly() (+12 more)

### Community 28 - "mind/page.tsx"
Cohesion: 0.11
Nodes (23): Block, CaptureArgs, captureExample(), Example, examplesAvailable(), execFileAsync, FILES_DIR, MAX_EXAMPLES_TOTAL (+15 more)

### Community 29 - "embeddings.ts"
Cohesion: 0.18
Nodes (23): dynamic, GET(), maxDuration, POST(), runtime, recallChatMemories(), reembedMissingMemories(), semanticSearch() (+15 more)

### Community 30 - "dependencies"
Cohesion: 0.18
Nodes (20): MapStayDto, MapView(), RoutePointDto, Data, fmt(), Gate, MapPage(), MapView (+12 more)

### Community 31 - "decisionWiki.ts"
Cohesion: 0.14
Nodes (23): AxisLabels, EmbeddingMap(), EntityRankings(), Heatmap(), HeatmapBucket, Map3D, MapPoint, MindData (+15 more)

### Community 32 - "reflectionWiki.ts"
Cohesion: 0.15
Nodes (22): extractEntryDate(), reparseAllEntryDates(), unlockRemarkableImport(), classifyReocr(), cursorValue(), diffRmPages(), foldPendingProfile(), IncrementalResult (+14 more)

### Community 33 - "isAuthenticated"
Cohesion: 0.14
Nodes (22): dynamic, GET(), LOCKED(), runtime, ConversationEntityInput, ensureConversationPage(), ensureConversationsNotebook(), getCombinedEntityWiki() (+14 more)

### Community 34 - "getCurrentProfile"
Cohesion: 0.17
Nodes (19): dynamic, fmtDate(), fmtDateTime(), fmtTime(), GET(), LOCKED(), maxDuration, runtime (+11 more)

### Community 35 - "DiaryGraphClient.tsx"
Cohesion: 0.16
Nodes (20): backfillTitles(), dynamic, GET(), LOCKED(), maxDuration, PATCH(), POST(), runtime (+12 more)

### Community 36 - "ref_path"
Cohesion: 0.13
Nodes (19): dynamic, LOCKED(), POST(), runtime, dynamic, LOCKED(), maxDuration, POST() (+11 more)

### Community 37 - "entityRelationships.ts"
Cohesion: 0.17
Nodes (20): DecisionEntityInput, ensureDecisionPage(), ensureDecisionsNotebook(), KINDS, tagDecisionEntities(), dateKey(), DECISION_FOLDER, decisionNoteFileName() (+12 more)

### Community 38 - "devDependencies"
Cohesion: 0.17
Nodes (20): REFLECTIONS_NOTEBOOK_ID, ensureReflectionPage(), ensureReflectionsNotebook(), KINDS, ReflectionEntityInput, tagReflectionEntities(), dateKey(), getReflectionByKey() (+12 more)

### Community 39 - "vitest"
Cohesion: 0.17
Nodes (16): dynamic, GET(), LOCKED(), POST(), runtime, dynamic, GET(), LOCKED() (+8 more)

### Community 40 - "entityWiki.ts"
Cohesion: 0.15
Nodes (3): main(), marker_path(), main()

### Community 41 - "ForceGraph"
Cohesion: 0.19
Nodes (19): clearSetting(), causeCodes(), DownloadedPage, downloadNotebook(), DownloadResult, filterNotebooks(), isTransientNetworkError(), listRemarkableNotebooks() (+11 more)

### Community 42 - "compilerOptions"
Cohesion: 0.10
Nodes (21): dependencies, better-sqlite3@^11.3.0, jszip@^3.10.1, leaflet@^1.9.4, mcp-handler@^1.1.0, next@^16.4.6, pdf-parse@^2.4.5, react@^19.2.8 (+13 more)

### Community 43 - "insights/route.ts"
Cohesion: 0.17
Nodes (18): dynamic, Kind, KINDS, maxDuration, POST(), postMergeDropbox(), runtime, findEntityDuplicates() (+10 more)

### Community 44 - "corsHeaders"
Cohesion: 0.14
Nodes (17): DiaryGraphClient(), EDGE_COLORS, EDGE_LABELS, EDGE_TYPES, formatGeneratedAt(), Inspector(), Metric(), metricLabel() (+9 more)

### Community 45 - "entityMerge.ts"
Cohesion: 0.11
Nodes (11): better-sqlite3, AuthMod, DbMod, AuthMod, DbMod, BackupMod, DbMod, DbMod (+3 more)

### Community 46 - "notebooks/pin/route.ts"
Cohesion: 0.14
Nodes (17): AuthCode, authCodes, ClientMetadataResult, ClientRegistrationMetadata, configuredSecrets(), consentSecretValid(), currentSecretHashes(), IssuedTokens (+9 more)

### Community 47 - "notebooksPinDenied"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.47, @types/better-sqlite3@^7.6.11, @types/d3-force@^3.0.10, @types/node@^22.7.4, @types/react@^19.2.18, @types/react-dom@^19.2.4 (+12 more)

### Community 48 - "entityTagging.ts"
Cohesion: 0.22
Nodes (17): dynamic, GET(), POST(), runtime, unlocked(), checkPasscode(), recordSuccessfulAuth(), gate (+9 more)

### Community 49 - "db.ts"
Cohesion: 0.13
Nodes (17): EntityPredicate, isEntityPredicate(), PREDICATE_LABELS, PREDICATES, CleanRelationshipInput, cleanRelationships(), EntityKind, getRelationshipsFor() (+9 more)

### Community 50 - "mcpOauth.ts"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 51 - "backfill-all/route.ts"
Cohesion: 0.17
Nodes (16): dynamic, maxDuration, POST(), runtime, EntityWikiExcerpt, candidates(), entityWikiAutoEnabled(), evenSample() (+8 more)

### Community 52 - "graphify_gate.py"
Cohesion: 0.26
Nodes (17): extractTaggingEntities(), wikiLinkingEnabled(), listUnlinkedConversations(), listUnlinkedDecisions(), autoTagConversation(), autoTagDecision(), autoTagExportsEnabled(), autoTagReflection() (+9 more)

### Community 53 - "pendingShares.ts"
Cohesion: 0.19
Nodes (16): backfillCandidates(), Candidate, estimateBackfill(), FILES_DIR, MAX_PER_RUN, NotebookResult, pdfPath(), PENDING_CAP (+8 more)

### Community 54 - "package.json"
Cohesion: 0.23
Nodes (13): modelMain(), ocrNotebookPdfWithFlags(), proofreadExistingPdf(), summarizeDay(), exampleBlocks(), maybeGenerateDailySummaries(), clean(), contextSnippet() (+5 more)

### Community 55 - "maybeCompressChatSessions"
Cohesion: 0.20
Nodes (11): ExistingRow, importRemarkableNotebookInner(), ImportResult, importsInFlight, ImportStatus, lockRemarkableImport(), execFileAsync, renderersAvailable() (+3 more)

### Community 56 - "vaultGraph.ts"
Cohesion: 0.12
Nodes (15): @anthropic-ai/sdk@^0.96.0, mammoth@^1.12.0, @modelcontextprotocol/sdk@^1.26.0, posthog-js@^1.374.3, @types/leaflet@^1.9.12, engines, node, name (+7 more)

### Community 57 - "authorize/route.ts"
Cohesion: 0.23
Nodes (11): dynamic, LOCKED(), POST(), runtime, BackfillMessage, CHUNK_TARGET_CHARS, chunkedBackfillForConversation(), chunkMessageIds() (+3 more)

### Community 58 - "usage.ts"
Cohesion: 0.22
Nodes (14): dynamic, GET(), LOCKED(), MemoryRow, runtime, compressBatch(), fetchRecentMemoryTexts(), isDuplicateMemory() (+6 more)

### Community 59 - "Map3D.tsx"
Cohesion: 0.20
Nodes (11): dynamic, GET(), runtime, DiaryGraphEdge, DiaryGraphNode, DiaryGraphPayload, VaultNoteKind, addVaultNotesToGraph() (+3 more)

### Community 60 - "usage/page.tsx"
Cohesion: 0.17
Nodes (13): dynamic, GET(), OPTIONS(), runtime, RFC-8414, dynamic, GET(), OPTIONS() (+5 more)

### Community 61 - "manifest.json"
Cohesion: 0.32
Nodes (14): consentForm(), destHost(), dynamic, esc(), GET(), OAuthParams, page(), POST() (+6 more)

### Community 62 - "location.ts"
Cohesion: 0.18
Nodes (14): ActiveLabel(), Axes(), AxisEndLabel(), AxisLabels, Map3D(), MapPoint, Point(), sentimentColour() (+6 more)

### Community 63 - "register/route.ts"
Cohesion: 0.13
Nodes (14): background_color, description, display, icons, name, files, share_target, action (+6 more)

### Community 64 - "analyzePending"
Cohesion: 0.24
Nodes (12): dynamic, GET(), runtime, dailyUsage(), FALLBACK, monthlyUsage(), Prices, PRICES (+4 more)

### Community 65 - "next"
Cohesion: 0.20
Nodes (13): CONVERSATION_FOLDER, conversationNoteFileName(), ExportedConversationRow, MAX_CONVERSATION_CHARS, renderConversationNote(), renderConversationNoteFiles(), sanitizeFileName(), saveExportedConversation() (+5 more)

### Community 66 - "mcp/route.ts"
Cohesion: 0.40
Nodes (11): AutoLock(), cancelPending(), lockNow(), markHiddenIfNeeded(), onPageHide(), onVisibility(), clearHiddenSince(), readHiddenSince() (+3 more)

### Community 67 - "AutoLock"
Cohesion: 0.31
Nodes (13): getSetting(), autoFixPages(), createPinGate(), attemptsLeft(), configured(), cookieKey(), lockRemainingMs(), makeUnlockToken() (+5 more)

### Community 68 - "diaryGraph.test.ts"
Cohesion: 0.15
Nodes (8): CeMod, CwMod, DbMod, DiaryGraphPayload, GraphMod, MindMod, NotesMod, RelMod

### Community 69 - "mcpOauth.test.ts"
Cohesion: 0.22
Nodes (7): codeFrom(), consent(), exchange(), issueAccessToken(), Mod, pkce(), register()

### Community 70 - "notebooks/[id]/pdf/route.ts"
Cohesion: 0.29
Nodes (11): dynamic, err(), OPTIONS(), POST(), readForm(), runtime, corsHeaders(), issueTokens() (+3 more)

### Community 71 - "token/route.ts"
Cohesion: 0.29
Nodes (10): ForceGraph(), draw(), fit(), hit(), loop(), onDown(), onMove(), onWheel() (+2 more)

### Community 72 - "mind/route.ts"
Cohesion: 0.20
Nodes (7): ConversationWikiMod, DbMod, deferred(), DiaryExportDbMod, DropboxMod, mockDropboxFetch(), UploadCall

### Community 73 - "createPinGate"
Cohesion: 0.20
Nodes (9): ForceEdgeInput, ForceNodeInput, Props, radiusFor(), SimLink, SimNode, Transform, d3-force@^3.0.1 (+1 more)

### Community 75 - "webauthn.ts"
Cohesion: 0.20
Nodes (5): ChatToolsMod, DbMod, MergeMod, NotesMod, Result

### Community 76 - "api/export/route.ts"
Cohesion: 0.33
Nodes (8): DELETE(), dynamic, GET(), runtime, requireAuth(), dropAuthCodesForClient(), listOAuthAudit(), revokeOAuthGrant()

### Community 77 - "grants/route.ts"
Cohesion: 0.33
Nodes (8): dynamic, LOCKED(), POST(), runtime, remarkableSyncStatus(), setSyncFolder(), syncFolderMap(), syncFolders()

### Community 78 - "interruptedNotebookRecovery.test.ts"
Cohesion: 0.33
Nodes (8): dynamic, GET(), LOCKED(), POST(), resolve(), runtime, Slot, SLOTS

### Community 79 - "relatedEntities.test.ts"
Cohesion: 0.22
Nodes (8): build, builder, dockerfilePath, deploy, restartPolicyMaxRetries, restartPolicyType, startCommand, $schema

### Community 80 - "chatDiary.ts"
Cohesion: 0.22
Nodes (6): body, enc, iv, MAGIC, salt, tag

### Community 81 - "deploy"
Cohesion: 0.22
Nodes (5): AuthMod, DbMod, requestCookies, RouteMod, webauthn

### Community 82 - "decrypt-backup.mjs"
Cohesion: 0.22
Nodes (4): ChatToolsMod, DbMod, MindMod, NotesMod

### Community 83 - "authRoute.test.ts"
Cohesion: 0.39
Nodes (7): dynamic, GET(), LOCKED(), POST(), runtime, isDisciplineEnabled(), setDisciplineEnabled()

### Community 84 - "topEntities.test.ts"
Cohesion: 0.25
Nodes (3): DbMod, ExportMod, NotesMod

### Community 86 - "entityWriteAtomicity.test.ts"
Cohesion: 0.25
Nodes (3): ChatToolsMod, DbMod, NotesMod

### Community 87 - "pagesForEntity.test.ts"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime

### Community 88 - "memories/route.ts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, test:watch

### Community 89 - "librarian/route.ts"
Cohesion: 0.29
Nodes (4): ChatToolsMod, DbMod, LocationMod, OwntracksMod

### Community 91 - "scripts"
Cohesion: 0.29
Nodes (4): CwMod, DbMod, MergeMod, RelMod

### Community 92 - "chatToolsLocation.test.ts"
Cohesion: 0.29
Nodes (3): DbMod, MindMod, NotesMod

### Community 93 - "entityMerge.test.ts"
Cohesion: 0.29
Nodes (3): ChatToolsMod, McpMod, RouteMod

### Community 94 - "entityRelationships.test.ts"
Cohesion: 0.40
Nodes (5): dynamic, LOCKED(), maxDuration, POST(), runtime

### Community 95 - "getTopEntities.test.ts"
Cohesion: 0.40
Nodes (5): dynamic, LOCKED(), maxDuration, POST(), runtime

### Community 96 - "mcp.test.ts"
Cohesion: 0.60
Nodes (5): composeHandwritingNotes(), maybeRefreshHandwritingNotes(), correctedPairsForNotes(), handwritingNotesDue(), saveHandwritingNotes()

### Community 98 - "chatMemoryExtract.test.ts"
Cohesion: 0.33
Nodes (5): ClaudeMod, CwMod, DbMod, EtMod, RwMod

### Community 99 - "chatMemoryRecall.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, MindMod, NotesMod

### Community 100 - "chatMemoryRolling.test.ts"
Cohesion: 0.33
Nodes (3): Db, Review, Store

### Community 101 - "entityTagging.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 102 - "mind.test.ts"
Cohesion: 0.40
Nodes (4): eslint@^9.39.5, eslint-config-next@^16.3.2, eslint, eslint-config-next

### Community 103 - "notebookDedupDb.test.ts"
Cohesion: 0.40
Nodes (4): CdMod, DbMod, MindMod, NotesMod

### Community 107 - "eslint"
Cohesion: 0.40
Nodes (4): DbMod, EmbMod, MindMod, NotesMod

### Community 108 - "correctPageText.test.ts"
Cohesion: 0.40
Nodes (4): CeMod, DbMod, ReMod, RwMod

### Community 109 - "dropboxTombstone.test.ts"
Cohesion: 0.40
Nodes (3): DbMod, NotesMod, SyncMod

### Community 110 - "embeddingMapDiscipline.test.ts"
Cohesion: 0.50
Nodes (3): RFC-8414, RFC-9728, nextConfig

### Community 111 - "entityWikiExclude.test.ts"
Cohesion: 0.50
Nodes (3): tailwindcss@^3.4.13, tailwindcss, config

## Knowledge Gaps
- **6 isolated node(s):** `RFC-8414`, `RFC-9728`, `RFC-7591`, `RFC-9728`, `RFC-8414` (+1 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 861 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db()` connect `usage.ts` to `dropbox.ts`, `remarkableCloud.ts`, `owntracks.ts`, `ocrLearning.ts`, `mcp.ts`, `diaryGraph.ts`, `backup.ts`, `app/page.tsx`, `chat/route.ts`, `notes.ts`, `MemoryPage`, `ref_fs`, `auth.ts`, `db`, `quality`, `map/pin/route.ts`, `env`, `layout.tsx`, `mind.ts`, `discipline/route.ts`, `mind/page.tsx`, `embeddings.ts`, `reflectionWiki.ts`, `isAuthenticated`, `getCurrentProfile`, `DiaryGraphClient.tsx`, `entityRelationships.ts`, `devDependencies`, `vitest`, `ForceGraph`, `insights/route.ts`, `entityMerge.ts`, `notebooks/pin/route.ts`, `db.ts`, `backfill-all/route.ts`, `graphify_gate.py`, `pendingShares.ts`, `package.json`, `maybeCompressChatSessions`, `authorize/route.ts`, `manifest.json`, `analyzePending`, `next`, `AutoLock`, `notebooks/[id]/pdf/route.ts`, `api/export/route.ts`, `entityMerge.test.ts`, `mcp.test.ts`?**
  _High betweenness centrality (0.221) - this node is a cross-community bridge._
- **What connects `RFC-8414`, `RFC-9728`, `RFC-7591` to the rest of the system?**
  _6 weakly-connected nodes found - possible missing edges._
- **Should `dropbox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Why does `next` connect `mcp.ts` to `dropbox.ts`, `diaryExportDb.ts`, `remarkableCloud.ts`, `ocrLearning.ts`, `diaryGraph.ts`, `backup.ts`, `app/page.tsx`, `chat/route.ts`, `notes.ts`, `claude.ts`, `auth.ts`, `db`, `quality`, `memory/page.tsx`, `layout.tsx`, `mind.ts`, `discipline/route.ts`, `notebooks/page.tsx`, `embeddings.ts`, `dependencies`, `decisionWiki.ts`, `isAuthenticated`, `getCurrentProfile`, `DiaryGraphClient.tsx`, `ref_path`, `vitest`, `compilerOptions`, `insights/route.ts`, `entityTagging.ts`, `backfill-all/route.ts`, `vaultGraph.ts`, `authorize/route.ts`, `usage.ts`, `Map3D.tsx`, `usage/page.tsx`, `manifest.json`, `analyzePending`, `notebooks/[id]/pdf/route.ts`, `api/export/route.ts`, `grants/route.ts`, `interruptedNotebookRecovery.test.ts`, `deploy`, `authRoute.test.ts`, `pagesForEntity.test.ts`, `entityRelationships.test.ts`, `getTopEntities.test.ts`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **Should `diaryExportDb.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.038559754851889685 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `diaryExportDb.ts` to `dropbox.ts`, `remarkableCloud.ts`, `ocrLearning.ts`, `mcp.ts`, `app/page.tsx`, `chat/route.ts`, `ref_fs`, `auth.ts`, `db`, `map/pin/route.ts`, `memory/page.tsx`, `discipline/route.ts`, `dependencies`, `reflectionWiki.ts`, `vitest`, `ForceGraph`, `entityMerge.ts`, `notebooksPinDenied`, `package.json`, `vaultGraph.ts`, `authorize/route.ts`, `Map3D.tsx`, `diaryGraph.test.ts`, `mcpOauth.test.ts`, `mind/route.ts`, `dropboxExportLock.test.ts`, `webauthn.ts`, `deploy`, `decrypt-backup.mjs`, `topEntities.test.ts`, `diaryExportDb.test.ts`, `entityWriteAtomicity.test.ts`, `librarian/route.ts`, `entityGraph.ts`, `scripts`, `chatToolsLocation.test.ts`, `entityMerge.test.ts`, `api/diary/route.ts`, `chatMemoryExtract.test.ts`, `chatMemoryRecall.test.ts`, `chatMemoryRolling.test.ts`, `entityTagging.test.ts`, `notebookDedupDb.test.ts`, `ocrReviewDb.test.ts`, `relationshipExportReconcile.test.ts`, `duplicates/route.ts`, `eslint`, `correctPageText.test.ts`, `dropboxTombstone.test.ts`, `ocrLearningDb.test.ts`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Should `remarkableCloud.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05737234652897304 - nodes in this community are weakly interconnected._