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

Do this once, in a browser (phone Chrome is fine):

1. Go to **claude.ai → Settings → Connectors**.
2. Tap **Add custom connector**.
3. **URL**: `https://<your-app>.up.railway.app/api/mcp`
4. Open the **Request headers** section and add a header:
   - Name: `Authorization`
   - Value: `Bearer <your token>` — the word `Bearer`, a space, then the
     token. (If you paste just the bare token, that works too.)
5. Save. Leave the OAuth fields in Advanced settings empty — they are not
   needed.

Now start a chat in Claude, enable the connector for that chat (tools
menu), and ask something like *"Search my diary for what I wrote about
Jeju."* Claude will call your diary tools. Tip: ask it to call
`get_profile` first — that's the same "understanding of you" your app's
chat uses.

Connectors are account-level: added once at claude.ai, they follow your
subscription across surfaces.

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

All of the in-app chat's read-only tools (they stay in sync automatically),
plus `get_profile`:

- `get_profile` — the evolving profile of you (call first)
- `search_diary`, `get_entries_by_date`, `get_recent_entries`
- `get_day_summary`, `get_week_summary`, `get_month_summary`
- `top_entities`, `pages_for_entity`, `related_entities`
- `get_recent_locations`, `current_time_kst`
- `get_insights`, `get_writing_stats`, `count_entries_mentioning`
- `search_chat_history`, `list_notebooks`, `get_notebook`

## Security notes

- The token is the only lock on this door — treat it like a password. To
  revoke access instantly, change or remove `MCP_AUTH_TOKEN` in Railway.
- **Token rotation without downtime**: `MCP_AUTH_TOKEN` accepts several
  tokens separated by commas. To rotate: set `old,new`, update the
  connector to the new token, then remove the old one.
- **Brute-force protection**: an IP that keeps sending wrong tokens gets
  blocked (HTTP 429) for a cooling-off window. Requests with the correct
  token are never blocked, so an attacker can't lock you out.
- **Audit trail**: every tool call and every failed attempt is recorded in
  the `mcp_audit` table (capped at the most recent 2,000 rows), so you can
  always check what came through this door. Failed attempts also show in
  Railway's deploy logs (`[mcp] failed auth attempt from <ip>`).
- **Scope control**: set `MCP_EXCLUDE_TOOLS` (comma-separated tool names,
  e.g. `search_chat_history`) to remove tools from the MCP surface without
  a code change.
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
