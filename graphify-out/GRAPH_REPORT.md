# Graph Report - .  (2026-07-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1505 nodes · 3740 edges · 109 communities (79 shown, 30 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from source commit: `b12d9590`
- Artifact commits can make repository `HEAD` newer than the source commit scanned.
- Run `graphify update .` after maintained app/test source changes (no API cost).

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

## God Nodes (most connected - your core abstractions)
1. `db()` - 241 edges
2. `isAuthenticated()` - 119 edges
3. `setSetting()` - 59 edges
4. `getSetting()` - 56 edges
5. `runMaintenanceSweep()` - 32 edges
6. `clearSetting()` - 30 edges
7. `callMcpTool()` - 29 edges
8. `buildDiaryGraph()` - 24 edges
9. `embeddingsEnabled()` - 24 edges
10. `incrementalSyncNotebook()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `waitUntil()` --indirect_call--> `resolve()`  [INFERRED]
  test/dropboxExportLock.test.ts → app/api/settings/models/route.ts
- `flushAsyncWork()` --indirect_call--> `resolve()`  [INFERRED]
  test/mcp.test.ts → app/api/settings/models/route.ts
- `GET()` --calls--> `isLockEnabled()`  [EXTRACTED]
  app/api/auth/route.ts → lib/auth.ts
- `POST()` --calls--> `createSessionToken()`  [EXTRACTED]
  app/api/auth/route.ts → lib/auth.ts
- `POST()` --calls--> `isLockEnabled()`  [EXTRACTED]
  app/api/auth/route.ts → lib/auth.ts

## Import Cycles
- 3-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/claude.ts -> lib/chatTools.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/claude.ts -> lib/chatTools.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/mind.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 5-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/mind.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`

## Communities (109 total, 30 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (94): ATTACHMENT_DIR, DELETE(), EXT, EXT_TO_MIME, GET(), IMAGE_TYPES, LOCKED(), POST() (+86 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (85): GET(), LOCKED(), POST(), GET(), GET(), POST(), LOCKED(), POST() (+77 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (78): GET(), LOCKED(), LOCKED(), POST(), allConversationNotesRows(), allConversationFileNames(), allDecisionFileNames(), buildDayFiles() (+70 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (73): LOCKED(), POST(), LOCKED(), POST(), LOCKED(), POST(), LOCKED(), POST() (+65 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (73): GET(), LOCKED(), extractTaggingEntities(), ConversationEntityInput, ensureConversationPage(), ensureConversationsNotebook(), getCombinedEntityWiki(), getConversationNotes() (+65 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (55): LOCKED(), POST(), LOCKED(), POST(), GET(), POST(), BatchRow, buildTranscript() (+47 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (34): POST(), POST(), POST(), GET(), reparseIfNeeded(), AxisExtremeEntry, AxisLabels, analyzePending() (+26 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (39): CHAT_TOOLS, saveExportedConversation(), authFailures, callMcpTool(), checkMcpAuth(), COMPANION_GUIDANCE, configuredTokens(), conversationExportEnabled() (+31 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (34): analyzeEntryContent(), AxisLabelResult, CHAT_MEMORY_EXTRACTION_GUIDANCE, chatOverNotes(), cleanEntityWiki(), client(), compareTranscriptions(), composeEntityWiki() (+26 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (26): ANCHORS, buildLayout(), clamp(), DiaryGraphClient(), EDGE_COLORS, EDGE_LABELS, EDGE_TYPES, edgePath() (+18 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (27): docs/reference/**, dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (25): autoprefixer, eslint, eslint-config-next, devDependencies, autoprefixer, eslint, eslint-config-next, postcss (+17 more)

### Community 12 - "Community 12"
Cohesion: 0.16
Nodes (19): err(), POST(), readForm(), register(), AuthCode, authCodes, configuredSecrets(), consentSecretValid() (+11 more)

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (18): GET(), LOCKED(), GET(), hasNotes(), LOCKED(), POST(), ensureChatDiaryNotebook(), nextPageIndex() (+10 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (21): ExportedConversationRow, addEdge(), addEvidence(), contentId(), ContentInfo, ContentKind, ContentStats, dateKey() (+13 more)

### Community 15 - "Community 15"
Cohesion: 0.10
Nodes (21): better-sqlite3, @modelcontextprotocol/sdk, next, dependencies, better-sqlite3, @modelcontextprotocol/sdk, next, posthog-js (+13 more)

### Community 16 - "Community 16"
Cohesion: 0.14
Nodes (20): ATTACHMENT_DIR, GET(), DELETE(), LOCKED(), POST(), GET(), PATCH(), GET() (+12 more)

### Community 17 - "Community 17"
Cohesion: 0.19
Nodes (17): summarizeDay(), ATTACHMENT_DIR, cleanupOrphanChatAttachments(), maybeCleanupOrphanAttachments(), ensureProfileSeed(), FILES_DIR, getMaybeCompressChatSessions(), getMaybeIngestDropbox() (+9 more)

### Community 18 - "Community 18"
Cohesion: 0.25
Nodes (16): GET(), POST(), relyingParty(), checkPasscode(), getAuthFailState(), passcodeLockRemainingMs(), recordFailedPasscodeAttempt(), recordSuccessfulAuth() (+8 more)

### Community 19 - "Community 19"
Cohesion: 0.17
Nodes (12): LINKS, Nav(), Badge(), BadgeProps, TONE_CLASSES, Card(), CardProps, cn() (+4 more)

### Community 20 - "Community 20"
Cohesion: 0.26
Nodes (15): GET(), LOCKED(), POST(), BINARY_EXT, disciplineConfig(), disciplineRepoName(), fetchRepoTextFiles(), headers() (+7 more)

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (9): AxisLabels, HeatmapBucket, Map3D, MapPoint, MindData, SentimentPoint, ThemeBucket, Section() (+1 more)

### Community 22 - "Community 22"
Cohesion: 0.21
Nodes (10): track(), Attachment, Msg, Insight, InsightsPage(), summarize(), ensurePosthog(), PostHogProvider() (+2 more)

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (13): GET(), GraphPage(), buildDiaryGraph(), dayId(), entityScore(), fetchDiaryRows(), fetchEntityMentions(), fetchRelationships() (+5 more)

### Community 24 - "Community 24"
Cohesion: 0.22
Nodes (13): POST(), EntityWikiExcerpt, candidates(), entityWikiAutoEnabled(), evenSample(), excerptHash(), excerptsLen(), Kind (+5 more)

### Community 25 - "Community 25"
Cohesion: 0.31
Nodes (12): DELETE(), GET(), LOCKED(), POST(), escapeHtml(), GET(), page(), POST() (+4 more)

### Community 26 - "Community 26"
Cohesion: 0.17
Nodes (12): ChatMemoryItem, ChatMemorySection(), ChatMemoryStatus, formatBytes(), MEMORY_FILTERS, MemoryPage(), PendingBatchDetail, DuplicateCandidate (+4 more)

### Community 27 - "Community 27"
Cohesion: 0.13
Nodes (14): background_color, description, display, icons, name, files, share_target, action (+6 more)

### Community 28 - "Community 28"
Cohesion: 0.24
Nodes (12): GET(), OPTIONS(), RFC-8414, GET(), OPTIONS(), RFC-9728, OPTIONS(), OPTIONS() (+4 more)

### Community 29 - "Community 29"
Cohesion: 0.32
Nodes (12): POST(), auditRequest(), guarded(), handler, RFC-9728, RFC-7591, clientIp(), isThrottled() (+4 more)

### Community 30 - "Community 30"
Cohesion: 0.29
Nodes (8): LOCKED(), POST(), BackfillMessage, chunkedBackfillForConversation(), chunkMessageIds(), createBatchForChunk(), estimateTranscriptCost(), chunkCost()

### Community 31 - "Community 31"
Cohesion: 0.31
Nodes (9): GET(), LOCKED(), buildCandidate(), buildCloudCoverage(), classifyDuplicate(), CloudCoverage, DuplicateCandidate, DuplicateClassification (+1 more)

### Community 32 - "Community 32"
Cohesion: 0.23
Nodes (7): AutoLock(), clearHiddenSince(), readHiddenSince(), isPickingFile(), isUnlocking(), setPickingFile(), setUnlocking()

### Community 33 - "Community 33"
Cohesion: 0.15
Nodes (8): CeMod, CwMod, DbMod, DiaryGraphPayload, GraphMod, MindMod, NotesMod, RelMod

### Community 34 - "Community 34"
Cohesion: 0.30
Nodes (10): GET(), dailyUsage(), FALLBACK, monthlyUsage(), priceFor(), Prices, totalUsage(), tzModifier() (+2 more)

### Community 35 - "Community 35"
Cohesion: 0.24
Nodes (7): codeFrom(), consent(), exchange(), issueAccessToken(), Mod, pkce(), register()

### Community 36 - "Community 36"
Cohesion: 0.25
Nodes (10): DayCost, DayData, FEATURE_LABEL, FeatureCost, money(), MonthData, pad(), UsagePage() (+2 more)

### Community 37 - "Community 37"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, lint, start, test (+2 more)

### Community 38 - "Community 38"
Cohesion: 0.20
Nodes (8): ConversationWikiMod, DbMod, deferred(), DiaryExportDbMod, DropboxMod, mockDropboxFetch(), UploadCall, waitUntil()

### Community 39 - "Community 39"
Cohesion: 0.42
Nodes (9): backfillTitles(), GET(), LOCKED(), PATCH(), POST(), generateInsights(), generateInsightTitle(), buildChatContext() (+1 more)

### Community 40 - "Community 40"
Cohesion: 0.49
Nodes (9): consentForm(), esc(), GET(), OAuthParams, page(), POST(), readParams(), validate() (+1 more)

### Community 41 - "Community 41"
Cohesion: 0.20
Nodes (5): ChatToolsMod, DbMod, MergeMod, NotesMod, Result

### Community 42 - "Community 42"
Cohesion: 0.53
Nodes (7): fmtDate(), fmtDateTime(), fmtTime(), GET(), LOCKED(), shifted(), parseSqliteUtc()

### Community 43 - "Community 43"
Cohesion: 0.25
Nodes (4): AxisLabels, MapPoint, Point(), sentimentColour()

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (8): ButtonProps, Common, LinkButton(), LinkButtonProps, Size, SIZE_CLASSES, Variant, VARIANT_CLASSES

### Community 45 - "Community 45"
Cohesion: 0.22
Nodes (8): build, builder, dockerfilePath, deploy, restartPolicyMaxRetries, restartPolicyType, startCommand, $schema

### Community 46 - "Community 46"
Cohesion: 0.22
Nodes (4): ChatToolsMod, DbMod, MindMod, NotesMod

### Community 47 - "Community 47"
Cohesion: 0.32
Nodes (6): clearSans, metadata, RootLayout(), viewport, LockOffBanner(), isLockEnabled()

### Community 48 - "Community 48"
Cohesion: 0.36
Nodes (6): Home(), LatestInsight, preview(), RecentNotebook, statusLabel(), Stat()

### Community 49 - "Community 49"
Cohesion: 0.70
Nodes (4): GET(), LOCKED(), POST(), setDisciplineEnabled()

### Community 50 - "Community 50"
Cohesion: 0.25
Nodes (3): DbMod, ExportMod, NotesMod

### Community 52 - "Community 52"
Cohesion: 0.25
Nodes (3): ChatToolsMod, DbMod, NotesMod

### Community 53 - "Community 53"
Cohesion: 0.29
Nodes (4): ChatToolsMod, DbMod, LocationMod, OwntracksMod

### Community 55 - "Community 55"
Cohesion: 0.29
Nodes (4): CwMod, DbMod, MergeMod, RelMod

### Community 56 - "Community 56"
Cohesion: 0.29
Nodes (3): DbMod, MindMod, NotesMod

### Community 57 - "Community 57"
Cohesion: 0.33
Nodes (3): ClaudeMod, CmMod, DbMod

### Community 58 - "Community 58"
Cohesion: 0.33
Nodes (3): CmMod, DbMod, EmbMod

### Community 60 - "Community 60"
Cohesion: 0.33
Nodes (5): ClaudeMod, CwMod, DbMod, EtMod, RwMod

### Community 61 - "Community 61"
Cohesion: 0.33
Nodes (3): DbMod, MindMod, NotesMod

### Community 62 - "Community 62"
Cohesion: 0.33
Nodes (3): DbMod, DedupMod, NotesMod

### Community 63 - "Community 63"
Cohesion: 0.60
Nodes (4): GET(), LOCKED(), MemoryRow, pendingBatchDetails()

### Community 64 - "Community 64"
Cohesion: 0.70
Nodes (4): GET(), LOCKED(), POST(), setLocationEnabled()

### Community 65 - "Community 65"
Cohesion: 0.40
Nodes (5): modelMain(), ocrNotebookPdf(), parsePages(), recentInsightsBlock(), updateSelfModel()

### Community 66 - "Community 66"
Cohesion: 0.50
Nodes (5): canonicalKey(), ensureEntity(), entityId(), fetchCanonicalEntityNames(), sanitizeEntityName()

### Community 67 - "Community 67"
Cohesion: 0.40
Nodes (4): CdMod, DbMod, MindMod, NotesMod

### Community 68 - "Community 68"
Cohesion: 0.40
Nodes (3): CmMod, DbMod, EmbMod

### Community 72 - "Community 72"
Cohesion: 0.40
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 73 - "Community 73"
Cohesion: 0.40
Nodes (4): DbMod, EmbMod, MindMod, NotesMod

### Community 74 - "Community 74"
Cohesion: 0.40
Nodes (3): ClaudeMod, DbMod, EwMod

### Community 75 - "Community 75"
Cohesion: 0.40
Nodes (4): CeMod, DbMod, ReMod, RwMod

### Community 76 - "Community 76"
Cohesion: 0.40
Nodes (3): DbMod, NotesMod, SyncMod

### Community 77 - "Community 77"
Cohesion: 0.67
Nodes (3): Entry, GET(), LOCKED()

### Community 78 - "Community 78"
Cohesion: 0.50
Nodes (3): RFC-8414, RFC-9728, nextConfig

### Community 80 - "Community 80"
Cohesion: 0.50
Nodes (3): CeMod, CwMod, DbMod

### Community 81 - "Community 81"
Cohesion: 0.50
Nodes (3): DbMod, DeMod, DwMod

## Knowledge Gaps
- **419 isolated node(s):** `extends`, `next/core-web-vitals`, `LINKS`, `ATTACHMENT_DIR`, `MemoryRow` (+414 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db()` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 12`, `Community 13`, `Community 14`, `Community 16`, `Community 17`, `Community 18`, `Community 20`, `Community 23`, `Community 24`, `Community 25`, `Community 29`, `Community 30`, `Community 31`, `Community 34`, `Community 39`, `Community 42`, `Community 48`, `Community 63`, `Community 65`, `Community 66`, `Community 77`?**
  _High betweenness centrality (0.212) - this node is a cross-community bridge._
- **Why does `downloadNotebook()` connect `Community 3` to `Community 97`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 15` to `Community 97`, `Community 98`, `Community 99`, `Community 100`, `Community 37`, `Community 102`, `Community 103`, `Community 104`, `Community 86`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **What connects `extends`, `next/core-web-vitals`, `LINKS` to the rest of the system?**
  _419 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05247079964061096 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0504950495049505 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05093632958801498 - nodes in this community are weakly interconnected._
