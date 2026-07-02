"""Patch rmc's RM_PALETTE to include the highlighter color id.

rmc 0.3.0's palette omits PenColor.HIGHLIGHT (color id 9), so any reMarkable
page containing highlighter strokes (firmware >= 3.14) crashes the renderer
with `KeyError: 9`. This adds a fallback color for it, editing the installed
source file so the fix applies to every `rmc` CLI invocation (a runtime
monkeypatch would not, since rmc runs as its own process).

Best-effort and idempotent: if the palette or its marker can't be found, it
prints a warning and exits 0 rather than failing the image build — a missing
patch degrades to per-page render failures (isolated downstream), not a
broken deploy.
"""

from pathlib import Path

try:
    import rmc.exporters.writing_tools as wt
except Exception as e:  # pragma: no cover - import shape guard
    print(f"[patch_rm_palette] rmc not importable, skipping: {e}")
    raise SystemExit(0)

path = Path(wt.__file__)
src = path.read_text(encoding="utf-8")

if "PenColor.HIGHLIGHT" in src:
    print("[patch_rm_palette] HIGHLIGHT already present, no change")
    raise SystemExit(0)

marker = "RM_PALETTE = {"
if marker not in src:
    print(
        "[patch_rm_palette] WARNING: 'RM_PALETTE = {' not found; "
        "highlighter pages may fail to render. Left unpatched."
    )
    raise SystemExit(0)

patched = src.replace(
    marker,
    marker + "\n    PenColor.HIGHLIGHT: (255, 235, 60),  # added: rmc 0.3.0 omits id 9",
    1,
)
path.write_text(patched, encoding="utf-8")
print(f"[patch_rm_palette] patched {path}")
