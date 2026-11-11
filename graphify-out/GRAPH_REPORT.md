# Graph Report - remarkabler  (2026-11-11)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1997 nodes · 5203 edges · 119 communities (105 shown, 14 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0c6f0027`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 117
- Community 118

## God Nodes (most connected - your core abstractions)
1. `db()` - 276 edges
2. `isAuthenticated()` - 129 edges
3. `vitest` - 77 edges
4. `next` - 72 edges
5. `getSetting()` - 61 edges
6. `setSetting()` - 59 edges
7. `MemoryPage()` - 41 edges
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
- `guarded()` --calls--> `checkMcpAuth()`  [EXTRACTED]
  app/api/mcp/route.ts → lib/mcp.ts
- `backfillTitles()` --calls--> `db()`  [EXTRACTED]
  app/api/insights/route.ts → lib/db.ts

## Import Cycles
- 2-file cycle: `lib/entityMerge.ts -> lib/mind.ts -> lib/entityMerge.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/claude.ts -> lib/chatTools.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/dropbox.ts -> lib/reflectionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/conversationWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/conversationWiki.ts`
- 4-file cycle: `lib/diaryExportDb.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts`
- 4-file cycle: `lib/decisionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/decisionWiki.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/mind.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/entityMerge.ts -> lib/claude.ts -> lib/chatTools.ts`
- 5-file cycle: `lib/conversationEntities.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts -> lib/conversationEntities.ts`
- 5-file cycle: `lib/diaryExportDb.ts -> lib/reflectionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts`
- 5-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/entityMerge.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 5-file cycle: `lib/conversationWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts -> lib/conversationWiki.ts`
- 5-file cycle: `lib/decisionWiki.ts -> lib/notes.ts -> lib/insightSources.ts -> lib/dropbox.ts -> lib/diaryExportDb.ts -> lib/decisionWiki.ts`

## Communities (119 total, 14 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (57): handler, MAX_DIARY_ENTRY_CHARS, CHAT_TOOLS, AUDIT_KEEP_ROWS, authFailures, callMcpTool(), checkMcpAuth(), COMPANION_GUIDANCE (+49 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (48): backfillTitles(), dynamic, GET(), LOCKED(), maxDuration, PATCH(), POST(), runtime (+40 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (47): dynamic, LOCKED(), POST(), runtime, downloadNotebook(), listRemarkableNotebooks(), pairRemarkable(), remarkablePaired() (+39 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (44): dynamic, POST(), runtime, dynamic, POST(), runtime, dynamic, POST() (+36 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (44): dynamic, LOCKED(), POST(), runtime, dynamic, LOCKED(), POST(), runtime (+36 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (40): markConversationsFiled(), unfiledConversationKeys(), markDecisionsFiled(), renderDecisionNoteFiles(), unfiledDecisionKeys(), classifyDropboxError(), deleteFile(), DiaryExportResult (+32 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (40): dynamic, GET(), POST(), relyingParty(), runtime, AUTH_CHALLENGE_COOKIE, authFailKey(), AuthFailState (+32 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (34): ATTACHMENT_DIR, dynamic, GET(), runtime, DELETE(), dynamic, LOCKED(), runtime (+26 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (33): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, LOCKED(), POST() (+25 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (34): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, dynamic, GET() (+26 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (37): ExportedConversationRow, addEdge(), addEvidence(), buildDiaryGraph(), canonicalKey(), contentId(), ContentInfo, ContentKind (+29 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (20): MemoryPage(), disconnectDropbox(), getPosition(), load(), loadBackup(), loadDisc(), loadDropbox(), loadEmbed() (+12 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (30): ext(), POST(), dynamic, GET(), isPlausiblePoint(), POST(), runtime, getRecentLocations() (+22 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (24): Insight, dynamic, Home(), LatestInsight, preview(), RecentNotebook, statusLabel(), Badge() (+16 more)

### Community 14 - "Community 14"
Cohesion: 0.10
Nodes (28): dependencies, @anthropic-ai/sdk@^0.96.0, jszip@^3.10.1, mammoth@^1.12.0, mcp-handler@^1.1.0, @modelcontextprotocol/sdk@^1.26.0, next@^16.3.2, pdf-parse@^2.4.5 (+20 more)

### Community 15 - "Community 15"
Cohesion: 0.11
Nodes (17): clearSans, dynamic, metadata, RootLayout(), viewport, LockAllButton(), LockOffBanner(), LINKS (+9 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (26): DELETE(), dynamic, GET(), LOCKED(), POST(), runtime, cleanName(), createPendingShare() (+18 more)

### Community 17 - "Community 17"
Cohesion: 0.07
Nodes (27): concurrency, cancel-in-progress, group, CI, NEXT_TELEMETRY_DISABLED, jobs, quality, name (+19 more)

### Community 18 - "Community 18"
Cohesion: 0.07
Nodes (26): COMMENT_BODY, COMMENT_URL, EVENT_NAME, GH_TOKEN, PR_NUMBER, REPO, if, runs-on (+18 more)

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (24): buildDayFiles(), buildDiaryMarkdown(), buildEntityStubFiles(), buildHomeNote(), collectEntities(), countLine(), EnrichedRow, ENTITY_INDEX_FILE (+16 more)

### Community 20 - "Community 20"
Cohesion: 0.25
Nodes (25): countEntriesMentioning(), currentTimeKst(), executeTool(), ftsSearch(), getDaySummary(), getEntriesByDate(), getInsights(), getMonthSummary() (+17 more)

### Community 21 - "Community 21"
Cohesion: 0.16
Nodes (22): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backupConfigured(), BackupStatus (+14 more)

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (23): AxisLabels, EmbeddingMap(), EntityRankings(), Heatmap(), HeatmapBucket, Map3D, MapPoint, MindData (+15 more)

### Community 23 - "Community 23"
Cohesion: 0.14
Nodes (23): register(), summarizeDay(), claimNextQueuedNotebook(), countMissingEmbeddings(), drainNotebookProcessingQueue(), ensureProfileSeed(), extractEntryDate(), FILES_DIR (+15 more)

### Community 24 - "Community 24"
Cohesion: 0.14
Nodes (23): ConversationEntityInput, ensureConversationPage(), ensureConversationsNotebook(), getCombinedEntityWiki(), getConversationNotes(), KINDS, MAX_ENTITY_NOTES_CHARS, tagConversationEntities() (+15 more)

### Community 25 - "Community 25"
Cohesion: 0.20
Nodes (24): allConversationNotesRows(), allConversationFileNames(), allDecisionFileNames(), buildEntityIndexNote(), buildProfileNote(), entityStubFileName(), sanitizeEntityName(), affectedEntityStubFileNames() (+16 more)

### Community 26 - "Community 26"
Cohesion: 0.14
Nodes (21): dynamic, OPTIONS(), POST(), readBoundedJson(), runtime, auditRequest(), dynamic, guarded() (+13 more)

### Community 27 - "Community 27"
Cohesion: 0.18
Nodes (21): DELETE(), dynamic, GET(), LOCKED(), POST(), runtime, escapeHtml(), GET() (+13 more)

### Community 28 - "Community 28"
Cohesion: 0.14
Nodes (21): resolveConversationEntityName(), updateConversationNotes(), REFLECTIONS_NOTEBOOK_ID, ensureReflectionPage(), ensureReflectionsNotebook(), KINDS, ReflectionEntityInput, tagReflectionEntities() (+13 more)

### Community 29 - "Community 29"
Cohesion: 0.09
Nodes (15): recoverInterruptedNotebooks(), better-sqlite3@^11.3.0, better-sqlite3, BackupMod, DbMod, CeMod, CwMod, DbMod (+7 more)

### Community 30 - "Community 30"
Cohesion: 0.15
Nodes (21): DecisionEntityInput, ensureDecisionPage(), ensureDecisionsNotebook(), KINDS, tagDecisionEntities(), dateKey(), DECISION_FOLDER, decisionNoteFileName() (+13 more)

### Community 31 - "Community 31"
Cohesion: 0.17
Nodes (16): dynamic, GET(), LOCKED(), POST(), runtime, dynamic, GET(), LOCKED() (+8 more)

### Community 32 - "Community 32"
Cohesion: 0.13
Nodes (18): DiaryGraphClient(), EDGE_COLORS, EDGE_LABELS, EDGE_TYPES, formatGeneratedAt(), Inspector(), Metric(), metricLabel() (+10 more)

### Community 33 - "Community 33"
Cohesion: 0.14
Nodes (18): AuthCode, authCodes, ClientMetadataResult, ClientRegistrationMetadata, configuredSecrets(), consentSecretValid(), currentSecretHashes(), IssuedTokens (+10 more)

### Community 34 - "Community 34"
Cohesion: 0.25
Nodes (18): track(), InsightsPage(), copy(), download(), exportText(), generate(), load(), summarize() (+10 more)

### Community 35 - "Community 35"
Cohesion: 0.13
Nodes (18): ATTACHMENT_DIR, DELETE(), dynamic, EXT, EXT_TO_MIME, GET(), IMAGE_TYPES, LOCKED() (+10 more)

### Community 36 - "Community 36"
Cohesion: 0.18
Nodes (18): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, GET(), runtime (+10 more)

### Community 37 - "Community 37"
Cohesion: 0.23
Nodes (18): dynamic, GET(), maxDuration, POST(), runtime, reembedMissingMemories(), callVoyage(), embed() (+10 more)

### Community 38 - "Community 38"
Cohesion: 0.13
Nodes (18): EntityPredicate, isEntityPredicate(), PREDICATE_LABELS, PREDICATES, CleanRelationshipInput, cleanRelationships(), EntityKind, getRelationshipsFor() (+10 more)

### Community 39 - "Community 39"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.47, @types/better-sqlite3@^7.6.11, @types/d3-force@^3.0.10, @types/node@^22.7.4, @types/react@^19.2.18, @types/react-dom@^19.2.4 (+12 more)

### Community 40 - "Community 40"
Cohesion: 0.18
Nodes (15): dynamic, GET(), LOCKED(), runtime, effectiveDateKeys(), isDatedEntry(), affectedDayFileNames(), buildCandidate() (+7 more)

### Community 41 - "Community 41"
Cohesion: 0.15
Nodes (14): setPickingFile(), DuplicateCandidate, Notebook, NotebooksPage(), approvePending(), load(), loadDuplicates(), loadPendingShares() (+6 more)

### Community 42 - "Community 42"
Cohesion: 0.25
Nodes (18): extractTaggingEntities(), wikiLinkingEnabled(), listUnlinkedConversations(), listUnlinkedDecisions(), autoTagConversation(), autoTagDecision(), autoTagExportsEnabled(), autoTagReflection() (+10 more)

### Community 43 - "Community 43"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 44 - "Community 44"
Cohesion: 0.17
Nodes (16): dynamic, maxDuration, POST(), runtime, EntityWikiExcerpt, candidates(), evenSample(), excerptHash() (+8 more)

### Community 45 - "Community 45"
Cohesion: 0.19
Nodes (16): dynamic, Kind, KINDS, maxDuration, POST(), postMergeDropbox(), runtime, dedupeAllEntities() (+8 more)

### Community 46 - "Community 46"
Cohesion: 0.18
Nodes (16): dynamic, GET(), LOCKED(), POST(), resolve(), runtime, Slot, SLOTS (+8 more)

### Community 47 - "Community 47"
Cohesion: 0.11
Nodes (9): vitest, ChatMemMod, DbMod, DbMod, DropboxMod, CeMod, DbMod, ReMod (+1 more)

### Community 48 - "Community 48"
Cohesion: 0.12
Nodes (9): AuthMod, DbMod, WikiMod, DbModule, GeocodeModule, DbMod, OwntracksMod, DbMod (+1 more)

### Community 49 - "Community 49"
Cohesion: 0.12
Nodes (9): CdMod, DbMod, MindMod, NotesMod, DbMod, MindMod, NotesMod, DbMod (+1 more)

### Community 50 - "Community 50"
Cohesion: 0.17
Nodes (11): dynamic, GET(), runtime, dynamic, GET(), runtime, buildAuthUrl(), exchangeCodeForTokens() (+3 more)

### Community 51 - "Community 51"
Cohesion: 0.29
Nodes (15): consentForm(), destHost(), dynamic, esc(), GET(), OAuthParams, page(), POST() (+7 more)

### Community 52 - "Community 52"
Cohesion: 0.17
Nodes (13): ChatMemoryItem, ChatMemorySection(), backfillAll(), load(), processPending(), remove(), retryStuck(), ChatMemoryStatus (+5 more)

### Community 53 - "Community 53"
Cohesion: 0.21
Nodes (11): dynamic, GET(), runtime, DiaryGraphNode, DiaryGraphPayload, VaultNoteKind, insightDropboxFolders(), addVaultNotesToGraph() (+3 more)

### Community 54 - "Community 54"
Cohesion: 0.17
Nodes (13): dynamic, GET(), OPTIONS(), runtime, RFC-8414, dynamic, GET(), OPTIONS() (+5 more)

### Community 55 - "Community 55"
Cohesion: 0.22
Nodes (13): dynamic, GET(), runtime, dailyUsage(), FALLBACK, monthlyUsage(), priceFor(), Prices (+5 more)

### Community 56 - "Community 56"
Cohesion: 0.18
Nodes (14): ActiveLabel(), Axes(), AxisEndLabel(), AxisLabels, Map3D(), MapPoint, Point(), sentimentColour() (+6 more)

### Community 57 - "Community 57"
Cohesion: 0.13
Nodes (14): background_color, description, display, icons, name, files, share_target, action (+6 more)

### Community 58 - "Community 58"
Cohesion: 0.13
Nodes (9): findRouteFiles(), PUBLIC, AuthMod, DbMod, CmMod, DbMod, EmbMod, DbMod (+1 more)

### Community 59 - "Community 59"
Cohesion: 0.24
Nodes (10): dynamic, LOCKED(), POST(), runtime, BackfillMessage, CHUNK_TARGET_CHARS, chunkedBackfillForConversation(), chunkMessageIds() (+2 more)

### Community 60 - "Community 60"
Cohesion: 0.22
Nodes (10): dynamic, LOCKED(), maxDuration, POST(), runtime, carryForwardDates(), DiaryPageRow, compareImportedNotebook() (+2 more)

### Community 61 - "Community 61"
Cohesion: 0.31
Nodes (11): dynamic, fmtDate(), fmtDateTime(), fmtTime(), GET(), LOCKED(), maxDuration, runtime (+3 more)

### Community 62 - "Community 62"
Cohesion: 0.40
Nodes (11): AutoLock(), cancelPending(), lockNow(), markHiddenIfNeeded(), onPageHide(), onVisibility(), clearHiddenSince(), readHiddenSince() (+3 more)

### Community 63 - "Community 63"
Cohesion: 0.21
Nodes (10): DayCost, DayData, FEATURE_LABEL, FeatureCost, money(), MonthData, pad(), UsagePage() (+2 more)

### Community 64 - "Community 64"
Cohesion: 0.15
Nodes (8): CeMod, CwMod, DbMod, DiaryGraphPayload, GraphMod, MindMod, NotesMod, RelMod

### Community 65 - "Community 65"
Cohesion: 0.22
Nodes (7): codeFrom(), consent(), exchange(), issueAccessToken(), Mod, pkce(), register()

### Community 66 - "Community 66"
Cohesion: 0.29
Nodes (11): dynamic, err(), OPTIONS(), POST(), readForm(), runtime, corsHeaders(), issueTokens() (+3 more)

### Community 67 - "Community 67"
Cohesion: 0.29
Nodes (10): ForceGraph(), draw(), fit(), hit(), loop(), onDown(), onMove(), onWheel() (+2 more)

### Community 68 - "Community 68"
Cohesion: 0.20
Nodes (7): ConversationWikiMod, DbMod, deferred(), DiaryExportDbMod, DropboxMod, mockDropboxFetch(), UploadCall

### Community 69 - "Community 69"
Cohesion: 0.20
Nodes (8): dynamic, GET(), runtime, DbMod, NotesMod, pdf, PendingMod, ShareRoute

### Community 70 - "Community 70"
Cohesion: 0.20
Nodes (9): ForceEdgeInput, ForceNodeInput, Props, radiusFor(), SimLink, SimNode, Transform, d3-force@^3.0.1 (+1 more)

### Community 72 - "Community 72"
Cohesion: 0.20
Nodes (5): ChatToolsMod, DbMod, MergeMod, NotesMod, Result

### Community 73 - "Community 73"
Cohesion: 0.33
Nodes (8): DELETE(), dynamic, GET(), runtime, requireAuth(), dropAuthCodesForClient(), listOAuthAudit(), revokeOAuthGrant()

### Community 74 - "Community 74"
Cohesion: 0.36
Nodes (8): dynamic, GET(), hasNotes(), LOCKED(), maxDuration, POST(), runtime, getCurrentProfileRow()

### Community 75 - "Community 75"
Cohesion: 0.33
Nodes (7): CHAT_DIARY_NOTEBOOK_NAME, ensureChatDiaryNotebook(), nextPageIndex(), normaliseDate(), saveChatDiaryEntry(), CHAT_DIARY_NOTEBOOK_ID, todayLocalDate()

### Community 76 - "Community 76"
Cohesion: 0.22
Nodes (8): build, builder, dockerfilePath, deploy, restartPolicyMaxRetries, restartPolicyType, startCommand, $schema

### Community 77 - "Community 77"
Cohesion: 0.22
Nodes (5): AuthMod, DbMod, requestCookies, RouteMod, webauthn

### Community 78 - "Community 78"
Cohesion: 0.22
Nodes (4): ChatToolsMod, DbMod, MindMod, NotesMod

### Community 79 - "Community 79"
Cohesion: 0.25
Nodes (3): DbMod, ExportMod, NotesMod

### Community 81 - "Community 81"
Cohesion: 0.25
Nodes (3): ChatToolsMod, DbMod, NotesMod

### Community 82 - "Community 82"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), MemoryRow, runtime, pendingBatchDetails()

### Community 83 - "Community 83"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), runtime, LibrarianStatus, librarianStatus()

### Community 84 - "Community 84"
Cohesion: 0.29
Nodes (6): entityIndexFileName(), HOME_FILE, HomeStats, PROFILE_FILE, vaultStructureFileNames(), STATS

### Community 85 - "Community 85"
Cohesion: 0.38
Nodes (4): computeRelatedEntities(), DayMembership, EntityKind, RelatedEntity

### Community 86 - "Community 86"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, test:watch

### Community 87 - "Community 87"
Cohesion: 0.29
Nodes (4): ChatToolsMod, DbMod, LocationMod, OwntracksMod

### Community 89 - "Community 89"
Cohesion: 0.29
Nodes (4): CwMod, DbMod, MergeMod, RelMod

### Community 90 - "Community 90"
Cohesion: 0.29
Nodes (3): DbMod, MindMod, NotesMod

### Community 91 - "Community 91"
Cohesion: 0.29
Nodes (3): ChatToolsMod, McpMod, RouteMod

### Community 92 - "Community 92"
Cohesion: 0.40
Nodes (5): dynamic, Entry, GET(), LOCKED(), runtime

### Community 93 - "Community 93"
Cohesion: 0.40
Nodes (5): dynamic, GET(), LOCKED(), maxDuration, runtime

### Community 94 - "Community 94"
Cohesion: 0.40
Nodes (5): dynamic, LOCKED(), maxDuration, POST(), runtime

### Community 95 - "Community 95"
Cohesion: 0.40
Nodes (5): blocksFor(), buildSavedSessionsContext(), DEFAULT_INSIGHT_DROPBOX_FOLDERS, InsightExtraContext, SavedRow

### Community 96 - "Community 96"
Cohesion: 0.33
Nodes (3): ClaudeMod, CmMod, DbMod

### Community 97 - "Community 97"
Cohesion: 0.33
Nodes (3): CmMod, DbMod, EmbMod

### Community 98 - "Community 98"
Cohesion: 0.33
Nodes (5): ClaudeMod, CwMod, DbMod, EtMod, RwMod

### Community 99 - "Community 99"
Cohesion: 0.33
Nodes (3): DbMod, DedupMod, NotesMod

### Community 100 - "Community 100"
Cohesion: 0.33
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 102 - "Community 102"
Cohesion: 0.40
Nodes (4): eslint@^9.39.5, eslint-config-next@^16.3.2, eslint, eslint-config-next

### Community 103 - "Community 103"
Cohesion: 0.40
Nodes (3): RFC-8414, RFC-9728, nextConfig

### Community 107 - "Community 107"
Cohesion: 0.40
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 108 - "Community 108"
Cohesion: 0.40
Nodes (4): DbMod, EmbMod, MindMod, NotesMod

### Community 109 - "Community 109"
Cohesion: 0.40
Nodes (3): ClaudeMod, DbMod, EwMod

### Community 110 - "Community 110"
Cohesion: 0.40
Nodes (3): DbMod, NotesMod, SyncMod

### Community 111 - "Community 111"
Cohesion: 0.50
Nodes (3): tailwindcss@^3.4.13, tailwindcss, config

## Knowledge Gaps
- **6 isolated node(s):** `RFC-8414`, `RFC-9728`, `RFC-9728`, `RFC-7591`, `RFC-8414` (+1 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 779 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db()` connect `Community 20` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 9`, `Community 10`, `Community 12`, `Community 13`, `Community 16`, `Community 21`, `Community 23`, `Community 24`, `Community 25`, `Community 26`, `Community 27`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 33`, `Community 35`, `Community 36`, `Community 37`, `Community 38`, `Community 40`, `Community 42`, `Community 44`, `Community 45`, `Community 46`, `Community 51`, `Community 55`, `Community 59`, `Community 60`, `Community 61`, `Community 66`, `Community 73`, `Community 74`, `Community 75`, `Community 82`, `Community 91`, `Community 92`, `Community 95`?**
  _High betweenness centrality (0.198) - this node is a cross-community bridge._
- **What connects `RFC-8414`, `RFC-9728`, `RFC-9728` to the rest of the system?**
  _6 weakly-connected nodes found - possible missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04558737580362361 - nodes in this community are weakly interconnected._
- **Why does `next` connect `Community 7` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 8`, `Community 9`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 16`, `Community 21`, `Community 22`, `Community 26`, `Community 27`, `Community 31`, `Community 35`, `Community 36`, `Community 37`, `Community 40`, `Community 44`, `Community 45`, `Community 46`, `Community 50`, `Community 51`, `Community 53`, `Community 54`, `Community 55`, `Community 59`, `Community 60`, `Community 61`, `Community 66`, `Community 69`, `Community 73`, `Community 74`, `Community 77`, `Community 82`, `Community 83`, `Community 92`, `Community 93`, `Community 94`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06936026936026936 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `Community 47` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 8`, `Community 12`, `Community 14`, `Community 19`, `Community 29`, `Community 31`, `Community 39`, `Community 40`, `Community 48`, `Community 49`, `Community 50`, `Community 53`, `Community 58`, `Community 59`, `Community 60`, `Community 64`, `Community 65`, `Community 68`, `Community 69`, `Community 71`, `Community 72`, `Community 77`, `Community 78`, `Community 79`, `Community 80`, `Community 81`, `Community 84`, `Community 85`, `Community 87`, `Community 88`, `Community 89`, `Community 90`, `Community 91`, `Community 96`, `Community 97`, `Community 98`, `Community 99`, `Community 100`, `Community 104`, `Community 105`, `Community 106`, `Community 107`, `Community 108`, `Community 109`, `Community 110`, `Community 112`, `Community 113`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07811447811447811 - nodes in this community are weakly interconnected._