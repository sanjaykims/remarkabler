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
`get_profile` — **except two sensitive tools that are OFF by default** (see
the next section):

- `get_profile` — the evolving profile of you (call first)
- `search_diary`, `get_entries_by_date`, `get_recent_entries`
- `get_day_summary`, `get_week_summary`, `get_month_summary`
- `top_entities`, `pages_for_entity`, `related_entities`
- `current_time_kst`
- `get_insights`, `get_writing_stats`, `count_entries_mentioning`
- `list_notebooks`, `get_notebook`

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
