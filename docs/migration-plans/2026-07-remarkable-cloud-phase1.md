# reMarkable Cloud Zero-Tap Ingest — Phase 1 & 2 Plan (REVIEW ONLY)

> **Purpose:** proposal for the rest of the "write on the tablet → close the
> cover → everything happens" feature. Phase 0 (pair + read-only listing)
> already shipped (PR #75). This document is for **Codex + human review
> before any Phase 1 code is written.** Nothing here is built yet. Open
> questions are collected at the end — those are where reviewer attention is
> most valuable.

## Context & goal

Today the user taps **Share → Export to integration → Dropbox** on the
reMarkable once per notebook; `lib/dropbox.ts` auto-ingests the rendered PDF.
The goal is to remove that tap: the tablet already auto-syncs every notebook
to reMarkable's cloud over WiFi, so the server should pull from there
directly.

**Phase 0 (done):** `lib/remarkableCloud.ts` pairs via a one-time code
(`rmapi-js`) and lists notebooks, read-only.

**Phase 1 (this plan):** render `.rm` → PDF on our server and ingest ONE
notebook on demand, behind a quality gate.

**Phase 2 (this plan):** poll the cloud on a schedule, page-hash-diffed, in
the maintenance sweep — the actual zero-tap loop.

**Non-negotiable:** this rides reMarkable's *unofficial* protocol, so it is
a SECONDARY source. The Dropbox one-tap path stays and is never removed. If
the protocol breaks, cloud ingest errors out (surfaced in UI) and nothing
else is affected.

## What's already proven (sandbox, this session)

- **Cloud read:** `rmapi-js` v10.1.1 — `register(code)` → device token;
  `listItems()` → entries with a per-doc content `hash`; `getDocument(id,
  hash)` → a **Uint8Array ZIP** of the notebook's raw files
  (`<docid>/<pageid>.rm`, `.content`, `.metadata`); `raw.getEntries()` gives
  **per-page hashes**; `raw.getRootHash()` gives an account-wide change
  cursor. No native deps. No built-in retry (we wrap it).
- **Render:** `rmc` (Python) renders `.rm` v6 → SVG; **SVG→PDF via
  `svglib`+`reportlab`** (pure pip — avoids Inkscape and system Cairo).
  Proven on real firmware-3.x samples. Two caveats: never use `rmc -t pdf`
  (needs Inkscape); patch `rmc`'s `RM_PALETTE` to add firmware-≥3.14
  highlighter color IDs (a `KeyError: 9` crashes those pages otherwise).
- **Deploy:** a multi-stage **Dockerfile** (base
  `nikolaik/python-nodejs:python3.11-nodejs20`) builds the app, bundles the
  renderer, boots with a working `better-sqlite3` binding and serves HTTP
  200. Image ≈ 2.15 GB. The renderer wrapper `rm2pdf INPUT.rm OUTPUT.pdf` is
  on PATH inside the image.

## The core design problem: notebooks are LIVING documents

This is the crux and the biggest divergence from the Dropbox path — **the
reviewer should scrutinise this most.**

- **Dropbox path:** each export is a *frozen* PDF. `createNotebook` saves it,
  `processNotebook` OCRs all pages once, done. One notebook = one immutable
  artifact.
- **Cloud path:** one reMarkable notebook is a *single, continuously growing*
  document. Day 1 it has 3 pages; day 5 it has 8; you might edit page 2.
  Naively re-ingesting the whole notebook on every change would (a) re-OCR
  every page every time — expensive and slow — and (b) duplicate diary
  entries.

**So cloud ingest needs an incremental, page-addressable pipeline**, not the
"one immutable PDF" model:

- Track each reMarkable **page** by its stable `pageId` (uuid) and its
  content `hash`.
- On sync, diff: render + OCR only pages whose hash is new or changed;
  leave unchanged pages untouched; handle deleted pages.
- A cloud notebook maps to a `notebooks` row; its pages map to `pages` rows
  keyed by reMarkable pageId (not `notebookId:index`, because inserting a
  page shifts indices).

This is real schema + pipeline work and is the main reason Phase 1 is gated.

## Phase 1 — render + single-notebook ingest (quality-gated)

### 1a. Deployment switch (highest risk)
- Add the proven `Dockerfile` + `.dockerignore` to the repo.
- Flip `railway.json` `"builder": "NIXPACKS"` → `"DOCKERFILE"`. **This changes
  how the entire app builds/deploys, not just this feature.**
- Consider `next.config` `output: "standalone"` to cut the 2.15 GB image.
- **Recommended rollout: land the Dockerfile in its own PR and flip
  `railway.json` as a deliberate, separate step — verify the app still boots
  and the `/data` volume is intact BEFORE any render/ingest code is live.**
  (Rollout choice is the user's; see open questions.)

### 1b. Renderer module
- `lib/rmRender.ts`: `renderRmPageToPdf(rmBytes) : Promise<Uint8Array>` and
  `renderNotebookToPdf(pages: rmBytes[]) : Promise<Uint8Array>` — shells out
  to the bundled `rm2pdf` via `child_process` (temp files under DATA_DIR),
  merges per-page PDFs (pypdf/reportlab). Per-page fail isolation: a page
  that fails to render is skipped + flagged, never kills the notebook.
- Ship the `RM_PALETTE` patch inside the image (or a post-install step).

### 1c. Download + assemble
- `lib/remarkableCloud.ts` gains `downloadNotebook(id, hash)`: `getDocument`
  → unzip (jszip, already a transitive dep) → ordered list of
  `{pageId, rmBytes}` using `.content`'s page order.

### 1d. On-demand ingest + QUALITY GATE
- A "Import this notebook now" button next to each listed notebook (Phase 0
  UI already lists them).
- **Gate:** import one notebook via the cloud path, then have the user
  compare its OCR to the same notebook imported via Dropbox (or just read
  it). If cloud-rendered handwriting OCRs materially worse, **stop here** —
  Phase 2 doesn't ship. We've added a renderer + a manual button, lost
  nothing, Dropbox still primary.
- For Phase 1 the on-demand path may render the WHOLE notebook to a PDF and
  reuse the existing `createNotebook`/`processNotebook` unchanged (simplest
  way to validate quality). Incremental page-diffing is a Phase 2 concern.

## Phase 2 — scheduled zero-tap polling

### 2a. Incremental sync engine
- New `remarkable_pages` tracking (or columns on `pages`): `remarkable_page_id`,
  `remarkable_page_hash`, `remarkable_doc_id`. Dedupe key per page = pageId.
- Poll loop (mirrors `lib/dropbox.ts` guards: in-flight bool, 5-min interval,
  30-min failure backoff, per-item error taxonomy):
  1. `raw.getRootHash()` — if unchanged since last poll, **skip everything**
     (cheap fast-path).
  2. `listItems(true)` → for each notebook, compare doc `hash` to stored.
  3. Changed/new notebook → `raw.getEntries()` → diff per-page hashes →
     render + OCR only changed pages → upsert those `pages` rows → refresh
     embeddings/analysis/entry-date for them → regenerate the affected
     per-day Dropbox markdown (reuse existing export).
- Wire one `void getMaybeSyncRemarkable()()` into `runMaintenanceSweep`
  (lazy require, like Dropbox).

### 2b. Cross-source dedupe
- If the user ALSO exports the same notebook to Dropbox, it must not ingest
  twice. Proposal: when a notebook is cloud-managed (has a
  `remarkable_doc_id`), the Dropbox path skips a file whose name matches, or
  we key both sources so one wins. **Needs a decision (open question).**

### 2c. "Quiesce" window
- Don't ingest a notebook edited in the last N minutes (avoid OCR'ing a
  mid-writing session repeatedly). Use `lastModified`/`lastOpened`.

## Files (anticipated)

- New: `Dockerfile`, `.dockerignore`, `lib/rmRender.ts`.
- Modified: `railway.json` (builder), `next.config.mjs` (maybe standalone),
  `lib/remarkableCloud.ts` (download + sync engine), `lib/notes.ts` (sweep
  wiring + possibly an incremental ingest variant), `lib/db.ts` (page-hash
  columns + index), `app/memory/page.tsx` (import button + sync status),
  new API route(s) for on-demand import.
- Tests: page-diff logic (pure), zip-unpack ordering, render-failure
  isolation, cross-source dedupe.

## Risks

1. **Dockerfile switch breaks the deploy.** Mitigation: separate PR, flip
   as a discrete verified step, keep the Nixpacks config in git history to
   revert instantly.
2. **Protocol breakage (unofficial API).** Mitigation: secondary source;
   Dropbox fallback; errors surfaced, backoff on failure.
3. **Incremental correctness** (double entries, index churn, deletes).
   Mitigation: page-id keying; the bulk of the test suite targets this.
4. **OCR cost creep** if diffing is wrong and it re-OCRs everything.
   Mitigation: page-hash gate + rootHash fast-path; watch /usage.
5. **Render fidelity** on the user's real handwriting/firmware. Mitigation:
   the Phase 1 quality gate — we don't proceed if it's worse than Dropbox.
6. **Image size / deploy time** (2.15 GB). Mitigation: `output: standalone`,
   trim client-only 3D deps from the runner stage.

## Open questions for reviewers (Codex + Kimi)

1. **Rollout of the Dockerfile switch** — separate verified step vs one big
   PR? (Leaning separate.)
2. **Incremental model** — is page-id + page-hash upsert into the existing
   `pages` table the right shape, or should cloud notebooks live in a
   parallel table to avoid disturbing the Dropbox-sourced rows? Trade-offs?
3. **Cross-source dedupe** — how should a notebook that arrives via BOTH
   Dropbox and cloud be handled so entries aren't duplicated? Prefer cloud
   once paired? Match by name? By content?
4. **Deletes/moves** — if a page or notebook is deleted/trashed on the
   tablet, should we delete the corresponding diary content, or keep it
   (diary = append-only record)? Leaning keep, but flag.
5. **Quiesce window length** — how long after last edit before ingest, to
   avoid re-OCR of an in-progress session?
6. **Render path robustness** — `rmc`+`svglib`/`reportlab` vs keeping
   `cairosvg` (the other proven path) — any reason to prefer one for
   fidelity/维护?
7. **entry_date for cloud notebooks** — same handwritten-header parsing as
   Dropbox (now spaced-separator tolerant), or should cloud ingest fall back
   to the notebook's cloud `lastModified` when no header is present?
8. **Image size** — is `output: standalone` worth adopting now to keep
   Railway deploys fast, given the 2.15 GB image?

## Verification (when built)

- Each phase: `npm run lint` + `npm run build` + `npm test` green.
- Phase 1 gate: OCR of a cloud-rendered notebook vs its Dropbox twin, judged
  by the user on real handwriting.
- Phase 2: watch `/usage` for a week to confirm only changed pages get
  OCR'd; confirm no duplicate diary entries; confirm the Dropbox fallback
  still works with cloud enabled.
