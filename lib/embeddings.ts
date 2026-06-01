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

async function callVoyage(
  texts: string[],
  inputType: InputType
): Promise<{ embeddings: number[][]; totalTokens: number }> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY is not set");

  // Voyage caps a single call at 128 inputs; we chunk to be safe.
  const CHUNK = 64;
  const out: number[][] = [];
  let totalTokens = 0;
  for (let i = 0; i < texts.length; i += CHUNK) {
    const slice = texts.slice(i, i + CHUNK).map((t) => t.slice(0, 30_000));
    const resp = await fetch(VOYAGE_URL, {
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
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`Voyage embeddings failed (${resp.status}): ${body.slice(0, 200)}`);
    }
    const data = (await resp.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
      usage?: { total_tokens?: number };
    };
    // Voyage returns the chunk in whatever order — sort by index to be safe.
    data.data.sort((a, b) => a.index - b.index);
    for (const d of data.data) out.push(d.embedding);
    totalTokens += data.usage?.total_tokens || 0;
  }
  return { embeddings: out, totalTokens };
}

export async function embed(text: string, inputType: InputType = "query"): Promise<Float32Array | null> {
  if (!embeddingsEnabled()) return null;
  try {
    const { embeddings, totalTokens } = await callVoyage([text], inputType);
    recordUsage("embeddings", voyageModel(), {
      input_tokens: totalTokens,
      output_tokens: 0,
    });
    return new Float32Array(embeddings[0]);
  } catch {
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
  } catch {
    return null;
  }
}

export function encodeEmbedding(vec: Float32Array | number[]): Buffer {
  const arr = vec instanceof Float32Array ? vec : new Float32Array(vec);
  return Buffer.from(arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength));
}

export function decodeEmbedding(buf: Buffer): Float32Array {
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
