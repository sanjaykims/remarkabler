# Design

The one-page token reference for Remarkabler. Read this before any UI change.

> Companion: `docs/design/mockup.html` is a self-contained visual reference
> of these tokens (both color modes on one page). Open it in a browser when
> evaluating a design change — it's faster than rebuilding the app.

## Identity in one line

A calm, mobile-first **personal journal** that happens to be powered by
Claude. Quiet, paper-feeling. A single, highly-legible humanist sans
across the whole app. Decorative warmth from amber accents. Not a SaaS
landing page.

## Typography — single font

**Clear Sans, everywhere.** UI chrome and reading content and the
wordmark all use the same family. The distinction between "stuff you
read" and "stuff you operate" is carried by **size and weight**, not by
swapping families.

| Variable | Family | Where |
| --- | --- | --- |
| `--font-sans` | **Clear Sans** | Everything textual |
| `--font-mono` | system mono | Code (unchanged) |

### Loading

`next/font/local` from `public/fonts/`. Clear Sans is not on Google
Fonts (it's an Intel-released open font hosted at `intel/clear-sans`);
the `.woff2` files are committed once under `public/fonts/`:

- `clear-sans-400.woff2` (Regular)
- `clear-sans-400-italic.woff2`
- `clear-sans-500.woff2` (Medium)
- `clear-sans-700.woff2` (Bold)

**Zero build-time network for fonts. Zero runtime network for fonts.**
Stronger isolation than `next/font/google` (which would still fetch
from Google at build).

### Weight remap (the one gotcha)

Clear Sans ships **400 / 500 / 700** (Light, Regular, Medium, Bold).
It does **not** ship a 600 (Semibold). Tailwind's `font-semibold`
applies `font-weight: 600`; without an actual 600 face the browser
would auto-bold from 700, which looks heavier than intended.

We remap globally in `app/globals.css`:

```css
.font-semibold { font-weight: 500; }
```

This makes every existing `font-semibold` call render in Clear Sans's
real Medium weight. Visually it reads closer to the previous system-font
"semibold" than auto-bolded 700 would. Documented here so future code
edits don't reintroduce a real 600 face.

### Long-form reading

Long-form surfaces get `leading-relaxed` (1.625 line-height) for
breathing room — Clear Sans is dense-ish at default 1.4:
- Assistant chat bubbles.
- Diary excerpt `<pre>` on `/notebooks`.
- Insight body on `/insights`.
- Memory profile textarea.
- Home latest-insight preview.

UI chrome stays at default density (no `leading-relaxed`).

## Color

| Surface | Light | Dark |
| --- | --- | --- |
| Body background | `#fafaf9` (stone-50, warm paper) | `#000000` (AMOLED true black) |
| Body text | `text-stone-900` | `text-stone-100` |
| Card border | `border-stone-200` | `border-stone-800` |
| Muted text | `opacity-70`/`opacity-60` | same |
| Accent (decorative) | `amber-600` `#d97706` | `amber-500` `#f59e0b` |
| Accent text on light | `amber-700` `#b45309` (≥4.5:1) | `amber-400` `#fbbf24` (>7:1) |

**Dark mode is media-based** (`prefers-color-scheme`). Do **not** switch
to class-based — every existing `dark:` variant would silently break.

**Contrast rule:** `amber-600` on stone-50 is only ~3.4:1, so it's
**decorative only** on light (underlines, focus rings, chart strokes,
borders). For amber **text** on light use `amber-700`. Dark mode is fine
either way.

The cost calendar's amber heat ramp is already this scale. The shared
`colors.accent` alias in `tailwind.config.ts` is a greppable name for
the same color; pick whichever reads better in context.

## Spacing & radius

- Radii: `rounded` (cards, buttons), `rounded-2xl` (chat bubbles, inputs),
  `rounded-full` (pills, icon buttons).
- **No shadows.** Shadows on AMOLED black render as grey halos — the flat
  aesthetic is intentional.
- Safe-area utilities (`.pt-safe`/`.pb-safe`/`.pl-safe`/`.pr-safe`) wrap
  the layout chrome — preserved untouched, do not regress.

## Interactivity

- **Focus rings:** keyboard-only via `:focus-visible`, amber. Mouse-click
  doesn't trigger them, so they don't clutter forms.
- **Tap targets:** 44px floor on touch devices (`(hover: none) and
  (pointer: coarse)`), applied **only** to `button`/`[role=button]`/
  `[type=button]`/`[type=submit]` — ordinary inline `<a>` links are
  exempt so prose links don't get distorted.
- **Motion:** `scroll-behavior: smooth` + a `prefers-reduced-motion`
  guard that disables it.

## Components

Server-safe, hook-free, in `components/`:

- `cn` — class-concatenation helper (6 lines, no deps).
- `Button` (`primary` / `secondary` / `ghost` × `sm` / `md`).
- `Card` — `rounded border border-stone-200 dark:border-stone-800 p-…`
  with an `as` prop.
- `Section` — H2 + optional subtitle + bordered body (lifted from the
  Mind page).
- `Stat` — large number + small label (de-dupes the copies on Home and
  Cost).
- `Badge` — neutral / accent pill.

`IconButton`, an icon library, and any animation library are explicitly
**out of scope** for this refresh — inline SVGs and Tailwind transitions
are enough. `app/mind/Map3D.tsx` is **not** touched (its amber literals
already match).

## Do not regress

- Typography stays **one font (Clear Sans)**. No serif. No hand. If a
  future change wants editorial typography back, write a new doc — don't
  silently add a second family.
- Fonts stay **self-hosted under `public/fonts/`** (no runtime Google
  calls, no build-time Google calls).
- `.font-semibold { font-weight: 500 }` remap stays. Don't add a real 600
  face unless Clear Sans starts shipping one.
- Dark mode stays **media-based**.
- Amber is **decorative-only on light** for non-text; amber-700 for text.
- Safe-area utilities preserved.
- `app/layout.tsx` stays a **server component** (it calls
  `isAuthenticated()` at request time).
- Map3D is untouched.
