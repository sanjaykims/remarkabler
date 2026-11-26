# Graph Report - remarkabler  (2026-11-26)

## Corpus Check
- 286 files · ~343,113 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 7, .woff2 4, .css 1)

## Summary
- 2399 nodes · 6363 edges · 124 communities (113 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e424c0e9`
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
- chat/route.ts
- notes.ts
- MemoryPage
- claude.ts
- clientIp
- ref_fs
- insights/route.ts
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
- notebooksPinDenied
- remarkableImport.ts
- embeddings.ts
- dependencies
- decisionWiki.ts
- reflectionWiki.ts
- isAuthenticated
- getCurrentProfile
- DiaryGraphClient.tsx
- auth.ts
- ref_path
- devDependencies
- vitest
- entityWiki.ts
- ForceGraph
- usage.ts
- insights/route.ts
- NotebooksContent
- entityMerge.ts
- notebooks/pin/route.ts
- remarkable/status/route.ts
- entityTagging.ts
- db.ts
- mcpOauth.ts
- next
- graphify_gate.py
- pendingShares.ts
- ocr-review/route.ts
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
- models/route.ts
- map/route.ts
- token/route.ts
- mind/route.ts
- createPinGate
- dropboxExportLock.test.ts
- webauthn.ts
- insightSources.ts
- notes.ts
- getSetting
- relatedEntities.test.ts
- chatDiary.ts
- duplicates/route.ts
- decrypt-backup.mjs
- authRoute.test.ts
- topEntities.test.ts
- owntracks/route.ts
- crop/route.ts
- pagesForEntity.test.ts
- memories/route.ts
- librarian/route.ts
- entityGraph.ts
- scripts
- chatToolsLocation.test.ts
- entityMerge.test.ts
- ocrLearningDb.test.ts
- mindPendingBlank.test.ts
- writingCoach.test.ts
- api/diary/route.ts
- chatMemoryExtract.test.ts
- chatMemoryRecall.test.ts
- chatMemoryRolling.test.ts
- entityTagging.test.ts
- mind.test.ts
- ocrReviewDb.test.ts
- relationshipExportReconcile.test.ts
- chatMemoryRecall.test.ts
- eslint
- db.ts
- embeddingMapDiscipline.test.ts
- entityWikiExclude.test.ts
- ocrLearningDb.test.ts
- vitest
- tailwindcss
- chatMemoryFlow.test.ts
- extractText.ts
- owntracksCurrent.test.ts
- rm2pdf
- postcss.config.mjs
- entityWikiExclude.test.ts
- eslint
- chatDiary.test.ts
- embeddingMapDiscipline.test.ts
- entityWikiExclude.test.ts

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
  app/api/mcp/oauth/register/route.ts → lib/mcpOauth.ts
- `GET()` --calls--> `db()`  [EXTRACTED]
  app/api/notebooks/[id]/pdf/route.ts → lib/db.ts
- `GET()` --calls--> `notebooksPinDenied()`  [EXTRACTED]
  app/api/notebooks/[id]/pdf/route.ts → lib/notebooksPin.ts
- `POST()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/dropbox/export/route.ts → lib/auth.ts
- `GET()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/dropbox/status/route.ts → lib/auth.ts

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

## Communities (124 total, 11 thin omitted)

### Community 0 - "dropbox.ts"
Cohesion: 0.06
Nodes (72): dynamic, GET(), runtime, dynamic, GET(), runtime, dynamic, POST() (+64 more)

### Community 1 - "diaryExportDb.ts"
Cohesion: 0.10
Nodes (28): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, LOCKED(), maxDuration (+20 more)

### Community 2 - "remarkableCloud.ts"
Cohesion: 0.05
Nodes (58): MAX_DIARY_ENTRY_CHARS, CHAT_TOOLS, saveDecision(), getRelationshipsFor(), AUDIT_KEEP_ROWS, authFailures, callMcpTool(), checkMcpAuth() (+50 more)

### Community 3 - "owntracks.ts"
Cohesion: 0.07
Nodes (21): main(), marker_path(), main(), _align(), _analyze(), _band_extent(), _cw(), _est_pitch() (+13 more)

### Community 4 - "ocrLearning.ts"
Cohesion: 0.07
Nodes (46): dynamic, POST(), runtime, dynamic, POST(), runtime, dynamic, POST() (+38 more)

### Community 5 - "mcp.ts"
Cohesion: 0.09
Nodes (45): POST(), analyzeEntryContent(), AxisLabelResult, CHAT_MEMORY_EXTRACTION_GUIDANCE, chatOverNotes(), cleanEntityWiki(), client(), coachWriting() (+37 more)

### Community 6 - "remarkableTombstone.test.ts"
Cohesion: 0.40
Nodes (3): DbMod, NotesMod, SyncMod

### Community 7 - "backup.ts"
Cohesion: 0.06
Nodes (47): dynamic, LOCKED(), POST(), runtime, dynamic, LOCKED(), POST(), runtime (+39 more)

### Community 8 - "app/page.tsx"
Cohesion: 0.11
Nodes (25): dynamic, Home(), LatestInsight, preview(), RecentNotebook, statusLabel(), DayCost, DayData (+17 more)

### Community 9 - "chat/route.ts"
Cohesion: 0.12
Nodes (19): ChatMemoryItem, ChatMemorySection(), backfillAll(), load(), processPending(), remove(), retryStuck(), ChatMemoryStatus (+11 more)

### Community 10 - "notes.ts"
Cohesion: 0.13
Nodes (35): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backupConfigured(), BackupStatus (+27 more)

### Community 11 - "MemoryPage"
Cohesion: 0.09
Nodes (23): dependencies, better-sqlite3@^11.3.0, d3-force@^3.0.1, jszip@^3.10.1, mammoth@^1.12.0, mcp-handler@^1.1.0, next@^16.4.6, pdf-parse@^2.4.5 (+15 more)

### Community 12 - "claude.ts"
Cohesion: 0.08
Nodes (39): ExportedConversationRow, SavedDecisionRow, addEdge(), addEvidence(), buildDiaryGraph(), canonicalKey(), contentId(), ContentInfo (+31 more)

### Community 13 - "clientIp"
Cohesion: 0.31
Nodes (9): DELETE(), dynamic, GET(), runtime, requireAuth(), clientIp(), dropAuthCodesForClient(), listOAuthAudit() (+1 more)

### Community 14 - "ref_fs"
Cohesion: 0.09
Nodes (19): Mode, PinGate(), onChange(), post(), submit(), Card, OcrReview(), Stats (+11 more)

### Community 15 - "insights/route.ts"
Cohesion: 0.36
Nodes (7): backfillTitles(), dynamic, GET(), LOCKED(), maxDuration, PATCH(), runtime

### Community 16 - "chatMemory.ts"
Cohesion: 0.07
Nodes (21): formatBytes(), MemoryPage(), disconnectDropbox(), getPosition(), load(), loadBackup(), loadDisc(), loadDropbox() (+13 more)

### Community 17 - "db"
Cohesion: 0.09
Nodes (35): dynamic, PATCH(), runtime, ocrNotebookPdf(), ocrNotebookPdfWithFlags(), parsePages(), exampleBlocks(), maybeRefreshHandwritingNotes() (+27 more)

### Community 18 - "quality"
Cohesion: 0.17
Nodes (21): MapStayDto, MapView(), RoutePointDto, Data, fmt(), Gate, MapPage(), MapView (+13 more)

### Community 19 - "map/pin/route.ts"
Cohesion: 0.12
Nodes (28): buildDayFiles(), buildDiaryMarkdown(), buildEntityStubFiles(), buildHomeNote(), collectEntities(), countLine(), EnrichedRow, ENTITY_INDEX_FILE (+20 more)

### Community 20 - "memory/page.tsx"
Cohesion: 0.20
Nodes (17): cachedPlace(), cacheKey(), reverseGeocodePlace(), analyzeGaps(), CurrentLocation, durationLabel(), fmtLocal(), GapStats (+9 more)

### Community 21 - "env"
Cohesion: 0.13
Nodes (24): dynamic, LOCKED(), POST(), runtime, classifyReocr(), cursorValue(), diffRmPages(), IncrementalResult (+16 more)

### Community 22 - "isAuthenticated"
Cohesion: 0.10
Nodes (24): ATTACHMENT_DIR, dynamic, GET(), runtime, DELETE(), dynamic, LOCKED(), runtime (+16 more)

### Community 23 - "ocrBackfill.ts"
Cohesion: 0.19
Nodes (19): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backfillCandidates(), Candidate (+11 more)

### Community 24 - "mind.ts"
Cohesion: 0.12
Nodes (20): Block, Box, CaptureArgs, cropFile(), Example, examplesAvailable(), execFileAsync, FILES_DIR (+12 more)

### Community 25 - "discipline/route.ts"
Cohesion: 0.17
Nodes (17): ATTACHMENT_DIR, DELETE(), dynamic, EXT, ext(), EXT_TO_MIME, GET(), IMAGE_TYPES (+9 more)

### Community 26 - "notebooks/route.ts"
Cohesion: 0.07
Nodes (27): concurrency, cancel-in-progress, group, CI, NEXT_TELEMETRY_DISABLED, jobs, quality, name (+19 more)

### Community 27 - "notebooksPinDenied"
Cohesion: 0.24
Nodes (16): DELETE(), dynamic, GET(), LOCKED(), POST(), runtime, DELETE(), dynamic (+8 more)

### Community 28 - "remarkableImport.ts"
Cohesion: 0.14
Nodes (18): dynamic, LOCKED(), maxDuration, POST(), runtime, ExistingRow, importRemarkableNotebook(), importRemarkableNotebookInner() (+10 more)

### Community 29 - "embeddings.ts"
Cohesion: 0.07
Nodes (26): COMMENT_BODY, COMMENT_URL, EVENT_NAME, GH_TOKEN, PR_NUMBER, REPO, if, runs-on (+18 more)

### Community 30 - "dependencies"
Cohesion: 0.09
Nodes (44): dynamic, Kind, KINDS, maxDuration, POST(), postMergeDropbox(), runtime, countEntriesMentioning() (+36 more)

### Community 31 - "decisionWiki.ts"
Cohesion: 0.19
Nodes (25): allConversationNotesRows(), allConversationFileNames(), allDecisionFileNames(), buildEntityIndexNote(), buildProfileNote(), entityIndexFileName(), entityStubFileName(), sanitizeEntityName() (+17 more)

### Community 32 - "reflectionWiki.ts"
Cohesion: 0.29
Nodes (11): escapeHtml(), GET(), page(), POST(), runtime, FileLike, isFileLike(), isPdfFile() (+3 more)

### Community 33 - "isAuthenticated"
Cohesion: 0.14
Nodes (23): AxisLabels, EmbeddingMap(), EntityRankings(), Heatmap(), HeatmapBucket, Map3D, MapPoint, MindData (+15 more)

### Community 34 - "getCurrentProfile"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.47, @types/better-sqlite3@^7.6.11, @types/d3-force@^3.0.10, @types/node@^22.7.4, @types/react@^19.2.18, @types/react-dom@^19.2.4 (+12 more)

### Community 35 - "DiaryGraphClient.tsx"
Cohesion: 0.19
Nodes (19): captureExample(), anchorPhrase(), clean(), contextSnippet(), insideLatinWord(), MAX_FLAGS_PER_CALL, parseBox(), parseFlagLines() (+11 more)

### Community 36 - "auth.ts"
Cohesion: 0.06
Nodes (77): dynamic, GET(), POST(), relyingParty(), runtime, dynamic, GET(), POST() (+69 more)

### Community 37 - "ref_path"
Cohesion: 0.05
Nodes (30): findRouteFiles(), PUBLIC, AuthMod, DbMod, CmMod, DbMod, EmbMod, CleanupMod (+22 more)

### Community 38 - "devDependencies"
Cohesion: 0.17
Nodes (19): REFLECTIONS_NOTEBOOK_ID, ensureReflectionPage(), ensureReflectionsNotebook(), KINDS, ReflectionEntityInput, tagReflectionEntities(), dateKey(), markReflectionsLinked() (+11 more)

### Community 39 - "vitest"
Cohesion: 0.11
Nodes (29): dynamic, GET(), LOCKED(), runtime, ConversationEntityInput, ensureConversationPage(), ensureConversationsNotebook(), getCombinedEntityWiki() (+21 more)

### Community 40 - "entityWiki.ts"
Cohesion: 0.40
Nodes (11): AutoLock(), cancelPending(), lockNow(), markHiddenIfNeeded(), onPageHide(), onVisibility(), clearHiddenSince(), readHiddenSince() (+3 more)

### Community 41 - "ForceGraph"
Cohesion: 0.16
Nodes (26): ensureChatDiaryNotebook(), nextPageIndex(), saveChatDiaryEntry(), resolveConversationEntityName(), updateConversationNotes(), db(), DecisionEntityInput, ensureDecisionPage() (+18 more)

### Community 42 - "usage.ts"
Cohesion: 0.24
Nodes (12): dynamic, GET(), runtime, dailyUsage(), FALLBACK, monthlyUsage(), Prices, PRICES (+4 more)

### Community 43 - "insights/route.ts"
Cohesion: 0.16
Nodes (13): dynamic, LOCKED(), POST(), runtime, BackfillMessage, CHUNK_TARGET_CHARS, chunkedBackfillForConversation(), chunkMessageIds() (+5 more)

### Community 44 - "NotebooksContent"
Cohesion: 0.22
Nodes (10): setPickingFile(), NotebooksContent(), approvePending(), load(), loadDuplicates(), loadPendingShares(), openFilePicker(), remove() (+2 more)

### Community 45 - "entityMerge.ts"
Cohesion: 0.13
Nodes (17): DiaryGraphClient(), EDGE_COLORS, EDGE_LABELS, EDGE_TYPES, formatGeneratedAt(), Inspector(), Metric(), metricLabel() (+9 more)

### Community 46 - "notebooks/pin/route.ts"
Cohesion: 0.13
Nodes (18): getConversationByKey(), EntityPredicate, isEntityPredicate(), PREDICATE_LABELS, PREDICATES, CleanRelationshipInput, cleanRelationships(), EntityKind (+10 more)

### Community 47 - "remarkable/status/route.ts"
Cohesion: 0.21
Nodes (10): dynamic, LOCKED(), POST(), runtime, dynamic, GET(), LOCKED(), runtime (+2 more)

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
Nodes (15): dynamic, Entry, GET(), LOCKED(), runtime, RFC-8414, RFC-9728, nextConfig (+7 more)

### Community 52 - "graphify_gate.py"
Cohesion: 0.12
Nodes (24): dynamic, GET(), OPTIONS(), runtime, RFC-8414, dynamic, GET(), OPTIONS() (+16 more)

### Community 53 - "pendingShares.ts"
Cohesion: 0.16
Nodes (17): dynamic, maxDuration, POST(), runtime, EntityWikiExcerpt, candidates(), entityWikiAutoEnabled(), evenSample() (+9 more)

### Community 54 - "ocr-review/route.ts"
Cohesion: 0.31
Nodes (8): dynamic, GET(), LOCKED(), POST(), runtime, ProofreadingStats, proofreadingStats(), ResolveAction

### Community 55 - "layout.tsx"
Cohesion: 0.11
Nodes (17): clearSans, dynamic, metadata, RootLayout(), viewport, LockAllButton(), LockOffBanner(), LINKS (+9 more)

### Community 56 - "vaultGraph.ts"
Cohesion: 0.14
Nodes (17): AuthCode, authCodes, ClientMetadataResult, ClientRegistrationMetadata, configuredSecrets(), consentSecretValid(), currentSecretHashes(), IssuedTokens (+9 more)

### Community 57 - "authorize/route.ts"
Cohesion: 0.52
Nodes (11): track(), friendly(), LockScreen(), completeUnlock(), post(), prefetchAuthOptions(), registerDevice(), rememberDevice() (+3 more)

### Community 58 - "usage.ts"
Cohesion: 0.15
Nodes (15): dynamic, GET(), runtime, coachablePages(), CoachSession, listCoachSessions(), MAX_BATCH_CHARS, maybeCoachWriting() (+7 more)

### Community 59 - "Map3D.tsx"
Cohesion: 0.25
Nodes (17): wikiLinkingEnabled(), listUnlinkedConversations(), listUnlinkedDecisions(), autoTagConversation(), autoTagDecision(), autoTagExportsEnabled(), autoTagReflection(), evenSample() (+9 more)

### Community 60 - "usage/page.tsx"
Cohesion: 0.13
Nodes (24): dynamic, GET(), runtime, cleanName(), createPendingShare(), discardPendingShare(), filePath(), listPendingShares() (+16 more)

### Community 61 - "manifest.json"
Cohesion: 0.19
Nodes (12): dynamic, GET(), runtime, dynamic, GraphPage(), DiaryGraphPayload, VaultNoteKind, insightDropboxFolders() (+4 more)

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
Nodes (10): dynamic, LOCKED(), maxDuration, POST(), runtime, carryForwardDates(), DiaryPageRow, compareImportedNotebook() (+2 more)

### Community 67 - "package.json"
Cohesion: 0.12
Nodes (15): @anthropic-ai/sdk@^0.96.0, leaflet@^1.9.4, @modelcontextprotocol/sdk@^1.26.0, @types/leaflet@^1.9.12, zod@^4.4.3, engines, node, name (+7 more)

### Community 68 - "format.ts"
Cohesion: 0.25
Nodes (11): Insight, InsightsPage(), copy(), download(), exportText(), generate(), load(), summarize() (+3 more)

### Community 69 - "models/route.ts"
Cohesion: 0.33
Nodes (8): dynamic, GET(), LOCKED(), POST(), resolve(), runtime, Slot, SLOTS

### Community 70 - "map/route.ts"
Cohesion: 0.33
Nodes (6): dynamic, GET(), runtime, TZ_OFFSET_MIN, MAP_UNLOCK_COOKIE, verifyUnlockToken

### Community 71 - "token/route.ts"
Cohesion: 0.15
Nodes (8): CeMod, CwMod, DbMod, DiaryGraphPayload, GraphMod, MindMod, NotesMod, RelMod

### Community 72 - "mind/route.ts"
Cohesion: 0.22
Nodes (7): codeFrom(), consent(), exchange(), issueAccessToken(), Mod, pkce(), register()

### Community 73 - "createPinGate"
Cohesion: 0.32
Nodes (9): effectiveDateKeys(), isDatedEntry(), buildCandidate(), buildCloudCoverage(), classifyDuplicate(), CloudCoverage, DuplicateCandidate, DuplicateClassification (+1 more)

### Community 74 - "dropboxExportLock.test.ts"
Cohesion: 0.36
Nodes (10): dynamic, fmtDate(), fmtDateTime(), fmtTime(), GET(), LOCKED(), maxDuration, runtime (+2 more)

### Community 75 - "webauthn.ts"
Cohesion: 0.18
Nodes (15): dynamic, GET(), LOCKED(), POST(), runtime, dynamic, GET(), LOCKED() (+7 more)

### Community 76 - "insightSources.ts"
Cohesion: 0.38
Nodes (6): blocksFor(), buildInsightExtraContext(), buildSavedSessionsContext(), DEFAULT_INSIGHT_DROPBOX_FOLDERS, InsightExtraContext, SavedRow

### Community 77 - "notes.ts"
Cohesion: 0.05
Nodes (92): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, dynamic, GET() (+84 more)

### Community 78 - "getSetting"
Cohesion: 0.17
Nodes (21): ATTACHMENT_DIR, cleanupOrphanChatAttachments(), maybeCleanupOrphanAttachments(), recordLibrarianHeartbeat(), getSetting(), setSetting(), maybeReconcileRelationshipExportRace(), createPinGate() (+13 more)

### Community 79 - "relatedEntities.test.ts"
Cohesion: 0.33
Nodes (3): ClaudeMod, CmMod, DbMod

### Community 80 - "chatDiary.ts"
Cohesion: 0.20
Nodes (7): ConversationWikiMod, DbMod, deferred(), DiaryExportDbMod, DropboxMod, mockDropboxFetch(), UploadCall

### Community 81 - "duplicates/route.ts"
Cohesion: 0.50
Nodes (4): dynamic, GET(), LOCKED(), runtime

### Community 82 - "decrypt-backup.mjs"
Cohesion: 0.27
Nodes (7): secondLook(), examplesForTexts(), OcrFlag, applySecondLook(), LookAnswer, LookItem, parseLookAnswers()

### Community 84 - "topEntities.test.ts"
Cohesion: 0.20
Nodes (5): ChatToolsMod, DbMod, MergeMod, NotesMod, Result

### Community 85 - "owntracks/route.ts"
Cohesion: 0.33
Nodes (10): dynamic, GET(), isPlausiblePoint(), POST(), runtime, addPoint(), checkOwntracksToken(), owntracksConfigured() (+2 more)

### Community 86 - "crop/route.ts"
Cohesion: 0.50
Nodes (4): dynamic, GET(), runtime, cropPng()

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

### Community 104 - "ocrReviewDb.test.ts"
Cohesion: 0.40
Nodes (5): dynamic, GET(), LOCKED(), maxDuration, runtime

### Community 105 - "relationshipExportReconcile.test.ts"
Cohesion: 0.53
Nodes (4): strip(), tokens(), WordChange, wordChanges()

### Community 106 - "chatMemoryRecall.test.ts"
Cohesion: 0.33
Nodes (3): CmMod, DbMod, EmbMod

### Community 108 - "db.ts"
Cohesion: 0.09
Nodes (15): recoverInterruptedNotebooks(), better-sqlite3, AuthMod, DbMod, BackupMod, DbMod, DbMod, CeMod (+7 more)

### Community 110 - "embeddingMapDiscipline.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, DedupMod, NotesMod

### Community 111 - "entityWikiExclude.test.ts"
Cohesion: 0.33
Nodes (3): Db, Review, Store

### Community 112 - "ocrLearningDb.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 116 - "vitest"
Cohesion: 0.09
Nodes (10): vitest, clean, DbMod, NotesMod, DbMod, DropboxMod, AuthMod, DbMod (+2 more)

### Community 117 - "tailwindcss"
Cohesion: 0.40
Nodes (4): CeMod, DbMod, ReMod, RwMod

### Community 120 - "extractText.ts"
Cohesion: 0.36
Nodes (7): ExtractResult, extractTextFromAttachment(), Mammoth, mammoth(), PdfParse, pdfParse(), shouldFallback()

### Community 121 - "owntracksCurrent.test.ts"
Cohesion: 0.50
Nodes (3): tailwindcss@^3.4.13, tailwindcss, config

### Community 128 - "eslint"
Cohesion: 0.40
Nodes (4): eslint@^9.39.5, eslint-config-next@^16.3.2, eslint, eslint-config-next

### Community 129 - "chatDiary.test.ts"
Cohesion: 0.40
Nodes (4): CdMod, DbMod, MindMod, NotesMod

### Community 133 - "embeddingMapDiscipline.test.ts"
Cohesion: 0.40
Nodes (4): DbMod, EmbMod, MindMod, NotesMod

### Community 134 - "entityWikiExclude.test.ts"
Cohesion: 0.40
Nodes (3): ClaudeMod, DbMod, EwMod

## Knowledge Gaps
- **6 isolated node(s):** `RFC-8414`, `RFC-9728`, `RFC-8414`, `RFC-9728`, `RFC-9728` (+1 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 902 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db()` connect `ForceGraph` to `dropbox.ts`, `remarkableCloud.ts`, `ocrLearning.ts`, `mcp.ts`, `backup.ts`, `app/page.tsx`, `notes.ts`, `claude.ts`, `clientIp`, `insights/route.ts`, `db`, `memory/page.tsx`, `env`, `isAuthenticated`, `ocrBackfill.ts`, `mind.ts`, `discipline/route.ts`, `notebooksPinDenied`, `remarkableImport.ts`, `dependencies`, `decisionWiki.ts`, `DiaryGraphClient.tsx`, `auth.ts`, `devDependencies`, `vitest`, `usage.ts`, `insights/route.ts`, `notebooks/pin/route.ts`, `entityTagging.ts`, `next`, `graphify_gate.py`, `pendingShares.ts`, `ocr-review/route.ts`, `vaultGraph.ts`, `usage.ts`, `Map3D.tsx`, `usage/page.tsx`, `location.ts`, `next`, `mcp/route.ts`, `createPinGate`, `dropboxExportLock.test.ts`, `webauthn.ts`, `insightSources.ts`, `notes.ts`, `getSetting`, `decrypt-backup.mjs`, `owntracks/route.ts`, `crop/route.ts`, `mind.test.ts`, `db.ts`, `chatMemoryFlow.test.ts`?**
  _High betweenness centrality (0.218) - this node is a cross-community bridge._
- **What connects `RFC-8414`, `RFC-9728`, `RFC-8414` to the rest of the system?**
  _6 weakly-connected nodes found - possible missing edges._
- **Should `dropbox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05737234652897304 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `dropbox.ts`, `diaryExportDb.ts`, `ocrLearning.ts`, `backup.ts`, `app/page.tsx`, `chat/route.ts`, `notes.ts`, `MemoryPage`, `clientIp`, `insights/route.ts`, `db`, `quality`, `env`, `isAuthenticated`, `ocrBackfill.ts`, `discipline/route.ts`, `notebooksPinDenied`, `remarkableImport.ts`, `dependencies`, `reflectionWiki.ts`, `isAuthenticated`, `auth.ts`, `ref_path`, `vitest`, `usage.ts`, `insights/route.ts`, `remarkable/status/route.ts`, `entityTagging.ts`, `graphify_gate.py`, `pendingShares.ts`, `ocr-review/route.ts`, `layout.tsx`, `usage.ts`, `usage/page.tsx`, `manifest.json`, `location.ts`, `next`, `mcp/route.ts`, `package.json`, `models/route.ts`, `map/route.ts`, `dropboxExportLock.test.ts`, `webauthn.ts`, `notes.ts`, `duplicates/route.ts`, `owntracks/route.ts`, `crop/route.ts`, `librarian/route.ts`, `ocrReviewDb.test.ts`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Should `diaryExportDb.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10160427807486631 - nodes in this community are weakly interconnected._
- **Why does `isAuthenticated()` connect `isAuthenticated` to `dropbox.ts`, `diaryExportDb.ts`, `ocrLearning.ts`, `mcp.ts`, `backup.ts`, `notes.ts`, `clientIp`, `insights/route.ts`, `db`, `env`, `ocrBackfill.ts`, `discipline/route.ts`, `notebooksPinDenied`, `remarkableImport.ts`, `dependencies`, `auth.ts`, `vitest`, `ForceGraph`, `usage.ts`, `insights/route.ts`, `remarkable/status/route.ts`, `entityTagging.ts`, `next`, `pendingShares.ts`, `ocr-review/route.ts`, `layout.tsx`, `usage.ts`, `usage/page.tsx`, `manifest.json`, `mcp/route.ts`, `models/route.ts`, `map/route.ts`, `dropboxExportLock.test.ts`, `webauthn.ts`, `notes.ts`, `duplicates/route.ts`, `owntracks/route.ts`, `crop/route.ts`, `ocrReviewDb.test.ts`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `remarkableCloud.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04519774011299435 - nodes in this community are weakly interconnected._