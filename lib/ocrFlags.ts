// Pure helpers for the transcription "proofreading" flags (no DB, no network).
//
// The OCR response stays in the delimiter format (`--- PAGE n ---`). After the
// last page Claude may append ONE trailing block:
//
//   --- FLAGS ---
//   {"page":2,"phrase":"Elim","alternatives":["Elin","Ellen"],"reason":"last letter unclear"}
//   ...one JSON object per line
//
// Flags are isolated from the transcript on purpose: a truncated or malformed
// flag line can only lose that flag, never the transcription itself.

export type OcrFlag = {
  /** 1-based page number inside the OCR'd PDF */
  page: number;
  /** exact text as it appears in Claude's transcription of that page */
  phrase: string;
  alternatives: string[];
  reason: string;
};

export const MAX_FLAGS_PER_CALL = 15;
const MAX_PHRASE = 120;
const MAX_ALT = 120;
const MAX_REASON = 160;

const FLAGS_MARKER = /^[ \t]*-{2,}\s*FLAGS\s*-{2,}[ \t]*$/im;

/** Split the raw OCR response into the transcript and the flags block. */
export function splitFlagsBlock(raw: string): { body: string; flagsRaw: string } {
  const m = FLAGS_MARKER.exec(raw);
  if (!m) return { body: raw, flagsRaw: "" };
  return { body: raw.slice(0, m.index), flagsRaw: raw.slice(m.index + m[0].length) };
}

function clean(s: unknown, max: number): string {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Lenient JSONL parse: bad lines are skipped, never thrown. */
export function parseFlagLines(flagsRaw: string): OcrFlag[] {
  const out: OcrFlag[] = [];
  for (const line of flagsRaw.split(/\r?\n/)) {
    const t = line.trim().replace(/^[-*]\s+/, "");
    if (!t.startsWith("{")) continue;
    try {
      const j = JSON.parse(t) as Record<string, unknown>;
      const page = Math.trunc(Number(j.page));
      const phrase = clean(j.phrase, MAX_PHRASE);
      if (!Number.isFinite(page) || page < 1 || !phrase) continue;
      const alts = Array.isArray(j.alternatives) ? j.alternatives : [];
      const alternatives: string[] = [];
      for (const a of alts) {
        const c = clean(a, MAX_ALT);
        if (c && c !== phrase && !alternatives.includes(c)) alternatives.push(c);
        if (alternatives.length >= 3) break;
      }
      out.push({ page, phrase, alternatives, reason: clean(j.reason, MAX_REASON) });
    } catch {
      /* skip malformed line */
    }
    if (out.length >= MAX_FLAGS_PER_CALL) break;
  }
  return out;
}

/** Offset of `phrase` in `text`, preferring the occurrence nearest `hint`. -1 if absent. */
export function anchorPhrase(text: string, phrase: string, hint = 0): number {
  if (!phrase) return -1;
  let best = -1;
  let from = 0;
  for (;;) {
    const i = text.indexOf(phrase, from);
    if (i === -1) break;
    if (best === -1 || Math.abs(i - hint) < Math.abs(best - hint)) best = i;
    from = i + 1;
  }
  return best;
}

/** Replace the `len` chars at `start` (verified to equal `phrase`) with `replacement`. */
export function replaceAt(
  text: string,
  start: number,
  phrase: string,
  replacement: string
): string | null {
  let s = start;
  if (text.slice(s, s + phrase.length) !== phrase) {
    s = anchorPhrase(text, phrase, start);
    if (s === -1) return null; // text changed underneath the flag
  }
  return text.slice(0, s) + replacement + text.slice(s + phrase.length);
}

/** A short one-line window around the phrase, for the review card. */
export function contextSnippet(
  text: string,
  start: number,
  phraseLen: number,
  radius = 70
): { before: string; match: string; after: string } {
  const from = Math.max(0, start - radius);
  const to = Math.min(text.length, start + phraseLen + radius);
  const flat = (s: string) => s.replace(/\s*\n\s*/g, " ⏎ ");
  return {
    before: (from > 0 ? "…" : "") + flat(text.slice(from, start)),
    match: text.slice(start, start + phraseLen),
    after: flat(text.slice(start + phraseLen, to)) + (to < text.length ? "…" : ""),
  };
}
