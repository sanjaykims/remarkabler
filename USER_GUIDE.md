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
| **Memory** | See and edit what it understands about you; connect extra sources (GitHub, location). |
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

**Tip (Android):** You can also **share a PDF straight from the reMarkable app
to Remarkabler** using your phone's share button — it starts transcription
automatically, no manual upload.

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

## 4. Memory — the "profile of you"

The **Memory** tab shows you, in plain language, **what Remarkabler currently
understands about you.** This is the AI's living memory, updated automatically
each time you feed it a notebook.

You can:
- **Read** it any time.
- **Edit / correct** it if something's wrong or you want to add context.
- **Rebuild** it from all your notes if you want a fresh pass.

This is also where you connect the extra memory sources below.

---

## 5. Extra memory sources (optional)

### Discipline (GitHub)

If you keep notes in a private GitHub repository, you can connect it so its text
files become part of your memory. On the **Memory** tab, tap **Sync now** to
pull the latest. (This needs to be configured once with access details — see
the setup appendix.)

### Location — three ways

Remarkabler can know where you've been, so you can ask about your days.

1. **Log my location** (one tap, manual)
   On the Memory tab, tap **Log my location** to record where you are *right
   now*, with the time. **One tap = one place.** It can't track in the
   background, so it only remembers when you tap.

2. **Upload location timeline** (your full history, manually)
   In **Google Maps**, open your Timeline → Settings → **Export Timeline
   data**, then tap **Upload location timeline** here. Remarkabler reads each
   stop — place, arrival/leave time, and how long you stayed — and feeds your
   recent route to chat.

3. **Auto route (OwnTracks)** — *recommended for the full daily route*
   A companion phone app that quietly reports your location all day, so
   Remarkabler can reconstruct **where you went and how long you stayed** —
   automatically, no taps. Setup is in the next section.

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

## Privacy & the lock

- The whole app (every page and every action) is gated behind your
  **fingerprint / Face ID**, with the passcode as backup.
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
**OwnTracks** or the **Google Timeline upload** instead.

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
| `APP_PASSCODE` | Set this to turn the private lock on. Unset = app is open. |
| `OWNTRACKS_TOKEN` | Set this to enable automatic location (OwnTracks). |
| `LOCATION_TZ_OFFSET` | Minutes from UTC for displaying local times (default 540 = Seoul). |
| `DISCIPLINE_REPO` / `DISCIPLINE_GITHUB_TOKEN` / `DISCIPLINE_BRANCH` | Connect a private GitHub notes repo. |
| `NEXT_PUBLIC_POSTHOG_KEY` | Optional anonymous analytics (no note content is ever sent). |

The lock, location, GitHub sync, and analytics are all **off until their
variables are set** — so you can turn the app from fully open to fully private
by adding a single variable.
