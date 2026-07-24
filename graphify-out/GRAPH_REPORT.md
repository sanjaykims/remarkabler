# Graph Report - .  (2026-07-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1407 nodes · 3550 edges · 104 communities (75 shown, 29 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f3a4592b`
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

## God Nodes (most connected - your core abstractions)
1. `db()` - 234 edges
2. `isAuthenticated()` - 115 edges
3. `setSetting()` - 58 edges
4. `getSetting()` - 55 edges
5. `runMaintenanceSweep()` - 31 edges
6. `clearSetting()` - 30 edges
7. `callMcpTool()` - 29 edges
8. `embeddingsEnabled()` - 24 edges
9. `incrementalSyncNotebook()` - 23 edges
10. `recordUsage()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `flushAsyncWork()` --indirect_call--> `resolve()`  [INFERRED]
  test/mcp.test.ts → app/api/settings/models/route.ts
- `Nav()` --calls--> `cn()`  [EXTRACTED]
  app/Nav.tsx → components/cn.ts
- `GET()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/backup/route.ts → lib/auth.ts
- `POST()` --calls--> `isAuthenticated()`  [EXTRACTED]
  app/api/backup/route.ts → lib/auth.ts
- `POST()` --calls--> `clearSetting()`  [EXTRACTED]
  app/api/backup/route.ts → lib/db.ts

## Import Cycles
- 3-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/claude.ts -> lib/chatTools.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/claude.ts -> lib/chatTools.ts`
- 3-file cycle: `lib/chatTools.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/mind.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 4-file cycle: `lib/chatTools.ts -> lib/mind.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`
- 5-file cycle: `lib/chatTools.ts -> lib/entityMerge.ts -> lib/mind.ts -> lib/notes.ts -> lib/claude.ts -> lib/chatTools.ts`

## Communities (104 total, 29 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (59): GET(), POST(), relyingParty(), ATTACHMENT_DIR, GET(), DELETE(), LOCKED(), Entry (+51 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (61): GET(), LOCKED(), LOCKED(), POST(), allConversationNotesRows(), allConversationFileNames(), allDecisionFileNames(), buildDayFiles() (+53 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (55): LOCKED(), POST(), LOCKED(), POST(), LOCKED(), POST(), GET(), LOCKED() (+47 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (55): GET(), OPTIONS(), RFC-8414, consentForm(), esc(), GET(), OAuthParams, page() (+47 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (49): ATTACHMENT_DIR, DELETE(), EXT, EXT_TO_MIME, GET(), IMAGE_TYPES, LOCKED(), POST() (+41 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (44): Kind, KINDS, POST(), postMergeDropbox(), Heatmap(), countEntriesMentioning(), currentTimeKst(), executeTool() (+36 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (42): analyzeEntryContent(), AxisLabelResult, CHAT_MEMORY_EXTRACTION_GUIDANCE, chatOverNotes(), cleanEntityWiki(), client(), compareTranscriptions(), composeBook() (+34 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (41): LOCKED(), POST(), markConversationsFiled(), renderConversationNoteFiles(), unfiledConversationKeys(), setSetting(), markDecisionsFiled(), unfiledDecisionKeys() (+33 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (33): POST(), POST(), POST(), GET(), reparseIfNeeded(), AxisExtremeEntry, AxisLabels, analyzePending() (+25 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (34): CHAT_TOOLS, authFailures, callMcpTool(), COMPANION_GUIDANCE, configuredTokens(), conversationExportEnabled(), DECISION_TOOL, decisionSavingEnabled() (+26 more)

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (27): LOCKED(), POST(), LOCKED(), POST(), LOCKED(), POST(), getSetting(), causeCodes() (+19 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (26): LOCKED(), POST(), GET(), LOCKED(), RemarkableNotebook, classifyReocr(), cursorValue(), diffRmPages() (+18 more)

### Community 12 - "Community 12"
Cohesion: 0.07
Nodes (27): docs/reference/**, dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (25): autoprefixer, eslint, eslint-config-next, devDependencies, autoprefixer, eslint, eslint-config-next, postcss (+17 more)

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (22): ConversationEntityInput, ensureConversationPage(), ensureConversationsNotebook(), getCombinedEntityWiki(), getConversationNotes(), KINDS, resolveConversationEntityName(), tagConversationEntities() (+14 more)

### Community 15 - "Community 15"
Cohesion: 0.10
Nodes (21): @anthropic-ai/sdk, better-sqlite3, @modelcontextprotocol/sdk, next, dependencies, @anthropic-ai/sdk, better-sqlite3, @modelcontextprotocol/sdk (+13 more)

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (17): GET(), backfillEmbeddingsLoop(), ensureProfileSeed(), extractEntryDate(), FILES_DIR, getMaybeCompressChatSessions(), getMaybeIngestDropbox(), getMaybeRunWeeklyBackup() (+9 more)

### Community 17 - "Community 17"
Cohesion: 0.19
Nodes (18): DecisionEntityInput, ensureDecisionPage(), ensureDecisionsNotebook(), KINDS, tagDecisionEntities(), dateKey(), decisionNoteFileName(), decisionPageId() (+10 more)

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (18): EntityPredicate, isEntityPredicate(), PREDICATE_LABELS, PREDICATES, CleanRelationshipInput, cleanRelationships(), EntityKind, getRelationshipsFor() (+10 more)

### Community 19 - "Community 19"
Cohesion: 0.19
Nodes (18): ensureReflectionPage(), ensureReflectionsNotebook(), KINDS, ReflectionEntityInput, tagReflectionEntities(), dateKey(), getReflectionByKey(), markReflectionsLinked() (+10 more)

### Community 20 - "Community 20"
Cohesion: 0.17
Nodes (15): LOCKED(), POST(), ExistingRow, importRemarkableNotebook(), importRemarkableNotebookInner(), ImportResult, importsInFlight, ImportStatus (+7 more)

### Community 21 - "Community 21"
Cohesion: 0.24
Nodes (16): GET(), LOCKED(), POST(), backupConfigured(), BackupStatus, deleteBackupFile(), listBackups(), maybeRunWeeklyBackup() (+8 more)

### Community 22 - "Community 22"
Cohesion: 0.26
Nodes (15): GET(), LOCKED(), POST(), buildSelfModel(), BINARY_EXT, disciplineConfig(), disciplineRepoName(), fetchRepoTextFiles() (+7 more)

### Community 23 - "Community 23"
Cohesion: 0.20
Nodes (12): Home(), LatestInsight, preview(), RecentNotebook, statusLabel(), Badge(), BadgeProps, TONE_CLASSES (+4 more)

### Community 24 - "Community 24"
Cohesion: 0.29
Nodes (16): extractTaggingEntities(), wikiLinkingEnabled(), listUnlinkedConversations(), listUnlinkedDecisions(), autoTagConversation(), autoTagDecision(), autoTagExportsEnabled(), autoTagReflection() (+8 more)

### Community 25 - "Community 25"
Cohesion: 0.29
Nodes (13): DELETE(), GET(), LOCKED(), POST(), escapeHtml(), GET(), page(), POST() (+5 more)

### Community 26 - "Community 26"
Cohesion: 0.13
Nodes (9): AxisLabels, HeatmapBucket, Map3D, MapPoint, MindData, SentimentPoint, ThemeBucket, Section() (+1 more)

### Community 27 - "Community 27"
Cohesion: 0.21
Nodes (10): track(), Attachment, Msg, Insight, InsightsPage(), summarize(), ensurePosthog(), PostHogProvider() (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.31
Nodes (13): GET(), POST(), reembedMissingMemories(), callVoyage(), embed(), embedBatch(), embedBatchOrThrow(), embeddingsEnabled() (+5 more)

### Community 29 - "Community 29"
Cohesion: 0.22
Nodes (13): POST(), EntityWikiExcerpt, candidates(), entityWikiAutoEnabled(), evenSample(), excerptHash(), excerptsLen(), Kind (+5 more)

### Community 30 - "Community 30"
Cohesion: 0.17
Nodes (12): ChatMemoryItem, ChatMemorySection(), ChatMemoryStatus, formatBytes(), MEMORY_FILTERS, MemoryPage(), PendingBatchDetail, DuplicateCandidate (+4 more)

### Community 31 - "Community 31"
Cohesion: 0.31
Nodes (14): ensureChatDiaryNotebook(), nextPageIndex(), normaliseDate(), processChatDiaryEntry(), saveChatDiaryEntry(), updateSelfModel(), encodeEmbedding(), maybeDistillLocation() (+6 more)

### Community 32 - "Community 32"
Cohesion: 0.13
Nodes (14): background_color, description, display, icons, name, files, share_target, action (+6 more)

### Community 33 - "Community 33"
Cohesion: 0.31
Nodes (11): fmtDate(), fmtDateTime(), fmtTime(), GET(), LOCKED(), shifted(), ATTACHMENT_DIR, cleanupOrphanChatAttachments() (+3 more)

### Community 34 - "Community 34"
Cohesion: 0.31
Nodes (9): GET(), LOCKED(), buildCandidate(), buildCloudCoverage(), classifyDuplicate(), CloudCoverage, DuplicateCandidate, DuplicateClassification (+1 more)

### Community 35 - "Community 35"
Cohesion: 0.23
Nodes (7): AutoLock(), clearHiddenSince(), readHiddenSince(), isPickingFile(), isUnlocking(), setPickingFile(), setUnlocking()

### Community 36 - "Community 36"
Cohesion: 0.22
Nodes (11): DayCost, DayData, FEATURE_LABEL, FeatureCost, money(), MonthData, pad(), UsagePage() (+3 more)

### Community 37 - "Community 37"
Cohesion: 0.27
Nodes (10): GET(), GET(), recordLibrarianHeartbeat(), clearSetting(), buildAuthUrl(), dropboxConfigured(), exchangeCodeForTokens(), fetchAccountDisplayName() (+2 more)

### Community 38 - "Community 38"
Cohesion: 0.30
Nodes (10): GET(), dailyUsage(), FALLBACK, monthlyUsage(), priceFor(), Prices, totalUsage(), tzModifier() (+2 more)

### Community 39 - "Community 39"
Cohesion: 0.24
Nodes (7): codeFrom(), consent(), exchange(), issueAccessToken(), Mod, pkce(), register()

### Community 40 - "Community 40"
Cohesion: 0.36
Nodes (8): GET(), LOCKED(), GET(), hasNotes(), LOCKED(), POST(), buildNotesContext(), getCurrentProfileRow()

### Community 41 - "Community 41"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, lint, start, test (+2 more)

### Community 42 - "Community 42"
Cohesion: 0.20
Nodes (5): ChatToolsMod, DbMod, MergeMod, NotesMod, Result

### Community 43 - "Community 43"
Cohesion: 0.31
Nodes (6): POST(), classifyDropboxError(), disconnectDropbox(), DropboxApiError, revokeAccessTokenAtDropbox(), safeDropboxError()

### Community 44 - "Community 44"
Cohesion: 0.25
Nodes (4): AxisLabels, MapPoint, Point(), sentimentColour()

### Community 45 - "Community 45"
Cohesion: 0.22
Nodes (8): ButtonProps, Common, LinkButton(), LinkButtonProps, Size, SIZE_CLASSES, Variant, VARIANT_CLASSES

### Community 46 - "Community 46"
Cohesion: 0.22
Nodes (8): build, builder, dockerfilePath, deploy, restartPolicyMaxRetries, restartPolicyType, startCommand, $schema

### Community 47 - "Community 47"
Cohesion: 0.22
Nodes (4): ChatToolsMod, DbMod, MindMod, NotesMod

### Community 48 - "Community 48"
Cohesion: 0.25
Nodes (3): DbMod, ExportMod, NotesMod

### Community 50 - "Community 50"
Cohesion: 0.25
Nodes (3): ChatToolsMod, DbMod, NotesMod

### Community 51 - "Community 51"
Cohesion: 0.48
Nodes (6): GET(), LOCKED(), POST(), resolve(), Slot, SLOTS

### Community 52 - "Community 52"
Cohesion: 0.33
Nodes (5): LINKS, Nav(), DocWithVT, Props, TransitionLink()

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
Cohesion: 0.29
Nodes (4): ChatToolsMod, flushAsyncWork(), McpMod, RouteMod

### Community 58 - "Community 58"
Cohesion: 0.33
Nodes (3): ClaudeMod, CmMod, DbMod

### Community 59 - "Community 59"
Cohesion: 0.33
Nodes (3): CmMod, DbMod, EmbMod

### Community 61 - "Community 61"
Cohesion: 0.33
Nodes (5): ClaudeMod, CwMod, DbMod, EtMod, RwMod

### Community 62 - "Community 62"
Cohesion: 0.33
Nodes (3): DbMod, MindMod, NotesMod

### Community 63 - "Community 63"
Cohesion: 0.33
Nodes (3): DbMod, DedupMod, NotesMod

### Community 64 - "Community 64"
Cohesion: 0.40
Nodes (4): CdMod, DbMod, MindMod, NotesMod

### Community 65 - "Community 65"
Cohesion: 0.40
Nodes (3): CmMod, DbMod, EmbMod

### Community 68 - "Community 68"
Cohesion: 0.40
Nodes (3): DbMod, DropboxMod, NotesMod

### Community 69 - "Community 69"
Cohesion: 0.40
Nodes (4): DbMod, EmbMod, MindMod, NotesMod

### Community 70 - "Community 70"
Cohesion: 0.40
Nodes (3): ClaudeMod, DbMod, EwMod

### Community 71 - "Community 71"
Cohesion: 0.40
Nodes (4): CeMod, DbMod, ReMod, RwMod

### Community 72 - "Community 72"
Cohesion: 0.40
Nodes (3): DbMod, NotesMod, SyncMod

### Community 73 - "Community 73"
Cohesion: 0.50
Nodes (3): RFC-8414, RFC-9728, nextConfig

### Community 75 - "Community 75"
Cohesion: 0.50
Nodes (3): CeMod, CwMod, DbMod

### Community 76 - "Community 76"
Cohesion: 0.50
Nodes (3): DbMod, DeMod, DwMod

## Knowledge Gaps
- **388 isolated node(s):** `extends`, `next/core-web-vitals`, `LINKS`, `ATTACHMENT_DIR`, `MemoryRow` (+383 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db()` connect `Community 5` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 14`, `Community 16`, `Community 17`, `Community 18`, `Community 19`, `Community 20`, `Community 21`, `Community 22`, `Community 23`, `Community 24`, `Community 25`, `Community 28`, `Community 29`, `Community 31`, `Community 33`, `Community 34`, `Community 37`, `Community 38`, `Community 40`?**
  _High betweenness centrality (0.171) - this node is a cross-community bridge._
- **Why does `getSetting()` connect `Community 10` to `Community 0`, `Community 33`, `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 11`, `Community 14`, `Community 16`, `Community 51`, `Community 21`, `Community 22`, `Community 29`, `Community 31`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `isAuthenticated()` connect `Community 0` to `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 7`, `Community 8`, `Community 10`, `Community 11`, `Community 16`, `Community 20`, `Community 21`, `Community 22`, `Community 25`, `Community 28`, `Community 29`, `Community 33`, `Community 34`, `Community 37`, `Community 38`, `Community 40`, `Community 43`, `Community 51`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **What connects `extends`, `next/core-web-vitals`, `LINKS` to the rest of the system?**
  _388 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.0593607305936073 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07203219315895372 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05311676909569798 - nodes in this community are weakly interconnected._