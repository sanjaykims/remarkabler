// Pure word-level diff used to learn from the owner's MANUAL page edits.
// Only small substitutions count as "misreadings" (a word or short phrase
// replaced by another). Pure insertions/deletions and big rewrites are not
// handwriting lessons, so they are ignored.

export type WordChange = { wrong: string; right: string; context: string };

const MAX_SIDE_TOKENS = 3; // longest replaced phrase we treat as a misreading
const MAX_MIDDLE = 400; // bail on edits whose changed middle is larger than this
const MAX_HUNKS = 12; // more edits than this = a rewrite, not corrections

const tokens = (t: string) => t.split(/\s+/).filter(Boolean);
const strip = (s: string) =>
  s.replace(/^[("'“‘\[{]+/, "").replace(/[.,;:!?)"'”’\]}。]+$/, "").trim();

export function wordChanges(oldText: string, newText: string): WordChange[] {
  const a = tokens(oldText);
  const b = tokens(newText);

  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (
    suf < a.length - pre &&
    suf < b.length - pre &&
    a[a.length - 1 - suf] === b[b.length - 1 - suf]
  ) {
    suf++;
  }
  const ma = a.slice(pre, a.length - suf);
  const mb = b.slice(pre, b.length - suf);
  if (ma.length === 0 || mb.length === 0) return [];
  if (ma.length > MAX_MIDDLE || mb.length > MAX_MIDDLE) return [];

  // LCS over the changed middle only.
  const n = ma.length;
  const m = mb.length;
  const w = m + 1;
  const dp = new Uint16Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] =
        ma[i] === mb[j]
          ? dp[(i + 1) * w + j + 1] + 1
          : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }

  const hunks: Array<{ del: string[]; ins: string[]; at: number }> = [];
  let i = 0;
  let j = 0;
  let cur: { del: string[]; ins: string[]; at: number } | null = null;
  const flush = () => {
    if (cur) hunks.push(cur);
    cur = null;
  };
  while (i < n || j < m) {
    if (i < n && j < m && ma[i] === mb[j]) {
      flush();
      i++;
      j++;
    } else if (j < m && (i >= n || dp[i * w + j + 1] >= dp[(i + 1) * w + j])) {
      cur = cur ?? { del: [], ins: [], at: pre + i };
      cur.ins.push(mb[j++]);
    } else {
      cur = cur ?? { del: [], ins: [], at: pre + i };
      cur.del.push(ma[i++]);
    }
  }
  flush();

  if (hunks.length > MAX_HUNKS) return [];
  const out: WordChange[] = [];
  for (const h of hunks) {
    if (!h.del.length || !h.ins.length) continue;
    if (h.del.length > MAX_SIDE_TOKENS || h.ins.length > MAX_SIDE_TOKENS) continue;
    const wrong = strip(h.del.join(" "));
    const right = strip(h.ins.join(" "));
    if (!wrong || !right || wrong === right) continue;
    // Punctuation-only change (e.g. "hello world" -> "hello, world"): not a misreading.
    const bare = (x: string) => x.replace(/[^\p{L}\p{N}\s]/gu, "");
    if (bare(wrong) === bare(right)) continue;
    const context = [
      ...a.slice(Math.max(0, h.at - 5), h.at),
      "[…]",
      ...a.slice(h.at + h.del.length, h.at + h.del.length + 5),
    ].join(" ");
    out.push({ wrong, right, context });
  }
  return out;
}
