# Plan: (B) typed-relationship enrichment of the diary knowledge graph + (A) Graphify pilot

> **Hand-off plan (v2 — revised after review).** Self-contained so a fresh
> Claude Code **or Codex** session can execute it without the originating
> conversation's context. **Build Phase B first** (real user-facing value);
> Phase A is a separate, unvalidated developer-tool pilot.
>
> **Prior context:** MCP Phase A/B/C are all MERGED (PRs #141–147). Phase C
> shipped the "librarian" surface — a synthetic `mcp-conversations` notebook,
> six MCP tools behind `MCP_ALLOW_WIKI_LINKING=true`, an
> `entity_conversation_notes` table, and Obsidian stub rendering. THIS plan
> mirrors those patterns. **Before writing code, read in full:**
> `lib/conversationEntities.ts` (esp. `resolveConversationEntityName`,
> `tagConversationEntities`), `lib/entityMerge.ts:mergeEntity`, and
> `lib/diaryExportDb.ts:renderEntityStubFiles`. The `\0`-separator gotcha in
> B4 and the merge-rewrite requirement in B0/B1 are load-bearing — both were
> real bugs the review caught.

## Context / why

The diary already HAS an accumulating entity graph: entities are tagged onto
diary/conversation pages (`entry_entities`), aliases resolve to canonical
casing (`entityMerge`), co-occurrence edges come from shared days
(`entityGraph`), and Obsidian stubs make entities browsable. What it LACKS is
**explicit semantics** — today an edge only means "co-occurred on the same
day," never "Jin *works at* Samsung" or "Jin *lives in* Suwon." Phase B adds
labeled, **provenance-tracked, correctable** relationships asserted by the
Phase C librarian from conversations.

**Accurate promise (do not overstate):** `[[wikilinks]]` connect the entities
as nodes in Obsidian's graph, and each entity's **note body** explains *how*
they relate (a `## Relationships` section). Obsidian's default graph view does
**not** print predicate labels on the edges themselves — so the deliverable is
"connected entities whose notes explain the relationship," not "a graph with
labeled edges."

---

# PHASE B — typed relationships (build in the numbered order below)

Design discipline carried from Phase C: **AI decides content (which entities,
which predicate), code decides destination (the exact rows); deterministic
name resolution; provenance-scoped, correctable writes; ownership separation.**

## Step 1 — Assertions: schema + data layer + merge support + tests

### B0. Schema (`lib/db.ts`, in the `SCHEMA` string after `entity_conversation_notes`)

```sql
CREATE TABLE IF NOT EXISTS entity_relationships (
  subject_kind  TEXT NOT NULL CHECK (subject_kind IN ('person','place','project')),
  subject_norm  TEXT NOT NULL,
  subject_name  TEXT NOT NULL,
  predicate     TEXT NOT NULL,               -- controlled enum value, see B1
  object_kind   TEXT NOT NULL CHECK (object_kind IN ('person','place','project')),
  object_norm   TEXT NOT NULL,
  object_name   TEXT NOT NULL,
  source_kind   TEXT NOT NULL,               -- 'librarian_conversation' (v1); 'diary' reserved for later
  source_key    TEXT NOT NULL,               -- conversation_key (v1) or page id (later)
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (subject_kind, subject_norm, predicate, object_kind, object_norm, source_kind, source_key)
);
CREATE INDEX IF NOT EXISTS idx_entity_rel_subject
  ON entity_relationships(subject_kind, subject_norm);
CREATE INDEX IF NOT EXISTS idx_entity_rel_object
  ON entity_relationships(object_kind, object_norm);
CREATE INDEX IF NOT EXISTS idx_entity_rel_source
  ON entity_relationships(source_kind, source_key);
```

**Why provenance is IN the primary key** (review point 1): `source` as a
non-key column would let a re-run or a future diary-writer clobber/collide with
librarian edges. With `(…, source_kind, source_key)` in the PK: (a) two
different conversations can each independently assert the same logical edge
(deduped at render, B4); (b) re-asserting a conversation's edges is a **scoped
replace** on exactly that `source_key` (B1), so a corrected re-run replaces
only the edges that conversation caused — nothing else. `CREATE TABLE IF NOT
EXISTS` in SCHEMA suffices for existing DBs (brand-new table, no `ALTER`).

### B1. Data layer — new file `lib/entityRelationships.ts`

Separate file (one concern each, like `entityMerge`/`entityWiki`). **Import-cycle
note:** this file imports `resolveConversationEntityName` from
`conversationEntities.ts`, which imports `applyEntityAlias` from
`entityMerge.ts`. Therefore `entityMerge.ts` must NOT import this file — the
merge-rewrite SQL in B1.4 lives **inline in `entityMerge.ts`** (it needs no name
resolution, only the canonical norm/name the merge already has), keeping the
cycle broken.

**B1.1 — Controlled predicate enum** (review point 3). Free text forks
("friend of" vs "college friend" vs "was friends with"). Define a stable set +
readable labels:

```ts
// key = stored value; label = how it renders in the Obsidian note body.
export const PREDICATES: Record<string, string> = {
  friend_of:    "friend of",
  family_of:    "family of",
  colleague_of: "colleague of",
  works_at:     "works at",
  studied_at:   "studied at",
  lives_in:     "lives in",
  located_in:   "located in",
  part_of:      "part of",
  related_to:   "related to",   // catch-all when nothing fits
};
```
The MCP tool schema (B2) lists these as an `enum`; the data layer drops any
edge whose predicate isn't a key of `PREDICATES` (same "filter invalid input"
posture as the kind check). Add predicates later only by extending this map.

**B1.2 — `relateEntities` = SCOPED REPLACE by conversation** (review point 2).
Mirror `tagConversationEntities`: require a known `conversation_key`, refuse
unknown, then delete+reinsert only THIS conversation's edges. Reuse
`resolveConversationEntityName` on both endpoints. Empty set = retract all of
that conversation's edges (the correction path).

```ts
import { db, setSetting } from "./db";
import {
  resolveConversationEntityName,
  // markConversationsLinked is exported from conversationWiki via conversationEntities? NO —
} from "./conversationEntities";
import { getConversationByKey } from "./conversationWiki";

const KINDS = new Set(["person", "place", "project"]);
const SOURCE_KIND = "librarian_conversation";
const MAX_RELATIONSHIPS_PER_CALL = 40;

export type RelationshipInput = {
  subject_kind: string; subject_name: string;
  predicate: string;
  object_kind: string; object_name: string;
};

export function relateEntities(input: {
  conversationKey: string;
  relationships: RelationshipInput[];
}): { related: number } | { error: string } {
  if (!getConversationByKey(input.conversationKey)) {
    return { error: `Unknown conversation_key "${input.conversationKey}" — export it first with export_conversation.` };
  }
  const clean = (input.relationships || [])
    .slice(0, MAX_RELATIONSHIPS_PER_CALL)
    .map((e) => ({
      sk: String(e?.subject_kind || "").trim().toLowerCase(),
      sn: String(e?.subject_name || "").trim(),
      p:  String(e?.predicate || "").trim().toLowerCase(),
      ok: String(e?.object_kind || "").trim().toLowerCase(),
      on: String(e?.object_name || "").trim(),
    }))
    .filter((e) => KINDS.has(e.sk) && KINDS.has(e.ok) && e.sn && e.on && (e.p in PREDICATES));

  const del = db().prepare(
    `DELETE FROM entity_relationships WHERE source_kind = ? AND source_key = ?`
  );
  const ins = db().prepare(
    `INSERT OR IGNORE INTO entity_relationships
       (subject_kind, subject_norm, subject_name, predicate,
        object_kind, object_norm, object_name, source_kind, source_key, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?, datetime('now'))`
  );
  db().transaction(() => {
    del.run(SOURCE_KIND, input.conversationKey);                 // scoped retract
    for (const e of clean) {
      const s = resolveConversationEntityName(e.sk, e.sn);
      const o = resolveConversationEntityName(e.ok, e.on);
      if (e.sk === e.ok && s.norm === o.norm) continue;          // skip self-loop
      ins.run(e.sk, s.norm, s.name, e.p, e.ok, o.norm, o.name, SOURCE_KIND, input.conversationKey);
    }
  })();
  setSetting("librarian_last_write_at", new Date().toISOString());
  return { related: clean.length };
}
```

**B1.3 — Reads** (both directions; used by the render + the MCP read tool).
De-dupe across sources so the same logical edge asserted by two conversations
appears once:

```ts
export function getRelationshipsFor(kind: string, norm: string): Array<{
  predicate: string; otherKind: string; otherName: string; direction: "out" | "in";
}> { /* SELECT where subject=(kind,norm) → 'out'; where object=(kind,norm) → 'in';
       DISTINCT on (predicate, otherKind, otherNorm, direction). */ }

export function allRelationshipRows(): Array<{
  subject_kind: string; subject_norm: string; subject_name: string; predicate: string;
  object_kind: string; object_norm: string; object_name: string;
}> { /* SELECT DISTINCT the seven identity columns (drop source_*/updated_at) so
        render dedupes multi-source edges; try/catch → [] if table missing. */ }
```

**B1.4 — Merge support (REQUIRED — review point 4).** `mergeEntity`
(`lib/entityMerge.ts`) rewrites `entry_entities` but is blind to relationship
endpoints; without this, an alias merge leaves stale/duplicate relationship
rows and disconnected stubs. Add, INSIDE `mergeEntity`'s existing
`db().transaction(() => { … })` (inline SQL, no import — avoids the cycle),
after the `entry_entities` rewrite+cleanup, the SAME shape for BOTH endpoints:

```sql
-- rewrite subject endpoint to canonical; UPDATE OR IGNORE + cleanup DELETE
UPDATE OR IGNORE entity_relationships SET subject_norm = ?, subject_name = ?
  WHERE subject_kind = ? AND subject_norm = ?;              -- (canonicalNorm, canonicalName, kind, aliasNorm)
DELETE FROM entity_relationships WHERE subject_kind = ? AND subject_norm = ?;   -- leftover collisions (kind, aliasNorm)
-- rewrite object endpoint to canonical
UPDATE OR IGNORE entity_relationships SET object_norm = ?, object_name = ?
  WHERE object_kind = ? AND object_norm = ?;
DELETE FROM entity_relationships WHERE object_kind = ? AND object_norm = ?;
-- a merge can turn an edge into a self-loop (both ends now canonical) — drop those
DELETE FROM entity_relationships
  WHERE subject_kind = object_kind AND subject_norm = object_norm;
```
This runs for BOTH the Claude-driven `dedupeAllEntities` and manual
`mergeEntitiesManually` paths (both funnel through `mergeEntity`). Mirror the
`UPDATE OR IGNORE` + `DELETE` collision handling already used for
`entry_entities` right above it.

**B1.5 — Tests** (`test/entityRelationships.test.ts`, mirror
`test/conversationEntities.test.ts` harness): scoped-replace by
`conversation_key` (re-run with a new set replaces ONLY that key's edges;
another conversation's edges untouched); empty set retracts that conversation's
edges; unknown `conversation_key` → error; predicate not in enum is dropped;
self-loop skipped; endpoints fold through alias/canonical casing;
`getRelationshipsFor` both directions + dedup. Plus a merge test
(`test/entityMerge.test.ts` or the relationships test): after `mergeEntity`,
relationship rows pointing at the alias now point at canonical (both subject and
object positions), collisions/self-loops cleaned.

## Step 2 — MCP surface

### B2. Write tool `relate_entities` (`lib/mcp.ts`)

Gate on the EXISTING `MCP_ALLOW_WIKI_LINKING` flag (no new flag). Mirror
`TAG_ENTITIES_TOOL` (see `mcp.ts` ~L380–395 registration + ~L445–456 dispatch):
- `RELATE_TOOL_NAME = "relate_entities"`; inputSchema
  `{ conversation_key: string, relationships: [{subject_kind, subject_name, predicate, object_kind, object_name}] }`
  with `kind` enums (person/place/project) and `predicate` an **enum of the
  `PREDICATES` keys**. Description: "Record how people/places/projects mentioned
  in a conversation relate — e.g. subject 'Jin' (person) `works_at` object
  'Samsung' (project). Requires the conversation_key from export_conversation;
  re-calling with the same key REPLACES that conversation's relationships (send
  the full set; an empty list retracts them). Call get_entity_wiki first to see
  what's already recorded."
- Register inside the `librarianToolsEnabled()` block in `mcpToolList()`; add to
  the `librarianToolNames` array + dispatch in `callMcpTool` (parse
  `conversation_key` + `relationships`, call `relateEntities`, JSON-stringify).
- **Export lifecycle (review point 6):** after a successful write, fire
  `maybeExportDiaryToDropbox({ onlyEntityStubs: [...] })` for the DISTINCT set
  of endpoint stub paths touched (build via `entityStubRelPathForName(kind,
  name)` from `lib/diaryExportDb.ts`), fire-and-forget with `.catch()` — the
  exact pattern `lib/entityWiki.ts:~L280–289` uses. This is the deliberate
  export path the review asked for. (Note: Phase C's note/tag writes currently
  do NOT self-export — landing stubs only on the next unrelated export trigger.
  Applying this same async stub-push to `update_entity_conversation_notes` /
  `tag_conversation_entities` is an aligned, optional cleanup; mention in the PR,
  keep scope to relationships unless cheap.)
- Import `relateEntities`, `PREDICATES` from `@/lib/entityRelationships`.

### B3. Extend `get_entity_wiki` read (compose in `lib/mcp.ts`, NOT the data layer)

To avoid the import cycle, do NOT make `getCombinedEntityWiki` call into
relationships. In the `GET_ENTITY_WIKI_TOOL_NAME` branch of `callMcpTool`, call
`getCombinedEntityWiki(...)` and `getRelationshipsFor(...)` separately (resolve
`norm` once via the same helper the branch already uses) and merge into one JSON
response `{ …bio…, relationships: [...] }`. Update the tool description to say it
now also returns known relationships (so the librarian avoids re-asserting).

## Step 3 — Obsidian rendering + docs + tests

### B4. Render (`lib/diaryExport.ts` + `lib/diaryExportDb.ts`)

**`lib/diaryExport.ts`:** `EntityStub` gains
`relationships?: Array<{ predicate: string; otherName: string; direction: "out" | "in" }>`
(otherName pre-sanitized by the caller). In `renderEntityStub`, after
`## Recent conversations` and before `## Mentions`, add `## Relationships` when
non-empty, rendering the READABLE label via `PREDICATES[predicate] ?? predicate`:
- outgoing: `- ${label} [[${otherName}]]`
- incoming: `- [[${otherName}]] — ${label}`
Additive: absent/empty → byte-identical to today.

**`lib/diaryExportDb.ts:renderEntityStubFiles`:** fetch `allRelationshipRows()`
once; build `Map<"kind\0canonicalSanitizedName", edges[]>`. ⚠️ **USE THE `\0`
SEPARATOR** — the accumulator keys entities that way and a space silently forks
keys (this exact bug was hit + fixed in Phase C; the comment is in that
function). Resolve each endpoint's canonical casing via the
`fetchCanonicalEntityNames` map already built there, then `sanitizeEntityName`,
so an edge to "jin" renders `[[Jin]]`. Attach `relationships` to each
`EntityStub`. Extend the existing "conversation-only entity" pass so an entity
appearing ONLY as a relationship endpoint (never tagged/noted/mentioned) still
gets a bare stub — same shape as the `entity_conversation_notes` pass already
there.

**Deletion / orphan behavior (review point 6, honest v1 scope):** incremental
relationship writes ADD/REFRESH endpoint stub files (B2 export). A now-orphaned
relationship-only stub (all its edges retracted, no other presence) is NOT
deleted incrementally — the incremental `onlyEntityStubs` export only writes.
Its removal happens on the next **whole-vault sync** (`renderEntityStubFiles`
re-renders the full set and omits it). Document this as a known v1 limitation —
it's the same class as the existing merge-cleanup boundary and is acceptable for
one user; do not pretend incremental deletion works.

### B5. Tests (extend existing)
- `test/diaryExport.test.ts`: `## Relationships` renders outgoing + incoming
  with readable labels + `[[wikilinks]]`; absent when empty (byte-identical).
- `test/diaryExportDb.test.ts`: a relationship-endpoint-only entity gets a stub;
  edge casing matches the diary's canonical casing; a multi-source duplicate edge
  renders once.
- `test/mcp.test.ts`: `relate_entities` hidden+refused unless
  `MCP_ALLOW_WIKI_LINKING=true`; requires a known `conversation_key`; scoped
  re-run replaces only that key's edges; `get_entity_wiki` returns relationships;
  respects `MCP_EXCLUDE_TOOLS`.

### B6. Docs
- `CLAUDE.md`: add `entity_relationships` to the table list; add `relate_entities`
  to the librarian tool bullet; do-not-regress notes: (i) provenance
  (`source_kind`,`source_key`) is IN the PK and the write is a scoped-replace by
  `conversation_key` — never a blind global upsert; (ii) `mergeEntity` MUST
  rewrite relationship endpoints in the same transaction; (iii) predicates are a
  controlled enum (`PREDICATES`); (iv) the `\0` separator in stub rendering is
  load-bearing.
- `AGENTS.md`, `SKILL.md`: new file `lib/entityRelationships.ts`, new tool, new
  table.
- `docs/mcp-setup.md`: add `relate_entities`; extend the catch-up Routine prompt
  ("...and if the conversation reveals how two named people/places/projects
  relate — works_at, lives_in, friend_of, etc. — call relate_entities with the
  conversation_key"); extend the inline nudge in `export_conversation`'s dynamic
  description (`lib/mcp.ts`) to mention `relate_entities`. State the accurate
  Obsidian promise (connected notes that explain the relation, not labeled graph
  edges).
- `CHANGELOG.md`: dated entry + the deferred follow-ups (B7).

### B7. Deferred (do NOT build now — note in CHANGELOG)
- **In-app diary extraction** of relationships (a `source_kind='diary'`,
  `source_key=page_id` writer). The provenance PK already isolates it from
  librarian edges. Higher cost (per page); richest relational statements come up
  in conversation, so ship librarian-first.
- **A canonical "self"/author entity.** v1 models only named person/place/project
  — NO self node (the namespace has no self today; inventing one ad hoc would
  fork). Design a deliberate self entity later if wanted; until then, relate
  named entities to each other only.
- **In-app graph visualization** (`/mind` D3 view). Obsidian's graph + the
  relationship notes are the v1 delivery.

---

# PHASE A — Graphify pilot (separate, unvalidated; do AFTER Phase B)

Support as a small developer-tool experiment only, NOT wired into the app/build.
**Everything below is unverified** and must be checked before relying on it: in
this environment `uv` exists but the PyPI lookup for the package failed through
the network proxy, and there is no Graphify install or `graphify-out/` in the
repo yet.

Validate first, then decide whether to commit any output:
1. Confirm the real package name + commands (docs claim `uv tool install
   graphifyy` / `graphify install` / `graphify extract .` → `graphify-out/`
   with `graph.json`, `GRAPH_REPORT.md`, `graph.html`). Treat as unconfirmed
   until it actually installs and runs here or on a local machine.
2. If it runs, inspect the output BEFORE committing anything: artifact size +
   churn, determinism across runs, whether it embeds local absolute paths or
   pulls in unwanted files, and that it excludes `node_modules`, `.next`,
   `data/`, and the other generated dirs already in `.gitignore`.
3. **Do NOT use a post-commit hook to keep committed output fresh** — it runs
   *after* the commit, so regenerated files land as uncommitted changes (dirty
   tree, never in the commit). If graph output is committed, refresh it via a
   **pre-commit** hook or a versioned `npm run graph:update` / check script
   instead. Simplest pilot: `.gitignore` `graphify-out/` entirely and regenerate
   on demand per session; only commit output once determinism/size/path-safety
   are verified.
4. Its value is inside interactive coding sessions (the `/graphify` skill + MCP
   query tools), never at app runtime — nothing ships to Railway.

---

## Verification
- **Phase B:** `npx vitest run` all green (≈+18 new/updated tests); `npm run
  build` clean. Live: with `MCP_ALLOW_WIKI_LINKING=true`, via the connector,
  `export_conversation` then `relate_entities` (e.g. Jin `works_at` Samsung),
  trigger the stub export, and confirm both endpoint stubs render a
  `## Relationships` line whose `[[wikilink]]` resolves to the other stub;
  re-run `relate_entities` for the same `conversation_key` with a changed set and
  confirm only that conversation's edges change. Claude-extraction quality + the
  live vault render only fully verify on the deployed instance (say so).
- **Phase A:** only after step 2's checks pass — `graphify query` (or the MCP
  `query_graph` tool) returns a sensible path, output is deterministic and
  path-clean.

## Build order (per review)
1. **Step 1** — assertions: schema (provenance PK) + `lib/entityRelationships.ts`
   (predicate enum, `conversation_key`-scoped replace, canonical resolution) +
   `mergeEntity` endpoint rewrite + tests.
2. **Step 2** — `relate_entities` MCP tool + `get_entity_wiki` relationship read
   + the deliberate stub-export path.
3. **Step 3** — Obsidian rendering + export/deletion lifecycle + docs + tests.
4. **Phase A** — Graphify pilot, independently, only after validation.

One PR for Phase B (Steps 1–3), mirroring the Phase C PR shape. **Ask before
merging** — the owner approves merges.
