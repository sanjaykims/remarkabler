// Pure helpers for the backfill-all endpoint, extracted so they can be
// unit-tested without dragging Next.js route plumbing into the test
// graph (Next forbids non-route exports from app/**/route.ts).

// Target chars per batch's transcript. compressBatch's MAX_TRANSCRIPT_CHARS
// is 16_000; we aim for ~12K so each chunk fits cleanly with headroom and
// nothing gets silently truncated. A single huge batch (one per conversation)
// would lose everything before the most recent 16K chars — exactly the bug
// the first version of this endpoint shipped with.
export const CHUNK_TARGET_CHARS = 12_000;

export type BackfillMessage = { id: number; role: string; content: string };

export function estimateTranscriptCost(role: string, content: string): number {
  // Matches buildTranscript() in lib/chatMemory.ts: "User: <text>\n\n" or
  // "Claude: <text>\n\n". Used to greedy-chunk by char budget.
  const label = role === "user" ? "User: " : "Claude: ";
  return label.length + (content || "").length + 2;
}

export function chunkMessageIds(messages: BackfillMessage[]): number[][] {
  const chunks: number[][] = [];
  let current: number[] = [];
  let cost = 0;
  for (const m of messages) {
    const c = estimateTranscriptCost(m.role, m.content);
    if (current.length > 0 && cost + c > CHUNK_TARGET_CHARS) {
      chunks.push(current);
      current = [];
      cost = 0;
    }
    current.push(m.id);
    cost += c;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}
