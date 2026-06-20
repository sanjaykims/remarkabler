# Design

The one-page token reference for Remarkabler. Read this before any UI change.

> Companion: `docs/design/mockup.html` is a self-contained visual reference
> of these tokens (both color modes on one page). Open it in a browser when
> evaluating a design change — it's faster than rebuilding the app.

## Identity in one line

A calm, mobile-first **personal journal** that happens to be powered by
Claude. Quiet, paper-feeling, editorial typography. Decorative warmth from
amber accents. Not a SaaS landing page.

## Color

| Surface | Light | Dark |
| --- | --- | --- |
| Body background | `#fafaf9` (stone-50, warm paper) | `#000000` (AMOLED true black) |
| Body text | `text-stone-900` | `text-stone-100` |
| Card border | `border-stone-200` | `border-stone-800` |
| Muted text | `opacity-70`/`opacity-60` | same |
| Accent (decorative) | `amber-600` `#d97706` | `amber-500` `#f59e0b` |
| Accent text on light | `amber-700` `#b45309` (≥4.5:1) | `amber-400` `#fbbf24` (>7:1) |

**Dark mode is media-based** (`prefers-color-scheme`), set by the Tailwind
config's default. Do **not** switch to class-based — every existing `dark:`
variant would silently break.

**Contrast rule:** `amber-600` on stone-50 is only ~3.4:1, so it's
**decorative only** on light (underlines, focus rings, chart strokes,
borders). For amber **text** on light use `amber-700`. Dark mode is fine
either way.

The cost calendar's amber heat ramp is already this scale. The shared
`colors.accent` alias in `tailwind.config.ts` is a greppable name for the
same color; pick whichever reads better in context.

## Typography

Three fonts, self-hosted at build via `next/font/google` (zero runtime
requests to Google).

| Variable | Family | Role | Where |
| --- | --- | --- | --- |
| `--font-sans` | **Inter** | UI chrome | Nav, buttons, badges, stat numbers, meta, calendar grid, all `text-xs`/`text-[10px]` |
| `--font-serif` | **Newsreader** (400/500/600 + italic) | Reading content | Page H1s, Mind section titles, **assistant chat bubbles**, insight body, **diary excerpts**, latest-insight preview, memory profile textarea |
| `--font-hand` | **Caveat** (500/700) | Sparse warmth | Nav wordmark, LockScreen H1 — **1–2 spots max** |
| `--font-mono` | system mono | Code | unchanged |

**Newsreader needs `leading-relaxed`** wherever it's used for paragraphs
(it has tighter default line-height than Inter). Already applied in the
serif map.

**Network posture:** `next/font/google` fetches `.woff2` files **at build
time** from Google and serves them from `.next/static/media/`. At runtime
the browser never hits `fonts.googleapis.com` or `fonts.gstatic.com`. The
Railway build container has outbound network access (it already fetches
npm packages), so this works. If a future tightened network policy ever
blocks Google during build, the build fails loudly — not a silent
regression.

### Where serif is **not** used

UI chrome stays sans for density: nav, every button, every badge, the
Memory settings page, error toasts, the cost calendar, the theme cloud,
entity rankings, `<details>` summaries. The serif/sans split exists to
distinguish *content you read* from *controls you operate*.

## Spacing & radius

- Radii: `rounded` (cards, buttons), `rounded-2xl` (chat bubbles, inputs),
  `rounded-full` (pills, icon buttons).
- No `shadow-*`. Shadows on AMOLED black render as grey halos — the flat
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

- Dark mode stays **media-based**.
- Fonts stay **self-hosted at build** (no runtime Google calls).
- Amber is **decorative-only on light** for non-text; amber-700 for text.
- Safe-area utilities preserved.
- `app/layout.tsx` stays a **server component** (it calls
  `isAuthenticated()` at request time).
- Map3D is untouched.
- Existing chat bubble shape and rhythm preserved — only typography
  changes (serif + `leading-relaxed` on assistant bubbles).
