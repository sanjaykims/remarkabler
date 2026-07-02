"""Ensure rmc's RM_PALETTE maps the highlighter color id (PenColor.HIGHLIGHT = 9).

Pinned `rmc==0.3.0` OMITS PenColor.HIGHLIGHT (color id 9) from RM_PALETTE —
verified against a clean PyPI install: the palette has 13 keys
[0..8, 10..13] with 9 absent, and the source carries only a commented-out
placeholder `#! PenColor.HIGHLIGHT = ...`. So any reMarkable page with a
stroke colored by the highlighter id (firmware >= 3.14) crashes the renderer
at `RM_PALETTE[base_color_id]` with `KeyError: 9`. This script adds the entry.

Necessity-gated and idempotent. It inspects the *live* RM_PALETTE dict and
patches ONLY if id 9 is missing; if it already resolves, it no-ops. This is
deliberately NOT a string match against the source — an earlier version
guarded on `"PenColor.HIGHLIGHT" in src`, which false-tripped on that very
`#! PenColor.HIGHLIGHT` comment and silently did nothing (the real bug this
rewrite fixes). Checking the actual dict is both correct and self-verifying,
and means a future rmc that ships id 9 makes this a clean no-op automatically.

When a patch is needed it edits the installed source file so the fix applies to
every `rmc` CLI subprocess (a runtime monkeypatch would not, since rmc runs as
its own process).

Best-effort: warns and exits 0 rather than failing the image build — a missing
patch degrades to isolated per-page render failures downstream, not a broken
deploy.
"""

import re
from pathlib import Path

SENTINEL = "added-by-remarkabler: restore missing highlight id 9"
INSERT = "\n    PenColor.HIGHLIGHT: (255, 235, 60),  # " + SENTINEL

try:
    import rmc.exporters.writing_tools as wt
except Exception as e:  # pragma: no cover - import shape guard
    print(f"[patch_rm_palette] rmc not importable, skipping: {e}")
    raise SystemExit(0)

# Necessity gate: inspect the LIVE palette. PenColor.HIGHLIGHT is an IntEnum
# member equal to 9, so `9 in RM_PALETTE` is True on every build that maps it.
# This is the correct check — not a string match against the source, which the
# prior version used and which both false-tripped and risked a duplicate key.
try:
    palette = wt.RM_PALETTE
except AttributeError:
    print(
        "[patch_rm_palette] WARNING: RM_PALETTE not found on module; "
        "cannot verify highlighter id. Left unpatched."
    )
    raise SystemExit(0)

if 9 in palette:
    print("[patch_rm_palette] RM_PALETTE already maps highlight id 9; no change")
    raise SystemExit(0)

path = Path(wt.__file__)
src = path.read_text(encoding="utf-8")

if SENTINEL in src:
    # Palette lacks id 9 at runtime but our sentinel is already in the source:
    # a broken prior edit. Don't stack a second one.
    print("[patch_rm_palette] sentinel present but id 9 unresolved; leaving as-is")
    raise SystemExit(0)

# Match the palette assignment tolerant of a type annotation, e.g.
#   RM_PALETTE = {
#   RM_PALETTE: dict[int, tuple] = {
m = re.search(r"RM_PALETTE\s*(?::[^=\n]+)?=\s*\{", src)
if not m:
    print(
        "[patch_rm_palette] WARNING: RM_PALETTE literal not found; "
        "highlighter pages may fail to render. Left unpatched."
    )
    raise SystemExit(0)

insert_at = m.end()
patched = src[:insert_at] + INSERT + src[insert_at:]
path.write_text(patched, encoding="utf-8")
print(f"[patch_rm_palette] added highlight id 9 to {path}")
