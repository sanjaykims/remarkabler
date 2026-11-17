import type { OcrFlag } from "./ocrFlags";

// Pure part of the "second look": after the first transcription, each doubtful word is shown
// to Claude again next to saved pictures of the candidate words in the writer's own hand.
// This file only applies the answers; the call itself lives in lib/claude.ts.

export type LookItem = {
  /** index into the flags array */
  flag: number;
  /** index into the pages array */
  page: number;
  offset: number;
  /** how many times the phrase occurs on that page */
  occurrences: number;
  candidates: string[];
};

export type LookAnswer = { item: number; read: string; sure: boolean };

export function parseLookAnswers(raw: string): LookAnswer[] {
  const out: LookAnswer[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try {
      const j = JSON.parse(t);
      if (Number.isInteger(j.item) && typeof j.read === "string") {
        out.push({ item: j.item, read: j.read.trim(), sure: j.sure === true });
      }
    } catch {
      /* skip a bad line */
    }
  }
  return out;
}

/**
 * Apply confident second-look answers. Confirmed as first read -> the flag is dropped (no card).
 * A different candidate -> the text is changed only when the phrase occurs exactly once on the
 * page, and the card stays (now offering the first reading as an alternative), so the owner
 * still has the last word. Anything unsure, unknown or ambiguous is left exactly as it was.
 */
export function applySecondLook<P extends { text: string }>(
  pages: P[],
  flags: OcrFlag[],
  items: LookItem[],
  answers: LookAnswer[]
): { pages: P[]; flags: OcrFlag[]; confirmed: number; changed: number } {
  const outPages = pages.map((p) => ({ ...p }));
  const outFlags: Array<OcrFlag | null> = flags.map((f) => ({ ...f, alternatives: [...f.alternatives] }));
  let confirmed = 0;
  let changed = 0;
  const done = new Set<number>();
  for (const a of answers) {
    const it = items[a.item - 1];
    if (!it || done.has(a.item) || !a.sure) continue;
    done.add(a.item);
    const f = outFlags[it.flag];
    if (!f || !it.candidates.includes(a.read)) continue;
    if (a.read === f.phrase) {
      outFlags[it.flag] = null;
      confirmed++;
      continue;
    }
    const others = [f.phrase, ...f.alternatives.filter((x) => x !== a.read)];
    const page = outPages[it.page];
    if (it.occurrences === 1 && page && page.text.slice(it.offset, it.offset + f.phrase.length) === f.phrase) {
      page.text = page.text.slice(0, it.offset) + a.read + page.text.slice(it.offset + f.phrase.length);
      outFlags[it.flag] = {
        ...f,
        phrase: a.read,
        alternatives: others.slice(0, 3),
        reason: `second look changed "${f.phrase}" to "${a.read}"`,
      };
      changed++;
    } else {
      f.alternatives = [a.read, ...f.alternatives.filter((x) => x !== a.read)];
    }
  }
  return { pages: outPages, flags: outFlags.filter((f): f is OcrFlag => f !== null), confirmed, changed };
}
