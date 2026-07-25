# Audit: typed entity relationships (shipped by Codex) + what's actually next

_Audited at `b3c6f96` on `main`. Test suite: **630 passing / 64 files**._

## Why this document

A design review defined **seven requirements** for the typed-relationship
feature, chosen specifically to prevent four long-term failure modes:
untraceable LLM claims, stale edges after entity merges, uncontrolled
predicates, and relationships that cannot be corrected. Codex implemented the
feature (`2fad6ce`) while the reviewing session was paused. This is the
verification pass.

## Verdict: all seven SATISFIED. No corrective work required.

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Provenance **in the PRIMARY KEY** | ✅ | `lib/db.ts` — `entity_relationships` PK is `(subject_kind, subject_norm, predicate, object_kind, object_norm, source_kind, source_key)`. Provenance is genuinely part of the key, not a loose column. |
| 2 | Scoped replace by `conversation_key` | ✅ | `lib/entityRelationships.ts:relateEntities` refuses unknown keys via `getConversationByKey`, then `DELETE … WHERE source_kind=? AND source_key=?` + reinsert inside one `db().transaction()`. Re-running with a corrected/empty set retracts only that conversation's edges. |
| 3 | Controlled predicate vocabulary | ✅ | `lib/entityPredicates.ts` — 9 stable keys + readable labels, `isEntityPredicate` type guard. `cleanRelationships` **returns an error** for out-of-enum values (stricter than the spec, which only required rejection). |
| 4 | Entity-merge endpoint rewrite | ✅ | `lib/entityMerge.ts` — inside `mergeEntity`'s existing `db().transaction()`: `UPDATE OR IGNORE` + cleanup `DELETE` for **both** subject and object endpoints, plus a self-loop sweep. Correctly uses inline SQL (no import → no cycle). |
| 5 | No self/author entity in v1 | ✅ | No self node invented; only named person/place/project. |
| 6 | Export + deletion lifecycle | ✅ **exceeded** | `lib/mcp.ts:refreshRelationshipStubs` splits touched stubs into live vs stale, re-exports the live ones and **`deleteDiaryExportFiles` the orphans**. `relateEntities` returns endpoints from the *pre-existing* rows too, so retracted entities get cleaned up. My own plan had deferred orphan deletion as a "known v1 limitation" — Codex actually solved it. |
| 7 | Accurate Obsidian claim | ✅ | Docs explicitly state the opposite of the overstatement: `CLAUDE.md:468` "never promise labeled graph edges"; `docs/mcp-setup.md:330` "body, not as graph-edge labels". |

### Adjacent checks (newer, less-reviewed work) — all clean
- `app/api/graph/route.ts` gates on `isAuthenticated()` (consistent with every
  other data route).
- `save_diary_entry` / `save_decision` / `save_reflection` each have their **own
  independent** env flag (`MCP_ALLOW_DIARY_WRITE`, `MCP_ALLOW_DECISION_SAVE`,
  `MCP_ALLOW_REFLECTION_SAVE`), all default-off — matching the fail-safe MCP
  invariant.
- `graphify-out/graph.json` contains **zero** absolute local paths
  (`/home/user...`), so nothing machine-specific leaked into the repo.
- The churny Graphify outputs (`cache/`, `manifest.json`, `.graphify_root`,
  `.graphify_analysis.json`) are correctly `.gitignore`d.

## The one open tradeoff (decision, not a bug)

`graphify-out/graph.html` (1.3 MB) + `graph.json` (1.6 MB) = **~2.9 MB of
generated artifacts committed to the repo**, which will re-churn wholesale
every time the graph is regenerated. That was a deliberate choice (see
`docs/graphify-phase-a.md`) to give fresh sessions a pre-built map. It is
defensible, but if repo size/diff noise becomes annoying, the alternative is to
`.gitignore` `graphify-out/` entirely and regenerate on demand per session.
**No action taken — flagging for the owner to decide.**

## What's genuinely next (nothing is blocking)

1. **Live end-to-end check** (needs the deployed Railway instance +
   `MCP_ALLOW_WIKI_LINKING=true`): call `relate_entities` for a conversation,
   re-call with a changed set, confirm only that conversation's edges change,
   and confirm both endpoint stubs render `## Relationships` with resolving
   `[[wikilinks]]`. Extraction quality and vault rendering can only be verified
   there, not locally.
2. **Deferred by design, still deferred** — revisit only if wanted:
   - In-app diary extraction of relationships (a `source_kind='diary'` writer).
     The provenance PK already isolates it from librarian edges, so it can be
     added without touching existing rows.
   - A canonical "self"/author entity, if relating things to the diarist
     directly ever becomes desirable.

---

# HAND-OFF INSTRUCTIONS FOR CODEX

> **Status: the typed-relationship feature is complete and verified.** An
> independent audit against all seven design-review requirements found them
> **all satisfied**, with the export/orphan-deletion lifecycle (#6) exceeding
> spec. `main` is green at 630 tests / 64 files. **Do not rebuild or refactor
> this feature.**
>
> If you pick up work here, these are the only open items:
>
> 1. **Graphify artifact size (owner decision pending).** `graphify-out/` is
>    ~2.9 MB committed and re-churns on every regeneration. If the owner asks
>    to slim the repo: `.gitignore` `graphify-out/` and document regenerating
>    on demand (`graphify extract .`). Do NOT install a **post-commit** hook to
>    refresh committed output — it runs *after* the commit, so refreshed files
>    are never in the commit and leave a dirty tree. Use pre-commit or an
>    explicit script.
> 2. **In-app diary relationship extraction** (only if requested). Write rows
>    with `source_kind='diary'`, `source_key=<page_id>`. The composite PK
>    already keeps these isolated from `librarian_conversation` rows, so no
>    schema change is needed. Cost is per-page, so bound it the way
>    `analyzePending` is bounded.
> 3. **A canonical self/author entity** (only if requested). Deliberately
>    absent in v1 — design it explicitly rather than letting one appear ad hoc,
>    or entity identity will fork.
>
> **Invariants to preserve when touching this area:**
> - Never import `lib/entityRelationships.ts` from `lib/entityMerge.ts` — it
>   creates a cycle (`entityRelationships` → `conversationEntities` →
>   `entityMerge`). The merge-time endpoint rewrite must stay **inline SQL**
>   inside `mergeEntity`'s existing transaction.
> - Entity accumulator map keys in `lib/diaryExportDb.ts` use a **`\0`
>   separator**, never a space — a space silently forks keys (this bug was hit
>   and fixed during Phase C).
> - Every fire-and-forget async call needs its own `.catch()`; an outer
>   try/catch does not catch a rejected promise, and unhandled rejections are
>   fatal under modern Node.
> - Predicates are a closed enum in `lib/entityPredicates.ts`. Extend that map
>   rather than accepting free text.
> - Obsidian does **not** render predicate labels on graph edges. Never
>   describe it as doing so; labels live in the note body.
> - Keep `CLAUDE.md` / `AGENTS.md` / `SKILL.md` / `CHANGELOG.md` in sync, keep
>   `npx vitest run` + `npm run build` green, and **ask the owner before
>   merging** any PR.
