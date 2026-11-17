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
  /** Rough location on the PDF page: [x0,y0,x1,y1] in thousandths of page width/height. */
  box?: [number, number, number, number];
};

export const MAX_FLAGS_PER_CALL = 15;
const MAX_PHRASE = 120;
// A card should ask about ONE doubtful word/number, not a whole sentence.
const MAX_FLAG_WORDS = 2;
const MAX_FLAG_CHARS = 30;
// Claude sometimes writes a "flag" whose own reason says it is fine; those are noise.
const SELF_DISMISSED =
  /no strong flag|not a strong flag|no flag (is )?needed|appears? consistent|looks? correct|seems? correct|reads? [^.]{0,60}correctly|is correct\b/i;
const squash = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
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
/** A usable box: 4 numbers in 0..1000, positive size, not the whole page. Else undefined. */
export function parseBox(v: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(v) || v.length !== 4) return undefined;
  const n = v.map((x) => Math.round(Number(x)));
  if (n.some((x) => !Number.isFinite(x) || x < 0 || x > 1000)) return undefined;
  const [x0, y0, x1, y1] = n;
  if (x1 - x0 < 5 || y1 - y0 < 5) return undefined;
  if ((x1 - x0) * (y1 - y0) > 600_000) return undefined; // more than ~60% of the page: not one word
  return [x0, y0, x1, y1];
}

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
      if (phrase.length > MAX_FLAG_CHARS || phrase.split(/\s+/).length > MAX_FLAG_WORDS) continue;
      if (SELF_DISMISSED.test(String(j.reason ?? ""))) continue;
      const alts = Array.isArray(j.alternatives) ? j.alternatives : [];
      const alternatives: string[] = [];
      for (const a of alts) {
        const c = clean(a, MAX_ALT);
        if (
          c &&
          squash(c) !== squash(phrase) &&
          !alternatives.some((x) => squash(x) === squash(c))
        )
          alternatives.push(c);
        if (alternatives.length >= 3) break;
      }
      if (!alternatives.length) continue; // nothing to offer = nothing to ask
      out.push({ page, phrase, alternatives, reason: clean(j.reason, MAX_REASON), box: parseBox(j.box) });
    } catch {
      /* skip malformed line */
    }
    if (out.length >= MAX_FLAGS_PER_CALL) break;
  }
  return out;
}

/** Offset of `phrase` in `text` as a whole word, preferring the occurrence nearest `hint`. -1 if absent. */
const ALNUM = /[A-Za-z0-9]/;

/** True when the match at `i` is only a piece of a longer Latin word or number ("opilot" inside
 *  "Copilot", "10" inside "100"). Replacing such a piece would corrupt the word. Korean is left
 *  alone on purpose: particles attach directly to a word ("심천에서"). */
function insideLatinWord(text: string, i: number, phrase: string): boolean {
  const before = text[i - 1] ?? "";
  const after = text[i + phrase.length] ?? "";
  return (
    (ALNUM.test(phrase[0]) && ALNUM.test(before)) ||
    (ALNUM.test(phrase[phrase.length - 1]) && ALNUM.test(after))
  );
}

export function anchorPhrase(text: string, phrase: string, hint = 0): number {
  if (!phrase) return -1;
  let best = -1;
  let from = 0;
  for (;;) {
    const i = text.indexOf(phrase, from);
    if (i === -1) break;
    if (insideLatinWord(text, i, phrase)) {
      from = i + 1;
      continue;
    }
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
  if (text.slice(s, s + phrase.length) !== phrase || insideLatinWord(text, s, phrase)) {
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
