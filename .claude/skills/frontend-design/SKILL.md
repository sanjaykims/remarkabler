---
name: frontend-design
description: >-
  Make bold, subject-specific frontend design decisions and avoid generic "AI
  slop" aesthetics. Use when designing or refining any UI, landing page, or
  visual identity. Vendored from Anthropic's official frontend-design skill and
  adapted with this repo's constraints (see DESIGN.md — one font, media dark
  mode, amber+stone, no shadows).
---

# Frontend Design — make deliberate choices, not templates

Design at the treatment the task calls for. A utilitarian tool gets polish and
restraint; an editorial surface (a pitch, a landing) earns a distinctive point
of view. Either way, ground every choice in the subject.

## Ground it in the subject

Pin the concrete subject, its audience, and the page's single job before
designing. Distinctive choices come from the subject's own world — its
materials, vernacular, instruments — not a generic template. For **Remarkabler**
that world is: handwriting, ruled paper, ink, the margin line, a daily entry,
quiet reflection on an e-ink tablet. Calm and paper-feeling, not a SaaS landing.

## Principles

- **Typography carries personality.** Set a clear type scale and hold it. Get
  personality from intentional weight / size / tracking / rhythm. (This repo is
  locked to one family — Clear Sans — so *all* the personality comes from how
  it's set, never from a second face. See DESIGN.md.)
- **Structure encodes information.** Eyebrows, dividers, numbers, labels must
  say something true about the content, not decorate it. Numbered markers
  (01/02/03) only when order genuinely matters.
- **Hero as thesis.** Open with the most characteristic thing in the subject's
  world, chosen deliberately — not a big number + small label + gradient.
- **Motion with purpose.** One orchestrated moment beats scattered effects.
  Scattered micro-animations read as AI-generated. Respect
  `prefers-reduced-motion`.
- **Spend boldness in one place.** Concentrate the one signature element; keep
  everything around it quiet and disciplined. If the accent fights the ground,
  shift it analogous or drop saturation — don't replace it.
- **Match complexity to the vision.** Minimal directions demand precision in
  spacing, type, and detail — that precision *is* the craft.

## Avoid the generic AI defaults

Recognize and avoid (unless the brief genuinely calls for one): warm-cream +
serif + terracotta; near-black + lone acid-green/vermilion pop; broadsheet
hairlines + dense columns; purple→blue gradient hero on white; Inter/Space
Grotesk as the "safe" face; emoji as section markers; everything centered;
`rounded-lg` on everything; an accent bar/rail glued to rounded cards.

## Two-pass process

1. **Draft** a compact system: 4–6 named colors with roles, the type scale +
   weights, a layout concept, and the one signature element.
2. **Critique** it against the brief. Revise anything that reads like a default
   you'd produce for any similar page; note what changed and why. Only then
   write code.

## Quality floors (non-negotiable)

Responsive (375 / 768 / 1024 / 1440), visible keyboard focus, reduced-motion
support, 4.5:1 text contrast, real content (never lorem), both color themes
given equal care.
