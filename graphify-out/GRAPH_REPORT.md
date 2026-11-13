# Graph Report - remarkabler  (2026-11-13)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2085 nodes · 5457 edges · 116 communities (105 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1d15c1d7`
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
- Community 115

## God Nodes (most connected - your core abstractions)
1. `db()` - 277 edges
2. `isAuthenticated()` - 131 edges
3. `vitest` - 81 edges
4. `next` - 75 edges
5. `getSetting()` - 66 edges
6. `setSetting()` - 62 edges
7. `MemoryPage()` - 42 edges
8. `runMaintenanceSweep()` - 34 edges
9. `callMcpTool()` - 30 edges
10. `clearSetting()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `looksLikePdf()`  [EXTRACTED]
  app/api/notebooks/route.ts → lib/upload.ts
- `POST()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/dropbox/export/route.ts → lib/auth.ts
- `POST()` --calls--> `maybeExportDiaryToDropbox()`  [EXTRACTED]
  app/api/dropbox/export/route.ts → lib/dropbox.ts
- `GET()` --calls--> `dropboxStatus()`  [EXTRACTED]
  app/api/dropbox/status/route.ts → lib/dropbox.ts
- `GET()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/dropbox/connect/route.ts → lib/auth.ts

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

## Communities (116 total, 11 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (59): dynamic, GET(), runtime, dynamic, POST(), runtime, dynamic, LOCKED() (+51 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (62): dynamic, GET(), POST(), relyingParty(), runtime, dynamic, GET(), POST() (+54 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (59): handler, MAX_DIARY_ENTRY_CHARS, CHAT_TOOLS, recordLibrarianHeartbeat(), getRelationshipsFor(), AUDIT_KEEP_ROWS, authFailures, callMcpTool() (+51 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (50): POST(), analyzeEntryContent(), AxisLabelResult, CHAT_MEMORY_EXTRACTION_GUIDANCE, chatOverNotes(), cleanEntityWiki(), client(), compareTranscriptions() (+42 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (43): dynamic, POST(), runtime, dynamic, POST(), runtime, dynamic, POST() (+35 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (41): dynamic, LOCKED(), POST(), runtime, dynamic, LOCKED(), POST(), runtime (+33 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (35): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, backupConfigured(), BackupStatus (+27 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (39): dependencies, @anthropic-ai/sdk@^0.96.0, better-sqlite3@^11.3.0, d3-force@^3.0.1, jszip@^3.10.1, leaflet@^1.9.4, mammoth@^1.12.0, mcp-handler@^1.1.0 (+31 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (32): track(), AutoLock(), cancelPending(), lockNow(), markHiddenIfNeeded(), onPageHide(), onVisibility(), clearHiddenSince() (+24 more)

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (34): dynamic, LOCKED(), maxDuration, POST(), runtime, dynamic, LOCKED(), maxDuration (+26 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (37): SavedDecisionRow, addEdge(), addEvidence(), buildDiaryGraph(), canonicalKey(), contentId(), ContentInfo, ContentKind (+29 more)

### Community 11 - "Community 11"
Cohesion: 0.10
Nodes (31): dynamic, GET(), runtime, dynamic, GET(), maxDuration, POST(), runtime (+23 more)

### Community 12 - "Community 12"
Cohesion: 0.14
Nodes (32): dynamic, GET(), LOCKED(), maxDuration, runtime, dynamic, GET(), hasNotes() (+24 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (20): MemoryPage(), disconnectDropbox(), getPosition(), load(), loadBackup(), loadDisc(), loadDropbox(), loadEmbed() (+12 more)

### Community 14 - "Community 14"
Cohesion: 0.16
Nodes (32): ensureChatDiaryNotebook(), nextPageIndex(), saveChatDiaryEntry(), countEntriesMentioning(), currentTimeKst(), executeTool(), ftsSearch(), getDaySummary() (+24 more)

### Community 15 - "Community 15"
Cohesion: 0.13
Nodes (31): POST(), dynamic, GET(), isPlausiblePoint(), POST(), runtime, getRecentLocations(), cachedPlace() (+23 more)

### Community 16 - "Community 16"
Cohesion: 0.11
Nodes (31): dynamic, GET(), runtime, DELETE(), dynamic, GET(), LOCKED(), POST() (+23 more)

### Community 17 - "Community 17"
Cohesion: 0.10
Nodes (26): DuplicateCandidate, Notebook, Page, PendingShare, dynamic, Home(), LatestInsight, preview() (+18 more)

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (30): buildDayFiles(), buildDiaryMarkdown(), buildEntityStubFiles(), buildHomeNote(), collectEntities(), countLine(), effectiveDateKeys(), EnrichedRow (+22 more)

### Community 19 - "Community 19"
Cohesion: 0.08
Nodes (17): vitest, findRouteFiles(), PUBLIC, AuthMod, DbMod, BackfillHelpers, DbMod, DbMod (+9 more)

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (27): dynamic, LOCKED(), POST(), runtime, RemarkableNotebook, remarkablePaired(), classifyReocr(), cursorValue() (+19 more)

### Community 21 - "Community 21"
Cohesion: 0.07
Nodes (27): concurrency, cancel-in-progress, group, CI, NEXT_TELEMETRY_DISABLED, jobs, quality, name (+19 more)

### Community 22 - "Community 22"
Cohesion: 0.07
Nodes (26): COMMENT_BODY, COMMENT_URL, EVENT_NAME, GH_TOKEN, PR_NUMBER, REPO, if, runs-on (+18 more)

### Community 23 - "Community 23"
Cohesion: 0.19
Nodes (26): allConversationNotesRows(), allConversationFileNames(), allDecisionFileNames(), buildEntityIndexNote(), buildProfileNote(), entityIndexFileName(), entityStubFileName(), sanitizeEntityName() (+18 more)

### Community 24 - "Community 24"
Cohesion: 0.11
Nodes (21): ATTACHMENT_DIR, dynamic, GET(), runtime, dynamic, GET(), LOCKED(), POST() (+13 more)

### Community 25 - "Community 25"
Cohesion: 0.12
Nodes (19): dynamic, LOCKED(), maxDuration, POST(), runtime, deleteNotebook(), ExistingRow, importRemarkableNotebook() (+11 more)

### Community 26 - "Community 26"
Cohesion: 0.14
Nodes (23): AxisLabels, EmbeddingMap(), EntityRankings(), Heatmap(), HeatmapBucket, Map3D, MapPoint, MindData (+15 more)

### Community 27 - "Community 27"
Cohesion: 0.14
Nodes (23): REFLECTIONS_NOTEBOOK_ID, ensureReflectionPage(), ensureReflectionsNotebook(), KINDS, ReflectionEntityInput, tagReflectionEntities(), dateKey(), getReflectionByKey() (+15 more)

### Community 28 - "Community 28"
Cohesion: 0.15
Nodes (20): backfillTitles(), dynamic, GET(), LOCKED(), maxDuration, PATCH(), runtime, reparseIfNeeded() (+12 more)

### Community 29 - "Community 29"
Cohesion: 0.14
Nodes (21): dynamic, POST(), readBoundedJson(), runtime, auditRequest(), dynamic, guarded(), maxDuration (+13 more)

### Community 30 - "Community 30"
Cohesion: 0.15
Nodes (20): dynamic, GET(), LOCKED(), runtime, ConversationEntityInput, ensureConversationPage(), ensureConversationsNotebook(), getCombinedEntityWiki() (+12 more)

### Community 31 - "Community 31"
Cohesion: 0.17
Nodes (20): DecisionEntityInput, ensureDecisionPage(), ensureDecisionsNotebook(), KINDS, tagDecisionEntities(), dateKey(), DECISION_FOLDER, decisionNoteFileName() (+12 more)

### Community 32 - "Community 32"
Cohesion: 0.12
Nodes (19): ATTACHMENT_DIR, DELETE(), dynamic, EXT, ext(), EXT_TO_MIME, GET(), IMAGE_TYPES (+11 more)

### Community 33 - "Community 33"
Cohesion: 0.18
Nodes (19): dynamic, GET(), LOCKED(), maxDuration, POST(), runtime, normaliseDate(), BINARY_EXT (+11 more)

### Community 34 - "Community 34"
Cohesion: 0.10
Nodes (13): dynamic, GET(), runtime, recoverInterruptedNotebooks(), exchangeCodeForTokens(), fetchAccountDisplayName(), CeMod, CwMod (+5 more)

### Community 35 - "Community 35"
Cohesion: 0.22
Nodes (17): DELETE(), dynamic, GET(), LOCKED(), POST(), runtime, escapeHtml(), GET() (+9 more)

### Community 36 - "Community 36"
Cohesion: 0.13
Nodes (18): getConversationByKey(), EntityPredicate, isEntityPredicate(), PREDICATE_LABELS, PREDICATES, CleanRelationshipInput, cleanRelationships(), EntityKind (+10 more)

### Community 37 - "Community 37"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.47, @types/better-sqlite3@^7.6.11, @types/d3-force@^3.0.10, @types/node@^22.7.4, @types/react@^19.2.18, @types/react-dom@^19.2.4 (+12 more)

### Community 38 - "Community 38"
Cohesion: 0.16
Nodes (17): dynamic, maxDuration, POST(), runtime, EntityWikiExcerpt, allEntityWikiRows(), candidates(), entityWikiAutoEnabled() (+9 more)

### Community 39 - "Community 39"
Cohesion: 0.18
Nodes (17): dynamic, Kind, KINDS, maxDuration, POST(), postMergeDropbox(), runtime, dedupeAllEntities() (+9 more)

### Community 40 - "Community 40"
Cohesion: 0.13
Nodes (17): DiaryGraphClient(), EDGE_COLORS, EDGE_LABELS, EDGE_TYPES, formatGeneratedAt(), Inspector(), Metric(), metricLabel() (+9 more)

### Community 41 - "Community 41"
Cohesion: 0.15
Nodes (17): ForceEdgeInput, ForceGraph(), draw(), fit(), hit(), loop(), onDown(), onMove() (+9 more)

### Community 42 - "Community 42"
Cohesion: 0.19
Nodes (16): MapStayDto, MapView(), RoutePointDto, Data, fmt(), Gate, MapPage(), MapView (+8 more)

### Community 43 - "Community 43"
Cohesion: 0.13
Nodes (16): AuthCode, authCodes, ClientMetadataResult, ClientRegistrationMetadata, configuredSecrets(), consentSecretValid(), dropAuthCodesForClient(), IssuedTokens (+8 more)

### Community 44 - "Community 44"
Cohesion: 0.11
Nodes (12): AuthMod, DbMod, BackupMod, DbMod, DbMod, DeMod, DwMod, DbMod (+4 more)

### Community 45 - "Community 45"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 46 - "Community 46"
Cohesion: 0.18
Nodes (13): dynamic, GET(), runtime, dynamic, GraphPage(), DiaryGraphPayload, VaultNoteKind, readDropboxTextFiles() (+5 more)

### Community 47 - "Community 47"
Cohesion: 0.17
Nodes (16): dynamic, GET(), OPTIONS(), runtime, RFC-8414, dynamic, GET(), OPTIONS() (+8 more)

### Community 48 - "Community 48"
Cohesion: 0.14
Nodes (12): dynamic, LOCKED(), POST(), runtime, LockAllButton(), LINKS, Nav(), DocWithVT (+4 more)

### Community 49 - "Community 49"
Cohesion: 0.26
Nodes (17): extractTaggingEntities(), wikiLinkingEnabled(), listUnlinkedConversations(), listUnlinkedDecisions(), autoTagConversation(), autoTagDecision(), autoTagExportsEnabled(), autoTagReflection() (+9 more)

### Community 50 - "Community 50"
Cohesion: 0.19
Nodes (13): dynamic, LOCKED(), POST(), runtime, createRollingBatch(), maybeRollConversationMemory(), BackfillMessage, CHUNK_TARGET_CHARS (+5 more)

### Community 51 - "Community 51"
Cohesion: 0.12
Nodes (8): CleanupMod, DbMod, WikiMod, DbMod, Mod, DbMod, NotesMod, SyncMod

### Community 52 - "Community 52"
Cohesion: 0.21
Nodes (13): dynamic, GET(), runtime, clampMapDays(), localDayStart(), MAP_MAX_DAYS, MAP_MAX_ROUTE_POINTS, mapWindowStart() (+5 more)

### Community 53 - "Community 53"
Cohesion: 0.17
Nodes (13): ChatMemoryItem, ChatMemorySection(), backfillAll(), load(), processPending(), remove(), retryStuck(), ChatMemoryStatus (+5 more)

### Community 54 - "Community 54"
Cohesion: 0.32
Nodes (14): consentForm(), destHost(), dynamic, esc(), GET(), OAuthParams, page(), POST() (+6 more)

### Community 55 - "Community 55"
Cohesion: 0.25
Nodes (11): dynamic, GET(), LOCKED(), runtime, buildCandidate(), buildCloudCoverage(), classifyDuplicate(), CloudCoverage (+3 more)

### Community 56 - "Community 56"
Cohesion: 0.22
Nodes (13): dynamic, GET(), runtime, dailyUsage(), FALLBACK, monthlyUsage(), priceFor(), Prices (+5 more)

### Community 57 - "Community 57"
Cohesion: 0.18
Nodes (14): ActiveLabel(), Axes(), AxisEndLabel(), AxisLabels, Map3D(), MapPoint, Point(), sentimentColour() (+6 more)

### Community 58 - "Community 58"
Cohesion: 0.13
Nodes (14): background_color, description, display, icons, name, files, share_target, action (+6 more)

### Community 59 - "Community 59"
Cohesion: 0.22
Nodes (9): clearSans, dynamic, metadata, RootLayout(), viewport, LockOffBanner(), ensurePosthog(), PostHogProvider() (+1 more)

### Community 60 - "Community 60"
Cohesion: 0.25
Nodes (10): dynamic, GET(), LOCKED(), POST(), runtime, addLocation(), isLocationEnabled(), listRecentLocations() (+2 more)

### Community 61 - "Community 61"
Cohesion: 0.22
Nodes (10): dynamic, LOCKED(), maxDuration, POST(), runtime, carryForwardDates(), DiaryPageRow, compareImportedNotebook() (+2 more)

### Community 62 - "Community 62"
Cohesion: 0.20
Nodes (13): CONVERSATION_FOLDER, conversationNoteFileName(), ExportedConversationRow, MAX_CONVERSATION_CHARS, renderConversationNote(), renderConversationNoteFiles(), sanitizeFileName(), saveExportedConversation() (+5 more)

### Community 63 - "Community 63"
Cohesion: 0.31
Nodes (11): dynamic, fmtDate(), fmtDateTime(), fmtTime(), GET(), LOCKED(), maxDuration, runtime (+3 more)

### Community 64 - "Community 64"
Cohesion: 0.26
Nodes (12): dynamic, err(), POST(), readForm(), runtime, currentSecretHashes(), issueTokens(), listOAuthGrants() (+4 more)

### Community 65 - "Community 65"
Cohesion: 0.21
Nodes (10): DayCost, DayData, FEATURE_LABEL, FeatureCost, money(), MonthData, pad(), UsagePage() (+2 more)

### Community 66 - "Community 66"
Cohesion: 0.15
Nodes (8): CeMod, CwMod, DbMod, DiaryGraphPayload, GraphMod, MindMod, NotesMod, RelMod

### Community 67 - "Community 67"
Cohesion: 0.22
Nodes (7): codeFrom(), consent(), exchange(), issueAccessToken(), Mod, pkce(), register()

### Community 68 - "Community 68"
Cohesion: 0.29
Nodes (9): Insight, InsightsPage(), copy(), download(), exportText(), generate(), load(), summarize() (+1 more)

### Community 69 - "Community 69"
Cohesion: 0.27
Nodes (8): afterFailure(), FailState, isValidPin(), lockDurationMs(), MAP_UNLOCK_TTL_MS, mapUnlockCookieOptions, MAX_ATTEMPTS, UnlockResult

### Community 70 - "Community 70"
Cohesion: 0.20
Nodes (7): ConversationWikiMod, DbMod, deferred(), DiaryExportDbMod, DropboxMod, mockDropboxFetch(), UploadCall

### Community 72 - "Community 72"
Cohesion: 0.20
Nodes (5): ChatToolsMod, DbMod, MergeMod, NotesMod, Result

### Community 73 - "Community 73"
Cohesion: 0.33
Nodes (8): dynamic, GET(), LOCKED(), POST(), resolve(), runtime, Slot, SLOTS

### Community 74 - "Community 74"
Cohesion: 0.22
Nodes (8): build, builder, dockerfilePath, deploy, restartPolicyMaxRetries, restartPolicyType, startCommand, $schema

### Community 75 - "Community 75"
Cohesion: 0.22
Nodes (6): body, enc, iv, MAGIC, salt, tag

### Community 76 - "Community 76"
Cohesion: 0.22
Nodes (5): AuthMod, DbMod, requestCookies, RouteMod, webauthn

### Community 77 - "Community 77"
Cohesion: 0.22
Nodes (4): ChatToolsMod, DbMod, MindMod, NotesMod

### Community 78 - "Community 78"
Cohesion: 0.25
Nodes (3): DbMod, ExportMod, NotesMod

### Community 80 - "Community 80"
Cohesion: 0.25
Nodes (3): ChatToolsMod, DbMod, NotesMod

### Community 81 - "Community 81"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), MemoryRow, runtime, pendingBatchDetails()

### Community 82 - "Community 82"
Cohesion: 0.43
Nodes (6): dynamic, GET(), LOCKED(), POST(), runtime, setDisciplineEnabled()

### Community 83 - "Community 83"
Cohesion: 0.38
Nodes (6): dynamic, GET(), LOCKED(), maxDuration, runtime, renderDiaryMarkdown()

### Community 84 - "Community 84"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, test:watch

### Community 85 - "Community 85"
Cohesion: 0.29
Nodes (4): ChatToolsMod, DbMod, LocationMod, OwntracksMod

### Community 87 - "Community 87"
Cohesion: 0.29
Nodes (4): CwMod, DbMod, MergeMod, RelMod

### Community 88 - "Community 88"
Cohesion: 0.29
Nodes (3): DbMod, MindMod, NotesMod

### Community 89 - "Community 89"
Cohesion: 0.29
Nodes (3): ChatToolsMod, McpMod, RouteMod

### Community 90 - "Community 90"
Cohesion: 0.40
Nodes (5): dynamic, Entry, GET(), LOCKED(), runtime

### Community 91 - "Community 91"
Cohesion: 0.33
Nodes (3): ClaudeMod, CmMod, DbMod

### Community 92 - "Community 92"
Cohesion: 0.33
Nodes (3): CmMod, DbMod, EmbMod

### Community 94 - "Community 94"
Cohesion: 0.33
Nodes (5): ClaudeMod, CwMod, DbMod, EtMod, RwMod

### Community 95 - "Community 95"
Cohesion: 0.33
Nodes (3): DbMod, MindMod, NotesMod

### Community 96 - "Community 96"
Cohesion: 0.33
Nodes (3): DbMod, DedupMod, NotesMod

### Community 97 - "Community 97"
Cohesion: 0.33
Nodes (5): DbMod, NotesMod, pdf, PendingMod, ShareRoute

### Community 98 - "Community 98"
Cohesion: 0.33
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 99 - "Community 99"
Cohesion: 0.50
Nodes (4): DELETE(), dynamic, LOCKED(), runtime

### Community 100 - "Community 100"
Cohesion: 0.50
Nodes (4): dynamic, GET(), LOCKED(), runtime

### Community 102 - "Community 102"
Cohesion: 0.40
Nodes (4): eslint@^9.39.5, eslint-config-next@^16.3.2, eslint, eslint-config-next

### Community 103 - "Community 103"
Cohesion: 0.40
Nodes (4): CdMod, DbMod, MindMod, NotesMod

### Community 104 - "Community 104"
Cohesion: 0.40
Nodes (3): CmMod, DbMod, EmbMod

### Community 106 - "Community 106"
Cohesion: 0.40
Nodes (4): DbMod, EmbMod, MindMod, NotesMod

### Community 107 - "Community 107"
Cohesion: 0.40
Nodes (3): ClaudeMod, DbMod, EwMod

### Community 108 - "Community 108"
Cohesion: 0.40
Nodes (4): CeMod, DbMod, ReMod, RwMod

### Community 109 - "Community 109"
Cohesion: 0.50
Nodes (3): RFC-8414, RFC-9728, nextConfig

### Community 110 - "Community 110"
Cohesion: 0.50
Nodes (3): tailwindcss@^3.4.13, tailwindcss, config

## Knowledge Gaps
- **6 isolated node(s):** `RFC-8414`, `RFC-9728`, `RFC-9728`, `RFC-7591`, `RFC-8414` (+1 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 801 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db()` connect `Community 14` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 10`, `Community 11`, `Community 12`, `Community 15`, `Community 16`, `Community 17`, `Community 20`, `Community 23`, `Community 24`, `Community 25`, `Community 27`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 33`, `Community 34`, `Community 35`, `Community 36`, `Community 38`, `Community 39`, `Community 43`, `Community 49`, `Community 50`, `Community 54`, `Community 55`, `Community 56`, `Community 60`, `Community 61`, `Community 62`, `Community 63`, `Community 64`, `Community 81`, `Community 89`, `Community 90`, `Community 99`, `Community 100`?**
  _High betweenness centrality (0.161) - this node is a cross-community bridge._
- **What connects `RFC-8414`, `RFC-9728`, `RFC-9728` to the rest of the system?**
  _6 weakly-connected nodes found - possible missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Why does `next` connect `Community 48` to `Community 0`, `Community 1`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 9`, `Community 11`, `Community 12`, `Community 15`, `Community 16`, `Community 17`, `Community 20`, `Community 24`, `Community 25`, `Community 26`, `Community 28`, `Community 29`, `Community 30`, `Community 32`, `Community 33`, `Community 34`, `Community 35`, `Community 38`, `Community 39`, `Community 42`, `Community 46`, `Community 47`, `Community 50`, `Community 52`, `Community 54`, `Community 55`, `Community 56`, `Community 59`, `Community 60`, `Community 61`, `Community 63`, `Community 64`, `Community 73`, `Community 76`, `Community 81`, `Community 82`, `Community 83`, `Community 90`, `Community 97`, `Community 99`, `Community 100`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07111501316944688 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `Community 19` to `Community 0`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 9`, `Community 11`, `Community 14`, `Community 15`, `Community 18`, `Community 20`, `Community 34`, `Community 37`, `Community 44`, `Community 46`, `Community 50`, `Community 51`, `Community 52`, `Community 55`, `Community 60`, `Community 61`, `Community 66`, `Community 67`, `Community 69`, `Community 70`, `Community 71`, `Community 72`, `Community 76`, `Community 77`, `Community 78`, `Community 79`, `Community 80`, `Community 85`, `Community 86`, `Community 87`, `Community 88`, `Community 89`, `Community 91`, `Community 92`, `Community 93`, `Community 94`, `Community 95`, `Community 96`, `Community 97`, `Community 98`, `Community 103`, `Community 104`, `Community 105`, `Community 106`, `Community 107`, `Community 108`, `Community 111`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.04480874316939891 - nodes in this community are weakly interconnected._