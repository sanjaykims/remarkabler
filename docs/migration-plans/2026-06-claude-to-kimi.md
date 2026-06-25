# Remarkabler — Claude → Kimi K2.6 Migration Plan (OCR stays on Opus)

> **Purpose of this document:** Internal proposal for migrating every Anthropic
> call in Remarkabler *except* OCR to Kimi K2.6 via `platform.kimi.ai`. The
> author (me, Claude) has a poor recent track record on this codebase —
> Codex caught real bugs on four of the last five PRs. This plan is being
> shared with Codex and Kimi K2.7 for external review **before** any code
> is written. Open questions are explicitly called out at the bottom.

## Context

Remarkabler today calls Anthropic for everything: OCR, chat, profile-builder,
insights, day summaries, mind analysis, chat-memory extraction, book
composition. Per-token API spend is in the $8–15/month range for typical use.

The owner wants to:
- **Move every Claude call to Kimi K2.6** (~70-80% cost reduction)
- **Except OCR** — handwritten Korean diary OCR stays on Claude Opus because
  no other vision model is reliable enough on dense handwriting, and any
  OCR error is permanent in the SQLite corpus.

This is a "stop paying Anthropic for daily things" move, not a quality
upgrade. Expected quality regression is real and bounded per feature
(see §Quality risk table).

Subscription quota on kimi.com is **not** applicable — it only covers
Kimi CLI, Claude Code, and Roo Code. Remarkabler is a custom backend, so
this migration uses pay-per-token `platform.kimi.ai` billing.

## Scope

### In scope (migrating to Kimi K2.6)

Every exported function in `lib/claude.ts` except `ocrNotebookPdf()`:

| Function | `lib/claude.ts` | Current model | Caller(s) |
| --- | --- | --- | --- |
| `buildSelfModel` | 182–222 | `modelMain()` Opus | `app/api/memory/route.ts`, `app/api/discipline/route.ts` |
| `updateSelfModel` | 225–270 | `modelMain()` Opus | `app/api/discipline/route.ts` |
| `chatOverNotes` | 274–468 | `modelChat()` Sonnet | `app/api/chat/route.ts` |
| `analyzeEntryContent` | 499–548 | `modelChat()` Sonnet | `lib/mind.ts:analyzePages` |
| `labelEmbeddingAxes` | 632–700 | `modelChat()` Sonnet | `lib/mind.ts:labelAxes` |
| `summarizeDay` | 782–811 | `modelMain()` Opus | `lib/notes.ts:processNotebook` |
| `composeBook` | 818–903 | `modelMain()` Opus | `app/api/export/book/route.ts` |
| `generateInsightTitle` | 910–930 | `modelChat()` Sonnet | `app/api/insights/route.ts` |
| `generateInsights` | 937–1017 | `modelMain()` Opus | `app/api/insights/route.ts` |
| `compressChatSession` | 1067–1151 | `modelChatMemory()` Sonnet | `lib/chatMemory.ts:extractChatMemories` |

### Out of scope (stays on Claude Opus)

- `ocrNotebookPdf` (`lib/claude.ts:92–147`) — handwritten Korean PDF
  transcription. Streamed, ~32K output tokens, document blocks. **Never
  moved.** Hardcoded to Opus regardless of any global provider setting.

### Out of scope (no change)

- Voyage embeddings (`lib/embeddings.ts`) — separate provider, separate
  budget. Not part of this migration.
- All tests, build, lint pipelines.

## Architecture

### Why a provider abstraction (vs. per-function `if/else`)

Currently, model selection is centralized via `modelMain()`/`modelChat()`/etc.
(`lib/claude.ts:36-66`). Provider selection should be **equally centralized**
— otherwise every call site grows an `if (provider === 'kimi') ... else ...`
branch and the tool-format conversion logic gets duplicated.

Proposal: **a thin LLM-call shim** in a new `lib/llm.ts` that takes a
provider-neutral request and dispatches to either Anthropic or an
OpenAI-compatible HTTP client (Kimi).

### Provider-neutral request shape

```ts
type Provider = "anthropic" | "kimi";

type LlmCall = {
  provider: Provider;
  model: string;
  // System content. cached:true is a hint — Anthropic honors via
  // cache_control; Kimi auto-caches and the hint is dropped.
  system?: Array<{ text: string; cached?: boolean }>;
  messages: Array<{ role: "user" | "assistant" | "tool"; content: …; toolCalls?: …; toolCallId?: … }>;
  tools?: NeutralTool[];
  maxTokens: number;
  timeoutMs?: number;
};
```

A neutral tool shape is a thin wrapper that converts between Anthropic's
`{name, description, input_schema}` and OpenAI's `{type:"function",
function:{name, description, parameters}}` at call time. The 16 tools in
`lib/chatTools.ts:35-925` keep their current Anthropic shape as the
canonical form; the shim converts on the way out.

### Per-feature provider routing

The existing `modelMain()` / `modelChat()` / `modelChatMemory()` knobs stay,
but now each gets a matching `providerX()` knob. Plus a new `modelOcr()` /
`providerOcr()` slot so OCR can be pinned to Anthropic-Opus while everything
else moves.

| Knob | Default after migration | Env var | DB setting |
| --- | --- | --- | --- |
| `modelOcr` / `providerOcr` | `claude-opus-4-7` / `anthropic` | `OCR_MODEL` | `model_ocr` (new) |
| `modelMain` / `providerMain` | `kimi-k2-6` / `kimi` | `CLAUDE_MODEL`/`MAIN_MODEL` | `model_main`, `provider_main` (new) |
| `modelChat` / `providerChat` | `kimi-k2-6` / `kimi` | `CHAT_MODEL` | `model_chat`, `provider_chat` (new) |
| `modelChatFallback` / `providerChatFallback` | `claude-sonnet-4-6` / `anthropic` | `CHAT_FALLBACK_MODEL` | `model_chat_fallback`, `provider_chat_fallback` (new) |
| `modelChatMemory` / `providerChatMemory` | `kimi-k2-6` / `kimi` | `CHAT_MEMORY_MODEL` | `model_chat_memory`, `provider_chat_memory` (new) |

The fallback chain stays on Claude Sonnet deliberately — when Kimi
overloads or rate-limits, retry on a different *provider* (not just a
different model in the same provider). Belt-and-suspenders.

### What Anthropic-specific features map to on Kimi

| Anthropic feature | Where used | Kimi equivalent |
| --- | --- | --- |
| `cache_control: { type: "ephemeral" }` | `chatOverNotes`, `generateInsights`, `compressChatSession` | **Drop the hint.** Kimi auto-caches input prefixes per Moonshot docs; no client-side hint needed. Cached input pricing drops to $0.10–0.16/M. |
| `tool_use` content blocks | `chatOverNotes` 6-iteration tool loop | OpenAI-style `tool_calls` on the assistant message + `role:"tool"` reply messages. Shim handles conversion in both directions. |
| Vision: `image` content block | `chatOverNotes` attachments | OpenAI-style `image_url` content part (Kimi K2.6 multimodal via MoonViT). |
| Vision: `document` content block (PDF) | `chatOverNotes` attachments (handwritten PDFs only — typed PDFs are pre-extracted to text by `lib/extractText.ts`) | **Open question** — Kimi K2.6 supports doc upload via their app, but exact API shape for inline PDF needs to be verified. Fallback: route handwritten-PDF chat attachments to Anthropic (keep one Claude path for this rare case). |
| Streaming (`.messages.stream()`) | `ocrNotebookPdf` (stays Anthropic), `composeBook` (moves to Kimi) | OpenAI-compatible `stream: true` + SSE chunks. Shim parses both formats. |
| Custom `timeout` | `compressChatSession` (60s) | Native `fetch` `AbortController` — same effect. |
| 429/529 overload retry → fallback | `chatOverNotes` | Same pattern; on Kimi 429/5xx fall through to Claude Sonnet via `providerChatFallback`. |

## Cost projections

Per-month, mid-use (3 new notebooks, daily chats, 4 insights, ~8 chat clears):

| Feature | Current (Claude) | After (Kimi K2.6) | Δ |
| --- | --- | --- | --- |
| OCR (stays Opus) | ~$4 | ~$4 | 0 |
| Profile rebuild | ~$0.60 | ~$0.04 | −93% |
| Insights (4×) | ~$2.20 | ~$0.16 | −93% |
| Chat (daily) | ~$3–8 | ~$1–2.50 | ~−70% |
| /mind per-page analysis | ~$0.50 | ~$0.20 | ~−60% |
| Chat memory extraction | ~$0.20 | ~$0.06 | ~−70% |
| Day summaries | ~$0.30 | ~$0.05 | ~−83% |
| **Total** | **~$11–16** | **~$5.50–7** | **~−50–55%** |

Smaller than the headline "−80%" from prior estimates once OCR stays —
OCR ends up being the dominant cost. Still a real but small absolute
saving (~$5–8/month).

## Quality risk per feature

Sorted worst-first:

| Feature | Risk | Why |
| --- | --- | --- |
| Insights | **MEDIUM-HIGH** | This is the most "Claude voice" output. Kimi will write competent structured reflections that read more generic. User will notice. |
| Profile builder | **MEDIUM** | The profile is the lens through which all chat is filtered. A more generic profile = more generic chat, compounding. |
| Chat | **MEDIUM** | Most-used surface. Korean+English nuance + multi-tool chains are where it shows. Mitigated by Sonnet fallback on Kimi error. |
| Day summary | **LOW-MEDIUM** | Short, structured. Less room for nuance loss. |
| Chat memory extraction | **LOW-MEDIUM** | Structured JSON output. Kimi handles it. Salvage parser from PR #58 still protects against truncation. |
| `/mind` analysis | **LOW** | Per-page classification. Theme labels may read slightly less elegant; substance unchanged. |
| Axis labels | **LOW** | Two-word labels for PCA axes. Trivial task. |
| Book composition | **LOW** | Long-form generation but rarely run. Output is for the user's eyes; they can re-run on Opus if needed. |

## Files to change (high level)

- **New: `lib/llm.ts`** — provider-neutral request type, dispatch to Anthropic
  SDK or Kimi HTTP client, tool-format conversion.
- **New: `lib/kimi.ts`** — Kimi HTTP client (OpenAI-compatible
  `chat/completions`, streaming + non-streaming). Wraps `fetch`.
- **Modified: `lib/claude.ts`** — every function except `ocrNotebookPdf`
  goes through `lib/llm.ts` instead of calling `client().messages.create`
  directly. Function signatures unchanged so callsites need no edits.
  Add `modelOcr()` / `providerOcr()` and similar `providerX()` resolvers
  alongside the existing model resolvers.
- **Modified: `lib/usage.ts`** — add Kimi pricing rows to the `PRICES`
  table (`kimi-k2-6`: $0.95 / $4.00; `kimi-k2-7`: same; cached input
  $0.10/M). Prefix-matching in `priceFor()` already handles versioning.
- **Modified: `app/api/settings/models/route.ts`** — add `ocr`,
  `chat_memory`, and per-slot `provider` fields. Existing GET/POST shape
  extended additively.
- **Modified: `app/memory/page.tsx`** — model settings UI gets two new
  rows (OCR, chat-memory) and a provider dropdown per slot.
- **Modified: `test/chatMemoryExtract.test.ts`** — already mocks at the
  `compressChatSession` boundary, so no test changes needed for that one.
  Add new tests:
  - `test/llmProviderRouting.test.ts` — verify `providerX()` resolves
    correctly from setting → env → default.
  - `test/toolFormatConversion.test.ts` — verify Anthropic ↔ OpenAI tool
    schema conversion roundtrip preserves names, descriptions, schemas.
  - `test/kimiUsageTracking.test.ts` — verify `recordUsage` with a
    `kimi-k2-6` model resolves correct pricing.
- **New env vars**: `KIMI_API_KEY` (required if any `providerX=kimi`),
  optional `KIMI_BASE_URL` (default `https://api.moonshot.ai/v1`),
  `OCR_MODEL`, `MAIN_MODEL`, etc.
- **Docs**: `CLAUDE.md` adds a do-not-regress note that OCR is hardcoded
  to Anthropic-Opus regardless of provider toggles. `CHANGELOG.md` dated
  entry. `SKILL.md` updated provider table.

## Rollout — phased even though scope is "all-except-OCR"

The owner could flip every `providerX=kimi` at once after merge, but
that's where the recent track record (PRs #62–#67) has been weak. Safer:

1. **Phase 1 — Plumbing only (no provider flips).** Merge `lib/llm.ts`,
   `lib/kimi.ts`, the `providerX()` knobs, Kimi pricing in `usage.ts`,
   and the settings-UI extension. All providers default to `anthropic`.
   Existing behavior unchanged. CI green, Codex review, deploy.
2. **Phase 2 — Flip the lowest-risk slots first.** Set
   `providerChatMemory=kimi`. Run for a few days. Watch
   `chat_archive_batches.extraction_error` for any new failure shape.
   Verify chat memories continue to flow.
3. **Phase 3 — Flip `/mind`.** Set `providerMain=kimi` for the analyze /
   axis-label / day-summary paths. (Actually these use `modelChat`, not
   `modelMain` — so this is `providerChat=kimi` partially. See open
   question #1.)
4. **Phase 4 — Flip chat.** Set `providerChat=kimi`. Keep
   `providerChatFallback=anthropic`. Watch for tool-call failures over
   a week of normal chats. If Kimi tool-calling is shaky, fallback path
   absorbs it.
5. **Phase 5 — Flip insights, profile-builder, book composition.** These
   are the "most Claude voice" features. Last to flip. Owner reads a few
   Kimi-generated insights and decides whether to keep them on Kimi or
   revert to Opus.

The Phase 1 PR is the only "code" PR. Phases 2-5 are settings flips on
the live `/memory` page, reversible in one tap.

## Verification

For each phase:

- `npm run lint` (clean)
- `npm run build` (clean)
- `npm test` (212+ tests pass; add ~10 new tests for plumbing in Phase 1)
- Cost-calendar inspection on `/usage` — confirms Kimi calls being tracked
  with correct pricing
- Owner does the kimi.com standalone test (paste a real diary entry, ask
  the kind of question they ask in Remarkabler chat) **before** Phase 4
- Owner reads ~3 Kimi-generated insights **before** Phase 5

For chat tool calling specifically: hand-test multi-tool chains (e.g.,
"What did I do last week + what entities recur there + give me a day
summary for the most-mentioned date"). Confirm tool-call IDs round-trip
correctly through the shim.

## Open questions for external review (Codex + Kimi K2.7)

These are the points where I'm least confident and where outside
perspective would help most.

1. **Provider abstraction shape.** Is `lib/llm.ts` worth the abstraction
   tax, or would per-function `if (provider === 'kimi')` branches be
   clearer for a single-provider-pair codebase? Prior experience with
   abstraction-for-the-future getting it wrong (e.g., a leaky abstraction
   that has to be torn out later) is worth more than theoretical purity.
2. **Cache control on Kimi.** Confirming: Moonshot's docs claim
   automatic context caching. Does dropping `cache_control` from our
   system blocks actually get us the cached pricing tier, or do we need
   to do something to opt in? (Sources welcome.)
3. **Tool calling fidelity.** Kimi K2.6 / K2.7 tool-call format is
   OpenAI-compatible per docs, but has anyone seen issues with
   3+ iteration chains, parallel tool calls, or `tool_calls` with empty
   `arguments`? Remarkabler's chat loop has `MAX_TOOL_ITERATIONS = 6`.
4. **Korean handling.** Reflection-style responses over a mixed
   Korean+English diary — is K2.6 quality comparable to Claude Sonnet
   4.6, or noticeably weaker? (We've planned to defer Phase 4 until the
   owner manually tests on kimi.com, but external opinion welcome.)
5. **PDF document blocks in chat attachments.** Chat allows attaching
   handwritten PDFs (rare; typed PDFs are pre-extracted to text by
   `lib/extractText.ts` before reaching the model). Anthropic accepts a
   `document` block with base64 PDF. Does Kimi K2.6 support an
   equivalent inline-PDF input via the OpenAI-style API, or must we
   detect this case and route just-this-call to Anthropic? The plan as
   written assumes the latter — small Anthropic escape hatch in
   `chatOverNotes` for handwritten-PDF attachments only.
6. **Streaming chunk format.** Kimi's `stream: true` response is
   OpenAI-compatible chunks per docs. For `composeBook` we currently use
   the Anthropic SDK's `.stream().finalMessage()` API. The shim needs to
   accumulate Kimi's `delta.content` chunks into a final string the same
   way. Edge cases: tool calls inside streaming responses (we don't use
   tools in `composeBook`, so not relevant; but good to confirm).
7. **Settings migration.** Existing DB rows for `model_chat=
   'claude-sonnet-4-6'` get carried through this migration unchanged.
   When the owner later flips `provider_chat=kimi`, the model value
   needs to also flip to a Kimi model name. Should the UI prevent
   "Anthropic model + Kimi provider" mismatch states? Or just warn?

## Reused patterns

- `getSetting / setSetting / clearSetting` from `lib/db.ts` for the new
  `provider_*` and `model_ocr` DB rows. Same pattern existing model
  resolvers use.
- `recordUsage` from `lib/usage.ts` — no signature change needed; adding
  rows to `PRICES` table covers Kimi.
- `safeDropboxError` pattern from `lib/dropbox.ts` is a good template
  for `safeKimiError` in `lib/kimi.ts` (translate status codes →
  `"auth" | "rate-limit" | "transient" | …`).
- The fallback retry pattern in `chatOverNotes` lines 393-426 stays —
  just becomes cross-provider instead of cross-model.

## Explicit non-goals

- Not building a model-quality A/B framework. Owner does manual
  comparison on kimi.com first.
- Not migrating Voyage embeddings.
- Not adding a "Test connection" button per provider in the UI (could be
  a follow-up).
- Not changing OCR. Ever.
