# Chat with your diary on your Claude subscription (MCP setup)

Remarkabler has a built-in **MCP endpoint** at `/api/mcp`. Once connected,
Claude (the app at claude.ai / on your phone) and Claude Code can call your
diary tools directly — `search_diary`, `get_entries_by_date`, locations,
insights, and the rest — **billed to your Claude subscription, not the
pay-per-token API**. Your diary never leaves Railway; Claude fetches only
what each question needs.

Everything is read-only: nothing Claude does through this connector can
change or delete your notes.

## Step 1 — Create the secret token (once)

1. Make up a long random token (or generate one):
   - Easiest: use a password manager's generator, 32+ characters.
   - Or in any terminal: `openssl rand -hex 32`
2. In **Railway → your service → Variables**, add:

   ```
   MCP_AUTH_TOKEN=<your long random token>
   ```

3. Railway redeploys automatically. Done.

Without this variable the endpoint is **disabled** (it fails closed), so
there is no risk window before you set it. Tokens shorter than 16
characters are treated as unset.

## Step 2 — Connect the Claude app (claude.ai)

The claude.ai connector dialog only offers OAuth (there's no field for a
static token), so the endpoint speaks OAuth — but the "login" is just your
token. Do this once in a browser (phone Chrome is fine):

1. Go to **claude.ai → Settings → Connectors**.
2. Tap **Add custom connector**.
3. **Name**: anything (e.g. `Remarkabler`).
   **원격 MCP 서버 URL / Remote MCP server URL**:
   `https://<your-app>.up.railway.app/api/mcp`
4. **Leave the OAuth Client ID / Secret fields (Advanced) empty.** Tap **Add**.
5. A small **Remarkabler login page** pops up ("Remarkabler를 Claude에 연결").
   Paste your **MCP token** (the same `MCP_AUTH_TOKEN` value) and tap
   **연결 승인 / Approve**.
6. Claude finishes the connection automatically.

Behind the scenes: Claude registers itself, you approve once with the token,
and Claude gets its own access token — you never have to touch the token
again. To revoke everything, change or remove `MCP_AUTH_TOKEN` in Railway.

Now start a chat, enable the connector (tools menu), and ask something like
*"Search my diary for what I wrote about Jeju."* Tip: ask it to call
`get_profile` first — that's the same "understanding of you" your app's chat
uses.

Connectors are account-level: added once at claude.ai, they follow your
subscription across surfaces.

### Why OAuth (and not a simple header)?

The claude.ai **web** connector UI exposes only OAuth fields, so a header-only
server can't be added there and fails with *"couldn't register with sign-in
service."* The endpoint therefore implements a minimal OAuth 2.1 server
(discovery + dynamic client registration + PKCE) whose consent step reuses
your `MCP_AUTH_TOKEN` as the password. **Claude Code** (below) also accepts a
plain `Authorization: Bearer` header, so it can skip OAuth entirely.

## Step 3 — Claude Code

**Nothing extra is usually needed**: connectors you add at claude.ai are
automatically available in Claude Code when you're logged in with your
claude.ai subscription (both the CLI and web sessions — in web sessions
they're provisioned through Anthropic's proxy, so no network-allowlist
changes are required).

To attach it to the Claude Code CLI directly (independent of claude.ai):

```sh
claude mcp add --transport http remarkabler-diary \
  https://<your-app>.up.railway.app/api/mcp \
  --header "Authorization: Bearer <your token>"
```

Or declare it in a repo's `.mcp.json` (note: committing secrets is bad —
use env expansion):

```json
{
  "mcpServers": {
    "remarkabler-diary": {
      "type": "http",
      "url": "https://<your-app>.up.railway.app/api/mcp",
      "headers": { "Authorization": "Bearer ${MCP_AUTH_TOKEN}" }
    }
  }
}
```

## What Claude gets access to

The in-app chat's read-only tools (they stay in sync automatically), plus
three companion tools that make the subscription chat feel like the in-app one
— **except two sensitive tools that are OFF by default** (see the next
section):

- `get_profile` — the evolving profile of you (call first)
- `recall_memories` — durable things you've told Claude before (preferences,
  facts, intents) — the same "memory" the in-app chat carries between chats
- `get_guidance` — how to be your diary companion (tone + don't-make-things-up
  rules); Claude can read this once at the start
- `search_diary`, `get_entries_by_date`, `get_recent_entries`
- `get_day_summary`, `get_week_summary`, `get_month_summary`
- `top_entities`, `pages_for_entity`, `related_entities`
- `current_time_kst`
- `get_insights`, `get_writing_stats`, `count_entries_mentioning`
- `list_notebooks`, `get_notebook`

## Saving conversations into your Obsidian wiki (OFF by default)

There's an optional **write** tool, `export_conversation`, that lets Claude
save the **full text** of a subscription conversation into your diary's
Obsidian vault (via Dropbox) — one Markdown note per conversation, verbatim
(nothing summarized). Over time you get a browsable record of your Claude
conversations alongside the diary.

It is **OFF by default** — the endpoint stays fully read-only unless you turn
this on. To enable it, set in Railway:

```
MCP_ALLOW_CONVERSATION_EXPORT=true
```

Requirements + how it behaves:
- Needs Dropbox export enabled (the same `files.content.write` scope as the
  diary auto-export — see `/memory`). Notes land under `Conversations/` in your
  export folder.
- **Add-only**: it can only *add* a conversation record and *create* a note —
  it never edits or deletes your diary or anything else. The content is written
  verbatim as plain text.
- **Not automatic**: Claude has to *choose* to call it (nudge it: "save this
  conversation"). We can't tap the transcript ourselves.
- ⚠️ **Privacy tradeoff**: with this on, your subscription conversations are no
  longer ephemeral — the full text is stored in Remarkabler and written to your
  vault. That's the opposite of the read-only default's privacy; enable it only
  if you want that permanent record.

## Saving an independent reflection (OFF by default)

A second, separate optional **write** tool, `save_reflection`, lets Claude save
a **standalone reflection it wrote about you** — not a conversation transcript.
Use it for asks like *"give me an honest, independent take on who I am"*: any
Claude with this connector (subscription-Claude in the app, Claude Code, or a
scheduled Routine) can read your diary and file its own written reflection,
landing under a separate `Reflections/` folder so it's never confused with a
real exported chat.

It has **its own flag**, independent of `MCP_ALLOW_CONVERSATION_EXPORT` — saving
a verbatim conversation and saving Claude-generated reflective content are
different privacy tradeoffs, and you may want one without the other. To enable
it, set in Railway:

```
MCP_ALLOW_REFLECTION_SAVE=true
```

Requirements + how it behaves:
- Same Dropbox prerequisite as conversation export (`files.content.write`
  scope). Notes land under `Reflections/` in your export folder, filed within
  seconds of being saved (fire-and-forget, same as `export_conversation`).
- **Add-only**: it can only *add* a reflection record and *create* a note.
- **Not automatic**: Claude has to *choose* to call it — just ask for a
  reflection and tell it to save it.
- The tool's own instructions hold Claude to a standard: ground every claim in
  specific diary evidence, no empty flattery, and name the limits of
  diary-based inference rather than overclaiming.
- ⚠️ Same privacy tradeoff as conversation export: this content becomes a
  permanent record in your vault, not an ephemeral chat.
- Can be linked into your entity wiki the same way conversations can — see
  the next section.

## Saving a Decision Record (OFF by default)

A third optional **write** tool, `save_decision`, lets Claude record a
**decision** you made (or reached together) as a structured, durable note —
obsidian-mind's "Decision Record" idea. Use it when something was actually
*decided* ("we're deferring the ETF allocation", "going with option B"):
Claude writes what was decided, the reasoning, and the alternatives, filed
under a separate `Decisions/` folder.

Its **own flag**, independent of the reflection/conversation flags:

```
MCP_ALLOW_DECISION_SAVE=true
```

Same behaviour as `save_reflection`: same Dropbox `files.content.write`
prerequisite, add-only, filed within seconds, auto entity-linked (a decision
about a project/person shows up connected to it in your graph, and gets a
`## Connects to` section), and it appears on `Home.md`'s counts + "Recent
decisions". Not automatic — Claude calls it when you tell it to record a
decision.

## Writing your diary by conversation (OFF by default)

The other three write tools file into the *vault* but stay OUT of your actual
diary. `save_diary_entry` is different: it writes a **real diary entry** — one
you composed by talking to Claude instead of handwriting it. It fully counts:
it feeds your profile, your Mind analytics, your writing streak/heatmap, your
day files, and your entity graph, exactly like a scanned handwritten page.

Its **own flag**:

```
MCP_ALLOW_DIARY_WRITE=true
```

How it behaves:
- Entries land in a **separate "Chat diary" notebook**, so handwritten vs
  talked entries stay distinguishable — but both count as diary.
- The tool's instructions tell Claude to **write in your own first-person
  voice** (your day, grounded in what you said — not Claude's commentary) and
  to **show you the draft and get your approval before saving**. So the normal
  flow is: talk about your day → Claude drafts the entry → you say "yes, save
  it" → it's saved.
- Optional `date` (defaults to today) and `entry_id` (re-use to *edit* an entry
  instead of adding a new one).
- Because it's a real diary write (it updates your profile + analytics, not
  just a vault file), it has a broader effect than the vault-only tools above —
  which is exactly the point. It's still off by default and destination-fixed
  (you supply the text; Remarkabler decides where it lands).

Unlike the Dropbox-vault tools, this one does **not** require the Dropbox write
scope — the entry is saved to your database regardless; the Dropbox day file
just also updates if you have the export on.

## Linking conversations, reflections, and decisions into your entity wiki (OFF by default)

Once conversations/reflections/decisions are being saved (above), a second optional
piece links them into the same wiki your diary already builds — so a person
or place you discussed with Claude, that came up in a reflection, or that a
decision concerns, shows up connected to your diary's people/places/projects,
not sitting in an isolated note.

**Step 1 — turn on linking.** In Railway, set:

```
MCP_ALLOW_WIKI_LINKING=true
```

Off by default — the endpoint has no extra exposure until you set this.

**Step 2 (recommended) — make tagging guaranteed, not opportunistic.** Also set:

```
MCP_AUTO_TAG_EXPORTS=true
```

With both flags on, Remarkabler tags every export **itself** — it calls
Claude (its own API budget, not your subscription) right after
`export_conversation`/`save_reflection`/`save_decision` saves, so a
conversation, reflection, or decision is linked within seconds, every time,
with nothing for any Claude session to remember to do. This mirrors how your
diary's own pages already get tagged on upload. Leave `MCP_AUTO_TAG_EXPORTS`
off and only `MCP_ALLOW_WIKI_LINKING=true` set if you'd rather keep tagging
entirely on your own Claude subscription (see the librarian below) instead of
this app's API budget — that's the previous, fully-opportunistic behavior.

You can check it's working on `/memory`, under "Conversation librarian" — it
shows the last time a tag/note write happened.

**Optional — the librarian agent, for enrichment beyond a mechanical tag.**
Once `MCP_ALLOW_WIKI_LINKING=true` is on, the vault write tools nudge any
connected Claude to enrich what the mechanical tagger cannot judge. For
conversations, it can call `relate_entities` to record typed assertions such
as `works_at`, `lives_in`, or `friend_of`. For any entity, it can call
`get_entity_wiki` and then `update_entity_conversation_notes` for anything
worth *remembering*, not just tagging. This is genuinely optional now that
auto-tag guarantees the base case; skip it if you don't want extra tool calls
per export.

If you want a periodic catch-up pass too (useful mainly for conversations
exported before you turned any of this on, or if you're running WITHOUT
`MCP_AUTO_TAG_EXPORTS`), either just ask any connected Claude "catch up on
unlinked conversations" occasionally, or — if your Claude plan has persistent
Routines/scheduled tasks in its own Settings (a claude.ai account feature,
separate from anything Remarkabler runs) — set one up with a prompt like:

> You are the diary librarian. Using the Remarkabler MCP connector: call
> `list_unlinked_conversations`. For each one, call `get_conversation` to
> read its full text, decide which people/places/projects it mentions, call
> `get_entity_wiki` for each to see what's already recorded, then call
> `tag_conversation_entities` with what you found (an empty list is fine if
> nothing applies) and, only if there's something new worth keeping,
> `update_entity_conversation_notes`. If the conversation clearly states how
> two named entities relate, call `relate_entities` with the full set of
> relationship assertions for that conversation using only the supported
> predicate values; pass an empty list if there are none or if you're
> correcting prior assertions away. Do not create a relationship to "the
> author" or infer one from vibes. Always finish by calling
> `record_librarian_heartbeat`, even if there was nothing to do.

A low frequency (once a day, or even manually) is enough for a catch-up
sweep. (This catch-up prompt only covers conversations — reflections and
decisions are tagged automatically when `MCP_AUTO_TAG_EXPORTS` is on, which is
why that flag is the recommended default.)

Requirements + how it behaves:
- The session needs the Remarkabler MCP connector available — same connector
  as Step 2 in this guide. If you've already added it for the app/Claude Code,
  a new session under the same account should already have access to it.
- **Deterministic destination, agent-supplied content only**: the tools let
  the agent tag entities and write its own notes, but the actual database
  row/file each write lands in is always computed by Remarkabler, never
  chosen by the agent — the same discipline `export_conversation` follows.
- Its notes are kept in a **separate section** from your diary's own
  Claude-written bio for that person/place/project ("Recent conversations"),
  so the two never overwrite each other.
- ⚠️ **`get_conversation` re-exposes full conversation content** you already
  chose to export — this is the one MCP read gated behind the same flag as
  the write tools, since it's new exposure the endpoint couldn't previously
  provide.
- If the connector ever seems to stop seeing a newly-deployed tool, a manual
  disconnect/reconnect of the Remarkabler connector (Step 2's dialog) forces
  a refresh — this is a platform behavior, not something Remarkabler controls.
- Once linked, a conversation/reflection/decision note gets a "## Connects to"
  section linking to the People/Places/Projects it mentions, and each of
  those entity pages gets a "## Related notes" section linking back. Typed
  relationship assertions render as `## Relationships` in entity pages.
  Obsidian shows the connected nodes; the relationship labels live in the note
  body, not as graph-edge labels.

## Sensitive tools are OFF by default

Two tools are **excluded from this connector by default** — the in-app chat
still uses them fully, but the subscription door hides them unless you turn
them on:

- **`get_recent_locations`** — this returns a *timestamped movement schedule*
  (where you sleep and work, when the house is empty). Combined with the
  diary, that's the difference between a privacy leak and a physical-safety
  risk. If your claude.ai account were ever taken over, an attacker could
  simply ask "where is this person, and when." Keeping location in the in-app
  chat only removes that door.
- **`search_chat_history`** — your raw in-app conversations, often more
  revealing than the diary itself.

To expose them anyway (e.g. you want to ask "where was I last Tuesday?" from
the Claude app), set in Railway:

```
MCP_ALLOW_SENSITIVE_TOOLS=true
```

Leaving it unset keeps them hidden — **forgetting the setting fails safe.**

## Security notes

- The token is the only lock on this door — treat it like a password. To
  revoke access instantly, change or remove `MCP_AUTH_TOKEN` in Railway.
- **Token rotation without downtime**: `MCP_AUTH_TOKEN` accepts several
  tokens separated by commas. To rotate: set `old,new`, update the
  connector to the new token, then remove the old one. **Rotating fully
  revokes the old connection** — any OAuth access/refresh tokens Claude was
  issued under the old value stop working the moment you drop it (they're
  bound to the secret that authorized them). So changing the token — not only
  removing it — is a real "log everyone out."
- **Brute-force protection**: an IP that keeps sending wrong tokens gets
  blocked (HTTP 429) for a cooling-off window. Requests with the correct
  token are never blocked, so an attacker can't lock you out.
- **Audit trail**: every tool call and every failed attempt is recorded in
  the `mcp_audit` table (capped at the most recent 2,000 rows), so you can
  always check what came through this door. Failed attempts also show in
  Railway's deploy logs (`[mcp] failed auth attempt from <ip>`).
- **Sensitive tools off by default**: `get_recent_locations` and
  `search_chat_history` are hidden unless `MCP_ALLOW_SENSITIVE_TOOLS=true`
  (see the section above). The allow flag is the only way to expose them —
  `MCP_EXCLUDE_TOOLS` cannot re-include them.
- **Scope control**: set `MCP_EXCLUDE_TOOLS` (comma-separated tool names) to
  remove *additional* tools from the MCP surface without a code change.
- The endpoint is separate from the app's passcode/passkey lock
  (`APP_PASSCODE`); the token replaces it for this route.
- Everything is read-only, and failures are contained: a wrong token gets
  401, no token configured means the endpoint is off (503), repeated
  failures get 429.
- Your diary text is only ever sent to Anthropic (same as the app's own
  chat) — no third parties.

## Troubleshooting

- **Connector won't add / "connection failed"**: check the URL ends with
  `/api/mcp` and the app is deployed and awake.
- **401 Unauthorized**: header value must be `Bearer <token>` with a space,
  and must match `MCP_AUTH_TOKEN` in Railway exactly.
- **503 disabled**: `MCP_AUTH_TOKEN` isn't set (or is under 16 chars).
- **Tools listed but empty answers**: the tools query the same DB as the
  app — if the app's own chat can see the entries, so can MCP.
