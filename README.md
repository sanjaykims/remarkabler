# Feed Claude — reMarkable

A self-hosted Next.js app that:

1. Takes a **PDF exported from your reMarkable** (Paper Pro Move or any model).
2. Transcribes every handwritten page with **Claude vision**.
3. Lets you **chat with Claude** over the full corpus of your notes.

Everything is stored locally: the SQLite database and uploaded PDFs live under
`data/` (or wherever `DATA_DIR` points). No third-party servers besides
Anthropic's API.

## Setup

```bash
cp .env.local.example .env.local   # add your ANTHROPIC_API_KEY
npm install
npm run dev
```

Open <http://localhost:3001>.

## Usage

1. On your reMarkable, open a notebook → menu → **Export** / **Save as PDF**.
   Get the PDF onto the device you're browsing from (reMarkable cloud, email,
   etc.).
2. On the **Notebooks** page, upload that PDF. Claude transcribes each page —
   this takes up to a minute depending on length.
3. On the **Chat** page, ask questions over everything you've transcribed.

## Architecture

- `lib/db.ts` — SQLite + FTS5 schema, key/value settings store
- `lib/claude.ts` — Anthropic SDK calls for PDF OCR and chat
- `lib/notes.ts` — ingest an uploaded PDF (OCR → store) and build chat context
- `app/api/notebooks` — list / upload (POST, multipart) / delete notebooks
- `app/api/chat` — chat endpoint
- `app/notebooks`, `app/chat` — UI

## Deployment

This app needs a **persistent disk** for the SQLite database and PDFs, so it
must run on a host that provides one (e.g. Railway, Fly.io) — not on a
serverless platform with an ephemeral filesystem.

- Set `ANTHROPIC_API_KEY` in the host's environment.
- Attach a persistent volume and either mount it at `<app>/data` or set
  `DATA_DIR` to the volume's mount path.
- `npm run start` respects the host-provided `PORT`.

## Notes & roadmap

- **Why PDF upload?** reMarkable's own export produces a correct, rendered PDF.
  There is no reliable JavaScript renderer for the raw `.rm` handwriting
  format, so the app relies on the device's export instead.
- OCR sends the whole PDF to Claude as a single `document` block (Claude reads
  PDFs natively — no client-side PDF→image splitting).
- Chat builds a context bundle of every transcribed page (truncated at ~150K
  chars). For very large collections, swap `buildNotesContext` in
  `lib/notes.ts` for a retrieval step over the `pages_fts` table.
- [ ] Optional automatic sync from the reMarkable cloud (would require a
  server-side `.rm` renderer)
- [ ] Retrieval-based chat context instead of a full dump
- [ ] Page viewer for the original PDF alongside the transcription
