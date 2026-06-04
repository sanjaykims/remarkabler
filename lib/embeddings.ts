import { recordUsage } from "@/lib/usage";

// Semantic embeddings via Voyage AI (Anthropic's recommended embedding partner).
// Stored per-page on `pages.embedding` as a Float32 BLOB so cosine similarity
// is cheap to compute in JS; for the current corpus (~hundreds of pages) a
// brute-force scan is fast enough. We'll revisit when it stops being so.

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";

export function embeddingsEnabled(): boolean {
  return !!process.env.VOYAGE_API_KEY;
}

export function voyageModel(): string {
  return process.env.VOYAGE_MODEL || "voyage-3";
}

// Voyage's "input_type" is a hint: use "document" when indexing, "query" when
// searching — they ask for different normalisation so retrieval is sharper.
type InputType = "document" | "query";

// Per-input character cap. voyage-3 accepts up to 32K tokens per single
// input; Korean / CJK runs at ~1 char/token in the worst case, so we cap at
// 24K characters to leave headroom even for dense Korean.
const PER_INPUT_CHAR_CAP = 24_000;
// Voyage-3's per-request budget is ~120K tokens total. We chunk by an
// estimated token count (chars / 3, a conservative ratio for mixed scripts)
// and stop adding inputs before crossing this cap.
const BATCH_TOKEN_BUDGET = 100_000;
// Free-tier Voyage allows 3 requests / minute. Spacing calls a touch
// keeps a backfill from blowing the RPM and bouncing on 429s.
const INTER_REQUEST_DELAY_MS = 250;

function estimateTokens(text: string): number {
  // Korean / mixed-CJK text runs much denser than English in Voyage's
  // tokeniser (often ~1-2 chars/token vs ~4 for English). Use chars/2 as
  // a safe upper bound that still groups English short pages efficiently.
  return Math.ceil(text.length / 2);
}

async function callVoyage(
  texts: string[],
  inputType: InputType
): Promise<{ embeddings: number[][]; totalTokens: number }> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY is not set");

  // Build chunks that respect both a per-input cap (already trimmed) and a
  // total-token cap per request. The previous CHUNK=64 ignored token totals,
  // so a batch of large discipline-notebook pages could blow Voyage's
  // ~120K-token-per-request ceiling and 400 out.
  const trimmed = texts.map((t) => t.slice(0, PER_INPUT_CHAR_CAP));
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentTokens = 0;
  for (const t of trimmed) {
    const est = estimateTokens(t);
    if (current.length > 0 && currentTokens + est > BATCH_TOKEN_BUDGET) {
      chunks.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(t);
    currentTokens += est;
  }
  if (current.length > 0) chunks.push(current);

  const out: number[][] = [];
  let totalTokens = 0;
  for (let c = 0; c < chunks.length; c++) {
    if (c > 0 && INTER_REQUEST_DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, INTER_REQUEST_DELAY_MS));
    }
    const slice = chunks[c];
    let resp: Response | null = null;
    // One retry on 429 — Voyage's free tier is 3 RPM, easy to trip on a
    // burst. Honour Retry-After if present, else back off 2s.
    for (let attempt = 0; attempt < 2; attempt++) {
      resp = await fetch(VOYAGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          input: slice,
          model: voyageModel(),
          input_type: inputType,
        }),
      });
      if (resp.status !== 429 || attempt === 1) break;
      const retryAfter = Number(resp.headers.get("retry-after") || "") || 2;
      await new Promise((r) => setTimeout(r, Math.min(retryAfter, 10) * 1000));
    }
    if (!resp || !resp.ok) {
      const status = resp?.status ?? 0;
      const body = (await resp?.text().catch(() => "")) || "";
      throw new Error(
        `Voyage embeddings failed (${status}): ${body.slice(0, 200)}`
      );
    }
    const data = (await resp.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
      usage?: { total_tokens?: number };
    };
    data.data.sort((a, b) => a.index - b.index);
    for (const d of data.data) out.push(d.embedding);
    totalTokens += data.usage?.total_tokens || 0;
  }
  return { embeddings: out, totalTokens };
}

export async function embed(text: string, inputType: InputType = "query"): Promise<Float32Array | null> {
  if (!embeddingsEnabled()) return null;
  if (!text || !text.trim()) return null;
  try {
    const { embeddings, totalTokens } = await callVoyage([text], inputType);
    recordUsage("embeddings", voyageModel(), {
      input_tokens: totalTokens,
      output_tokens: 0,
    });
    return new Float32Array(embeddings[0]);
  } catch (e) {
    // Keep the API stable (callers expect null), but surface the actual
    // Voyage error in Railway logs so 429s / 400s aren't invisible.
    console.warn("[voyage] embed failed:", (e as Error).message);
    return null;
  }
}

export async function embedBatch(
  texts: string[],
  inputType: InputType = "document"
): Promise<Float32Array[] | null> {
  if (!embeddingsEnabled()) return null;
  if (texts.length === 0) return [];
  try {
    const { embeddings, totalTokens } = await callVoyage(texts, inputType);
    recordUsage("embeddings", voyageModel(), {
      input_tokens: totalTokens,
      output_tokens: 0,
    });
    return embeddings.map((e) => new Float32Array(e));
  } catch (e) {
    console.warn("[voyage] embedBatch failed:", (e as Error).message);
    return null;
  }
}

/**
 * Like embedBatch, but surfaces the Voyage error instead of swallowing it.
 * Used by the manual backfill so the loop can decide to fall back to
 * per-page retries and report a real failure.
 */
export async function embedBatchOrThrow(
  texts: string[],
  inputType: InputType = "document"
): Promise<Float32Array[]> {
  if (!embeddingsEnabled()) throw new Error("VOYAGE_API_KEY is not set");
  if (texts.length === 0) return [];
  // Voyage 400s on empty / whitespace-only inputs. Surface a clear error
  // so the per-page fallback knows to skip rather than retry blindly.
  for (let i = 0; i < texts.length; i++) {
    if (!texts[i] || !texts[i].trim()) {
      throw new Error(`Input ${i} is empty or whitespace-only`);
    }
  }
  const { embeddings, totalTokens } = await callVoyage(texts, inputType);
  recordUsage("embeddings", voyageModel(), {
    input_tokens: totalTokens,
    output_tokens: 0,
  });
  return embeddings.map((e) => new Float32Array(e));
}

export function encodeEmbedding(vec: Float32Array | number[]): Buffer {
  const arr = vec instanceof Float32Array ? vec : new Float32Array(vec);
  return Buffer.from(arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength));
}

export function decodeEmbedding(buf: Buffer): Float32Array | null {
  // Sanity-check the BLOB length: a Float32 vector must be a multiple of 4
  // bytes. A truncated / corrupted BLOB would silently produce NaN entries
  // and zero out every cosine similarity comparison against it. Returning
  // null lets the caller skip the row and surface a clearer signal.
  if (buf.byteLength === 0 || buf.byteLength % 4 !== 0) {
    console.warn(
      `[embeddings] malformed embedding blob: ${buf.byteLength} bytes`
    );
    return null;
  }
  // Copy to avoid pointing at the shared SQLite buffer.
  const copy = new ArrayBuffer(buf.byteLength);
  new Uint8Array(copy).set(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
  return new Float32Array(copy);
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}
