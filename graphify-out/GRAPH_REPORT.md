# Graph Report - remarkabler  (2026-11-26)

## Corpus Check
- 287 files · ~345,038 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 7, .woff2 4, .css 1)

## Summary
- 2414 nodes · 6411 edges · 130 communities (119 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7de1e550`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- dropbox.ts
- diaryExportDb.ts
- remarkableCloud.ts
- owntracks.ts
- ocrLearning.ts
- mcp.ts
- callMcpTool
- backup.ts
- app/page.tsx
- owntracks.ts
- notes.ts
- MemoryPage
- claude.ts
- secondLook.ts
- ref_fs
- insights/route.ts
- chatMemory.ts
- db
- quality
- map/pin/route.ts
- discipline/route.ts
- remarkableSync.ts
- discipline/settings/route.ts
- ocrBackfill.ts
- mind.ts
- discipline/route.ts
- notebooks/route.ts
- remarkableImport.ts
- map/pin/route.ts
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
- notebooksPin.ts
- insights/route.ts
- format.ts
- entityMerge.ts
- notebooks/pin/route.ts
- embeddings.ts
- remarkable/status/route.ts
- db.ts
- mcpOauth.ts
- next
- graphify_gate.py
- pendingShares.ts
- entityMerge.ts
- layout.tsx
- vaultGraph.ts
- memory/route.ts
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
- Nav.tsx
- ForceGraph.tsx
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
- book/route.ts
- authRoute.test.ts
- topEntities.test.ts
- writing-coach/route.ts
- mapPin.ts
- pagesForEntity.test.ts
- memories/route.ts
- librarian/route.ts
- entityGraph.ts
- scripts
- chatToolsLocation.test.ts
- entityMerge.test.ts
- ocrLearningDb.test.ts
- dropboxDisconnect.test.ts
- mcp/route.ts
- api/diary/route.ts
- chatMemoryExtract.test.ts
- chatMemoryRecall.test.ts
- chatMemoryRolling.test.ts
- entityTagging.test.ts
- token/route.ts
- ocrReviewDb.test.ts
- chatMemoryRecall.test.ts
- chatMemoryRolling.test.ts
- relationshipExportReconcile.test.ts
- embeddingMapDiscipline.test.ts
- entityWikiExclude.test.ts
- ocrDiff.ts
- chatDiary.test.ts
- chunkedBackfill.test.ts
- ref_fs
- mind.test.ts
- vitest
- ref_os
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
- ref_path

## God Nodes (most connected - your core abstractions)
1. `db()` - 321 edges
2. `isAuthenticated()` - 145 edges
3. `vitest` - 94 edges
4. `next` - 84 edges
5. `getSetting()` - 76 edges
6. `setSetting()` - 69 edges
7. `MemoryPage()` - 42 edges
8. `runMaintenanceSweep()` - 36 edges
9. `clearSetting()` - 30 edges
10. `notebooksPinDenied()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/authorization-server/route.ts → lib/mcpOauth.ts
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/register/route.ts → lib/mcpOauth.ts
- `guarded()` --calls--> `clientIp()`  [EXTRACTED]
  app/api/mcp/route.ts → lib/clientIp.ts
- `guarded()` --calls--> `isThrottled()`  [EXTRACTED]
  app/api/mcp/route.ts → lib/mcp.ts
- `guarded()` --calls--> `recordAuthFailure()`  [EXTRACTED]
  app/api/mcp/route.ts → lib/mcp.ts

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

## Communities (130 total, 11 thin omitted)

### Community 0 - "dropbox.ts"
Cohesion: 0.06
Nodes (69): dynamic, GET(), runtime, dynamic, GET(), runtime, dynamic, POST() (+61 more)

### Community 1 - "diaryExportDb.ts"
Cohesion: 0.10
Nodes (28): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, LOCKED(), maxDuration (+20 more)

### Community 2 - "remarkableCloud.ts"
Cohesion: 0.04
Nodes (48): MAX_DIARY_ENTRY_CHARS, CHAT_TOOLS, AUDIT_KEEP_ROWS, authFailures, COMPANION_GUIDANCE, configuredTokens(), DECISION_TOOL, DECISION_TOOL_NAME (+40 more)

### Community 3 - "owntracks.ts"
Cohesion: 0.07
Nodes (23): bash_edits_code(), main(), marker_path(), main(), _acf_pitch(), _align(), _analyze(), _band_extent() (+15 more)

### Community 4 - "ocrLearning.ts"
Cohesion: 0.07
Nodes (44): dynamic, POST(), runtime, dynamic, POST(), runtime, dynamic, POST() (+36 more)

### Community 5 - "mcp.ts"
Cohesion: 0.08
Nodes (51): analyzeEntryContent(), AxisLabelResult, CHAT_MEMORY_EXTRACTION_GUIDANCE, chatOverNotes(), cleanEntityWiki(), client(), compareTranscriptions(), composeEntityWiki() (+43 more)

### Community 6 - "callMcpTool"
Cohesion: 0.17
Nodes (18): handler, resolveConversationEntityName(), tagConversationEntities(), updateConversationNotes(), getRelationshipsFor(), callMcpTool(), callMcpToolContent(), conversationExportEnabled() (+10 more)

### Community 7 - "backup.ts"
Cohesion: 0.07
Nodes (44): dynamic, LOCKED(), POST(), runtime, dynamic, LOCKED(), POST(), runtime (+36 more)

### Community 8 - "app/page.tsx"
Cohesion: 0.11
Nodes (25): dynamic, Home(), LatestInsight, preview(), RecentNotebook, statusLabel(), DayCost, DayData (+17 more)

### Community 9 - "owntracks.ts"
Cohesion: 0.13
Nodes (30): POST(), dynamic, GET(), isPlausiblePoint(), POST(), runtime, getRecentLocations(), cachedPlace() (+22 more)

### Community 10 - "notes.ts"
Cohesion: 0.12
Nodes (36): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, PATCH(), backupConfigured() (+28 more)

### Community 11 - "MemoryPage"
Cohesion: 0.10
Nodes (21): dependencies, better-sqlite3@^11.3.0, jszip@^3.10.1, leaflet@^1.9.4, mcp-handler@^1.1.0, next@^16.4.6, pdf-parse@^2.4.5, react@^19.2.8 (+13 more)

### Community 12 - "claude.ts"
Cohesion: 0.09
Nodes (37): addEdge(), addEvidence(), buildDiaryGraph(), canonicalKey(), contentId(), ContentInfo, ContentKind, ContentStats (+29 more)

### Community 13 - "secondLook.ts"
Cohesion: 0.38
Nodes (4): applySecondLook(), LookAnswer, LookItem, parseLookAnswers()

### Community 14 - "ref_fs"
Cohesion: 0.07
Nodes (28): setPickingFile(), Mode, PinGate(), onChange(), post(), submit(), Card, OcrReview() (+20 more)

### Community 15 - "insights/route.ts"
Cohesion: 0.18
Nodes (18): backfillTitles(), dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, generateInsights() (+10 more)

### Community 16 - "chatMemory.ts"
Cohesion: 0.07
Nodes (21): formatBytes(), MemoryPage(), disconnectDropbox(), getPosition(), load(), loadBackup(), loadDisc(), loadDropbox() (+13 more)

### Community 17 - "db"
Cohesion: 0.13
Nodes (22): maybeRefreshHandwritingNotes(), applyFixes(), AUTOFIX_MIN, autoFixablePairs(), buildOcrHints(), confirmedTerms(), correctedPairs(), correctedPairsForNotes() (+14 more)

### Community 18 - "quality"
Cohesion: 0.13
Nodes (27): dynamic, GET(), runtime, MapStayDto, MapView(), RoutePointDto, Data, fmt() (+19 more)

### Community 19 - "map/pin/route.ts"
Cohesion: 0.11
Nodes (31): buildDayFiles(), buildDiaryMarkdown(), buildEntityIndexNote(), buildEntityStubFiles(), buildHomeNote(), buildProfileNote(), collectEntities(), countLine() (+23 more)

### Community 20 - "discipline/route.ts"
Cohesion: 0.19
Nodes (18): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, BINARY_EXT, disciplineConfig() (+10 more)

### Community 21 - "remarkableSync.ts"
Cohesion: 0.11
Nodes (30): dynamic, LOCKED(), POST(), runtime, OcrFlag, saveOcrFlags(), lockRemarkableImport(), classifyReocr() (+22 more)

### Community 22 - "discipline/settings/route.ts"
Cohesion: 0.43
Nodes (6): dynamic, GET(), LOCKED(), POST(), runtime, setDisciplineEnabled()

### Community 23 - "ocrBackfill.ts"
Cohesion: 0.07
Nodes (46): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, GET(), LOCKED() (+38 more)

### Community 24 - "mind.ts"
Cohesion: 0.11
Nodes (22): dynamic, runtime, Block, Box, CaptureArgs, captureExample(), cropPng(), Example (+14 more)

### Community 25 - "discipline/route.ts"
Cohesion: 0.12
Nodes (20): ATTACHMENT_DIR, DELETE(), dynamic, EXT, ext(), EXT_TO_MIME, GET(), IMAGE_TYPES (+12 more)

### Community 26 - "notebooks/route.ts"
Cohesion: 0.07
Nodes (27): concurrency, cancel-in-progress, group, CI, NEXT_TELEMETRY_DISABLED, jobs, quality, name (+19 more)

### Community 27 - "remarkableImport.ts"
Cohesion: 0.14
Nodes (18): dynamic, LOCKED(), maxDuration, POST(), runtime, deleteNotebook(), ExistingRow, importRemarkableNotebook() (+10 more)

### Community 28 - "map/pin/route.ts"
Cohesion: 0.21
Nodes (15): dynamic, GET(), POST(), runtime, unlocked(), requireAuth(), clientIp(), attemptsLeft (+7 more)

### Community 29 - "embeddings.ts"
Cohesion: 0.07
Nodes (26): COMMENT_BODY, COMMENT_URL, EVENT_NAME, GH_TOKEN, PR_NUMBER, REPO, if, runs-on (+18 more)

### Community 30 - "db"
Cohesion: 0.22
Nodes (27): countEntriesMentioning(), currentTimeKst(), executeTool(), ftsSearch(), getDaySummary(), getEntriesByDate(), getInsights(), getMonthSummary() (+19 more)

### Community 31 - "decisionWiki.ts"
Cohesion: 0.20
Nodes (25): allConversationNotesRows(), allConversationFileNames(), allDecisionFileNames(), entityStubFileName(), sanitizeEntityName(), affectedDayFileNames(), affectedEntityStubFileNames(), collectEntityStubs() (+17 more)

### Community 32 - "reflectionWiki.ts"
Cohesion: 0.22
Nodes (16): dynamic, LOCKED(), POST(), runtime, escapeHtml(), GET(), page(), POST() (+8 more)

### Community 33 - "isAuthenticated"
Cohesion: 0.14
Nodes (23): AxisLabels, EmbeddingMap(), EntityRankings(), Heatmap(), HeatmapBucket, Map3D, MapPoint, MindData (+15 more)

### Community 34 - "getCurrentProfile"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.47, @types/better-sqlite3@^7.6.11, @types/d3-force@^3.0.10, @types/node@^22.7.4, @types/react@^19.2.18, @types/react-dom@^19.2.4 (+12 more)

### Community 35 - "DiaryGraphClient.tsx"
Cohesion: 0.17
Nodes (19): anchorPhrase(), clean(), contextSnippet(), insideLatinWord(), MAX_FLAGS_PER_CALL, parseBox(), parseFlagLines(), replaceAt() (+11 more)

### Community 36 - "auth.ts"
Cohesion: 0.10
Nodes (42): dynamic, GET(), POST(), relyingParty(), runtime, RootLayout(), appIsFailClosed(), AUTH_CHALLENGE_COOKIE (+34 more)

### Community 38 - "devDependencies"
Cohesion: 0.17
Nodes (20): entityStubWikiTarget(), REFLECTIONS_NOTEBOOK_ID, ensureReflectionPage(), ensureReflectionsNotebook(), KINDS, ReflectionEntityInput, tagReflectionEntities(), dateKey() (+12 more)

### Community 39 - "vitest"
Cohesion: 0.10
Nodes (29): dynamic, GET(), LOCKED(), runtime, ConversationEntityInput, ensureConversationPage(), ensureConversationsNotebook(), getCombinedEntityWiki() (+21 more)

### Community 40 - "entityWiki.ts"
Cohesion: 0.40
Nodes (11): AutoLock(), cancelPending(), lockNow(), markHiddenIfNeeded(), onPageHide(), onVisibility(), clearHiddenSince(), readHiddenSince() (+3 more)

### Community 41 - "ForceGraph"
Cohesion: 0.16
Nodes (21): DecisionEntityInput, ensureDecisionPage(), ensureDecisionsNotebook(), KINDS, tagDecisionEntities(), dateKey(), DECISION_FOLDER, decisionNoteFileName() (+13 more)

### Community 42 - "notebooksPin.ts"
Cohesion: 0.25
Nodes (15): dynamic, GET(), POST(), runtime, unlocked(), gate, makeNotebooksUnlockToken, NOTEBOOKS_UNLOCK_COOKIE (+7 more)

### Community 43 - "insights/route.ts"
Cohesion: 0.24
Nodes (10): dynamic, LOCKED(), POST(), runtime, BackfillMessage, CHUNK_TARGET_CHARS, chunkedBackfillForConversation(), chunkMessageIds() (+2 more)

### Community 44 - "format.ts"
Cohesion: 0.25
Nodes (11): Insight, InsightsPage(), copy(), download(), exportText(), generate(), load(), summarize() (+3 more)

### Community 45 - "entityMerge.ts"
Cohesion: 0.13
Nodes (18): DiaryGraphClient(), EDGE_COLORS, EDGE_LABELS, EDGE_TYPES, formatGeneratedAt(), Inspector(), Metric(), metricLabel() (+10 more)

### Community 46 - "notebooks/pin/route.ts"
Cohesion: 0.13
Nodes (18): getConversationByKey(), EntityPredicate, isEntityPredicate(), PREDICATE_LABELS, PREDICATES, CleanRelationshipInput, cleanRelationships(), EntityKind (+10 more)

### Community 47 - "embeddings.ts"
Cohesion: 0.13
Nodes (30): dynamic, GET(), maxDuration, POST(), runtime, CHAT_DIARY_NOTEBOOK_NAME, ensureChatDiaryNotebook(), nextPageIndex() (+22 more)

### Community 48 - "remarkable/status/route.ts"
Cohesion: 0.21
Nodes (10): dynamic, LOCKED(), POST(), runtime, dynamic, GET(), LOCKED(), runtime (+2 more)

### Community 49 - "db.ts"
Cohesion: 0.29
Nodes (10): ForceGraph(), draw(), fit(), hit(), loop(), onDown(), onMove(), onWheel() (+2 more)

### Community 50 - "mcpOauth.ts"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 51 - "next"
Cohesion: 0.09
Nodes (18): ATTACHMENT_DIR, dynamic, GET(), runtime, DELETE(), dynamic, LOCKED(), runtime (+10 more)

### Community 52 - "graphify_gate.py"
Cohesion: 0.32
Nodes (7): dynamic, GET(), OPTIONS(), runtime, RFC-8414, authorizationServerMetadata(), publicOrigin()

### Community 53 - "pendingShares.ts"
Cohesion: 0.16
Nodes (17): dynamic, maxDuration, POST(), runtime, EntityWikiExcerpt, candidates(), entityWikiAutoEnabled(), evenSample() (+9 more)

### Community 54 - "entityMerge.ts"
Cohesion: 0.18
Nodes (17): dynamic, Kind, KINDS, maxDuration, POST(), postMergeDropbox(), runtime, dedupeAllEntities() (+9 more)

### Community 55 - "layout.tsx"
Cohesion: 0.16
Nodes (20): track(), clearSans, dynamic, metadata, viewport, LockOffBanner(), friendly(), LockScreen() (+12 more)

### Community 56 - "vaultGraph.ts"
Cohesion: 0.11
Nodes (24): DELETE(), dynamic, GET(), runtime, AuthCode, authCodes, ClientMetadataResult, ClientRegistrationMetadata (+16 more)

### Community 57 - "memory/route.ts"
Cohesion: 0.33
Nodes (9): dynamic, GET(), hasNotes(), LOCKED(), maxDuration, POST(), runtime, getCurrentProfileRow() (+1 more)

### Community 58 - "usage.ts"
Cohesion: 0.21
Nodes (12): coachWriting(), coachablePages(), CoachSession, MAX_BATCH_CHARS, maybeCoachWriting(), MIN_BATCH_CHARS, MIN_PAGE_CHARS, pickBatch() (+4 more)

### Community 59 - "Map3D.tsx"
Cohesion: 0.26
Nodes (16): wikiLinkingEnabled(), listUnlinkedConversations(), listUnlinkedDecisions(), autoTagConversation(), autoTagDecision(), autoTagExportsEnabled(), autoTagReflection(), evenSample() (+8 more)

### Community 60 - "usage/page.tsx"
Cohesion: 0.11
Nodes (31): dynamic, GET(), runtime, DELETE(), dynamic, GET(), LOCKED(), POST() (+23 more)

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
Cohesion: 0.19
Nodes (14): dynamic, OPTIONS(), POST(), readBoundedJson(), runtime, RFC-7591, isThrottled(), recordAuthFailure() (+6 more)

### Community 66 - "mcp/route.ts"
Cohesion: 0.22
Nodes (10): dynamic, LOCKED(), maxDuration, POST(), runtime, carryForwardDates(), DiaryPageRow, compareImportedNotebook() (+2 more)

### Community 67 - "package.json"
Cohesion: 0.12
Nodes (15): @anthropic-ai/sdk@^0.96.0, mammoth@^1.12.0, @modelcontextprotocol/sdk@^1.26.0, posthog-js@^1.374.3, @types/leaflet@^1.9.12, engines, node, name (+7 more)

### Community 68 - "format.ts"
Cohesion: 0.12
Nodes (20): ChatMemoryItem, ChatMemorySection(), backfillAll(), load(), processPending(), remove(), retryStuck(), ChatMemoryStatus (+12 more)

### Community 69 - "Nav.tsx"
Cohesion: 0.25
Nodes (6): LockAllButton(), LINKS, Nav(), DocWithVT, Props, TransitionLink()

### Community 70 - "ForceGraph.tsx"
Cohesion: 0.20
Nodes (9): ForceEdgeInput, ForceNodeInput, Props, radiusFor(), SimLink, SimNode, Transform, d3-force@^3.0.1 (+1 more)

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
Cohesion: 0.12
Nodes (19): dynamic, GET(), LOCKED(), POST(), runtime, dynamic, GET(), LOCKED() (+11 more)

### Community 76 - "ocr-review/route.ts"
Cohesion: 0.31
Nodes (8): dynamic, GET(), LOCKED(), runtime, ProofreadingStats, proofreadingStats(), listReviewCards(), ResolveAction

### Community 77 - "notes.ts"
Cohesion: 0.14
Nodes (24): register(), backfillEmbeddingsLoop(), claimNextQueuedNotebook(), correctPageText(), drainNotebookProcessingQueue(), ensureProfileSeed(), extractEntryDate(), FILES_DIR (+16 more)

### Community 78 - "createPinGate"
Cohesion: 0.22
Nodes (19): maybeCleanupOrphanAttachments(), getSetting(), setSetting(), maybeReconcileRelationshipExportRace(), autoFixPages(), createPinGate(), attemptsLeft(), configured() (+11 more)

### Community 79 - "relatedEntities.test.ts"
Cohesion: 0.33
Nodes (3): ClaudeMod, CmMod, DbMod

### Community 80 - "chatDiary.ts"
Cohesion: 0.20
Nodes (7): ConversationWikiMod, DbMod, deferred(), DiaryExportDbMod, DropboxMod, mockDropboxFetch(), UploadCall

### Community 81 - "models/route.ts"
Cohesion: 0.33
Nodes (8): dynamic, GET(), LOCKED(), POST(), resolve(), runtime, Slot, SLOTS

### Community 82 - "book/route.ts"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), maxDuration, runtime, composeBook()

### Community 84 - "topEntities.test.ts"
Cohesion: 0.20
Nodes (5): ChatToolsMod, DbMod, MergeMod, NotesMod, Result

### Community 85 - "writing-coach/route.ts"
Cohesion: 0.50
Nodes (4): dynamic, GET(), runtime, listCoachSessions()

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

### Community 96 - "mcp/route.ts"
Cohesion: 0.21
Nodes (11): auditRequest(), dynamic, guarded(), maxDuration, runtime, RFC-9728, checkMcpAuth(), recordMcpAudit() (+3 more)

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

### Community 103 - "token/route.ts"
Cohesion: 0.18
Nodes (17): dynamic, GET(), OPTIONS(), runtime, RFC-9728, dynamic, err(), OPTIONS() (+9 more)

### Community 104 - "ocrReviewDb.test.ts"
Cohesion: 0.40
Nodes (5): dynamic, GET(), LOCKED(), maxDuration, runtime

### Community 106 - "chatMemoryRecall.test.ts"
Cohesion: 0.33
Nodes (3): CmMod, DbMod, EmbMod

### Community 108 - "relationshipExportReconcile.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, DropboxMod, NotesMod

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

### Community 115 - "ref_fs"
Cohesion: 0.10
Nodes (9): ATTACHMENT_DIR, AuthMod, DbMod, CleanupMod, DbMod, DbMod, Mod, AuthMod (+1 more)

### Community 116 - "mind.test.ts"
Cohesion: 0.33
Nodes (3): DbMod, MindMod, NotesMod

### Community 117 - "vitest"
Cohesion: 0.09
Nodes (13): vitest, CeMod, CwMod, DbMod, CeMod, DbMod, ReMod, RwMod (+5 more)

### Community 118 - "ref_os"
Cohesion: 0.09
Nodes (10): AuthMod, DbMod, DbMod, DbMod, DeMod, DwMod, DbMod, DropboxMod (+2 more)

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
Cohesion: 0.10
Nodes (28): dynamic, GET(), runtime, dynamic, POST(), runtime, dynamic, GET() (+20 more)

### Community 133 - "db.ts"
Cohesion: 0.09
Nodes (14): better-sqlite3, BackupMod, DbMod, DbMod, Mod, DbMod, DropboxMod, DbModule (+6 more)

### Community 135 - "chatMemoryDedup.test.ts"
Cohesion: 0.40
Nodes (3): CmMod, DbMod, EmbMod

### Community 138 - "ref_path"
Cohesion: 0.09
Nodes (12): findRouteFiles(), PUBLIC, DbMod, EmbMod, MindMod, NotesMod, ClaudeMod, DbMod (+4 more)

## Knowledge Gaps
- **6 isolated node(s):** `RFC-9728`, `RFC-9728`, `RFC-8414`, `RFC-9728`, `RFC-8414` (+1 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 905 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db()` connect `db` to `dropbox.ts`, `api/diary/route.ts`, `remarkableCloud.ts`, `isAuthenticated`, `ocrLearning.ts`, `mcp.ts`, `backup.ts`, `app/page.tsx`, `owntracks.ts`, `notes.ts`, `callMcpTool`, `db.ts`, `claude.ts`, `insights/route.ts`, `db`, `quality`, `discipline/route.ts`, `remarkableSync.ts`, `ocrBackfill.ts`, `mind.ts`, `discipline/route.ts`, `remarkableImport.ts`, `decisionWiki.ts`, `reflectionWiki.ts`, `DiaryGraphClient.tsx`, `auth.ts`, `devDependencies`, `vitest`, `ForceGraph`, `insights/route.ts`, `notebooks/pin/route.ts`, `embeddings.ts`, `next`, `pendingShares.ts`, `entityMerge.ts`, `vaultGraph.ts`, `memory/route.ts`, `usage.ts`, `Map3D.tsx`, `usage/page.tsx`, `location.ts`, `next`, `mcp/route.ts`, `createPinGate`, `dropboxExportLock.test.ts`, `webauthn.ts`, `ocr-review/route.ts`, `notes.ts`, `createPinGate`, `book/route.ts`, `writing-coach/route.ts`, `mcp/route.ts`, `token/route.ts`, `ref_fs`, `vitest`, `memories/route.ts`?**
  _High betweenness centrality (0.189) - this node is a cross-community bridge._
- **What connects `RFC-9728`, `RFC-9728`, `RFC-8414` to the rest of the system?**
  _6 weakly-connected nodes found - possible missing edges._
- **Should `dropbox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05740740740740741 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `dropbox.ts`, `diaryExportDb.ts`, `api/diary/route.ts`, `isAuthenticated`, `ocrLearning.ts`, `backup.ts`, `app/page.tsx`, `owntracks.ts`, `notes.ts`, `MemoryPage`, `insights/route.ts`, `quality`, `discipline/route.ts`, `remarkableSync.ts`, `discipline/settings/route.ts`, `ocrBackfill.ts`, `mind.ts`, `discipline/route.ts`, `remarkableImport.ts`, `map/pin/route.ts`, `reflectionWiki.ts`, `isAuthenticated`, `auth.ts`, `vitest`, `notebooksPin.ts`, `insights/route.ts`, `embeddings.ts`, `remarkable/status/route.ts`, `graphify_gate.py`, `pendingShares.ts`, `entityMerge.ts`, `layout.tsx`, `vaultGraph.ts`, `memory/route.ts`, `usage/page.tsx`, `manifest.json`, `location.ts`, `next`, `mcp/route.ts`, `package.json`, `format.ts`, `Nav.tsx`, `dropboxExportLock.test.ts`, `webauthn.ts`, `ocr-review/route.ts`, `models/route.ts`, `book/route.ts`, `writing-coach/route.ts`, `librarian/route.ts`, `mcp/route.ts`, `token/route.ts`, `ocrReviewDb.test.ts`, `ref_os`, `memories/route.ts`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Should `diaryExportDb.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10160427807486631 - nodes in this community are weakly interconnected._
- **Why does `isAuthenticated()` connect `isAuthenticated` to `dropbox.ts`, `diaryExportDb.ts`, `api/diary/route.ts`, `ocrLearning.ts`, `backup.ts`, `owntracks.ts`, `notes.ts`, `insights/route.ts`, `quality`, `discipline/route.ts`, `remarkableSync.ts`, `discipline/settings/route.ts`, `ocrBackfill.ts`, `mind.ts`, `discipline/route.ts`, `remarkableImport.ts`, `map/pin/route.ts`, `db`, `reflectionWiki.ts`, `auth.ts`, `vitest`, `insights/route.ts`, `entityMerge.ts`, `embeddings.ts`, `remarkable/status/route.ts`, `next`, `pendingShares.ts`, `entityMerge.ts`, `layout.tsx`, `memory/route.ts`, `usage/page.tsx`, `manifest.json`, `mcp/route.ts`, `dropboxExportLock.test.ts`, `webauthn.ts`, `ocr-review/route.ts`, `models/route.ts`, `book/route.ts`, `writing-coach/route.ts`, `ocrReviewDb.test.ts`, `memories/route.ts`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Should `remarkableCloud.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0444947209653092 - nodes in this community are weakly interconnected._