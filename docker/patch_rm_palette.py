"""Patch rmc's RM_PALETTE to include the highlighter color id.

rmc 0.3.0's palette omits PenColor.HIGHLIGHT (color id 9), so any reMarkable
page containing highlighter strokes (firmware >= 3.14) crashes the renderer
with `KeyError: 9`. This adds a fallback color for it, editing the installed
source file so the fix applies to every `rmc` CLI invocation (a runtime
monkeypatch would not, since rmc runs as its own process).

Idempotency guard is a UNIQUE SENTINEL string we insert — NOT the bare
"PenColor.HIGHLIGHT", because pristine rmc 0.3.0 already contains that text
in a comment (`#! PenColor.HIGHLIGHT = ...`), which would make the guard
false-trip and the patch a silent no-op (caught in review of PR #76).

Best-effort and idempotent: if the palette literal can't be found it prints
a warning and exits 0 rather than failing the image build — a missing patch
degrades to isolated per-page render failures downstream, not a broken
deploy.
"""

import re
from pathlib import Path

SENTINEL = "patched-by-remarkabler: rmc omits highlight id 9"
INSERT = (
    "\n    PenColor.HIGHLIGHT: (255, 235, 60),  # " + SENTINEL
)

try:
    import rmc.exporters.writing_tools as wt
except Exception as e:  # pragma: no cover - import shape guard
    print(f"[patch_rm_palette] rmc not importable, skipping: {e}")
    raise SystemExit(0)

path = Path(wt.__file__)
src = path.read_text(encoding="utf-8")

if SENTINEL in src:
    print("[patch_rm_palette] already patched, no change")
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
print(f"[patch_rm_palette] patched {path}")
