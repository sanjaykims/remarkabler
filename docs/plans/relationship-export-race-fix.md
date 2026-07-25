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

Bounded retry-with-backoff when an export is skipped due to `in-flight`,
applied to BOTH fire-and-forget export call sites (the second one to fire is
usually the one that loses, but don't assume the ordering — apply it
symmetrically so either can retry).

Add a small helper near `refreshRelationshipStubs` in `lib/mcp.ts`:

```ts
// Both tag_conversation_entities and relate_entities fire their own
// fire-and-forget Dropbox export, and lib/dropbox.ts's maybeExportDiaryToDropbox
// shares ONE process-wide lock across every exporter. When two of these race
// (the guided flow calls tag then relate back-to-back for one conversation),
// the loser gets `{ skipped: "in-flight" }` and — without this retry — is
// silently dropped forever; nothing else ever re-triggers that entity's stub.
async function withExportRetry<T extends { ok: boolean; skipped?: string }>(
  run: () => Promise<T>,
  attempts = 4,
  delayMs = 750
): Promise<T> {
  let result = await run();
  for (let tries = 1; result.skipped === "in-flight" && tries < attempts; tries++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    result = await run();
  }
  return result;
}
```

Update `refreshRelationshipStubs` (line 532-543):
```ts
async function refreshRelationshipStubs(stubPaths: string[]): Promise<void> {
  const touched = [...new Set(stubPaths)];
  if (touched.length === 0) return;
  const current = new Set(currentEntityStubFileNames());
  const existing = touched.filter((path) => current.has(path));
  const stale = touched.filter((path) => !current.has(path));
  const dropbox = await import("@/lib/dropbox");
  const result = await withExportRetry(() =>
    dropbox.maybeExportDiaryToDropbox({ onlyEntityStubs: existing })
  );
  if (!result.ok && result.skipped) {
    console.warn(`[mcp] relationship-stub export skipped after retries: ${result.skipped}`);
  }
  if (stale.length > 0) {
    await dropbox.deleteDiaryExportFiles(stale);
  }
}
```

Apply the SAME `withExportRetry` wrapper to the `tag_conversation_entities`
export call at `lib/mcp.ts:899-903` (currently a bare
`import(...).then(...).catch(...)` chain — wrap the `maybeExportDiaryToDropbox`
call the same way, keep the `.catch()` for genuine failures).

**Why bounded retry, not a proper queue/mutex:** a promise-chained queue
(callers await their turn instead of polling) is the more "correct" fix, but
it's a larger change to a shared primitive four other exporters
(`lib/entityWiki.ts`, diary/conversation/reflection/decision exporters) also
depend on, with real risk of introducing a new bug (deadlock, unbounded queue
growth) in code you can't fully re-verify end-to-end without a live account.
For a single-user app, 4 attempts × 750ms (≤ ~2.25s extra background latency,
never blocking the MCP tool's response to the caller) comfortably covers the
realistic case. **Only reach for the queue-based rewrite if retries prove
insufficient in practice** (e.g., very large notebooks where Export A's
upload loop legitimately exceeds ~3 seconds) — note that possibility in the
PR description rather than building it preemptively.

## Repairing the currently-stuck data

The fix only prevents *future* drops. Jin's and Minji's stubs are stuck stale
right now. After the fix ships, tell the user to re-run `relate_entities` once
more for the same `conversation_key` with the same relationships (it's a
scoped replace — see `docs/plans/relationship-audit-and-next-steps.md` — so
this is safe and idempotent) to force a fresh, now-retrying export. Do not
build a special one-off repair script for two rows.

## Tests to add

`test/mcp.test.ts`, near the existing `relate_entities`/librarian-tool tests:
- `withExportRetry` (export it for testing, or test indirectly via
  `refreshRelationshipStubs`'s effect): given a mock/stub export function that
  returns `{ ok: false, skipped: "in-flight" }` N times then `{ ok: true }`,
  confirm it retries until success (within the attempt cap) rather than
  giving up after one try.
- Given a mock that always returns `{ ok: false, skipped: "in-flight" }`,
  confirm it stops after the attempt cap (doesn't retry forever) and logs a
  warning rather than throwing.
- A regression test simulating the actual race: call `tag_conversation_entities`
  then immediately `relate_entities` for the same conversation with Dropbox
  export mocked so the first call holds an artificial delay; assert the
  relationship-carrying export eventually succeeds instead of being dropped.

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
- Every fire-and-forget async call needs its own `.catch()` — `withExportRetry`
  itself doesn't throw for `in-flight`, but the caller's outer `.catch()` must
  stay for genuine exceptions.
- Don't touch `lib/entityMerge.ts`'s relationship-endpoint rewrite, the `\0`
  map-key separator in `lib/diaryExportDb.ts`, or the closed predicate enum —
  all verified correct in the prior audit; this fix is scoped to the export
  trigger only.
- Keep `CLAUDE.md` / `CHANGELOG.md` in sync: this is exactly the kind of
  "do-not-regress" lesson that doc curates (add a bullet: fire-and-forget
  exports sharing one lock need retry-on-skip, or data is silently lost, not
  just delayed).
- `npx vitest run` + `npm run build` must both pass. Ask the owner before
  merging.
