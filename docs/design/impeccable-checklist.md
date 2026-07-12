# Impeccable — design anti-pattern checklist

Adapted from pbakaus/impeccable's deterministic detector rules. Run this
checklist against any UI change before shipping. It complements `DESIGN.md`
(the repo's token system) and `.claude/skills/frontend-design` (the design
stance) — this file is the "what makes UI look amateurish" negative list.

## AI-slop / overused tells — avoid

- [ ] No purple→blue (or any) gradient hero. This app is flat, paper-feeling.
- [ ] No bounce / elastic easing. Use ease-out, 150–300ms.
- [ ] No drop shadows / dark glows. (Hard rule here: shadows on AMOLED black
      render as grey halos — DESIGN.md.)
- [ ] No accent bar/rail glued onto every rounded card.
- [ ] No emoji used as UI icons — inline SVG only.
- [ ] Not everything centered; use a real reading axis.

## Typography & color

- [ ] Neutrals are **tinted**, never pure mid-grey. (stone-* is warm-tinted —
      good; don't swap to plain gray-*.)
- [ ] No grey text on a colored background (poor contrast).
- [ ] Body text ≥ 16px on mobile; line-height 1.5–1.75 for reading surfaces.
- [ ] Reading measure ~65–75 characters; don't let prose run edge-to-edge.
- [ ] Heading hierarchy is semantic and not skipped (h1→h2→h3).
- [ ] Uppercase labels get letter-spacing; large headings get
      `text-wrap: balance`.
- [ ] Amber is decorative-only on light for non-text; amber-700 for amber text
      (contrast — DESIGN.md).

## Spacing, rhythm & layout

- [ ] Generous, consistent padding — no cramped cards.
- [ ] One spacing scale, applied with flex/grid `gap` (not ad-hoc margins).
- [ ] Consistent container max-width across pages.
- [ ] No horizontal scroll at 375px.
- [ ] Fixed/sticky chrome doesn't hide content beneath it.

## Components & structure

- [ ] Don't wrap everything in cards; don't nest cards inside cards.
- [ ] Structural devices (eyebrows, numbers, dividers) encode real meaning.
- [ ] Interactive things look interactive (cursor-pointer, hover feedback).
- [ ] Touch targets ≥ 44px (already enforced globally in globals.css).

## Motion & state

- [ ] Transitions 150–300ms, transform/opacity only (not width/height).
- [ ] `prefers-reduced-motion` respected.
- [ ] Loading = skeleton/spinner with reserved space (no content jump).
- [ ] Async buttons disable while pending; errors are specific and near the
      problem.

## Themes & a11y

- [ ] Both light and dark given equal care (not a naive invert).
- [ ] Borders visible in both modes.
- [ ] Visible keyboard focus (`:focus-visible`, amber — globals.css).
- [ ] Color is never the only signal (pair with icon/label/shape).
