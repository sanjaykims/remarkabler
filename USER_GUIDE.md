# Remarkabler — User Guide

Welcome. Remarkabler is your **private AI companion that grows with you.**
You feed it your handwritten notes (and, if you like, where you've been), and
it builds an evolving understanding of who you are — so you can ask it
questions and get answers that actually know *you*, not generic advice.

Everything stays yours: your notes, your diary, your data. Nothing is shared
except the calls to Claude (the AI) that you choose to make.

---

## The big idea in one breath

> You write by hand on your reMarkable → export the page as a PDF → upload it
> here → Claude reads it and quietly updates its "memory of you" → you chat
> with something that remembers your life.

You don't have to manage any of that. Upload and talk. The rest is automatic.

---

## First time: unlocking the app

If your app is private (a lock is turned on), the first screen asks you to
unlock.

- **On your phone**, you'll use your **fingerprint (Android)** or **Face ID
  (iPhone)**. The first time on a new phone, tap **"Set up this phone"** and
  enter your passcode once to register that device. After that, it's just your
  fingerprint / face.
- **The passcode** is your backup. Use it if the fingerprint/face prompt
  doesn't appear.

Once you're in, a successful unlock keeps that device open for **7 days**. The
app **re-locks automatically** whenever you switch away from it, so it's
private even if you hand someone your phone.

---

## The tabs at a glance

| Tab | What it's for |
|---|---|
| **Remarkabler** (home) | Your dashboard: counts, what's transcribing, the latest insight, recent notebooks. |
| **Notebooks** | Upload reMarkable PDFs and watch them get transcribed. |
| **Chat** | Ask anything — it answers from its memory of you. |
| **Insights** | On-demand reflections about you, building over time. |
| **Mind** | Your diary visualized — a writing heatmap, your themes, your mood over time, and a map of the people/places/projects you write about. |
| **Memory** | See and edit what it understands about you; connect extra sources (Dropbox, reMarkable cloud, GitHub, location); manage the Obsidian export and the Claude-app connector. |
| **Cost** | A calendar of how much you've spent on Claude. |

---

## 1. Feeding your notes (the core loop)

This is the heart of the app.

1. On your **reMarkable**, open a notebook → menu → **Export** / **Save as
   PDF**. Get that PDF onto your phone (reMarkable cloud, email, or the share
   button — see the tip below).
2. Open the **Notebooks** tab → tap **Choose file** → pick the PDF → upload.
3. The notebook appears with a **"Transcribing…"** status. You can leave the
   page; it keeps working in the background and updates itself when done.
4. When it finishes, Claude has read every page **and** folded what it learned
   into its memory of you.

**Multiple at once.** You can select **several PDFs** in the file dialog, or
share several from the reMarkable app at once — they all upload together and
transcribe independently. The page shows "Uploaded N notebooks" and lists
anything skipped (wrong type, too large).

**Tip (Android):** You can also **share a PDF straight from the reMarkable app
to Remarkabler** using your phone's share button — it starts transcription
automatically, no manual upload.

### Two automatic ways in (so you never have to upload)

Manual upload always works, but you can also let notes arrive on their own:

- **Dropbox (one tap on the tablet).** With reMarkable Connect, on the tablet
  tap **Share → Export to integration → Dropbox**. Remarkabler watches that
  Dropbox folder and transcribes new PDFs by itself — no phone step at all.
  This is the reliable automatic path.
- **reMarkable cloud sync (zero taps).** On the **Memory** tab you can pair
  your reMarkable once and switch on **Auto-sync** for the folders you choose.
  After that, you just **write and close the cover** — Remarkabler notices the
  new or changed pages and transcribes them in the background. (This uses
  reMarkable's unofficial cloud, so it's a bonus on top of the dependable
  Dropbox path, not a replacement.)

---

## 2. Chatting with it

Open the **Chat** tab and just ask. Because it reasons over its **memory of
you** (plus a few relevant excerpts from your notes), answers are personal —
not a generic summary.

- **Attach** a photo or PDF with the paperclip if you want Claude to look at
  something.
- **Speak** (mic button) to ask out loud; it can read the answer back.
- **Clear** hides the conversation from view for privacy. The messages aren't
  deleted — they're archived and still inform future answers, so the
  conversation continues seamlessly.
- Sometimes you'll see a small **"via Haiku — main model was busy"** label
  under a reply. That means the main chat model was briefly overloaded and the
  app used the cheaper fallback for that one message. The next message goes
  back to the main model automatically.

Example questions:
- *"What have I been worrying about lately?"*
- *"Where did I go yesterday and how long was I at each place?"*
- *"Based on my notes, what should I focus on this week?"*

---

## 3. Insights

The **Insights** tab is where Claude reflects on everything — your notes and
your chats — and writes down what it notices about you. Each new entry builds
on the last, so it becomes a growing record over time.

- Tap any row to expand it.
- **Copy** or **Export** to save all your reflections as text.

Insights are generated on demand (when you ask), because they're a deeper, more
expensive reflection than everyday chat.

---

## 4. Mind — your diary, visualized

The **Mind** tab turns your diary into pictures, so you can *see* patterns you'd
never spot reading entries one by one. It's all free to look at (nothing new is
sent to Claude when you open it):

- A **writing heatmap** — which days you wrote, and how much.
- Your **themes** — the topics that come up most.
- Your **mood over time** — a gentle line of how positive or heavy your
  entries have felt.
- A **map of your people, places, and projects** — who and what you write
  about, and which of them show up together.

You can also tidy up the entities here (for example, merge "Mom" and "Mother"
into one person), and tap **"Build life wiki"** to have Claude write a short
biography of each important person/place/project from everything you've written
about them.

---

## 5. Memory — the "profile of you"

The **Memory** tab shows you, in plain language, **what Remarkabler currently
understands about you.** This is the AI's living memory, updated automatically
each time you feed it a notebook.

You can:
- **Read** it any time.
- **Edit / correct** it if something's wrong or you want to add context.
- **Rebuild** it from all your notes if you want a fresh pass.

This is also where you connect the extra memory sources below.

---

## 6. Extra memory sources (optional)

### Discipline (GitHub)

If you keep notes in a private GitHub repository, you can connect it so its text
files become part of your memory. On the **Memory** tab, tap **Sync now** to
pull the latest. (This needs to be configured once with access details — see
the setup appendix.)

A **"Share discipline notes with Remarkabler"** toggle in the same section lets
you stop feeding these notes to Claude at any time. When off, Sync is disabled
and your discipline pages are filtered out of every chat answer; past entries
stay in the database and reappear the moment you flip it back on.

### Location — two ways

A **"Share location with Remarkabler"** toggle at the top of the Location
section lets you stop sharing location with the app at any time. When off, the
ingestion endpoints reject new data, the chat prompt no longer includes your
recent route, and the weekly memory distill (below) is skipped. Past entries
remain in your database — turning it back on restores everything.

Remarkabler can know where you've been, so you can ask about your days.

1. **Log my location** (one tap, manual)
   On the Memory tab, tap **Log my location** to record where you are *right
   now*, with the time. **One tap = one place.** It can't track in the
   background, so it only remembers when you tap.

2. **Auto route (OwnTracks)** — *recommended for the full daily route*
   A companion phone app that quietly reports your location all day, so
   Remarkabler can reconstruct **where you went and how long you stayed** —
   automatically, no taps. Setup is in the next section.

**Weekly location distill.** Once a week, when you chat, Remarkabler quietly
folds your recent route into your evolving memory — *patterns only* (routines,
where you spend most of your time, notable changes), never raw stops. It runs
in the background, costs one Opus call a week, and is skipped entirely when
the share toggle is off.

---

## Setting up OwnTracks (automatic daily route)

You need your app's web address and the secret token your operator set
(`OWNTRACKS_TOKEN`). Your full link is:

```
https://YOUR-APP-ADDRESS/api/owntracks?token=YOUR_TOKEN
```

**On Android:**
1. Install **OwnTracks** from the Play Store.
2. On first launch, allow location **"All the time"** (background tracking
   needs this).
3. Turn off battery optimization for OwnTracks (Settings → Apps → OwnTracks →
   Battery → **Unrestricted**) so Android doesn't stop it.
4. Open OwnTracks → menu (☰) → **Preferences → Connection**.
5. **Mode** → **HTTP**.
6. **Host** → paste the full link above.
7. **Identification** → set any Username and Device ID; leave the password
   blank.
8. Back out, then set **Reporting** to **Significant** or **Move**.
9. Tap the upload icon once to send your first point.

**On iPhone:** same idea — install OwnTracks, allow location **"Always"**,
Settings → **Mode: HTTP** → paste the link → set any UserID → Reporting:
**Significant**.

**Check it worked:** Memory tab → **Auto route (OwnTracks)** — the points count
should climb and show a "last received" time.

---

## Your diary as an Obsidian "second brain" (optional)

If you connect **Dropbox** (with write access), Remarkabler doesn't just keep
your diary in its own database — it also writes it out as a proper, browsable
**Obsidian vault** in your Dropbox. You never edit these files by hand;
Remarkabler keeps them current automatically. You get:

- **One note per day**, with your entries and clickable links to the people,
  places, and projects you mentioned.
- **A page for each person, place, and project**, with a short Claude-written
  bio and links back to every day you mentioned them.
- **A `Home` dashboard**, plus **People / Places / Projects** index pages and a
  **Profile** page — so opening your vault feels like opening a real "second
  brain," not a pile of files.

To turn it on: **Memory** tab → the Dropbox section → **"Auto-save diary
Markdown"** → **Turn on** (it'll tell you if you need to enable write access in
Dropbox first). There's an **"Export now"** button to sync everything
immediately.

## Talk to your diary from the Claude app (optional)

You can reach your diary from your **Claude subscription** — the **claude.ai
app** or **Claude Code** — instead of only the in-app Chat tab. That means you
can chat about your life using the plan you already pay for, no per-message API
cost.

Once your operator sets it up (a secret token — see the appendix), you add
"Remarkabler" as a **connector** in the Claude app. Then you can ask Claude
things like *"what have I been focused on this month?"* and it reads your diary
to answer. By default it's **read-only** — it can look, not change anything.

Four optional extras your operator can switch on, each with its own setting:

- **Write your diary by talking** — instead of handwriting, just *tell Claude
  about your day*. It drafts a diary entry in your own voice, **shows it to you,
  and saves it only once you say yes.** This is a **real diary entry** — it
  counts toward your profile, your Mind charts, and your writing streak, exactly
  like a handwritten page. (Talked entries are kept in a separate "Chat diary"
  notebook so you can always tell them apart from handwritten ones.) Great for
  the days you don't feel like writing by hand but still want to capture.
- **Save a reflection** — ask Claude for *"an honest, independent take on how
  I'm doing"* and tell it to save; it files a **Reflection** into your vault.
- **Save a decision** — say *"we decided X because Y — save that as a
  decision"* and it files a **Decision Record**.
- **Auto-linking** — anything saved this way is automatically connected to the
  people and projects it's about, so it shows up in your graph.

Full setup lives in `docs/mcp-setup.md` (for whoever configures the app).

## Privacy controls — what you choose to share

Remarkabler is built so **every data source is a switch you control,** and
they all live in the **Memory** tab:

| Switch | When *off*, this happens |
|---|---|
| **Share location with Remarkabler** | Your location is not fed to Claude, the weekly memory distill is skipped, and incoming location data is rejected (OwnTracks and "Log my location"). |
| **Share discipline notes with Remarkabler** | Your synced GitHub notes are filtered out of every chat answer and Sync is disabled. |
| **Claude models** (next section) | You pick which model — and price — handles each task. |

Flipping a switch off keeps **past data in your own database** — it just stops
the flow to Claude. You can flip it back on any time and everything resumes.

## Choosing your Claude models

In the **Memory** tab's "Claude models" section there are three dropdowns —
you pay per call, so this is real-time cost control:

- **Chat** — what answers your daily questions. **Sonnet 4.6** is a good
  balance. Opus is most thoughtful (and most expensive); Haiku is cheap but
  shallower.
- **OCR & memory** — transcribes your handwriting and updates your evolving
  memory. **Opus is recommended** — errors here poison your memory
  permanently, so this is the worst place to cheap out.
- **Chat fallback** — used only when the chat model is briefly overloaded. A
  cheaper tier here means a busy chat still gets an answer (and you'll see the
  "via Haiku" label on that one reply).

The first option in each dropdown — *"Use Railway / default"* — clears your
in-app choice and falls back to whatever was set in the host's environment.

## Privacy & the lock

- The whole app (every page and every action) is gated behind your
  **fingerprint / Face ID**, with the passcode as backup.
- The lock is **only on when `APP_PASSCODE` is set** (see the env-vars table).
  If it's **not** set, the app is open to anyone with the link — and to make
  that impossible to miss, you'll see a **red "This diary is unlocked" banner**
  across the top of every page (and the server logs a warning at startup). The
  banner disappears the moment you set `APP_PASSCODE` and redeploy.
- It **re-locks the moment you leave it**, so a glance over your shoulder won't
  expose your diary.
- Your notes, diary, and location stay in your own database. The only data that
  leaves is what's sent to Claude to answer you.
- Sharing a PDF *into* the app still works even while locked (it's
  write-only — it can start a transcription but can't read anything back out).

---

## Cost

The **Cost** tab is an honest money tracker. Every Claude call records its
token usage and an estimated cost.

- A **month calendar** with this-month and all-time totals.
- **Tap any day** to see the breakdown by feature (transcription, chat,
  insights, memory).

Costs are *estimates* from list prices — the Anthropic console is the final
word — and only count usage since this feature was added. A typical chat
message costs around a cent; transcribing a long notebook costs more.

---

## Tips & FAQ

**Do I have to keep my notebooks in the app?**
No. Even if you delete a notebook, what Claude already learned from it stays in
its memory (the profile). Deleting only removes the page-by-page text.

**Does Claude see my whole life history every time I chat?**
No — that would be slow and expensive. It reasons over a **compact memory of
you** plus a few relevant note excerpts, and your **recent** location route
(last few days). Insights is the exception: it reflects over everything, on
demand.

**The AI got something about me wrong.**
Open the **Memory** tab and edit it directly, or rebuild it from your notes.

**Why English only?**
The app's interface, dates, and voice are set to English on purpose, so they
don't switch based on your phone's language.

**It only logged one place when I tapped "Log my location."**
That button records a single moment. For your *full* daily route, use
**OwnTracks** instead — it sends your location automatically all day.

---

## Appendix — for whoever sets up the app

Remarkabler is self-hosted (e.g. on Railway) with a persistent volume for its
database and PDFs. Behavior is controlled by environment variables:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | **Required.** Your Claude API key. |
| `CLAUDE_MODEL` | Model for OCR / insights / memory (e.g. an Opus model). |
| `CHAT_MODEL` | Optional. Cheaper model for everyday chat. |
| `CHAT_FALLBACK_MODEL` | Optional. Used if the chat model is busy. |
| `DATA_DIR` | Where the database + PDFs live (the mounted volume). |
| `APP_PASSCODE` | Set this to turn the private lock on. Unset = app is open (and a red warning banner nags you until you set it). |
| `VOYAGE_API_KEY` | Optional. Turns on smarter (meaning-based) diary search and the Mind map. |
| `DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET` / `APP_BASE_URL` | Turn on Dropbox auto-ingest and the Obsidian vault export. |
| `OWNTRACKS_TOKEN` | Set this to enable automatic location (OwnTracks). |
| `LOCATION_TZ_OFFSET` | Minutes from UTC for displaying local times (default 540 = Seoul). |
| `DISCIPLINE_REPO` / `DISCIPLINE_GITHUB_TOKEN` / `DISCIPLINE_BRANCH` | Connect a private GitHub notes repo. |
| `MCP_AUTH_TOKEN` | A long secret that turns on the read-only Claude-app connector (`/api/mcp`). |
| `MCP_ALLOW_REFLECTION_SAVE` / `MCP_ALLOW_DECISION_SAVE` / `MCP_ALLOW_CONVERSATION_EXPORT` | Let the connector *save* reflections / decisions / conversations into the vault (each off by default). |
| `MCP_ALLOW_WIKI_LINKING` / `MCP_AUTO_TAG_EXPORTS` | Let saved content be linked into your entity graph, and have the app do that tagging automatically. |
| `NEXT_PUBLIC_POSTHOG_KEY` | Optional anonymous analytics (no note content is ever sent). |

The lock, Dropbox, location, GitHub sync, the Claude-app connector, and
analytics are all **off until their variables are set** — so you can turn the
app from fully open to fully private by adding or removing a single variable.
The full connector setup (including the security model) is in
`docs/mcp-setup.md`.
