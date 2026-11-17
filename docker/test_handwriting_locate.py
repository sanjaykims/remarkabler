import random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import handwriting_locate as LC

W, H, PITCH, TOP = 1404, 1872, 70, 110
KR = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
LAT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
LATW = ["today", "I", "went", "to", "the", "office", "and", "met", "Corning", "glass", "about",
        "meeting", "coffee", "wife", "morning", "very", "tired", "but", "happy", "gym", "walk",
        "dinner", "with", "Samsung", "plan", "next", "week", "Terry", "church", "reading"]
KRS = list("오늘아침회사에서점심을먹고운동했다가족과함께교회갔다피곤하지만기분좋은하루였어요글라스연구미팅")


def rand_text(rng, kind, nwords):
    ws = []
    for _ in range(nwords):
        if kind == "kr":
            ws.append("".join(rng.choice(KRS) for _ in range(rng.randint(2, 5))))
        elif kind == "lat":
            ws.append(rng.choice(LATW))
        else:
            ws.append(rng.choice(LATW) if rng.random() < .5 else "".join(rng.choice(KRS) for _ in range(rng.randint(2, 4))))
    return " ".join(ws)


def make_page(seed, mode="clean"):
    """returns img(gray L), page_text, words[(start_off, len, line_idx_nonempty, box_px)], rows"""
    rng = random.Random(seed)
    img = Image.new("L", (W, H), 255)
    d = ImageDraw.Draw(img)
    for y in range(TOP - 10, H - 60, PITCH):
        d.line([(0, y), (W, y)], fill=205, width=2)
    d.line([(95, 0), (95, H)], fill=215, width=2)
    nrows = 22
    # which rows carry text
    blanks = set(rng.sample(range(2, nrows), 2))
    rows_text = []
    for r in range(nrows):
        if r in blanks:
            rows_text.append("")
            continue
        r_ = rng.random()
        kind = rng.choice(["kr", "lat", "mix"])
        if r_ < .12:
            n = 1
        elif r_ < .2:
            n = rng.randint(7, 9)  # long / near-wrap
        else:
            n = rng.randint(3, 6)
        rows_text.append(rand_text(rng, kind, n))
    text_lines, words, extra_rows = [], [], []
    pos = 0
    ys_offset = [0] * nrows
    if mode == "touch":  # push two adjacent lines closer so ascenders/descenders touch
        k = rng.randint(4, nrows - 4)
        while not rows_text[k] or not rows_text[k + 1]:
            k = rng.randint(4, nrows - 4)
        ys_offset[k + 1] = -22
        for q in range(k + 2, nrows):
            ys_offset[q] = -22
    drawn_rows = []
    for r, t in enumerate(rows_text):
        if t:
            nonempty_idx = sum(1 for x in rows_text[:r] if x)
            fs = rng.randint(36, 44)
            fk = ImageFont.truetype(KR, fs, index=1)
            fl = ImageFont.truetype(LAT, fs)
            x = 130 + rng.randint(0, 45)
            base = TOP + r * PITCH + ys_offset[r]
            phase, amp = rng.random() * 6, rng.uniform(0, 3)
            ink = rng.randint(15, 60)
            ys, boxes = [], []
            for ci, ch in enumerate(t):
                f = fk if ord(ch) > 0x2E80 or ch in "" else fl
                if ord(ch) > 0x2E80:
                    f = fk
                wob = int(amp * np.sin(phase + x / 90.0) + rng.randint(-2, 2))
                if ch != " ":
                    d.text((x, base + wob), ch, font=f, fill=ink)
                    bb = d.textbbox((x, base + wob), ch, font=f)
                else:
                    bb = (x, base, x + f.getlength(" "), base)
                boxes.append(bb)
                x += f.getlength(ch) + rng.uniform(-1.5, 3.0)
            ly0 = min(b[1] for b in boxes if b[3] > b[1]); ly1 = max(b[3] for b in boxes if b[3] > b[1])
            # words
            import re
            for m in re.finditer(r"\S+", t):
                bs = [boxes[i] for i in range(m.start(), m.end())]
                words.append((pos + m.start(), m.end() - m.start(), nonempty_idx,
                              (min(b[0] for b in bs), min(b[1] for b in bs),
                               max(b[2] for b in bs), max(b[3] for b in bs))))
            drawn_rows.append((ly0, ly1))
        text_lines.append(t)
        pos += len(t) + 1
    if mode == "scribble":  # margin scribble / doodle on an extra spot (blank row or margin)
        r = rng.choice(sorted(blanks))
        y = TOP + r * PITCH + 10
        xs = 20 if rng.random() < .5 else 600 + rng.randint(0, 300)
        for _ in range(3):
            d.line([(xs, y + rng.randint(0, 30)), (xs + rng.randint(40, 180), y + rng.randint(0, 30))], fill=30, width=3)
    return img, "\n".join(text_lines), words, drawn_rows


def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0])); iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / u if u > 0 else 0.0


def evaluate(mode, npages, per_page, seed0=0):
    res = dict(n=0, hit=0, line_ok=0, ious=[], xerr=[], Keq=0, pages=0, hit_eq=0, n_eq=0, hit_ne=0, n_ne=0, confs_ok=[], confs_bad=[])
    for p in range(npages):
        img, text, words, _ = make_page(seed0 + p, mode)
        arr = np.asarray(img)
        bands = LC.find_text_lines(arr)
        N = sum(1 for l in text.split("\n") if l.strip())
        eq = len(bands) == N
        res["pages"] += 1; res["Keq"] += eq
        rng = random.Random(1000 + p)
        for off, ln, li, tb in rng.sample(words, per_page):
            box, conf, info = LC.locate_word_ex(arr, text, off, ln)
            pb = (box[0] * W / 1000, box[1] * H / 1000, box[2] * W / 1000, box[3] * H / 1000)
            cy = (pb[1] + pb[3]) / 2
            line_ok = tb[1] - 4 <= cy <= tb[3] + 4
            i = iou(pb, tb)
            ok = line_ok and i > 0
            res["n"] += 1; res["hit"] += ok; res["line_ok"] += line_ok; res["ious"].append(i)
            res["xerr"].append(abs((pb[0] + pb[2]) / 2 - (tb[0] + tb[2]) / 2))
            (res["confs_ok"] if ok else res["confs_bad"]).append(conf)
            if eq: res["n_eq"] += 1; res["hit_eq"] += ok
            else: res["n_ne"] += 1; res["hit_ne"] += ok
    return res


def show(mode, r):
    print(f"[{mode}] pages={r['pages']} K==N on {r['Keq']}/{r['pages']}  targets={r['n']}  "
          f"line-correct={r['line_ok']/r['n']:.3f}  hit(IoU>0 & line)={r['hit']/r['n']:.3f}  "
          f"meanIoU={np.mean(r['ious']):.3f}  median|dx|={np.median(r['xerr']):.0f}px  p90|dx|={np.percentile(r['xerr'],90):.0f}px")
    if r["n_eq"]: print(f"    K==N: {r['hit_eq']}/{r['n_eq']}")
    if r["n_ne"]: print(f"    K!=N: {r['hit_ne']}/{r['n_ne']}")
    if r["confs_ok"] and r["confs_bad"]:
        print(f"    mean conf hits={np.mean(r['confs_ok']):.2f} misses={np.mean(r['confs_bad']):.2f}")


if __name__ == "__main__":
    img, text, words, _ = make_page(0, "clean"); img.save("/tmp/lines/sample_clean.png")
    img, text, words, _ = make_page(3, "touch"); img.save("/tmp/lines/sample_touch.png")
    img, text, words, _ = make_page(5, "scribble"); img.save("/tmp/lines/sample_scribble.png")
    for mode in ("clean", "scribble", "touch"):
        show(mode, evaluate(mode, 40, 5))
