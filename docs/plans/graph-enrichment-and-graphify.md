# Plan: (A) Graphify the Remarkabler codebase + (B) typed-relationship enrichment of the diary knowledge graph

> **Hand-off plan.** Self-contained so a fresh Claude Code **or Codex** session
> can execute it without the originating conversation's context. Phases A and B
> are INDEPENDENT — do either first. Phase A is tooling (no app code); Phase B
> is the substantive app engineering.
>
> **Prior context:** MCP Phase A/B/C are all MERGED (PRs #141–147). Phase C
> shipped the "librarian" surface — a synthetic `mcp-conversations` notebook,
> six MCP tools behind `MCP_ALLOW_WIKI_LINKING=true`, an
> `entity_conversation_notes` table, and Obsidian stub rendering. THIS plan
> reuses those exact patterns. **Before starting Phase B, read
> `lib/conversationEntities.ts` and `lib/diaryExportDb.ts:renderEntityStubFiles`
> in full** — Phase B is a direct mirror of them, and the `\0`-separator bug
> called out in B4 is real (it was hit and fixed during Phase C).

## Context / why

The user wants their diary knowledge to "accumulate into a graph" and to "use
Graphify." Two separate things, both wanted:

- **Graphify** turns a *codebase* into a queryable knowledge graph for AI
  coding assistants (tree-sitter AST parsing, 100% local for code, no API keys).
  It does NOT and cannot graph personal/diary knowledge. Its only real use here
  is indexing the Remarkabler repo so future coding sessions are faster and
  avoid regressions (this codebase has many load-bearing invariants). → Phase A.
- The diary already HAS an accumulating knowledge graph (`entry_entities`
  co-occurrence via `lib/entityGraph.ts`, `entity_wiki` bios, Obsidian
  wikilink/stub export, all extended to conversations in Phase C). What it
  lacks is **typed relationships** — edges today only mean "co-occurred on the
  same day," not "Jin is the author's college friend" or "Jin lives in Suwon."
  Labeled edges are what turn a co-occurrence graph into a real knowledge
  graph, and they're what external graph tools (Graphiti/Graphify) are actually
  reaching for. → Phase B.

---

# PHASE A — Graphify the Remarkabler codebase (tooling only, no app code)

Goal: commit a pre-built code knowledge graph so future Claude Code / Codex
sessions on this repo query the graph instead of blind file reads. Zero effect
on diary data or the deployed app. Graphify is a **Python** CLI; code parsing is
local and needs no API keys.

### Steps
1. Install (in whatever environment runs the coding session):
   ```bash
   uv tool install graphifyy      # NOTE the double-y package name on PyPI
   graphify install               # registers the /graphify skill + MCP server
   ```
   If `uv` is unavailable: `pipx install graphifyy` or `pip install graphifyy`.
2. Build the graph at the repo root (`/home/user/remarkable-feed`):
   ```bash
   graphify extract .             # headless; or type "/graphify ." inside the assistant
   ```
   Output lands in `graphify-out/`: `graph.json` (queryable graph),
   `GRAPH_REPORT.md` (summary + suggested questions), `graph.html` (viz).
3. Commit the graph; ignore the churny bits:
   - `git add graphify-out/graph.json graphify-out/GRAPH_REPORT.md graphify-out/graph.html`
   - Append to `.gitignore`:
     ```
     graphify-out/cost.json
     graphify-out/cache/
     ```
4. Keep it fresh automatically:
   ```bash
   graphify hook install          # post-commit hook re-builds the AST graph (no API cost)
   ```
5. Add a short "Code knowledge graph" note to `AGENTS.md` (and/or `CLAUDE.md`):
   that `graphify-out/graph.json` exists, that sessions should prefer
   `graphify query` / the MCP tools (`query_graph`, `get_node`,
   `shortest_path`) over blind file reads, and how to rebuild
   (`graphify update ./lib`).

### Caveats to record honestly
- Value is realized inside *interactive* coding sessions (the `/graphify` skill
  + MCP hook), not at app runtime. Nothing ships to Railway.
- If this environment can't reach PyPI or run `uv`, do Phase A from a local
  machine; the app is unaffected either way.
- Do NOT wire Graphify into the Next.js build or Railway — it is a dev tool.

---

# PHASE B — typed relationships in the diary knowledge graph (app development)

Add explicit, labeled edges between entities (person/place/project), asserted
primarily by the Phase C librarian agent from conversations, rendered into the
Obsidian stub notes as a `## Relationships` section so Obsidian's graph view
draws meaningful connections. Mirrors Phase C's discipline throughout: **AI
decides content (which entities, what label), code decides destination (the
exact row); deterministic name resolution; ownership-separated storage.**

## B0. Schema — new table (`lib/db.ts`)

Add to the `SCHEMA` string, right after the `entity_conversation_notes` block:

```sql
CREATE TABLE IF NOT EXISTS entity_relationships (
  subject_kind  TEXT NOT NULL CHECK (subject_kind IN ('person','place','project')),
  subject_norm  TEXT NOT NULL,
  subject_name  TEXT NOT NULL,
  predicate     TEXT NOT NULL,               -- label, e.g. "college friend of", "lives in", "works at"
  object_kind   TEXT NOT NULL CHECK (object_kind IN ('person','place','project')),
  object_norm   TEXT NOT NULL,
  object_name   TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'librarian',
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (subject_kind, subject_norm, predicate, object_kind, object_norm)
);
```

Properties to keep:
- Directed edge `subject --predicate--> object`; both endpoints live in the
  existing `(kind, name_norm)` namespace, so they line up with `entry_entities`
  / stub notes with no new identity system.
- PK on `(subject, predicate, object)` → re-asserting the same edge UPSERTS,
  never duplicates.
- `source` column so a future in-app diary-extraction writer (deferred, B6) can
  coexist without clobbering librarian edges — same ownership-separation lesson
  as `entity_wiki` vs `entity_conversation_notes`.
- `CREATE TABLE IF NOT EXISTS` in SCHEMA is enough for existing DBs (brand-new
  table → no `ALTER` needed).

## B1. Data layer — new file `lib/entityRelationships.ts`

Separate file (one concern each, like `entityMerge`/`entityWiki`). Reuse
`resolveConversationEntityName` from `lib/conversationEntities.ts` — it folds
through `applyEntityAlias` AND prefers an existing canonical casing, exactly
what edge endpoints need so "JIN"/"Jin" don't fork.

```ts
import { db, setSetting } from "./db";
import { resolveConversationEntityName } from "./conversationEntities";

const KINDS = new Set(["person", "place", "project"]);
const MAX_PREDICATE_CHARS = 120;
const MAX_RELATIONSHIPS_PER_CALL = 30;

export type RelationshipInput = {
  subject_kind: string; subject_name: string;
  predicate: string;
  object_kind: string; object_name: string;
};

// Upsert labeled edges. Both endpoints resolved to canonical casing/alias
// first (code decides the row; the agent only supplies names + a label).
export function relateEntities(
  edges: RelationshipInput[]
): { related: number } | { error: string } {
  const clean = (edges || [])
    .slice(0, MAX_RELATIONSHIPS_PER_CALL)
    .map((e) => ({
      sk: String(e?.subject_kind || "").trim().toLowerCase(),
      sn: String(e?.subject_name || "").trim(),
      p:  String(e?.predicate || "").trim().slice(0, MAX_PREDICATE_CHARS),
      ok: String(e?.object_kind || "").trim().toLowerCase(),
      on: String(e?.object_name || "").trim(),
    }))
    .filter((e) => KINDS.has(e.sk) && KINDS.has(e.ok) && e.sn && e.p && e.on);

  const upsert = db().prepare(
    `INSERT INTO entity_relationships
       (subject_kind, subject_norm, subject_name, predicate,
        object_kind, object_norm, object_name, source, updated_at)
     VALUES (?,?,?,?,?,?,?, 'librarian', datetime('now'))
     ON CONFLICT(subject_kind, subject_norm, predicate, object_kind, object_norm)
       DO UPDATE SET subject_name = excluded.subject_name,
                     object_name  = excluded.object_name,
                     updated_at   = excluded.updated_at`
  );
  db().transaction(() => {
    for (const e of clean) {
      const s = resolveConversationEntityName(e.sk, e.sn);
      const o = resolveConversationEntityName(e.ok, e.on);
      if (e.sk === e.ok && s.norm === o.norm) continue; // skip self-loop
      upsert.run(e.sk, s.norm, s.name, e.p, e.ok, o.norm, o.name);
    }
  })();
  setSetting("librarian_last_write_at", new Date().toISOString());
  return { related: clean.length };
}

// All edges touching an entity, BOTH directions. 'out' = entity is subject.
export function getRelationshipsFor(
  kind: string, norm: string
): Array<{ predicate: string; otherKind: string; otherName: string; direction: "out" | "in" }> {
  const out = db().prepare(
    `SELECT predicate, object_kind AS otherKind, object_name AS otherName
     FROM entity_relationships WHERE subject_kind = ? AND subject_norm = ?`
  ).all(kind, norm) as Array<{ predicate: string; otherKind: string; otherName: string }>;
  const inc = db().prepare(
    `SELECT predicate, subject_kind AS otherKind, subject_name AS otherName
     FROM entity_relationships WHERE object_kind = ? AND object_norm = ?`
  ).all(kind, norm) as Array<{ predicate: string; otherKind: string; otherName: string }>;
  return [
    ...out.map((r) => ({ ...r, direction: "out" as const })),
    ...inc.map((r) => ({ ...r, direction: "in" as const })),
  ];
}

// Every edge, for the export to attach per-entity in one query (no N+1).
export function allRelationshipRows(): Array<{
  subject_kind: string; subject_norm: string; subject_name: string;
  predicate: string;
  object_kind: string; object_norm: string; object_name: string;
}> {
  try {
    return db().prepare(
      `SELECT subject_kind, subject_norm, subject_name, predicate,
              object_kind, object_norm, object_name FROM entity_relationships`
    ).all() as any;
  } catch { return []; } // table missing on older DB → stubs render without the section
}
```

## B2. MCP write tool `relate_entities` (`lib/mcp.ts`)

Add ONE new librarian tool, gated by the EXISTING `MCP_ALLOW_WIKI_LINKING` flag
(no new flag). Mirror `TAG_ENTITIES_TOOL` exactly:

- `RELATE_TOOL_NAME = "relate_entities"` + a `McpToolDef` whose inputSchema is
  `{ relationships: [{subject_kind, subject_name, predicate, object_kind, object_name}] }`
  (each kind an enum person/place/project, predicate free-text). Description:
  "Record a labeled relationship between two people/places/projects the person
  mentioned — e.g. subject 'Jin' (person), predicate 'college friend of',
  object another entity. Call get_entity_wiki first to see existing
  relationships and avoid duplicates."
- Register inside the existing `librarianToolsEnabled()` block in
  `mcpToolList()` (add `[RELATE_TOOL_NAME, RELATE_TOOL]` to that `for...of`).
- Add to the `librarianToolNames` array in `callMcpTool` and dispatch: parse
  `args.relationships`, call `relateEntities(...)`, JSON-stringify. The existing
  gate already refuses the whole array with "Tool not available" when off.
- `import { relateEntities } from "@/lib/entityRelationships"`.

## B3. Extend the read tool `get_entity_wiki` (`lib/mcp.ts`, NOT the data layer)

So the agent sees existing edges before adding. **Avoid an import cycle**
(`entityRelationships` already imports from `conversationEntities`): do NOT make
`getCombinedEntityWiki` call `getRelationshipsFor`. Instead, in the
`GET_ENTITY_WIKI_TOOL_NAME` branch of `callMcpTool`, call `getCombinedEntityWiki(...)`
and `getRelationshipsFor(...)` separately and merge into one JSON response.
Update that tool's description to say it now also returns known relationships.

## B4. Render into Obsidian stubs (`lib/diaryExport.ts` + `lib/diaryExportDb.ts`)

**`lib/diaryExport.ts`:**
- `EntityStub` gains `relationships?: Array<{ predicate: string; otherName: string; direction: "out" | "in" }>`
  (otherName already sanitized by the caller).
- In `renderEntityStub`, after `## Recent conversations` and before
  `## Mentions`, add `## Relationships` when non-empty:
  - outgoing: `- ${predicate} [[${otherName}]]`
  - incoming: `- [[${otherName}]] — ${predicate}`
  The `[[wikilink]]` is the load-bearing part — it's what makes Obsidian's
  graph draw the labeled edge. Additive: absent/empty → byte-identical to today.

**`lib/diaryExportDb.ts` `renderEntityStubFiles`:**
- Fetch `allRelationshipRows()` once; build a `Map<"kind\0sanitizedName", edges[]>`.
  ⚠️ **USE THE `\0` SEPARATOR, not a space** — the accumulator keys entities
  that way, and a space silently forks keys (this exact bug was hit + fixed in
  Phase C; see the comment already in that function). Sanitize BOTH endpoint
  names with the existing `sanitizeEntityName`; resolve endpoint canonical
  casing via the `fetchCanonicalEntityNames` map already built in that function
  so an edge to "jin" renders `[[Jin]]`.
- Attach `relationships` to each `EntityStub` by that key.
- Extend the existing "conversation-only entity" pass so an entity appearing
  ONLY as a relationship endpoint (never tagged/noted/mentioned) still gets a
  bare stub — same shape as the `entity_conversation_notes` pass already there.

## B5. Tests (Vitest, no network — mirror `test/conversationEntities.test.ts`)

- New `test/entityRelationships.test.ts`: `relateEntities` upserts (re-assert →
  ONE row, casing updated); resolves both endpoints through aliases/canonical
  casing; skips self-loops; caps at 30; `getRelationshipsFor` returns both
  directions.
- Extend `test/diaryExport.test.ts`: `## Relationships` renders outgoing +
  incoming with `[[wikilinks]]`; absent when empty (additive/byte-identical).
- Extend `test/diaryExportDb.test.ts`: a relationship-endpoint-only entity gets
  a stub; edge casing matches the diary's canonical casing.
- Extend `test/mcp.test.ts`: `relate_entities` hidden+refused unless
  `MCP_ALLOW_WIKI_LINKING=true`; when on it upserts and `get_entity_wiki`
  returns the new relationships; respects `MCP_EXCLUDE_TOOLS`.

## B6. Deferred follow-ups (do NOT build now — note in CHANGELOG)

- **In-app diary extraction of relationships** (`source='diary'` writer
  extending `analyzeEntryContent` or a new pass). Higher cost (per page); the
  richest relational statements come up in *conversation*, so start
  librarian-only. The `source` column already keeps the two writers apart.
- **In-app graph visualization** (`/mind` graph view). Obsidian's graph view
  already visualizes stubs+wikilinks+relationships for free; an in-app D3 view
  is a separate, larger feature.

## B7. Docs (update all, matching how Phase C is documented)

- `CLAUDE.md`: add `entity_relationships` to the table list; add
  `relate_entities` to the librarian tool list in the `lib/mcp.ts` bullet;
  do-not-regress note that `source` separates librarian- vs diary-asserted edges
  (never merge writers) and that the `\0` separator in stub rendering is
  load-bearing.
- `AGENTS.md`, `SKILL.md`: new file `lib/entityRelationships.ts`, new tool, new
  table.
- `docs/mcp-setup.md`: add `relate_entities` to the librarian tool list; extend
  the catch-up Routine prompt ("...and if the conversation reveals how two
  people/places/projects relate, call relate_entities"); extend the
  inline-tagging nudge in `export_conversation`'s dynamic description
  (`lib/mcp.ts`) to mention relate_entities alongside tag_conversation_entities.
- `CHANGELOG.md`: dated entry describing typed relationships + the two deferred
  follow-ups.

---

## Verification (both phases)

- **Phase A:** `graphify-out/graph.json` committed; `graphify query "how does
  export_conversation reach the vault"` (or the MCP `query_graph` tool) returns
  a sensible path `lib/mcp.ts` → `lib/conversationWiki.ts`/`lib/dropbox.ts`.
- **Phase B:** `npx vitest run` all green (≈+15 new tests); `npm run build`
  clean. Then live: with `MCP_ALLOW_WIKI_LINKING=true`, via the Remarkabler MCP
  connector call `relate_entities` (e.g. Jin —college friend of→ another
  entity), trigger a Dropbox export, and confirm the entity's stub note shows a
  `## Relationships` section whose `[[wikilink]]` resolves to the other entity's
  stub — Obsidian's graph now draws the labeled edge. Claude-extraction quality
  and end-to-end vault render only fully verify on the deployed instance (say so
  honestly, per repo convention).

## Suggested build order & PRs
1. Phase B first if the diary is the priority (the substantive value); Phase A
   is quick and independent — do it whenever.
2. One PR for Phase B (schema → data layer → MCP tool → rendering → tests →
   docs), mirroring the Phase C PR shape. **Ask before merging** (repo
   convention — the owner wants to approve merges).
3. Phase A can be its own tiny PR (`graphify-out/` + `.gitignore` + an AGENTS.md
   note) or folded in — it touches no app code.
