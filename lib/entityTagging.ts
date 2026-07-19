import { getConversationByKey, listUnlinkedConversations } from "./conversationWiki";
import { getReflectionByKey, listUnlinkedReflections } from "./reflectionWiki";
import { tagConversationEntities, wikiLinkingEnabled } from "./conversationEntities";
import { tagReflectionEntities } from "./reflectionEntities";
import { extractTaggingEntities } from "./claude";
import { CONVERSATIONS_NOTEBOOK_ID, REFLECTIONS_NOTEBOOK_ID } from "./notes";

// Guaranteed, app-initiated entity-tagging for exported conversations and
// reflections — the app calls Claude itself (its own ANTHROPIC_API_KEY)
// right after an export, rather than waiting on an external Claude session
// to opportunistically call the Phase C librarian tools. Shared across both
// content types (not folded into lib/conversationEntities.ts, which is
// scoped to the external-agent-facing Phase C surface for conversations
// specifically) since this is a different, app-initiated concern that calls
// into both lib/conversationEntities.ts and lib/reflectionEntities.ts.

// Layered ON TOP of wikiLinkingEnabled() (the master "is any linking of
// exported content into the entity graph happening at all" switch), not a
// peer flag — MCP_ALLOW_WIKI_LINKING is the user's privacy decision about
// whether conversation/reflection content gets linked into their diary's
// People/Places/Projects graph at all; auto-tag is a refinement of HOW
// (guaranteed + immediate, vs. purely opportunistic external agents), not
// an independent WHETHER. A user who has wiki-linking off and mistakenly
// sets MCP_AUTO_TAG_EXPORTS=true gets the safer no-op, matching this repo's
// fail-safe-by-default posture.
export function autoTagExportsEnabled(): boolean {
  return process.env.MCP_AUTO_TAG_EXPORTS === "true" && wikiLinkingEnabled();
}

// Cost bound for the extraction call's input. A MAX_REFLECTION_CHARS=20,000
// reflection never triggers sampling; a MAX_CONVERSATION_CHARS=500,000
// conversation does. 60K mirrors lib/entityWiki.ts's MAX_INPUT_CHARS —
// a proven, accepted per-call cost precedent in this codebase.
export const MAX_TAGGING_INPUT_CHARS = 60_000;
const TAGGING_CHUNK_CHARS = 4_000;
const SAMPLE_SEPARATOR = "\n\n…\n\n";

// Evenly spaced indices across [0 .. len-1], always including both ends —
// mirrors lib/entityWiki.ts's own evenSample (not imported from there to
// keep this module's only DB/API dependency direction one-way; both are
// tiny, pure, and now intentionally duplicated rather than coupled).
function evenSample<T>(arr: T[], keep: number): T[] {
  if (keep >= arr.length) return arr.slice();
  const step = (arr.length - 1) / (keep - 1);
  const out: T[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < keep; i++) {
    const idx = Math.round(i * step);
    if (!seen.has(idx)) {
      seen.add(idx);
      out.push(arr[idx]);
    }
  }
  return out;
}

// Bounds `text` to maxChars for the tagging call. Long transcripts get an
// evenly-spaced CHUNK sample (always keeping the first + last chunk), not a
// flat truncation — so entities mentioned only in the middle or end of a
// long conversation aren't silently invisible to the extractor. Pure,
// unit-tested; the returned string's length is always <= maxChars.
export function sampleForTagging(
  text: string,
  maxChars: number = MAX_TAGGING_INPUT_CHARS,
  chunkChars: number = TAGGING_CHUNK_CHARS
): string {
  if (text.length <= maxChars) return text;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkChars) {
    chunks.push(text.slice(i, i + chunkChars));
  }

  let keep = Math.max(2, Math.min(chunks.length, Math.floor(maxChars / chunkChars)));
  let sample = evenSample(chunks, keep);
  let joined = sample.join(SAMPLE_SEPARATOR);
  while (keep > 2 && joined.length > maxChars) {
    keep--;
    sample = evenSample(chunks, keep);
    joined = sample.join(SAMPLE_SEPARATOR);
  }
  return joined.length > maxChars ? joined.slice(0, maxChars) : joined;
}

// Dedupes the inline fire (right after export_conversation/save_reflection)
// against a concurrent sweep retry picking up the same still-pending row —
// mirrors exportInFlight/refreshInFlight/analyzePendingInFlight elsewhere.
const taggingInFlight = new Set<string>();

async function reExportAffectedStubs(notebookId: string): Promise<void> {
  const { maybeExportDiaryToDropbox } = await import("./dropbox");
  await maybeExportDiaryToDropbox({ notebookId });
}

export async function autoTagConversation(
  conversationKey: string
): Promise<{ tagged: number } | { error: string } | { skipped: string }> {
  if (!autoTagExportsEnabled()) return { skipped: "disabled" };
  const flightKey = `conversation:${conversationKey}`;
  if (taggingInFlight.has(flightKey)) return { skipped: "in-flight" };
  taggingInFlight.add(flightKey);
  try {
    const convo = getConversationByKey(conversationKey);
    if (!convo) return { error: `Unknown conversation_key "${conversationKey}"` };
    const entities = await extractTaggingEntities(sampleForTagging(convo.content));
    const result = tagConversationEntities({ conversationKey, entities });
    if (!("error" in result)) {
      reExportAffectedStubs(CONVERSATIONS_NOTEBOOK_ID).catch((e) =>
        console.warn("[entityTagging] stub re-export failed:", (e as Error).message)
      );
    }
    return result;
  } catch (e) {
    console.warn(
      "[entityTagging] auto-tag conversation failed:",
      conversationKey,
      (e as Error).message
    );
    return { error: (e as Error).message };
  } finally {
    taggingInFlight.delete(flightKey);
  }
}

export async function autoTagReflection(
  reflectionKey: string
): Promise<{ tagged: number } | { error: string } | { skipped: string }> {
  if (!autoTagExportsEnabled()) return { skipped: "disabled" };
  const flightKey = `reflection:${reflectionKey}`;
  if (taggingInFlight.has(flightKey)) return { skipped: "in-flight" };
  taggingInFlight.add(flightKey);
  try {
    const refl = getReflectionByKey(reflectionKey);
    if (!refl) return { error: `Unknown reflection_key "${reflectionKey}"` };
    const entities = await extractTaggingEntities(sampleForTagging(refl.content));
    const result = tagReflectionEntities({ reflectionKey, entities });
    if (!("error" in result)) {
      reExportAffectedStubs(REFLECTIONS_NOTEBOOK_ID).catch((e) =>
        console.warn("[entityTagging] stub re-export failed:", (e as Error).message)
      );
    }
    return result;
  } catch (e) {
    console.warn(
      "[entityTagging] auto-tag reflection failed:",
      reflectionKey,
      (e as Error).message
    );
    return { error: (e as Error).message };
  } finally {
    taggingInFlight.delete(flightKey);
  }
}

// Maintenance-sweep safety net for anything the inline fire missed (e.g. a
// process restart mid-call). Small per-tick limit bounds worst-case cost per
// sweep, mirroring maybeRefreshEntityWiki's limit:4 / daily-summary
// PER_TICK=3 precedent elsewhere in this codebase. Per-row try/catch inside
// autoTagConversation/autoTagReflection already isolates one bad row from
// the rest of the batch.
export async function maybeAutoTagUnlinkedConversations(
  limit = 5
): Promise<{ tagged: number; failed: number }> {
  if (!autoTagExportsEnabled()) return { tagged: 0, failed: 0 };
  const rows = listUnlinkedConversations(limit);
  let tagged = 0;
  let failed = 0;
  for (const row of rows) {
    const result = await autoTagConversation(row.conversation_key);
    if ("error" in result) failed++;
    else if ("tagged" in result) tagged++;
  }
  return { tagged, failed };
}

export async function maybeAutoTagUnlinkedReflections(
  limit = 5
): Promise<{ tagged: number; failed: number }> {
  if (!autoTagExportsEnabled()) return { tagged: 0, failed: 0 };
  const rows = listUnlinkedReflections(limit);
  let tagged = 0;
  let failed = 0;
  for (const row of rows) {
    const result = await autoTagReflection(row.reflection_key);
    if ("error" in result) failed++;
    else if ("tagged" in result) tagged++;
  }
  return { tagged, failed };
}
