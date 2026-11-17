# Graph Report - remarkabler  (2026-11-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2347 nodes · 6209 edges · 137 communities (123 shown, 14 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `92b19059`
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
- remarkableTombstone.test.ts
- mapPin.test.ts
- next.config.mjs
- tailwindcss
- chatMemoryFlow.test.ts
- owntracksCurrent.test.ts
- entrypoint.sh

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
10. `notebooksPinDenied()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `OPTIONS()` --calls--> `corsHeaders()`  [EXTRACTED]
  app/api/mcp/oauth/register/route.ts → lib/mcpOauth.ts
- `GET()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/dropbox/callback/route.ts → lib/auth.ts
- `GET()` --calls--> `setSetting()`  [EXTRACTED]
  app/api/dropbox/callback/route.ts → lib/db.ts
- `GET()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/dropbox/connect/route.ts → lib/auth.ts
- `POST()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/dropbox/disconnect/route.ts → lib/auth.ts

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

## Communities (137 total, 14 thin omitted)

### Community 0 - "dropbox.ts"
Cohesion: 0.06
Nodes (74): dynamic, GET(), runtime, dynamic, GET(), runtime, dynamic, POST() (+66 more)

### Community 1 - "diaryExportDb.ts"
Cohesion: 0.06
Nodes (59): dynamic, GET(), runtime, dynamic, GET(), isPlausiblePoint(), POST(), runtime (+51 more)

### Community 2 - "remarkableCloud.ts"
Cohesion: 0.08
Nodes (51): analyzeEntryContent(), AxisLabelResult, buildSelfModel(), CHAT_MEMORY_EXTRACTION_GUIDANCE, chatOverNotes(), cleanEntityWiki(), client(), compareTranscriptions() (+43 more)

### Community 3 - "owntracks.ts"
Cohesion: 0.07
Nodes (21): main(), marker_path(), main(), _align(), _analyze(), _band_extent(), _cw(), _est_pitch() (+13 more)

### Community 4 - "ocrLearning.ts"
Cohesion: 0.08
Nodes (43): dynamic, POST(), runtime, dynamic, POST(), runtime, dynamic, GET() (+35 more)

### Community 5 - "mcp.ts"
Cohesion: 0.05
Nodes (45): MAX_DIARY_ENTRY_CHARS, CHAT_TOOLS, AUDIT_KEEP_ROWS, authFailures, checkMcpAuth(), COMPANION_GUIDANCE, configuredTokens(), DECISION_TOOL (+37 more)

### Community 6 - "diaryGraph.ts"
Cohesion: 0.07
Nodes (31): LockAllButton(), LINKS, Nav(), dynamic, Home(), LatestInsight, preview(), RecentNotebook (+23 more)

### Community 7 - "backup.ts"
Cohesion: 0.08
Nodes (37): dynamic, LOCKED(), POST(), runtime, dynamic, LOCKED(), POST(), runtime (+29 more)

### Community 8 - "app/page.tsx"
Cohesion: 0.12
Nodes (34): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backupConfigured(), BackupStatus (+26 more)

### Community 9 - "chat/route.ts"
Cohesion: 0.07
Nodes (22): setPickingFile(), Card, OcrReview(), Stats, Estimate, OldDiaryProofread(), DuplicateCandidate, Gate (+14 more)

### Community 10 - "notes.ts"
Cohesion: 0.11
Nodes (33): register(), ATTACHMENT_DIR, cleanupOrphanChatAttachments(), maybeCleanupOrphanAttachments(), getSetting(), setSetting(), buildChatContext(), CHAT_DIARY_NOTEBOOK_ID (+25 more)

### Community 11 - "MemoryPage"
Cohesion: 0.09
Nodes (36): addEdge(), addEvidence(), buildDiaryGraph(), canonicalKey(), contentId(), ContentInfo, ContentKind, ContentStats (+28 more)

### Community 12 - "claude.ts"
Cohesion: 0.08
Nodes (20): MemoryPage(), disconnectDropbox(), getPosition(), load(), loadBackup(), loadDisc(), loadDropbox(), loadEmbed() (+12 more)

### Community 13 - "remarkableSync.ts"
Cohesion: 0.08
Nodes (28): DELETE(), dynamic, LOCKED(), runtime, dynamic, Entry, GET(), LOCKED() (+20 more)

### Community 14 - "ref_fs"
Cohesion: 0.11
Nodes (31): dynamic, GET(), runtime, DELETE(), dynamic, GET(), LOCKED(), POST() (+23 more)

### Community 15 - "auth.ts"
Cohesion: 0.14
Nodes (31): dynamic, POST(), relyingParty(), runtime, AUTH_CHALLENGE_COOKIE, authFailKey(), AuthFailState, bumpBucket() (+23 more)

### Community 16 - "chatMemory.ts"
Cohesion: 0.14
Nodes (30): dynamic, GET(), maxDuration, POST(), runtime, CHAT_DIARY_NOTEBOOK_NAME, ensureChatDiaryNotebook(), nextPageIndex() (+22 more)

### Community 17 - "db"
Cohesion: 0.09
Nodes (12): findRouteFiles(), PUBLIC, DbMod, Mod, DbMod, DropboxMod, WikiMod, DbMod (+4 more)

### Community 18 - "quality"
Cohesion: 0.07
Nodes (27): concurrency, cancel-in-progress, group, CI, NEXT_TELEMETRY_DISABLED, jobs, quality, name (+19 more)

### Community 19 - "map/pin/route.ts"
Cohesion: 0.15
Nodes (23): dynamic, GET(), POST(), runtime, unlocked(), attemptsLeft, gate, makeUnlockToken (+15 more)

### Community 20 - "memory/page.tsx"
Cohesion: 0.12
Nodes (21): ChatMemoryItem, ChatMemorySection(), backfillAll(), load(), processPending(), remove(), retryStuck(), ChatMemoryStatus (+13 more)

### Community 21 - "env"
Cohesion: 0.07
Nodes (26): COMMENT_BODY, COMMENT_URL, EVENT_NAME, GH_TOKEN, PR_NUMBER, REPO, if, runs-on (+18 more)

### Community 22 - "setSetting"
Cohesion: 0.23
Nodes (26): countEntriesMentioning(), currentTimeKst(), executeTool(), ftsSearch(), getDaySummary(), getEntriesByDate(), getInsights(), getMonthSummary() (+18 more)

### Community 23 - "layout.tsx"
Cohesion: 0.15
Nodes (24): buildDayFiles(), buildDiaryMarkdown(), buildEntityStubFiles(), collectEntities(), effectiveDateKeys(), EnrichedRow, ENTITY_INDEX_FILE, ENTITY_STUB_FOLDER (+16 more)

### Community 24 - "mind.ts"
Cohesion: 0.18
Nodes (20): track(), clearSans, dynamic, metadata, RootLayout(), viewport, LockOffBanner(), friendly() (+12 more)

### Community 25 - "discipline/route.ts"
Cohesion: 0.19
Nodes (25): allConversationNotesRows(), allConversationFileNames(), allDecisionFileNames(), buildEntityIndexNote(), buildProfileNote(), entityIndexFileName(), entityStubFileName(), sanitizeEntityName() (+17 more)

### Community 26 - "notebooks/route.ts"
Cohesion: 0.14
Nodes (23): AxisLabels, EmbeddingMap(), EntityRankings(), Heatmap(), HeatmapBucket, Map3D, MapPoint, MindData (+15 more)

### Community 27 - "notebooks/page.tsx"
Cohesion: 0.12
Nodes (22): ATTACHMENT_DIR, DELETE(), dynamic, EXT, ext(), EXT_TO_MIME, GET(), IMAGE_TYPES (+14 more)

### Community 28 - "mind/page.tsx"
Cohesion: 0.13
Nodes (22): dynamic, OPTIONS(), POST(), readBoundedJson(), runtime, auditRequest(), dynamic, guarded() (+14 more)

### Community 29 - "embeddings.ts"
Cohesion: 0.19
Nodes (19): DELETE(), dynamic, GET(), LOCKED(), POST(), runtime, escapeHtml(), GET() (+11 more)

### Community 30 - "dependencies"
Cohesion: 0.16
Nodes (21): DecisionEntityInput, ensureDecisionPage(), ensureDecisionsNotebook(), KINDS, tagDecisionEntities(), dateKey(), DECISION_FOLDER, decisionNoteFileName() (+13 more)

### Community 31 - "decisionWiki.ts"
Cohesion: 0.15
Nodes (20): dynamic, GET(), LOCKED(), runtime, ConversationEntityInput, ensureConversationPage(), ensureConversationsNotebook(), getCombinedEntityWiki() (+12 more)

### Community 32 - "reflectionWiki.ts"
Cohesion: 0.18
Nodes (20): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backfillCandidates(), Candidate (+12 more)

### Community 33 - "isAuthenticated"
Cohesion: 0.13
Nodes (19): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, LOCKED(), POST() (+11 more)

### Community 34 - "getCurrentProfile"
Cohesion: 0.16
Nodes (20): ensureReflectionPage(), ensureReflectionsNotebook(), KINDS, ReflectionEntityInput, tagReflectionEntities(), dateKey(), getReflectionByKey(), markReflectionsLinked() (+12 more)

### Community 35 - "DiaryGraphClient.tsx"
Cohesion: 0.13
Nodes (20): applyFixes(), AUTOFIX_MIN, autoFixablePairs(), buildOcrHints(), confirmedTerms(), correctedPairs(), editDistance(), escapeRe() (+12 more)

### Community 36 - "ref_path"
Cohesion: 0.10
Nodes (21): dependencies, better-sqlite3@^11.3.0, jszip@^3.10.1, leaflet@^1.9.4, mcp-handler@^1.1.0, next@^16.4.6, pdf-parse@^2.4.5, react@^19.2.8 (+13 more)

### Community 37 - "entityRelationships.ts"
Cohesion: 0.15
Nodes (18): dynamic, maxDuration, POST(), runtime, EntityWikiExcerpt, candidates(), entityWikiAutoEnabled(), evenSample() (+10 more)

### Community 38 - "devDependencies"
Cohesion: 0.14
Nodes (17): DiaryGraphClient(), EDGE_COLORS, EDGE_LABELS, EDGE_TYPES, formatGeneratedAt(), Inspector(), Metric(), metricLabel() (+9 more)

### Community 39 - "vitest"
Cohesion: 0.11
Nodes (13): better-sqlite3, AuthMod, DbMod, BackupMod, DbMod, CmMod, DbMod, EmbMod (+5 more)

### Community 40 - "entityWiki.ts"
Cohesion: 0.19
Nodes (18): causeCodes(), DownloadedPage, downloadNotebook(), DownloadResult, filterNotebooks(), isTransientNetworkError(), listRemarkableNotebooks(), ListResult (+10 more)

### Community 41 - "ForceGraph"
Cohesion: 0.16
Nodes (18): lockRemarkableImport(), classifyReocr(), cursorValue(), diffRmPages(), IncrementalResult, isWithinQuiesceWindow(), maybeSyncRemarkable(), NotebookRow (+10 more)

### Community 42 - "compilerOptions"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.47, @types/better-sqlite3@^7.6.11, @types/d3-force@^3.0.10, @types/node@^22.7.4, @types/react@^19.2.18, @types/react-dom@^19.2.4 (+12 more)

### Community 43 - "insights/route.ts"
Cohesion: 0.12
Nodes (15): ATTACHMENT_DIR, dynamic, GET(), runtime, dynamic, GET(), LOCKED(), runtime (+7 more)

### Community 44 - "corsHeaders"
Cohesion: 0.20
Nodes (17): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, BINARY_EXT, disciplineConfig() (+9 more)

### Community 45 - "entityMerge.ts"
Cohesion: 0.13
Nodes (15): dynamic, runtime, Block, Box, CaptureArgs, captureExample(), cropPng(), Example (+7 more)

### Community 46 - "notebooks/pin/route.ts"
Cohesion: 0.22
Nodes (17): dynamic, GET(), LOCKED(), POST(), runtime, queueNotebookProcessing(), Cand, estimateRetranscribe() (+9 more)

### Community 47 - "notebooksPinDenied"
Cohesion: 0.13
Nodes (17): EntityPredicate, isEntityPredicate(), PREDICATE_LABELS, PREDICATES, CleanRelationshipInput, cleanRelationships(), EntityKind, getRelationshipsFor() (+9 more)

### Community 48 - "entityTagging.ts"
Cohesion: 0.11
Nodes (10): AuthMod, DbMod, DbMod, DropboxMod, Db, L, Review, Store (+2 more)

### Community 49 - "db.ts"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 50 - "mcpOauth.ts"
Cohesion: 0.19
Nodes (15): dynamic, GET(), LOCKED(), maxDuration, runtime, dynamic, GET(), hasNotes() (+7 more)

### Community 51 - "backfill-all/route.ts"
Cohesion: 0.19
Nodes (16): dynamic, Kind, KINDS, maxDuration, POST(), postMergeDropbox(), runtime, dedupeAllEntities() (+8 more)

### Community 52 - "graphify_gate.py"
Cohesion: 0.24
Nodes (16): dynamic, GET(), POST(), runtime, unlocked(), gate, makeNotebooksUnlockToken, NOTEBOOKS_UNLOCK_COOKIE (+8 more)

### Community 53 - "pendingShares.ts"
Cohesion: 0.14
Nodes (15): AuthCode, authCodes, ClientMetadataResult, ClientRegistrationMetadata, configuredSecrets(), consentSecretValid(), currentSecretHashes(), IssuedTokens (+7 more)

### Community 54 - "package.json"
Cohesion: 0.11
Nodes (10): vitest, CeMod, CwMod, DbMod, DbModule, GeocodeModule, DbMod, DedupMod (+2 more)

### Community 55 - "maybeCompressChatSessions"
Cohesion: 0.18
Nodes (15): backfillTitles(), dynamic, GET(), LOCKED(), maxDuration, PATCH(), POST(), runtime (+7 more)

### Community 56 - "vaultGraph.ts"
Cohesion: 0.18
Nodes (15): dynamic, GET(), OPTIONS(), runtime, RFC-8414, dynamic, GET(), OPTIONS() (+7 more)

### Community 57 - "authorize/route.ts"
Cohesion: 0.26
Nodes (16): wikiLinkingEnabled(), listUnlinkedConversations(), listUnlinkedDecisions(), autoTagConversation(), autoTagDecision(), autoTagExportsEnabled(), autoTagReflection(), evenSample() (+8 more)

### Community 58 - "usage.ts"
Cohesion: 0.19
Nodes (15): CONVERSATION_FOLDER, conversationNoteFileName(), conversationPageId(), dateKey(), ExportedConversationRow, markConversationsLinked(), MAX_CONVERSATION_CHARS, renderConversationNote() (+7 more)

### Community 59 - "Map3D.tsx"
Cohesion: 0.12
Nodes (15): @anthropic-ai/sdk@^0.96.0, mammoth@^1.12.0, @modelcontextprotocol/sdk@^1.26.0, posthog-js@^1.374.3, @types/leaflet@^1.9.12, engines, node, name (+7 more)

### Community 60 - "usage/page.tsx"
Cohesion: 0.23
Nodes (11): dynamic, LOCKED(), POST(), runtime, BackfillMessage, CHUNK_TARGET_CHARS, chunkedBackfillForConversation(), chunkMessageIds() (+3 more)

### Community 61 - "manifest.json"
Cohesion: 0.20
Nodes (11): dynamic, GET(), runtime, DiaryGraphEdge, DiaryGraphNode, DiaryGraphPayload, VaultNoteKind, addVaultNotesToGraph() (+3 more)

### Community 62 - "location.ts"
Cohesion: 0.32
Nodes (14): consentForm(), destHost(), dynamic, esc(), GET(), OAuthParams, page(), POST() (+6 more)

### Community 63 - "register/route.ts"
Cohesion: 0.25
Nodes (11): dynamic, GET(), LOCKED(), runtime, buildCandidate(), buildCloudCoverage(), classifyDuplicate(), CloudCoverage (+3 more)

### Community 64 - "analyzePending"
Cohesion: 0.20
Nodes (11): dynamic, LOCKED(), maxDuration, POST(), runtime, carryForwardDates(), DiaryPageRow, DISCIPLINE_ID (+3 more)

### Community 65 - "next"
Cohesion: 0.18
Nodes (14): ActiveLabel(), Axes(), AxisEndLabel(), AxisLabels, Map3D(), MapPoint, Point(), sentimentColour() (+6 more)

### Community 66 - "mcp/route.ts"
Cohesion: 0.13
Nodes (14): background_color, description, display, icons, name, files, share_target, action (+6 more)

### Community 67 - "AutoLock"
Cohesion: 0.25
Nodes (10): dynamic, GET(), LOCKED(), POST(), runtime, addLocation(), isLocationEnabled(), listRecentLocations() (+2 more)

### Community 68 - "diaryGraph.test.ts"
Cohesion: 0.22
Nodes (12): dynamic, GET(), LOCKED(), POST(), runtime, maybeRefreshHandwritingNotes(), correctedPairsForNotes(), handwritingNotesDue() (+4 more)

### Community 69 - "mcpOauth.test.ts"
Cohesion: 0.24
Nodes (12): dynamic, GET(), runtime, dailyUsage(), FALLBACK, monthlyUsage(), Prices, PRICES (+4 more)

### Community 70 - "notebooks/[id]/pdf/route.ts"
Cohesion: 0.24
Nodes (11): ExistingRow, importRemarkableNotebookInner(), ImportResult, importsInFlight, ImportStatus, unlockRemarkableImport(), execFileAsync, renderersAvailable() (+3 more)

### Community 71 - "token/route.ts"
Cohesion: 0.31
Nodes (11): dynamic, fmtDate(), fmtDateTime(), fmtTime(), GET(), LOCKED(), maxDuration, runtime (+3 more)

### Community 72 - "mind/route.ts"
Cohesion: 0.22
Nodes (11): dynamic, LOCKED(), POST(), runtime, dynamic, GET(), LOCKED(), runtime (+3 more)

### Community 73 - "createPinGate"
Cohesion: 0.40
Nodes (11): AutoLock(), cancelPending(), lockNow(), markHiddenIfNeeded(), onPageHide(), onVisibility(), clearHiddenSince(), readHiddenSince() (+3 more)

### Community 74 - "dropboxExportLock.test.ts"
Cohesion: 0.27
Nodes (12): examplesAvailable(), anchorPhrase(), replaceAt(), recordLearned(), captureHandwriting(), FlagRow, learn(), listReviewCards() (+4 more)

### Community 75 - "webauthn.ts"
Cohesion: 0.15
Nodes (8): CeMod, CwMod, DbMod, DiaryGraphPayload, GraphMod, MindMod, NotesMod, RelMod

### Community 76 - "api/export/route.ts"
Cohesion: 0.22
Nodes (7): codeFrom(), consent(), exchange(), issueAccessToken(), Mod, pkce(), register()

### Community 77 - "grants/route.ts"
Cohesion: 0.26
Nodes (12): handler, callMcpTool(), conversationExportEnabled(), decisionSavingEnabled(), diaryWriteEnabled(), effectiveExcludedToolNames(), excludedToolNames(), librarianToolsEnabled() (+4 more)

### Community 78 - "interruptedNotebookRecovery.test.ts"
Cohesion: 0.29
Nodes (8): clean(), contextSnippet(), MAX_FLAGS_PER_CALL, OcrFlag, parseBox(), parseFlagLines(), squash(), clearPendingFlagsForNotebook()

### Community 79 - "relatedEntities.test.ts"
Cohesion: 0.29
Nodes (10): dynamic, err(), POST(), readForm(), runtime, issueTokens(), pruneExpiredTokens(), redeemAuthCode() (+2 more)

### Community 80 - "chatDiary.ts"
Cohesion: 0.29
Nodes (10): ForceGraph(), draw(), fit(), hit(), loop(), onDown(), onMove(), onWheel() (+2 more)

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
Nodes (9): GET(), isLockEnabled(), buildAuthenticationOptions(), buildRegistrationOptions(), hasCredentials(), listCredentials(), parseTransports(), StoredCredential (+1 more)

### Community 85 - "diaryExportDb.test.ts"
Cohesion: 0.31
Nodes (9): DELETE(), dynamic, GET(), runtime, requireAuth(), dropAuthCodesForClient(), listOAuthAudit(), listOAuthGrants() (+1 more)

### Community 86 - "entityWriteAtomicity.test.ts"
Cohesion: 0.20
Nodes (9): ForceEdgeInput, ForceNodeInput, Props, radiusFor(), SimLink, SimNode, Transform, d3-force@^3.0.1 (+1 more)

### Community 88 - "memories/route.ts"
Cohesion: 0.20
Nodes (5): ChatToolsMod, DbMod, MergeMod, NotesMod, Result

### Community 89 - "librarian/route.ts"
Cohesion: 0.33
Nodes (8): dynamic, GET(), LOCKED(), POST(), resolve(), runtime, Slot, SLOTS

### Community 90 - "entityGraph.ts"
Cohesion: 0.22
Nodes (8): build, builder, dockerfilePath, deploy, restartPolicyMaxRetries, restartPolicyType, startCommand, $schema

### Community 91 - "scripts"
Cohesion: 0.22
Nodes (6): body, enc, iv, MAGIC, salt, tag

### Community 92 - "chatToolsLocation.test.ts"
Cohesion: 0.22
Nodes (5): AuthMod, DbMod, requestCookies, RouteMod, webauthn

### Community 93 - "entityMerge.test.ts"
Cohesion: 0.22
Nodes (4): ChatToolsMod, DbMod, MindMod, NotesMod

### Community 94 - "entityRelationships.test.ts"
Cohesion: 0.39
Nodes (7): dynamic, GET(), LOCKED(), POST(), runtime, isDisciplineEnabled(), setDisciplineEnabled()

### Community 95 - "getTopEntities.test.ts"
Cohesion: 0.25
Nodes (3): DbMod, ExportMod, NotesMod

### Community 97 - "api/diary/route.ts"
Cohesion: 0.25
Nodes (3): ChatToolsMod, DbMod, NotesMod

### Community 98 - "chatMemoryExtract.test.ts"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), MemoryRow, runtime, pendingBatchDetails()

### Community 99 - "chatMemoryRecall.test.ts"
Cohesion: 0.43
Nodes (6): dynamic, PATCH(), runtime, correctPageText(), learnFromEdit(), pageTextOf()

### Community 100 - "chatMemoryRolling.test.ts"
Cohesion: 0.38
Nodes (6): dynamic, LOCKED(), maxDuration, POST(), runtime, importRemarkableNotebook()

### Community 101 - "entityTagging.test.ts"
Cohesion: 0.29
Nodes (6): buildHomeNote(), countLine(), HOME_FILE, HomeStats, PROFILE_FILE, STATS

### Community 102 - "mind.test.ts"
Cohesion: 0.38
Nodes (4): computeRelatedEntities(), DayMembership, EntityKind, RelatedEntity

### Community 103 - "notebookDedupDb.test.ts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, test:watch

### Community 104 - "ocrReviewDb.test.ts"
Cohesion: 0.29
Nodes (4): ChatToolsMod, DbMod, LocationMod, OwntracksMod

### Community 106 - "duplicates/route.ts"
Cohesion: 0.29
Nodes (4): CwMod, DbMod, MergeMod, RelMod

### Community 107 - "eslint"
Cohesion: 0.29
Nodes (3): DbMod, MindMod, NotesMod

### Community 108 - "correctPageText.test.ts"
Cohesion: 0.29
Nodes (3): ChatToolsMod, McpMod, RouteMod

### Community 109 - "dropboxTombstone.test.ts"
Cohesion: 0.40
Nodes (5): dynamic, GET(), LOCKED(), maxDuration, runtime

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
Nodes (3): Db, Review, Store

### Community 117 - "tailwindcss"
Cohesion: 0.33
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 118 - "chatMemoryFlow.test.ts"
Cohesion: 0.40
Nodes (4): eslint@^9.39.5, eslint-config-next@^16.3.2, eslint, eslint-config-next

### Community 119 - "conversationEntities.test.ts"
Cohesion: 0.40
Nodes (4): CdMod, DbMod, MindMod, NotesMod

### Community 123 - "entrypoint.sh"
Cohesion: 0.40
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 124 - "rm2pdf"
Cohesion: 0.40
Nodes (4): DbMod, EmbMod, MindMod, NotesMod

### Community 125 - "postcss.config.mjs"
Cohesion: 0.40
Nodes (3): ClaudeMod, DbMod, EwMod

### Community 126 - "ocrReviewDb.test.ts"
Cohesion: 0.40
Nodes (4): CeMod, DbMod, ReMod, RwMod

### Community 127 - "entityWikiExclude.test.ts"
Cohesion: 0.40
Nodes (3): DbMod, NotesMod, SyncMod

### Community 129 - "remarkableTombstone.test.ts"
Cohesion: 0.50
Nodes (3): RFC-8414, RFC-9728, nextConfig

### Community 130 - "mapPin.test.ts"
Cohesion: 0.50
Nodes (3): tailwindcss@^3.4.13, tailwindcss, config

## Knowledge Gaps
- **6 isolated node(s):** `RFC-8414`, `RFC-9728`, `RFC-9728`, `RFC-7591`, `RFC-8414` (+1 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 883 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db()` connect `setSetting` to `dropbox.ts`, `diaryExportDb.ts`, `remarkableCloud.ts`, `ocrLearning.ts`, `mcp.ts`, `diaryGraph.ts`, `backup.ts`, `app/page.tsx`, `notes.ts`, `MemoryPage`, `remarkableSync.ts`, `ref_fs`, `auth.ts`, `chatMemory.ts`, `discipline/route.ts`, `notebooks/page.tsx`, `mind/page.tsx`, `embeddings.ts`, `dependencies`, `decisionWiki.ts`, `reflectionWiki.ts`, `getCurrentProfile`, `DiaryGraphClient.tsx`, `entityRelationships.ts`, `vitest`, `ForceGraph`, `insights/route.ts`, `corsHeaders`, `entityMerge.ts`, `notebooks/pin/route.ts`, `notebooksPinDenied`, `entityTagging.ts`, `mcpOauth.ts`, `backfill-all/route.ts`, `pendingShares.ts`, `maybeCompressChatSessions`, `authorize/route.ts`, `usage.ts`, `usage/page.tsx`, `location.ts`, `register/route.ts`, `analyzePending`, `AutoLock`, `diaryGraph.test.ts`, `mcpOauth.test.ts`, `notebooks/[id]/pdf/route.ts`, `token/route.ts`, `dropboxExportLock.test.ts`, `interruptedNotebookRecovery.test.ts`, `relatedEntities.test.ts`, `topEntities.test.ts`, `diaryExportDb.test.ts`, `chatMemoryExtract.test.ts`, `chatMemoryRecall.test.ts`, `correctPageText.test.ts`?**
  _High betweenness centrality (0.204) - this node is a cross-community bridge._
- **What connects `RFC-8414`, `RFC-9728`, `RFC-9728` to the rest of the system?**
  _6 weakly-connected nodes found - possible missing edges._
- **Should `dropbox.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05693664795509222 - nodes in this community are weakly interconnected._
- **Why does `next` connect `insights/route.ts` to `dropbox.ts`, `diaryExportDb.ts`, `ocrLearning.ts`, `diaryGraph.ts`, `backup.ts`, `app/page.tsx`, `remarkableSync.ts`, `ref_fs`, `auth.ts`, `chatMemory.ts`, `db`, `map/pin/route.ts`, `memory/page.tsx`, `mind.ts`, `notebooks/route.ts`, `notebooks/page.tsx`, `mind/page.tsx`, `embeddings.ts`, `decisionWiki.ts`, `reflectionWiki.ts`, `isAuthenticated`, `ref_path`, `entityRelationships.ts`, `corsHeaders`, `entityMerge.ts`, `notebooks/pin/route.ts`, `mcpOauth.ts`, `backfill-all/route.ts`, `graphify_gate.py`, `maybeCompressChatSessions`, `vaultGraph.ts`, `Map3D.tsx`, `usage/page.tsx`, `manifest.json`, `location.ts`, `register/route.ts`, `analyzePending`, `AutoLock`, `diaryGraph.test.ts`, `mcpOauth.test.ts`, `token/route.ts`, `mind/route.ts`, `relatedEntities.test.ts`, `diaryExportDb.test.ts`, `librarian/route.ts`, `chatToolsLocation.test.ts`, `entityRelationships.test.ts`, `chatMemoryExtract.test.ts`, `chatMemoryRecall.test.ts`, `chatMemoryRolling.test.ts`, `dropboxTombstone.test.ts`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Should `diaryExportDb.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06376811594202898 - nodes in this community are weakly interconnected._
- **Why does `isAuthenticated()` connect `remarkableSync.ts` to `dropbox.ts`, `diaryExportDb.ts`, `ocrLearning.ts`, `backup.ts`, `app/page.tsx`, `ref_fs`, `auth.ts`, `chatMemory.ts`, `setSetting`, `mind.ts`, `notebooks/page.tsx`, `embeddings.ts`, `decisionWiki.ts`, `reflectionWiki.ts`, `isAuthenticated`, `entityRelationships.ts`, `devDependencies`, `insights/route.ts`, `corsHeaders`, `entityMerge.ts`, `notebooks/pin/route.ts`, `mcpOauth.ts`, `backfill-all/route.ts`, `maybeCompressChatSessions`, `usage/page.tsx`, `manifest.json`, `register/route.ts`, `analyzePending`, `AutoLock`, `diaryGraph.test.ts`, `mcpOauth.test.ts`, `token/route.ts`, `mind/route.ts`, `topEntities.test.ts`, `diaryExportDb.test.ts`, `librarian/route.ts`, `entityRelationships.test.ts`, `chatMemoryExtract.test.ts`, `chatMemoryRecall.test.ts`, `chatMemoryRolling.test.ts`, `dropboxTombstone.test.ts`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Should `remarkableCloud.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08395989974937343 - nodes in this community are weakly interconnected._