# Feed Claude — reMarkable

A self-hosted Next.js app that:

1. Connects to your **reMarkable Paper Pro Move** via the official cloud sync.
2. Downloads your notebooks and renders each page.
3. OCRs handwritten pages with **Claude vision**.
4. Lets you **chat with Claude** over the full corpus of your notes.

Everything is stored locally in SQLite (`data/app.db`) and rendered PNGs in `data/files/`. No third-party servers besides Anthropic's API and reMarkable's cloud.

## Setup

```bash
cd remarkable-app
cp .env.local.example .env.local   # add your ANTHROPIC_API_KEY
npm install
npm run dev
```

Open <http://localhost:3001>.

### Connecting your reMarkable

1. Go to <https://my.remarkable.com/device/desktop/connect> and sign in.
2. Copy the 8-character one-time code.
3. Paste it on `/connect`. The device token is stored in `data/app.db` and persists across restarts.

### Syncing

On `/notebooks`, click **Sync + OCR**. The app will:

- Pull the notebook index from reMarkable cloud (`rmapi-js` `listItems`).
- For each notebook, fetch a server-rendered PDF and store it at `data/files/<notebook-id>/notebook.pdf`.
- Send the PDF directly to Claude as a `document` block — Claude returns per-page `{ text, summary }`.
- Index OCR output in a SQLite FTS5 table.

### Chatting

`/chat` builds a context bundle of every OCR'd page (truncated at ~150K chars) and sends it to Claude alongside your message + last 50 turns of conversation history.

For very large note collections, swap `buildNotesContext` in `lib/sync.ts` for a retrieval step that queries the `pages_fts` table for the top-K relevant pages per message.

## Architecture

- `lib/db.ts` — SQLite + FTS5 schema, key/value settings store
- `lib/remarkable.ts` — wraps [`rmapi-js`](https://www.npmjs.com/package/rmapi-js) for auth + notebook listing + rendering
- `lib/claude.ts` — Anthropic SDK calls for OCR and chat
- `lib/sync.ts` — orchestration: download → OCR → store → index
- `app/api/*` — Next.js route handlers, all `runtime = "nodejs"`
- `app/connect`, `app/notebooks`, `app/chat` — UI

## Known caveats

- **Notebook rendering is the fragile part.** `rmapi-js` upstream explicitly excludes server-side rendering. `getNotebookPdf` in `lib/remarkable.ts` first tries a typed `getPdf` method, then falls back to a raw call against the cloud's render endpoint. Both paths depend on what your installed `rmapi-js` version exposes and on the unofficial cloud endpoint staying stable. If you see "No PDF render path available", inspect the installed version (`npm ls rmapi-js`) and patch `getNotebookPdf` to use whichever export method it exposes (or shell out to the `rmapi` Go binary).
- **Claude reads PDFs natively.** OCR sends the notebook PDF straight to Claude as a `document` block — no client-side PDF→PNG splitting. This relies on the model accepting PDF input (Sonnet 4.x does).
- **Token usage**: full-corpus context can be expensive. Consider switching to retrieval (`pages_fts MATCH ...`) or Claude's prompt caching for repeated questions.
- **Auth tokens**: the device token in `data/app.db` is long-lived. Don't commit `data/`.

## Roadmap

- [ ] Verify / patch `getNotebookPdf` against the actual `rmapi-js` API on first install
- [ ] Incremental sync (skip unchanged notebooks via `hash` comparison)
- [ ] Retrieval-based context (FTS5 → top-K pages) instead of full dump
- [ ] Page viewer: click an OCR'd row to see the original PDF page
- [ ] Todo extraction: pull `[ ]` checkboxes into a separate task list
- [ ] Prompt caching on the notes context for cheaper follow-ups
