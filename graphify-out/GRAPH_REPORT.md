# Graph Report - remarkabler  (2026-11-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2280 nodes · 6025 edges · 126 communities (113 shown, 13 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d70f5ada`
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
- postcss.config.mjs

## God Nodes (most connected - your core abstractions)
1. `db()` - 305 edges
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
- `POST()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/auth/route.ts → lib/auth.ts
- `POST()` --calls--> `clientIp()`  [EXTRACTED]
  app/api/auth/route.ts → lib/clientIp.ts
- `RootLayout()` --calls--> `isLockEnabled()`  [EXTRACTED]
  app/layout.tsx → lib/auth.ts
- `GET()` --calls--> `requireAuth()`  [EXTRACTED]
  app/api/notebooks/pin/route.ts → lib/auth.ts
- `POST()` --calls--> `requireAuth()`  [EXTRACTED]
  app/api/notebooks/pin/route.ts → lib/auth.ts

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

## Communities (126 total, 13 thin omitted)

### Community 0 - "dropbox.ts"
Cohesion: 0.05
Nodes (78): dynamic, GET(), POST(), relyingParty(), runtime, dynamic, GET(), POST() (+70 more)

### Community 1 - "diaryExportDb.ts"
Cohesion: 0.06
Nodes (67): dynamic, GET(), runtime, dynamic, GET(), runtime, dynamic, POST() (+59 more)

### Community 2 - "remarkableCloud.ts"
Cohesion: 0.05
Nodes (54): handler, MAX_DIARY_ENTRY_CHARS, CHAT_TOOLS, AUDIT_KEEP_ROWS, authFailures, callMcpTool(), COMPANION_GUIDANCE, configuredTokens() (+46 more)

### Community 3 - "owntracks.ts"
Cohesion: 0.08
Nodes (48): analyzeEntryContent(), AxisLabelResult, CHAT_MEMORY_EXTRACTION_GUIDANCE, chatOverNotes(), cleanEntityWiki(), client(), compareTranscriptions(), composeEntityWiki() (+40 more)

### Community 4 - "ocrLearning.ts"
Cohesion: 0.07
Nodes (44): dynamic, POST(), runtime, dynamic, POST(), runtime, dynamic, POST() (+36 more)

### Community 5 - "mcp.ts"
Cohesion: 0.09
Nodes (42): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, register(), buildSelfModel() (+34 more)

### Community 6 - "diaryGraph.ts"
Cohesion: 0.07
Nodes (31): LockAllButton(), LINKS, Nav(), dynamic, Home(), LatestInsight, preview(), RecentNotebook (+23 more)

### Community 7 - "backup.ts"
Cohesion: 0.09
Nodes (37): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, LOCKED(), POST() (+29 more)

### Community 8 - "app/page.tsx"
Cohesion: 0.12
Nodes (34): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backupConfigured(), BackupStatus (+26 more)

### Community 9 - "chat/route.ts"
Cohesion: 0.09
Nodes (32): Block, CaptureArgs, captureExample(), Example, examplesAvailable(), execFileAsync, FILES_DIR, MAX_EXAMPLES_TOTAL (+24 more)

### Community 10 - "notes.ts"
Cohesion: 0.07
Nodes (26): setPickingFile(), Mode, PinGate(), onChange(), post(), submit(), Card, OcrReview() (+18 more)

### Community 11 - "MemoryPage"
Cohesion: 0.09
Nodes (37): addEdge(), addEvidence(), buildDiaryGraph(), canonicalKey(), contentId(), ContentInfo, ContentKind, ContentStats (+29 more)

### Community 12 - "claude.ts"
Cohesion: 0.09
Nodes (32): dynamic, GET(), PATCH(), runtime, maybeRefreshHandwritingNotes(), strip(), tokens(), WordChange (+24 more)

### Community 13 - "remarkableSync.ts"
Cohesion: 0.08
Nodes (20): MemoryPage(), disconnectDropbox(), getPosition(), load(), loadBackup(), loadDisc(), loadDropbox(), loadEmbed() (+12 more)

### Community 14 - "ref_fs"
Cohesion: 0.11
Nodes (30): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, dynamic, GET() (+22 more)

### Community 15 - "auth.ts"
Cohesion: 0.07
Nodes (17): AuthMod, DbMod, DbMod, DeMod, DwMod, DbMod, Mod, DbMod (+9 more)

### Community 16 - "chatMemory.ts"
Cohesion: 0.14
Nodes (28): CHAT_DIARY_NOTEBOOK_NAME, ensureChatDiaryNotebook(), nextPageIndex(), normaliseDate(), processChatDiaryEntry(), saveChatDiaryEntry(), updateSelfModel(), encodeEmbedding() (+20 more)

### Community 17 - "db"
Cohesion: 0.12
Nodes (28): buildDayFiles(), buildDiaryMarkdown(), buildEntityStubFiles(), buildHomeNote(), collectEntities(), countLine(), EnrichedRow, ENTITY_INDEX_FILE (+20 more)

### Community 18 - "quality"
Cohesion: 0.14
Nodes (25): dynamic, GET(), runtime, MapStayDto, MapView(), RoutePointDto, Data, fmt() (+17 more)

### Community 19 - "map/pin/route.ts"
Cohesion: 0.20
Nodes (29): countEntriesMentioning(), currentTimeKst(), executeTool(), ftsSearch(), getDaySummary(), getEntriesByDate(), getInsights(), getMonthSummary() (+21 more)

### Community 20 - "memory/page.tsx"
Cohesion: 0.11
Nodes (26): BatchRow, buildTranscript(), CATEGORY_ALIASES, ChatMemoryCategory, ChatMemoryRowForDedup, compressBatch(), CompressBatchResult, DuplicateCheck (+18 more)

### Community 21 - "env"
Cohesion: 0.13
Nodes (26): ATTACHMENT_DIR, DELETE(), dynamic, EXT, ext(), EXT_TO_MIME, GET(), IMAGE_TYPES (+18 more)

### Community 22 - "setSetting"
Cohesion: 0.07
Nodes (27): concurrency, cancel-in-progress, group, CI, NEXT_TELEMETRY_DISABLED, jobs, quality, name (+19 more)

### Community 23 - "layout.tsx"
Cohesion: 0.11
Nodes (22): DELETE(), dynamic, LOCKED(), runtime, dynamic, Entry, GET(), LOCKED() (+14 more)

### Community 24 - "mind.ts"
Cohesion: 0.12
Nodes (21): ChatMemoryItem, ChatMemorySection(), backfillAll(), load(), processPending(), remove(), retryStuck(), ChatMemoryStatus (+13 more)

### Community 25 - "discipline/route.ts"
Cohesion: 0.07
Nodes (26): COMMENT_BODY, COMMENT_URL, EVENT_NAME, GH_TOKEN, PR_NUMBER, REPO, if, runs-on (+18 more)

### Community 26 - "notebooks/route.ts"
Cohesion: 0.19
Nodes (26): allConversationNotesRows(), allConversationFileNames(), allDecisionFileNames(), buildEntityIndexNote(), buildProfileNote(), entityIndexFileName(), entityStubFileName(), sanitizeEntityName() (+18 more)

### Community 27 - "notebooks/page.tsx"
Cohesion: 0.18
Nodes (20): track(), clearSans, dynamic, metadata, RootLayout(), viewport, LockOffBanner(), friendly() (+12 more)

### Community 28 - "mind/page.tsx"
Cohesion: 0.18
Nodes (22): DELETE(), dynamic, GET(), LOCKED(), POST(), runtime, escapeHtml(), GET() (+14 more)

### Community 29 - "embeddings.ts"
Cohesion: 0.14
Nodes (23): AxisLabels, EmbeddingMap(), EntityRankings(), Heatmap(), HeatmapBucket, Map3D, MapPoint, MindData (+15 more)

### Community 30 - "dependencies"
Cohesion: 0.15
Nodes (22): DecisionEntityInput, ensureDecisionPage(), ensureDecisionsNotebook(), KINDS, tagDecisionEntities(), dateKey(), DECISION_FOLDER, decisionNoteFileName() (+14 more)

### Community 31 - "decisionWiki.ts"
Cohesion: 0.11
Nodes (21): checkMcpAuth(), tokenMatches(), AuthCode, authCodes, ClientMetadataResult, ClientRegistrationMetadata, configuredSecrets(), consentSecretValid() (+13 more)

### Community 32 - "reflectionWiki.ts"
Cohesion: 0.09
Nodes (23): dependencies, better-sqlite3@^11.3.0, d3-force@^3.0.1, jszip@^3.10.1, mammoth@^1.12.0, mcp-handler@^1.1.0, next@^16.4.6, pdf-parse@^2.4.5 (+15 more)

### Community 33 - "isAuthenticated"
Cohesion: 0.17
Nodes (19): dynamic, GET(), isPlausiblePoint(), POST(), runtime, RoutePoint, addPoint(), analyzeGaps() (+11 more)

### Community 34 - "getCurrentProfile"
Cohesion: 0.17
Nodes (20): REFLECTIONS_NOTEBOOK_ID, ensureReflectionPage(), ensureReflectionsNotebook(), KINDS, ReflectionEntityInput, tagReflectionEntities(), dateKey(), getReflectionByKey() (+12 more)

### Community 35 - "DiaryGraphClient.tsx"
Cohesion: 0.18
Nodes (19): backfillTitles(), dynamic, GET(), LOCKED(), maxDuration, PATCH(), POST(), runtime (+11 more)

### Community 36 - "ref_path"
Cohesion: 0.16
Nodes (19): dynamic, GET(), LOCKED(), runtime, ConversationEntityInput, ensureConversationPage(), ensureConversationsNotebook(), getCombinedEntityWiki() (+11 more)

### Community 37 - "entityRelationships.ts"
Cohesion: 0.17
Nodes (19): dynamic, POST(), readBoundedJson(), runtime, auditRequest(), dynamic, guarded(), maxDuration (+11 more)

### Community 38 - "devDependencies"
Cohesion: 0.16
Nodes (16): dynamic, LOCKED(), maxDuration, POST(), runtime, ExistingRow, importRemarkableNotebook(), importRemarkableNotebookInner() (+8 more)

### Community 39 - "vitest"
Cohesion: 0.15
Nodes (3): main(), marker_path(), main()

### Community 40 - "entityWiki.ts"
Cohesion: 0.12
Nodes (19): getConversationByKey(), EntityPredicate, isEntityPredicate(), PREDICATE_LABELS, PREDICATES, CleanRelationshipInput, cleanRelationships(), EntityKind (+11 more)

### Community 41 - "ForceGraph"
Cohesion: 0.18
Nodes (15): dynamic, GET(), LOCKED(), POST(), runtime, dynamic, GET(), LOCKED() (+7 more)

### Community 42 - "compilerOptions"
Cohesion: 0.15
Nodes (18): dynamic, maxDuration, POST(), runtime, EntityWikiExcerpt, allEntityWikiRows(), candidates(), entityWikiAutoEnabled() (+10 more)

### Community 43 - "insights/route.ts"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.47, @types/better-sqlite3@^7.6.11, @types/d3-force@^3.0.10, @types/node@^22.7.4, @types/react@^19.2.18, @types/react-dom@^19.2.4 (+12 more)

### Community 44 - "corsHeaders"
Cohesion: 0.12
Nodes (15): ATTACHMENT_DIR, dynamic, GET(), runtime, dynamic, GET(), LOCKED(), runtime (+7 more)

### Community 45 - "entityMerge.ts"
Cohesion: 0.15
Nodes (17): dynamic, LOCKED(), POST(), runtime, dynamic, GET(), LOCKED(), runtime (+9 more)

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
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 50 - "mcpOauth.ts"
Cohesion: 0.24
Nodes (16): dynamic, GET(), maxDuration, POST(), runtime, reembedMissingMemories(), callVoyage(), embed() (+8 more)

### Community 51 - "backfill-all/route.ts"
Cohesion: 0.18
Nodes (13): dynamic, GET(), runtime, dynamic, GraphPage(), DiaryGraphPayload, VaultNoteKind, readDropboxTextFiles() (+5 more)

### Community 52 - "graphify_gate.py"
Cohesion: 0.17
Nodes (16): dynamic, GET(), OPTIONS(), runtime, RFC-8414, dynamic, GET(), OPTIONS() (+8 more)

### Community 53 - "pendingShares.ts"
Cohesion: 0.19
Nodes (16): dynamic, Kind, KINDS, maxDuration, POST(), postMergeDropbox(), runtime, dedupeAllEntities() (+8 more)

### Community 54 - "package.json"
Cohesion: 0.11
Nodes (12): vitest, findRouteFiles(), PUBLIC, CmMod, DbMod, EmbMod, DbModule, GeocodeModule (+4 more)

### Community 55 - "maybeCompressChatSessions"
Cohesion: 0.19
Nodes (13): dynamic, LOCKED(), POST(), runtime, createRollingBatch(), maybeRollConversationMemory(), BackfillMessage, CHUNK_TARGET_CHARS (+5 more)

### Community 56 - "vaultGraph.ts"
Cohesion: 0.26
Nodes (16): wikiLinkingEnabled(), listUnlinkedConversations(), listUnlinkedDecisions(), autoTagConversation(), autoTagDecision(), autoTagExportsEnabled(), autoTagReflection(), evenSample() (+8 more)

### Community 57 - "authorize/route.ts"
Cohesion: 0.17
Nodes (16): cleanName(), createPendingShare(), filePath(), MAX_PENDING_BYTES, MAX_PENDING_SHARES, PENDING_DIR, PENDING_RETENTION_HOURS, PendingRow (+8 more)

### Community 58 - "usage.ts"
Cohesion: 0.25
Nodes (14): dynamic, GET(), runtime, DELETE(), dynamic, GET(), LOCKED(), POST() (+6 more)

### Community 59 - "Map3D.tsx"
Cohesion: 0.13
Nodes (7): ATTACHMENT_DIR, BackfillHelpers, DbMod, CleanupMod, DbMod, DbMod, Mod

### Community 60 - "usage/page.tsx"
Cohesion: 0.27
Nodes (16): maybeCleanupOrphanAttachments(), getSetting(), setSetting(), maybeReconcileRelationshipExportRace(), autoFixPages(), createPinGate(), attemptsLeft(), configured() (+8 more)

### Community 61 - "manifest.json"
Cohesion: 0.12
Nodes (15): @anthropic-ai/sdk@^0.96.0, leaflet@^1.9.4, @modelcontextprotocol/sdk@^1.26.0, @types/leaflet@^1.9.12, zod@^4.4.3, engines, node, name (+7 more)

### Community 62 - "location.ts"
Cohesion: 0.19
Nodes (13): dynamic, LOCKED(), POST(), runtime, dynamic, LOCKED(), POST(), runtime (+5 more)

### Community 63 - "register/route.ts"
Cohesion: 0.32
Nodes (14): consentForm(), destHost(), dynamic, esc(), GET(), OAuthParams, page(), POST() (+6 more)

### Community 64 - "analyzePending"
Cohesion: 0.18
Nodes (14): ActiveLabel(), Axes(), AxisEndLabel(), AxisLabels, Map3D(), MapPoint, Point(), sentimentColour() (+6 more)

### Community 65 - "next"
Cohesion: 0.13
Nodes (14): background_color, description, display, icons, name, files, share_target, action (+6 more)

### Community 66 - "mcp/route.ts"
Cohesion: 0.22
Nodes (10): dynamic, LOCKED(), maxDuration, POST(), runtime, carryForwardDates(), DiaryPageRow, compareImportedNotebook() (+2 more)

### Community 67 - "AutoLock"
Cohesion: 0.31
Nodes (11): dynamic, fmtDate(), fmtDateTime(), fmtTime(), GET(), LOCKED(), maxDuration, runtime (+3 more)

### Community 68 - "diaryGraph.test.ts"
Cohesion: 0.40
Nodes (11): AutoLock(), cancelPending(), lockNow(), markHiddenIfNeeded(), onPageHide(), onVisibility(), clearHiddenSince(), readHiddenSince() (+3 more)

### Community 69 - "mcpOauth.test.ts"
Cohesion: 0.23
Nodes (12): CONVERSATION_FOLDER, conversationNoteFileName(), dateKey(), ExportedConversationRow, MAX_CONVERSATION_CHARS, renderConversationNote(), renderConversationNoteFiles(), sanitizeFileName() (+4 more)

### Community 70 - "notebooks/[id]/pdf/route.ts"
Cohesion: 0.28
Nodes (10): effectiveDateKeys(), isDatedEntry(), buildCandidate(), buildCloudCoverage(), classifyDuplicate(), CloudCoverage, DuplicateCandidate, DuplicateClassification (+2 more)

### Community 71 - "token/route.ts"
Cohesion: 0.15
Nodes (8): CeMod, CwMod, DbMod, DiaryGraphPayload, GraphMod, MindMod, NotesMod, RelMod

### Community 72 - "mind/route.ts"
Cohesion: 0.22
Nodes (7): codeFrom(), consent(), exchange(), issueAccessToken(), Mod, pkce(), register()

### Community 73 - "createPinGate"
Cohesion: 0.29
Nodes (10): dynamic, err(), POST(), readForm(), runtime, issueTokens(), pruneExpiredTokens(), redeemAuthCode() (+2 more)

### Community 74 - "dropboxExportLock.test.ts"
Cohesion: 0.27
Nodes (10): dynamic, GET(), LOCKED(), POST(), resolve(), runtime, Slot, SLOTS (+2 more)

### Community 75 - "webauthn.ts"
Cohesion: 0.29
Nodes (9): Insight, InsightsPage(), copy(), download(), exportText(), generate(), load(), summarize() (+1 more)

### Community 76 - "api/export/route.ts"
Cohesion: 0.20
Nodes (7): ConversationWikiMod, DbMod, deferred(), DiaryExportDbMod, DropboxMod, mockDropboxFetch(), UploadCall

### Community 77 - "grants/route.ts"
Cohesion: 0.31
Nodes (9): DELETE(), dynamic, GET(), runtime, requireAuth(), dropAuthCodesForClient(), listOAuthAudit(), listOAuthGrants() (+1 more)

### Community 78 - "interruptedNotebookRecovery.test.ts"
Cohesion: 0.31
Nodes (9): dynamic, GET(), LOCKED(), POST(), runtime, ProofreadingStats, proofreadingStats(), listReviewCards() (+1 more)

### Community 80 - "chatDiary.ts"
Cohesion: 0.20
Nodes (5): ChatToolsMod, DbMod, MergeMod, NotesMod, Result

### Community 81 - "deploy"
Cohesion: 0.36
Nodes (8): dynamic, GET(), hasNotes(), LOCKED(), maxDuration, POST(), runtime, getCurrentProfileRow()

### Community 82 - "decrypt-backup.mjs"
Cohesion: 0.22
Nodes (8): build, builder, dockerfilePath, deploy, restartPolicyMaxRetries, restartPolicyType, startCommand, $schema

### Community 83 - "authRoute.test.ts"
Cohesion: 0.22
Nodes (6): body, enc, iv, MAGIC, salt, tag

### Community 84 - "topEntities.test.ts"
Cohesion: 0.22
Nodes (5): AuthMod, DbMod, requestCookies, RouteMod, webauthn

### Community 85 - "diaryExportDb.test.ts"
Cohesion: 0.22
Nodes (4): ChatToolsMod, DbMod, MindMod, NotesMod

### Community 86 - "entityWriteAtomicity.test.ts"
Cohesion: 0.36
Nodes (7): ExtractResult, extractTextFromAttachment(), Mammoth, mammoth(), PdfParse, pdfParse(), shouldFallback()

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
Nodes (6): dynamic, GET(), LOCKED(), maxDuration, runtime, renderDiaryMarkdown()

### Community 93 - "entityMerge.test.ts"
Cohesion: 0.38
Nodes (4): computeRelatedEntities(), DayMembership, EntityKind, RelatedEntity

### Community 94 - "entityRelationships.test.ts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, test:watch

### Community 95 - "getTopEntities.test.ts"
Cohesion: 0.29
Nodes (4): ChatToolsMod, DbMod, LocationMod, OwntracksMod

### Community 97 - "api/diary/route.ts"
Cohesion: 0.29
Nodes (4): CwMod, DbMod, MergeMod, RelMod

### Community 98 - "chatMemoryExtract.test.ts"
Cohesion: 0.29
Nodes (3): DbMod, MindMod, NotesMod

### Community 99 - "chatMemoryRecall.test.ts"
Cohesion: 0.29
Nodes (3): ChatToolsMod, McpMod, RouteMod

### Community 100 - "chatMemoryRolling.test.ts"
Cohesion: 0.33
Nodes (3): ClaudeMod, CmMod, DbMod

### Community 101 - "entityTagging.test.ts"
Cohesion: 0.33
Nodes (3): CmMod, DbMod, EmbMod

### Community 103 - "notebookDedupDb.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, MindMod, NotesMod

### Community 104 - "ocrReviewDb.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, DedupMod, NotesMod

### Community 105 - "relationshipExportReconcile.test.ts"
Cohesion: 0.33
Nodes (3): Db, Review, Store

### Community 106 - "duplicates/route.ts"
Cohesion: 0.33
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 107 - "eslint"
Cohesion: 0.50
Nodes (4): dynamic, GET(), LOCKED(), runtime

### Community 108 - "correctPageText.test.ts"
Cohesion: 0.40
Nodes (4): eslint@^9.39.5, eslint-config-next@^16.3.2, eslint, eslint-config-next

### Community 110 - "embeddingMapDiscipline.test.ts"
Cohesion: 0.40
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 111 - "entityWikiExclude.test.ts"
Cohesion: 0.40
Nodes (4): DbMod, EmbMod, MindMod, NotesMod

### Community 112 - "ocrLearningDb.test.ts"
Cohesion: 0.40
Nodes (3): ClaudeMod, DbMod, EwMod

### Community 113 - "reflectionEntities.test.ts"
Cohesion: 0.40
Nodes (4): Db, L, Review, Store

### Community 114 - "remarkableTombstone.test.ts"
Cohesion: 0.40
Nodes (3): DbMod, NotesMod, SyncMod

### Community 116 - "next.config.mjs"
Cohesion: 0.50
Nodes (3): RFC-8414, RFC-9728, nextConfig

### Community 117 - "tailwindcss"
Cohesion: 0.50
Nodes (3): tailwindcss@^3.4.13, tailwindcss, config

### Community 119 - "conversationEntities.test.ts"
Cohesion: 0.50
Nodes (3): CeMod, CwMod, DbMod

## Knowledge Gaps
- **6 isolated node(s):** `RFC-8414`, `RFC-9728`, `RFC-9728`, `RFC-7591`, `RFC-8414` (+1 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 862 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db()` connect `map/pin/route.ts` to `dropbox.ts`, `diaryExportDb.ts`, `remarkableCloud.ts`, `owntracks.ts`, `ocrLearning.ts`, `mcp.ts`, `diaryGraph.ts`, `app/page.tsx`, `chat/route.ts`, `MemoryPage`, `claude.ts`, `ref_fs`, `chatMemory.ts`, `quality`, `memory/page.tsx`, `env`, `layout.tsx`, `notebooks/route.ts`, `mind/page.tsx`, `dependencies`, `decisionWiki.ts`, `isAuthenticated`, `getCurrentProfile`, `DiaryGraphClient.tsx`, `ref_path`, `entityRelationships.ts`, `devDependencies`, `entityWiki.ts`, `ForceGraph`, `compilerOptions`, `corsHeaders`, `entityMerge.ts`, `entityTagging.ts`, `mcpOauth.ts`, `pendingShares.ts`, `maybeCompressChatSessions`, `vaultGraph.ts`, `authorize/route.ts`, `usage.ts`, `Map3D.tsx`, `usage/page.tsx`, `location.ts`, `register/route.ts`, `mcp/route.ts`, `AutoLock`, `mcpOauth.test.ts`, `notebooks/[id]/pdf/route.ts`, `createPinGate`, `dropboxExportLock.test.ts`, `grants/route.ts`, `interruptedNotebookRecovery.test.ts`, `deploy`, `entityGraph.ts`, `scripts`, `chatMemoryRecall.test.ts`, `mapPin.test.ts`?**
  _High betweenness centrality (0.223) - this node is a cross-community bridge._
- **What connects `RFC-8414`, `RFC-9728`, `RFC-9728` to the rest of the system?**
  _6 weakly-connected nodes found - possible missing edges._
- **Should `dropbox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05231724796942188 - nodes in this community are weakly interconnected._
- **Why does `next` connect `corsHeaders` to `dropbox.ts`, `diaryExportDb.ts`, `ocrLearning.ts`, `mcp.ts`, `diaryGraph.ts`, `backup.ts`, `app/page.tsx`, `claude.ts`, `ref_fs`, `auth.ts`, `quality`, `env`, `layout.tsx`, `mind.ts`, `notebooks/page.tsx`, `mind/page.tsx`, `embeddings.ts`, `reflectionWiki.ts`, `isAuthenticated`, `DiaryGraphClient.tsx`, `ref_path`, `entityRelationships.ts`, `devDependencies`, `ForceGraph`, `compilerOptions`, `entityMerge.ts`, `mcpOauth.ts`, `backfill-all/route.ts`, `graphify_gate.py`, `pendingShares.ts`, `maybeCompressChatSessions`, `usage.ts`, `manifest.json`, `location.ts`, `register/route.ts`, `mcp/route.ts`, `AutoLock`, `createPinGate`, `dropboxExportLock.test.ts`, `grants/route.ts`, `interruptedNotebookRecovery.test.ts`, `deploy`, `topEntities.test.ts`, `entityGraph.ts`, `scripts`, `chatToolsLocation.test.ts`, `eslint`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **Should `diaryExportDb.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05569620253164557 - nodes in this community are weakly interconnected._
- **Why does `isAuthenticated()` connect `layout.tsx` to `dropbox.ts`, `diaryExportDb.ts`, `ocrLearning.ts`, `mcp.ts`, `backup.ts`, `app/page.tsx`, `claude.ts`, `ref_fs`, `quality`, `map/pin/route.ts`, `env`, `notebooks/page.tsx`, `mind/page.tsx`, `isAuthenticated`, `DiaryGraphClient.tsx`, `ref_path`, `devDependencies`, `ForceGraph`, `compilerOptions`, `corsHeaders`, `entityMerge.ts`, `mcpOauth.ts`, `backfill-all/route.ts`, `pendingShares.ts`, `maybeCompressChatSessions`, `usage.ts`, `location.ts`, `mcp/route.ts`, `AutoLock`, `dropboxExportLock.test.ts`, `grants/route.ts`, `interruptedNotebookRecovery.test.ts`, `deploy`, `entityGraph.ts`, `scripts`, `chatToolsLocation.test.ts`, `eslint`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Should `remarkableCloud.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.046753246753246755 - nodes in this community are weakly interconnected._