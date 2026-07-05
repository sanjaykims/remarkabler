# Connect Remarkabler to an Obsidian graph (phone guide)

Turn your handwritten diary into a live **graph of your life** in Obsidian:
every person, place, and project becomes a clickable node, wired to the days
you wrote about them. This is set up once and then updates on its own.

**How the pieces fit:** Remarkabler transcribes your reMarkable notes →
writes one Markdown file per day (plus a note per person/place/project) into
a Dropbox folder → the **Remotely Save** Obsidian plugin syncs that folder
into your vault → Obsidian's Graph view draws the network.

> **The one non-obvious catch:** the Remotely Save plugin can only see a
> *hidden* Dropbox folder at `/Apps/remotely-save/<your-vault-name>`, not an
> arbitrary Dropbox path. So we point Remarkabler's export straight at that
> folder. If your vault is named `Diary`, the folder is
> `/Apps/remotely-save/Diary`. Match your own vault name.

---

## 1. Install Obsidian + create a vault

1. Play Store → install **Obsidian** → open it.
2. **Create new vault** → name it (e.g. `Diary`) → **Device storage**
   (survives reinstalls) → **Create**. Remember this name — it's part of the
   folder path below.

## 2. Install the Remotely Save sync plugin

1. Settings (⚙️) → **Community plugins** → turn them on (safe).
2. **Browse** → search **Remotely Save** → **Install** → **Enable**.
3. Settings → **Remotely Save** → **Options**.
4. **Choose A Remote Service** → **Dropbox** → **Auth / Connect** → sign in →
   **Allow**.
5. Leave the **remote base directory** at its default (your vault name). Do
   NOT type a `/` — the plugin rejects slashes. Its real target is
   `/Apps/remotely-save/<vault-name>`.

## 3. Point Remarkabler's export at that folder

1. In Remarkabler → **Memory** page → **Dropbox** section.
2. Make sure **Auto-save diary Markdown** is **On** (needs the
   `files.content.write` scope on the Dropbox app + a reconnect — the page
   tells you if it's missing).
3. In **Destination folder**, type your app-folder path, e.g.:
   ```
   /Apps/remotely-save/Diary
   ```
   (match your vault name) → **Save**.
4. Tap **Export now**. When it succeeds it says "Syncing … in the
   background" with **no red error**. (There's no file count — a big diary
   syncs in the background so it can't time out. No error = success.)
5. Optional check: in the **Dropbox app**, open
   `Apps/remotely-save/<vault>` — you should see date files
   (`2026-06-19.md`) plus **`People`, `Places`, `Projects`** folders.

## 4. Sync into Obsidian and open the graph

1. Obsidian → open the left sidebar (top-left ⬜) → tap the **Remotely Save
   sync icon (circular arrows)** on the ribbon. Wait for "sync finished".
2. Your files (and the People/Places/Projects folders) appear in the vault.
3. Open **Graph view** (sidebar → the constellation icon). You'll see a dot
   per day and per entity, connected by mentions. Tap any person/place dot
   to open its page and see every day it appears.

## 5. Color-code the graph (optional, ~1 min)

Makes people vs. places vs. projects readable at a glance. This is an
Obsidian setting stored in *your* vault, so it's done here, not in the app:

1. In **Graph view**, tap the **⚙️ gear** (top of the graph).
2. Find **Groups** → **New group**. For each, type the query and pick a color:
   - `path:People` → blue
   - `path:Places` → green
   - `path:Projects` → orange
3. Under **Forces**, nudge **Repel** up a little to spread the dense center
   out; drop **Link force** slightly if it's too tight.

## Troubleshooting

- **"124 failed" / ByteString error on Export now** — you're on an old build;
  the fix that escapes non-ASCII (Korean) file paths shipped 2026-07-05.
  Wait for the deploy, then Export now again.
- **Sync runs but the vault is empty** — the Destination folder and the
  Remotely Save target don't match. Both must be
  `/Apps/remotely-save/<vault-name>` with the *same* vault name.
- **Nodes show but tapping one opens nothing** — the entity stub notes
  haven't synced yet. Export now in Remarkabler, then sync in Remotely Save
  again; the People/Places/Projects folders should appear.
- **A big `undated` hub in the center** — those are pages whose diary date
  didn't parse. They're still fully searchable; the hub just groups them.
