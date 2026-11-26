"""Locate a word on a rendered handwriting page from transcript line structure.

No LLM coordinates are used: the y-position comes from detected ink bands
(horizontal projection of DARK pixels only, so light ruled lines vanish),
the x-position from the character fraction within the line mapped onto that
band's actual ink extent.
"""
import hashlib
import math
import unicodedata

import numpy as np

DARK_THRESH = 130  # gray < this counts as ink; template rules are ~200+


# ----------------------------------------------------------------- bands
def _smooth(v, sigma):
    r = max(1, int(sigma * 3))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    return np.convolve(v, k, mode="same")


def _runs(mask):
    """contiguous True runs -> list of [start, end) """
    idx = np.flatnonzero(np.diff(np.concatenate([[0], mask.astype(np.int8), [0]])))
    return [[int(idx[i]), int(idx[i + 1])] for i in range(0, len(idx), 2)]


def _est_pitch(bands):
    if len(bands) < 3:
        hs = [b[1] - b[0] for b in bands]
        return (np.median(hs) / 0.7) if hs else 70.0
    c = np.array([(b[0] + b[1]) / 2 for b in bands])
    d = np.diff(c)
    m = np.median(d)
    for _ in range(3):
        sel = d[(d > 0.6 * m) & (d < 1.5 * m)]
        if len(sel):
            m = np.median(sel)
    return float(m)


def _acf_pitch(prof):
    """Line spacing from the repeating ink pattern (autocorrelation of the row profile), or None.

    The segment-based estimate collapses when touching lines merge into one tall band (it then
    reports two or three lines as "one line", so nothing ever gets split and the marker covers
    several lines). The ink rows repeat once per line, so the first strong autocorrelation peak
    is the real spacing regardless of how the segments merged."""
    v = _smooth(np.asarray(prof, float), 2.0)
    v = v - v.mean()
    n = len(v)
    if n < 80 or not v.any():
        return None
    ac = np.correlate(v, v, "full")[n - 1:]
    if ac[0] <= 0:
        return None
    ac = ac / ac[0]
    lo, hi = 12, min(n // 2, 300)
    best = None
    for i in range(lo + 1, hi - 1):
        if ac[i] > ac[i - 1] and ac[i] >= ac[i + 1] and ac[i] >= 0.3:
            if best is None or ac[i] > 1.25 * ac[best]:
                best = i
            break  # the FIRST strong peak is the spacing; later ones are multiples
    return float(best) if best else None


def find_text_lines(img_gray):
    """-> list of (y0, y1) pixel bands (y1 exclusive), top to bottom."""
    a = np.asarray(img_gray)
    if a.ndim == 3:
        a = a.mean(axis=2)
    dark = a < DARK_THRESH
    prof = dark.sum(axis=1).astype(float)
    if prof.max() <= 0:
        return []
    s1 = _smooth(prof, 2.0)
    nz = s1[s1 > 0]
    t = max(1.2, 0.012 * np.percentile(nz, 90)) if len(nz) else 1.5
    segs = _runs(s1 > t)
    # merge tiny gaps (<=3 px)
    m = []
    for s in segs:
        if m and s[0] - m[-1][1] <= 3:
            m[-1][1] = s[1]
        else:
            m.append(s)
    segs = m
    if not segs:
        return []

    ink = lambda s: float(prof[s[0]:s[1]].sum())
    # drop noise: very short AND little ink
    med_ink = np.median([ink(s) for s in segs])
    segs = [s for s in segs if (s[1] - s[0]) >= 5 and ink(s) >= 0.02 * med_ink]
    if not segs:
        return []

    # merge fragments (i-dots, accents, jamo pieces): short segment close to neighbour
    hs = [s[1] - s[0] for s in segs]
    medh = float(np.median(hs))
    changed = True
    while changed and len(segs) > 1:
        changed = False
        for i, s in enumerate(segs):
            h = s[1] - s[0]
            if h >= 0.4 * medh:
                continue
            gl = s[0] - segs[i - 1][1] if i > 0 else 1e9
            gr = segs[i + 1][0] - s[1] if i + 1 < len(segs) else 1e9
            g, j = (gl, i - 1) if gl <= gr else (gr, i + 1)
            if g <= 0.45 * medh and (max(segs[j][1], s[1]) - min(segs[j][0], s[0])) < 1.6 * medh + 10:
                a0, a1 = min(segs[j][0], s[0]), max(segs[j][1], s[1])
                segs[min(i, j)] = [a0, a1]
                del segs[max(i, j)]
                changed = True
                break

    pitch = _est_pitch(segs)
    ap = _acf_pitch(prof)
    if ap is not None and ap < 0.8 * pitch:
        pitch = ap  # merged lines had inflated the estimate

    # split touching lines at profile valleys (both sides must be line-sized)
    s2 = _smooth(prof, 4.0)
    out = []
    for s in segs:
        out.extend(_split_valleys(s, s2, pitch))

    # split still-too-tall bands into n equal-ish rows, cutting at nearest valley
    final = []
    for s in out:
        h = s[1] - s[0]
        n = max(2, int(round(h / pitch))) if pitch > 0 else 1
        if h > 1.25 * pitch and n >= 2:
            cuts = []
            for k in range(1, n):
                c = s[0] + h * k / n
                lo, hi = int(c - 0.25 * pitch), int(c + 0.25 * pitch)
                lo, hi = max(lo, s[0] + 1), min(hi, s[1] - 1)
                cuts.append(lo + int(np.argmin(s2[lo:hi + 1])) if hi > lo else int(c))
            edges = [s[0]] + cuts + [s[1]]
            for a_, b_ in zip(edges[:-1], edges[1:]):
                final.append([a_, b_])
        else:
            final.append(s)
    return [(int(a_), int(b_)) for a_, b_ in final]


def _split_valleys(seg, s2, pitch):
    y0, y1 = seg
    if y1 - y0 < 1.2 * pitch:
        return [seg]
    p = s2[y0:y1]
    # candidate valleys: local minima
    mins = [i for i in range(2, len(p) - 2) if p[i] <= p[i - 1] and p[i] <= p[i + 1]]
    cuts = []
    last = 0
    minpiece = 0.35 * pitch
    for i in mins:
        if i - last < minpiece or len(p) - i < minpiece:
            continue
        lmax = p[last:i].max()
        rmax = p[i:].max()
        if p[i] < 0.5 * min(lmax, rmax):
            cuts.append(i)
            last = i
    edges = [0] + cuts + [len(p)]
    return [[y0 + a_, y0 + b_] for a_, b_ in zip(edges[:-1], edges[1:])]


def _band_extent(a, band):
    y0, y1 = band
    dark = a[y0:y1] < DARK_THRESH
    cols = dark.sum(axis=0)
    xs = np.flatnonzero(cols >= 2)
    if len(xs) == 0:
        xs = np.flatnonzero(cols >= 1)
    if len(xs) == 0:
        return 0, a.shape[1] - 1, 0
    # robust ends: ignore lone outlier strokes (e.g. margin scribble far away)
    lo, hi = int(xs[0]), int(xs[-1])
    return lo, hi, int(dark.sum())


# ----------------------------------------------------------- text weights
_NARROW = set("iljt.,:;'!|()[]`I1 ")
_WIDE = set("mwMW@")


def _cw(ch):
    if ch == " ":
        return 0.6
    if unicodedata.east_asian_width(ch) in ("W", "F"):
        return 1.8
    if ch in _NARROW:
        return 0.55
    if ch in _WIDE:
        return 1.5
    if ch.isupper():
        return 1.2
    return 1.0


def _parse_lines(page_text):
    lines = []
    pos = 0
    for raw_idx, ln in enumerate(page_text.split("\n")):
        if ln.strip():
            lead = len(ln) - len(ln.lstrip())
            body = ln.strip()
            lines.append(dict(raw=raw_idx, start=pos + lead, text=body,
                              w=sum(_cw(c) for c in body)))
        pos += len(ln) + 1
    return lines


# ------------------------------------------------------------- alignment
def _align(lines, bands, ext, pitch):
    """returns (assign list len N: band idx or None, mean_cost, total_cost)"""
    N, K = len(lines), len(bands)
    lw = np.array([l["w"] for l in lines])
    bw = np.array([e[1] - e[0] + 1 for e in ext], float)
    # global scale px per weight unit: ratio of upper-quartile widths
    sc = np.percentile(bw, 75) / max(np.percentile(lw, 75), 1e-6)
    cy = np.array([(b[0] + b[1]) / 2 for b in bands])

    def mcost(i, j):
        return min(1.5, abs(math.log((bw[j] + 40) / (sc * lw[i] + 40))))

    SKL, SKB, GAPW, MAXSK = 0.9, 0.8, 0.35, 4
    INF = 1e18
    best = {}  # (i,j) -> (cost, prev)
    for i in range(N):
        for j in range(K):
            c0 = i * SKL + j * SKB + 0.3 * (1 if (i and j) else 0)  # start skips
            cand = (c0 + mcost(i, j), None)
            for i0 in range(max(0, i - 1 - MAXSK), i):
                for j0 in range(max(0, j - 1 - MAXSK), j):
                    pc = best[(i0, j0)][0]
                    exp_gap = lines[i]["raw"] - lines[i0]["raw"]
                    act = (cy[j] - cy[j0]) / pitch
                    c = (pc + (i - i0 - 1) * SKL + (j - j0 - 1) * SKB
                         + GAPW * min(2.0, abs(exp_gap - act)) + mcost(i, j))
                    if c < cand[0]:
                        cand = (c, (i0, j0))
            best[(i, j)] = cand
    # end skips
    bk, bc = None, INF
    for (i, j), (c, _) in best.items():
        tot = c + (N - 1 - i) * SKL + (K - 1 - j) * SKB
        if tot < bc:
            bc, bk = tot, (i, j)
    assign = [None] * N
    costs = []
    k = bk
    while k is not None:
        assign[k[0]] = k[1]
        costs.append(mcost(*k))
        k = best[k][1]
    return assign, float(np.mean(costs)) if costs else 9.0, bc


_cache = {}


def _analyze(img_gray, page_text):
    a = np.asarray(img_gray)
    if a.ndim == 3:
        a = a.mean(axis=2)
    key = (hashlib.md5(a.tobytes()).hexdigest(), a.shape, page_text)
    if key in _cache:
        return _cache[key]
    bands = find_text_lines(a)
    lines = _parse_lines(page_text)
    ext = [_band_extent(a, b) for b in bands]
    N, K = len(lines), len(bands)
    pitch = _est_pitch([list(b) for b in bands]) if K else 70.0
    info = dict(N=N, K=K)
    if N == 0 or K == 0:
        res = (a, bands, lines, ext, [None] * N, 0.0, info)
    elif K == N and _align(lines, bands, ext, pitch)[0] == list(range(N)):
        # Equal counts are NOT proof of a 1:1 pairing: a split title (two bands for one line)
        # plus merged/faint lines elsewhere can cancel out, and pairing by index then puts every
        # marker one line too high. Only take this shortcut when the alignment agrees with it.
        assign = list(range(N))
        lw = np.array([l["w"] for l in lines])
        bw = np.array([e[1] - e[0] + 1 for e in ext], float)
        sc = np.percentile(bw, 75) / max(np.percentile(lw, 75), 1e-6)
        costs = [min(1.5, abs(math.log((bw[i] + 40) / (sc * lw[i] + 40)))) for i in range(N)]
        mc = float(np.mean(costs))
        info["mode"] = "direct"
        conf = float(max(0.0, min(1.0, 0.98 - 0.5 * mc)))
        res = (a, bands, lines, ext, assign, conf, info)
    else:
        assign, mc, _ = _align(lines, bands, ext, pitch)
        matched = sum(x is not None for x in assign)
        info["mode"] = "dp"
        info["matched"] = matched
        conf = float(max(0.0, min(0.9, (matched / N) * math.exp(-0.7 * mc) * 0.9
                                  * (min(N, K) / max(N, K)) ** 0.5)))
        res = (a, bands, lines, ext, assign, conf, info)
    if len(_cache) > 32:
        _cache.clear()
    _cache[key] = res
    return res


def _line_index_for_offset(lines, off):
    for idx, l in enumerate(lines):
        if off < l["start"] + len(l["text"]) + 1 and off >= l["start"] - 1:
            return idx
    # offset in blank/after: nearest by start
    return min(range(len(lines)), key=lambda i: abs(lines[i]["start"] - off))


def locate_word_ex(img_gray, page_text, char_offset, word_len):
    """-> ((x0,y0,x1,y1) in thousandths, confidence 0..1, info dict)"""
    a, bands, lines, ext, assign, conf, info = _analyze(img_gray, page_text)
    H, W = a.shape
    if not lines or not bands:
        return (0, 0, 1000, 1000), 0.0, info
    L = _line_index_for_offset(lines, char_offset)
    ln = lines[L]
    j = assign[L]
    if j is None:
        # unmatched line: interpolate between matched neighbours by raw row, snap
        m = [(lines[i]["raw"], assign[i]) for i in range(len(lines)) if assign[i] is not None]
        pitch = _est_pitch([list(b) for b in bands])
        if m:
            r0, j0 = min(m, key=lambda t: abs(t[0] - ln["raw"]))
            ycen = (bands[j0][0] + bands[j0][1]) / 2 + (ln["raw"] - r0) * pitch
        else:
            top, bot = bands[0][0], bands[-1][1]
            ycen = top + (bot - top) * (ln["raw"] / max(1, lines[-1]["raw"]))
        j = int(np.argmin([abs((b[0] + b[1]) / 2 - ycen) for b in bands]))
        conf = min(conf, 0.3)
        info["snapped"] = True
    y0, y1 = bands[j]
    xl, xr, _ = ext[j]
    body = ln["text"]
    s = max(0, min(len(body), char_offset - ln["start"]))
    e = max(s + 1, min(len(body), s + word_len))
    cum = np.concatenate([[0], np.cumsum([_cw(c) for c in body])])
    tot = cum[-1] if cum[-1] > 0 else 1.0
    fx0, fx1 = cum[s] / tot, cum[e] / tot
    span = max(1, xr - xl + 1)
    x0, x1 = xl + fx0 * span, xl + fx1 * span
    box = (int(round(1000 * x0 / W)), int(round(1000 * y0 / H)),
           int(round(1000 * x1 / W)), int(round(1000 * y1 / H)))
    info.update(line=L, band=j)
    return box, conf, info


def locate_word(img_gray, page_text, char_offset, word_len):
    """-> (x0, y0, x1, y1) in thousandths of the image."""
    return locate_word_ex(img_gray, page_text, char_offset, word_len)[0]
