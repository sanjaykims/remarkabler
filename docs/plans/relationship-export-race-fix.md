# Bug: relationship data can be silently dropped from the exported vault

> **Hand-off for Codex.** Self-contained — includes root cause, live evidence,
> exact fix, and verification. The typed-relationship feature itself
> (`docs/plans/relationship-audit-and-next-steps.md`) is correctly built; this
> is a genuine concurrency bug in how its Dropbox export is triggered, found
> via a live end-to-end test, not a design flaw in the data layer.

## Live evidence (already verified, do not re-derive)

1. Asked subscription-Claude (via the Remarkabler MCP connector) to export a
   test conversation mentioning Jin, Minji, Suwon, Samsung, Yonsei, then tag
   entities and record relationships. It reported success and called
   `tag_conversation_entities` then `relate_entities`.
2. Queried the live database directly via the `get_entity_wiki` MCP tool:
   ```json
   {"kind":"person","name":"Jin","bio":null,"conversation_notes":null,
    "relationships":[
      {"predicate":"lives_in","otherKind":"place","otherName":"Suwon","direction":"out"},
      {"predicate":"works_at","otherKind":"project","otherName":"Samsung","direction":"out"},
      {"predicate":"friend_of","otherKind":"person","otherName":"Minji","direction":"in"}]}
   ```
   **The database is correct.**
3. Opened the actual exported `People/Jin.md` in the user's Dropbox vault (screenshot).
   It has a `## Related notes` section (the conversation backlink) but **no
   `## Relationships` section at all** — despite `lib/diaryExport.ts` (line
   497-508) definitely emitting that section whenever `stub.relationships` is
   non-empty. **The exported file is stale.**

So: data layer correct, MCP read tool correct, renderer correct — the bug is
specifically in the export **trigger** path.

## Root cause

`lib/dropbox.ts:786` `maybeExportDiaryToDropbox` uses ONE shared boolean lock
across the whole module:
```ts
if (exportInFlight) return { ok: false, skipped: "in-flight" };
exportInFlight = true;
```
Both new MCP write tools fire an export **un-awaited, fire-and-forget**, with
no coordination between them:

- `lib/mcp.ts:899-903` (`tag_conversation_entities` handler) fires a
  **broad** export: `maybeExportDiaryToDropbox({ notebookId: CONVERSATIONS_NOTEBOOK_ID })`
  — this re-renders every entity stub ever touched by any conversation, so it
  can take a while (a `renderEntityStubFiles()` call plus a per-file Dropbox
  upload loop with a 150ms delay between files).
- `lib/mcp.ts:907-933` (`relate_entities` handler) fires a **narrow** export
  seconds later: `refreshRelationshipStubs` (line 532) → `maybeExportDiaryToDropbox({ onlyEntityStubs })`.

The guided agent flow (`docs/mcp-setup.md` + the `export_conversation` nudge
in `lib/mcp.ts`) calls these back-to-back: tag, then relate, for the same
conversation. Sequence that actually happened:

1. `tag_conversation_entities` fires Export A. It acquires the lock almost
   immediately and starts rendering — **at this point relate_entities hasn't
   run yet**, so Export A's snapshot of Jin's stub has no relationships.
2. `relate_entities` commits the relationship rows (this part is correct and
   verified), then fires Export B. Export A is still mid-upload-loop, so
   Export B hits the lock and returns `{ ok: false, skipped: "in-flight" }`
   immediately — **it never renders, never uploads, and is never retried.**
3. Export A finishes uploading its already-stale (pre-relationship) content.
4. Nothing else ever touches Jin's stub again. `maybeExportDiaryToDropbox` is
   only called from `lib/notes.ts:149` (post-OCR) and these two MCP handlers
   — there is no periodic sweep that would eventually reconcile it. **The
   relationship data is stuck, correct in the DB, permanently unrendered,
   until some unrelated future event happens to touch the same entity.**

This is a real, already-reproduced bug, not a hypothetical race.

## The fix

> **Revision note:** an earlier draft of this doc recommended a bounded
> retry-with-backoff (4 attempts × 750ms). Codex's own automated PR review
> (on #162) correctly flagged that this is insufficient, not just in a rare
> edge case but during **normal use**: the `tag_conversation_entities` export
> touches every entity ever tagged in the whole conversations notebook *plus*
> the vault-structure files (`Home.md`, `People/Places/Projects` indexes,
> `Profile.md`), each separated by a 150ms delay — that alone exceeds a 2.25s
> retry budget once the notebook accumulates roughly 15+ files, which will
> happen naturally as this feature gets used. A bigger retry budget just
> raises the threshold, it doesn't fix the underlying problem: retries are a
> **probabilistic** fix for what needs to be a **guaranteed** one. Use the
> design below instead.

**Coalesced pending-flag** in `lib/dropbox.ts`, not a retry loop. Every export
already recomputes everything fresh from the DB on each run (no incremental
deltas) — so the lock doesn't need to remember *what* changed while it was
busy, only *that* something did, and guarantee exactly one more full run once
it's free. This is correct regardless of how long the in-flight export takes
or how many callers pile up while it's running.

```ts
// lib/dropbox.ts
let exportInFlight = false;
// Sticky flag: a caller's request arrived while an export was already
// running and got { skipped: "in-flight" }. Rather than retry-with-backoff
// (probabilistic — fails once the in-flight export legitimately takes longer
// than the retry budget, which happens in normal use once the vault has
// enough entities/files), guarantee the dropped request's data actually
// lands: run exactly ONE more full export as soon as the current one
// finishes. Every export re-renders fresh from the DB, so one unscoped
// follow-up run is a strict superset of whatever narrower request(s) (e.g.
// onlyEntityStubs) were coalesced into this flag — no need to track WHICH
// requests were dropped, only that at least one was.
let exportPending = false;

export async function maybeExportDiaryToDropbox(
  opts?: { /* ...existing options... */ }
): Promise<DiaryExportResult> {
  if (!dropboxExportEnabled()) return { ok: false, skipped: "disabled" };
  if (!dropboxConnected()) return { ok: false, skipped: "not-connected" };
  if (exportInFlight) {
    exportPending = true;
    return { ok: false, skipped: "in-flight" };
  }
  exportInFlight = true;
  try {
    // ...existing render + upload logic, unchanged...
    return result;
  } finally {
    exportInFlight = false;
    if (exportPending) {
      exportPending = false;
      // Fire-and-forget the guaranteed follow-up. Deliberately UNSCOPED (no
      // opts) so it re-renders and re-checks everything, not just what the
      // dropped caller(s) asked for.
      void maybeExportDiaryToDropbox().catch((e) =>
        console.warn("[dropbox] coalesced follow-up export failed:", (e as Error).message)
      );
    }
  }
}
```

This is a small, local change to the existing lock (add one boolean + check
it in the existing `finally` block) — NOT the larger promise-chained-queue
rewrite considered and rejected in the earlier draft. It doesn't touch the
other four exporters' call sites (`lib/entityWiki.ts`, diary/conversation/
reflection/decision) at all; they get the guarantee for free since they all
go through this same function.

With this in place, `refreshRelationshipStubs` (`lib/mcp.ts:532-543`) and the
`tag_conversation_entities` export trigger (`lib/mcp.ts:899-903`) need **no
changes** — the guarantee lives entirely in `lib/dropbox.ts`, transparently to
every caller. Simpler than the retry approach in both the fix itself and what
callers have to do.

**One thing to verify while implementing:** confirm the `opts` used elsewhere
(`notebookId`, `onlyNewest`, `extraDayFiles`, `onlyEntityStubs`) don't have a
caller that relies on the follow-up run being *scoped* the same way the
original call was — re-read every call site listed in the "Live evidence /
Root cause" section above before assuming an unscoped follow-up is always
safe. If any caller's correctness depends on scoping (unlikely, since
`renderEntityStubFiles()`/`renderDiaryDayFiles()` etc. are always fresh
reads), note it in the PR rather than silently narrowing the follow-up.

## Repairing the currently-stuck data

The fix only prevents *future* drops. Jin's and Minji's stubs are stuck stale
right now. After the fix ships, tell the user to re-run `relate_entities` once
more for the same `conversation_key` with the same relationships (it's a
scoped replace — see `docs/plans/relationship-audit-and-next-steps.md` — so
this is safe and idempotent) to force a fresh export that now benefits from
the coalesced follow-up if it's still needed. Do not build a special one-off
repair script for two rows.

## Tests to add

`test/dropbox*.test.ts` (wherever `maybeExportDiaryToDropbox`'s existing
tests live — check for a `dropboxExport`/similar file first rather than
guessing a new one):
- Given `exportInFlight` is true when `maybeExportDiaryToDropbox` is called,
  confirm it returns `{ skipped: "in-flight" }` immediately (existing
  behavior, pin it) AND sets the pending flag.
- Given a call arrives while one is in flight, confirm that once the in-flight
  export's `finally` block runs, exactly ONE follow-up export fires
  automatically (mock the render/upload internals so this is fast and
  deterministic — don't hit real Dropbox in the test).
- Given TWO calls arrive while one is in flight (the pending flag is a
  boolean, not a counter), confirm only ONE follow-up run fires — not two —
  since a single unscoped re-render already covers both.
- Given no call arrives while exporting, confirm no follow-up fires (the
  pending flag must default false and stay false on the happy path — a
  regression here would mean every export silently double-runs).
- A regression test simulating the actual originally-reported race: call
  `tag_conversation_entities` then immediately `relate_entities` for the same
  conversation with the underlying Dropbox upload mocked to hold an
  artificial delay on the first call; assert the relationship-carrying
  content eventually gets uploaded via the coalesced follow-up, not dropped.

## Verification
- `npx vitest run` and `npm run build` green.
- Live, post-deploy: re-run `relate_entities` for the test conversation (see
  "Repairing the currently-stuck data" above), then re-check
  `People/Jin.md` in Dropbox — it should now show:
  ```
  ## Relationships
  - works at [[Samsung]]
  - lives in [[Suwon]]
  - [[Minji]] — friend of
  ```
- Do a FRESH end-to-end test (new conversation, new entities) to confirm the
  race no longer drops data on a clean run, not just the repaired one.

## Constraints (repo-wide, still apply)
- Every fire-and-forget async call needs its own `.catch()` — the coalesced
  follow-up call (`void maybeExportDiaryToDropbox().catch(...)`) must keep
  its own `.catch()`; a rejected follow-up must never become an unhandled
  rejection (see the hard rule in `CLAUDE.md` about this — it's fatal under
  modern Node).
- Don't touch `lib/entityMerge.ts`'s relationship-endpoint rewrite, the `\0`
  map-key separator in `lib/diaryExportDb.ts`, or the closed predicate enum —
  all verified correct in the prior audit; this fix is scoped to
  `lib/dropbox.ts`'s export lock only.
- Keep `CLAUDE.md` / `CHANGELOG.md` in sync: this is exactly the kind of
  "do-not-regress" lesson that doc curates (add a bullet: the export lock in
  `lib/dropbox.ts` MUST guarantee a coalesced follow-up run for any request
  dropped while busy — do not regress this back to a bare `{ skipped:
  "in-flight" }` with no reconciliation, and do not "fix" it with a retry
  loop instead, since retry budgets are probabilistic and this bug was
  specifically caused by one being insufficient).
- `npx vitest run` + `npm run build` must both pass. Ask the owner before
  merging.
