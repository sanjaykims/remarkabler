import { createHash, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { CHAT_TOOLS, executeTool } from "@/lib/chatTools";
import { getCurrentProfile } from "@/lib/profile";
import { recallChatMemories } from "@/lib/chatMemory";
import {
  saveExportedConversation,
  MAX_CONVERSATION_CHARS,
} from "@/lib/conversationWiki";
import { isValidAccessToken } from "@/lib/mcpOauth";

// MCP bridge: exposes the SAME read-only diary tools the in-app chat uses
// (lib/chatTools.ts) over the Model Context Protocol, so Claude on the user's
// subscription (claude.ai custom connector, Claude Code) can reach the diary
// without per-token API billing. The tool list is derived from CHAT_TOOLS at
// runtime — add a chat tool and the MCP surface picks it up automatically, so
// the two can never drift. Everything here must stay READ-ONLY: no tool may
// mutate the DB or filesystem (see the "do not regress" rule in CLAUDE.md).
//
// Security posture (all fail-safe):
// - Auth: bearer token(s) from MCP_AUTH_TOKEN, timing-safe compare, fail
//   CLOSED when unset/too short. Comma-separated values allow zero-downtime
//   rotation (add new token, move clients, remove old).
// - Throttle: per-IP sliding window on FAILED auth only — a valid token is
//   never blocked (so an attacker spraying from a shared proxy IP cannot
//   lock the real user out), but guessing from one IP gets cut off.
// - Audit: every failed attempt and every tool call is recorded in the
//   mcp_audit table (size-capped), so there is always an answer to "what
//   came through this door, and when".
// - Scope: MCP_EXCLUDE_TOOLS can drop tools from the MCP surface (list AND
//   call) without a code change.

export type McpToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

// MCP-only extra: the compact self-model the in-app chat receives as system
// context. External Claude has no system prompt from us, so it's exposed as a
// tool the model can call to ground itself before answering.
export const PROFILE_TOOL_NAME = "get_profile";

const PROFILE_TOOL: McpToolDef = {
  name: PROFILE_TOOL_NAME,
  description:
    "Get the evolving profile of the diary's author — Claude's accumulated " +
    "understanding of who they are, built from their entire diary. Call this " +
    "first in a conversation to ground yourself before answering questions " +
    "about the person.",
  inputSchema: { type: "object", properties: {} },
};

// MCP-only: the durable chat-memory layer (chat_memories) — compact items the
// author has told Claude before (preferences, stable facts, recurring intents,
// unresolved threads), DISTINCT from diary entries. The in-app chat auto-recalls
// these every turn; external Claude gets no such injection, so it's a tool.
export const RECALL_TOOL_NAME = "recall_memories";

const RECALL_TOOL: McpToolDef = {
  name: RECALL_TOOL_NAME,
  description:
    "Recall durable things the author has told Claude in past conversations — " +
    "their stated preferences, stable facts about their life, recurring intents, " +
    "and unresolved threads. This is separate from diary entries (use search_diary " +
    "for those). Pass `query` describing what you want to remember about (a topic, " +
    "a person, or the user's current message); omit it to get the most recent " +
    "memories. Call this early so you sound like you already know them.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "What to recall about — a topic, person, or the user's current message. Optional.",
      },
    },
  },
};

// MCP-only: how to BEHAVE as this person's diary companion. The in-app chat has
// this as its system prompt; external Claude gets no system prompt from us, so
// the tone + anti-confabulation contract is exposed as a tool.
export const GUIDANCE_TOOL_NAME = "get_guidance";

const GUIDANCE_TOOL: McpToolDef = {
  name: GUIDANCE_TOOL_NAME,
  description:
    "Get guidance on HOW to be this person's diary companion — the tone and the " +
    "grounding/anti-confabulation rules the in-app assistant follows. Call this " +
    "once at the start of a conversation.",
  inputSchema: { type: "object", properties: {} },
};

// MCP-only WRITE tool (Phase B): the ONLY thing on this read-only endpoint that
// writes. It lets subscription-Claude export a full conversation so the API side
// can file it, verbatim, into the diary's Obsidian wiki. It is a deliberate,
// audited, ADD-ONLY exception to the read-only invariant, and it is OFF unless
// the operator explicitly opts in with MCP_ALLOW_CONVERSATION_EXPORT=true —
// forgetting config keeps the endpoint fully read-only (fail-safe). See the
// do-not-regress rule in CLAUDE.md.
export const EXPORT_TOOL_NAME = "export_conversation";

export function conversationExportEnabled(): boolean {
  return process.env.MCP_ALLOW_CONVERSATION_EXPORT === "true";
}

const EXPORT_TOOL: McpToolDef = {
  name: EXPORT_TOOL_NAME,
  description:
    "Save the FULL text of this conversation to the person's diary wiki so they " +
    "can look back on it later. Pass `content` = the complete conversation " +
    "transcript verbatim (both sides, in order), an optional `title`, and an " +
    "optional stable `conversation_id` (re-exporting with the same id updates the " +
    "same record). Do this at natural end points or when they say something worth " +
    "keeping. It is stored as-is — do not summarize.",
  inputSchema: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "The full conversation transcript, verbatim (required).",
      },
      title: { type: "string", description: "Short title for the conversation. Optional." },
      conversation_id: {
        type: "string",
        description:
          "Stable id for this conversation; re-export with the same id to update it. Optional.",
      },
    },
    required: ["content"],
  },
};

// Mirrors the in-app chat's persona contract (lib/claude.ts:staticGuidance),
// adapted for an external Claude that pulls context via tools instead of having
// it injected. Kept as advisory text — the model may or may not follow it.
const COMPANION_GUIDANCE = [
  "You are this person's personal diary companion. You know them through their",
  "diary and your past conversations — treat that as your memory of them, and",
  "answer with your honest, thoughtful opinion, not a bare summary.",
  "",
  "Ground yourself in what's real before answering about their life:",
  "- get_profile — your accumulated understanding of who they are (call first).",
  "- recall_memories — durable things they've told you before.",
  "- search_diary / get_entries_by_date / get_recent_entries — actual entries.",
  "- get_day_summary / get_week_summary / get_month_summary — prefer these for",
  "  \"how was [date/week/month]?\"; fall back to entries only for the raw words.",
  "- current_time_kst — call whenever they say \"today/yesterday/this week\"; you",
  "  don't know what today is otherwise.",
  "",
  "Be warm, direct, and specific. If you genuinely don't know, say so.",
  "",
  "Never fill a gap with a guess dressed as fact. If the tools are silent, say so",
  "plainly — don't invent a reason for the gap and don't wave it away. Answer only",
  "from what the tool results actually show. And don't turn a factual request",
  "(\"what did I do on X\", a list, a timeline) into an interview — answer what was",
  "asked; save the check-ins for when they're actually reflecting with you.",
  "",
  "Diary timestamps are written YYYY-MM-DD-HHMM-KST (Korea Standard Time, UTC+9).",
].join("\n");

// Tools whose output is dangerous under account takeover and are therefore
// excluded from the MCP surface BY DEFAULT (fail-safe): the subscription
// connector rides on the user's claude.ai account, so a compromised account
// can just *ask* for whatever these expose.
//   - get_recent_locations: a timestamped movement schedule (home/work, when
//     the house is empty) — turns an informational leak into a physical-safety
//     one. This must never be exposed by forgetting a setting.
//   - search_chat_history: raw in-app chats, often more revealing than the
//     diary itself.
// They come back only when the operator explicitly opts in with
// MCP_ALLOW_SENSITIVE_TOOLS=true. Forgetting config = safe. The in-app chat
// (lib/chatTools.ts) still uses these fully; only the MCP door hides them.
export const SENSITIVE_TOOL_NAMES = new Set<string>([
  "get_recent_locations",
  "search_chat_history",
]);

export function sensitiveToolsAllowed(): boolean {
  return process.env.MCP_ALLOW_SENSITIVE_TOOLS === "true";
}

// Manual exclusions from env (comma-separated names) — operator's own list.
export function excludedToolNames(): Set<string> {
  return new Set(
    (process.env.MCP_EXCLUDE_TOOLS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

// The effective exclusion set enforced everywhere: the manual list UNION the
// sensitive defaults (unless explicitly allowed). Both tools/list and
// tools/call key on this, so a hidden tool is also un-callable — the allow
// flag is the ONLY way a sensitive tool becomes reachable.
export function effectiveExcludedToolNames(): Set<string> {
  const excluded = excludedToolNames();
  if (!sensitiveToolsAllowed()) {
    for (const name of SENSITIVE_TOOL_NAMES) excluded.add(name);
  }
  return excluded;
}

export function mcpToolList(): McpToolDef[] {
  const excluded = effectiveExcludedToolNames();
  const tools: McpToolDef[] = CHAT_TOOLS.filter(
    (t) => !excluded.has(t.name)
  ).map((t) => ({
    name: t.name,
    description: t.description ?? "",
    // Anthropic's input_schema and MCP's inputSchema are both plain JSON
    // Schema — pass through verbatim.
    inputSchema: t.input_schema as unknown as Record<string, unknown>,
  }));
  if (!excluded.has(PROFILE_TOOL_NAME)) tools.push(PROFILE_TOOL);
  if (!excluded.has(RECALL_TOOL_NAME)) tools.push(RECALL_TOOL);
  if (!excluded.has(GUIDANCE_TOOL_NAME)) tools.push(GUIDANCE_TOOL);
  // The write tool appears ONLY when explicitly opted in (and not manually
  // excluded) — default OFF keeps the surface read-only.
  if (conversationExportEnabled() && !excluded.has(EXPORT_TOOL_NAME)) {
    tools.push(EXPORT_TOOL);
  }
  return tools;
}

// Returns the tool result as a JSON string (executeTool's own convention —
// it never throws; errors come back as {"error": ...} JSON).
export async function callMcpTool(
  name: string,
  args: unknown
): Promise<string> {
  if (effectiveExcludedToolNames().has(name)) {
    return JSON.stringify({ error: `Tool not available: ${name}` });
  }
  if (name === EXPORT_TOOL_NAME) {
    // The one write on this endpoint — refused unless opted in (fail-safe).
    if (!conversationExportEnabled()) {
      return JSON.stringify({ error: `Tool not available: ${name}` });
    }
    const a = (args ?? {}) as {
      content?: unknown;
      title?: unknown;
      conversation_id?: unknown;
    };
    const content = typeof a.content === "string" ? a.content : "";
    if (!content.trim()) {
      return JSON.stringify({ error: "content is required (the full transcript)." });
    }
    if (content.length > MAX_CONVERSATION_CHARS) {
      return JSON.stringify({
        error: `content too large — ${content.length} chars, max ${MAX_CONVERSATION_CHARS}.`,
      });
    }
    // Add-only: writes exactly one row in mcp_conversations (upsert by id),
    // never anything else. Then fire the filing job so it lands in the vault
    // promptly (fire-and-forget with .catch; no-ops if Dropbox export is off).
    const { key } = saveExportedConversation({
      content,
      title: typeof a.title === "string" ? a.title : undefined,
      conversationId: typeof a.conversation_id === "string" ? a.conversation_id : undefined,
    });
    import("@/lib/dropbox")
      .then((m) => m.maybeExportConversationsToDropbox())
      .catch((e) =>
        console.warn("[mcp] conversation filing failed:", (e as Error).message)
      );
    return JSON.stringify({
      ok: true,
      key,
      note: "Saved this conversation to your diary wiki.",
    });
  }
  if (name === PROFILE_TOOL_NAME) {
    const profile = getCurrentProfile();
    return JSON.stringify(
      profile
        ? { profile }
        : {
            profile: null,
            note: "No profile has been built yet — the diary may be empty.",
          }
    );
  }
  if (name === GUIDANCE_TOOL_NAME) {
    return JSON.stringify({ guidance: COMPANION_GUIDANCE });
  }
  if (name === RECALL_TOOL_NAME) {
    // recallChatMemories is read-only + fail-open (embeds the query via Voyage,
    // which is compute-only — no DB/fs write — matching search_diary). Never
    // throws, so a Voyage outage degrades to recency, not an endpoint error.
    const q =
      typeof (args as { query?: unknown })?.query === "string"
        ? ((args as { query: string }).query)
        : "";
    const { items } = await recallChatMemories(q);
    return JSON.stringify(
      items.length > 0
        ? { memories: items.map((m) => ({ category: m.category, text: m.text })) }
        : { memories: [], note: "No durable memories recorded yet." }
    );
  }
  // readOnly: the MCP endpoint's core guarantee. Tools that would otherwise
  // warm caches / write / call out (e.g. get_recent_locations' geocode warm)
  // skip those side effects when invoked here — see lib/chatTools.ts.
  return executeTool(name, args ?? {}, { readOnly: true });
}

// --- Auth ---------------------------------------------------------------
// The MCP endpoint sits on the public internet (Railway), guarding a private
// diary, so it fails CLOSED: no MCP_AUTH_TOKEN (or a too-weak one) disables
// the endpoint entirely rather than leaving it open. Comparison is
// timing-safe (hash both sides to equal length, then timingSafeEqual).

export const MIN_TOKEN_LENGTH = 16;

export type McpAuthVerdict = "ok" | "unauthorized" | "disabled";

// MCP_AUTH_TOKEN may hold several comma-separated tokens so a rotation can
// overlap (old + new both valid while clients are moved). Entries shorter
// than MIN_TOKEN_LENGTH are ignored; if none qualify the endpoint is off.
function configuredTokens(): string[] {
  return (process.env.MCP_AUTH_TOKEN || "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length >= MIN_TOKEN_LENGTH);
}

export function mcpEnabled(): boolean {
  return configuredTokens().length > 0;
}

function tokenMatches(presented: string, expected: string): boolean {
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

// Accepts "Bearer <token>" (any scheme casing) or the bare token itself —
// claude.ai's connector UI has users type the full header value, and a
// missing "Bearer " prefix is the most likely slip.
export function checkMcpAuth(
  authorizationHeader: string | null
): McpAuthVerdict {
  const expected = configuredTokens();
  if (expected.length === 0) return "disabled";
  const raw = (authorizationHeader || "").trim();
  if (!raw) return "unauthorized";
  const presented = /^bearer\s+/i.test(raw)
    ? raw.replace(/^bearer\s+/i, "").trim()
    : raw;
  // Check every configured token (constant work per token; the count is the
  // operator's own config, not attacker-controlled).
  for (const t of expected) if (tokenMatches(presented, t)) return "ok";
  // Also accept a live OAuth access token issued via the claude.ai connector
  // handshake (lib/mcpOauth.ts). The raw MCP_AUTH_TOKEN path above stays for
  // Claude Code / direct use; this is the claude.ai-app path.
  if (isValidAccessToken(presented)) return "ok";
  return "unauthorized";
}

// --- Brute-force throttle -------------------------------------------------
// Sliding window of FAILED auth attempts per client IP. Once an IP crosses
// the limit, further invalid attempts get 429 until the window drains.
// Deliberately failure-only: a request with a VALID token always passes, so
// the throttle can never be used to lock the real user out (Claude's
// connector traffic can share egress IPs with other tenants). In-memory is
// fine here: the app is a single long-lived process (same assumption as the
// in-flight guards in lib/chatMemory.ts), and losing the counters on restart
// only means an attacker gets a fresh window, not access.

export const THROTTLE_WINDOW_MS = 10 * 60 * 1000;
export const THROTTLE_MAX_FAILURES = 10;
const MAX_TRACKED_IPS = 10_000;

const authFailures = new Map<string, number[]>();

export function recordAuthFailure(ip: string, now = Date.now()): void {
  const cutoff = now - THROTTLE_WINDOW_MS;
  const list = (authFailures.get(ip) ?? []).filter((t) => t > cutoff);
  list.push(now);
  authFailures.set(ip, list);
  // Bound memory under an IP-spraying scan: drop the stalest entries.
  if (authFailures.size > MAX_TRACKED_IPS) {
    let oldestKey: string | null = null;
    let oldestTs = Infinity;
    for (const [k, v] of authFailures) {
      const last = v[v.length - 1] ?? 0;
      if (last < oldestTs) {
        oldestTs = last;
        oldestKey = k;
      }
    }
    if (oldestKey) authFailures.delete(oldestKey);
  }
}

export function isThrottled(ip: string, now = Date.now()): boolean {
  const cutoff = now - THROTTLE_WINDOW_MS;
  const list = authFailures.get(ip);
  if (!list) return false;
  const recent = list.filter((t) => t > cutoff);
  if (recent.length === 0) {
    authFailures.delete(ip);
    return false;
  }
  authFailures.set(ip, recent);
  return recent.length >= THROTTLE_MAX_FAILURES;
}

export function resetMcpThrottle(): void {
  authFailures.clear();
}

// First value of X-Forwarded-For (Railway's proxy sets it), else "unknown".
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

// --- Audit trail ----------------------------------------------------------
// Best-effort by design: auditing must never take the endpoint down, so
// every write is wrapped. Size-capped so an attack can't grow the DB
// unboundedly.

export const AUDIT_KEEP_ROWS = 2000;

export type McpAuditEvent = "auth_fail" | "throttled" | "initialize" | "tools_call";

export function recordMcpAudit(
  event: McpAuditEvent,
  opts: { ip: string; tool?: string | null; ok?: boolean } // ok default true
): void {
  try {
    db()
      .prepare(`INSERT INTO mcp_audit(ip, event, tool, ok) VALUES(?,?,?,?)`)
      .run(opts.ip, event, opts.tool ?? null, opts.ok === false ? 0 : 1);
    db()
      .prepare(
        `DELETE FROM mcp_audit
         WHERE id <= (SELECT MAX(id) FROM mcp_audit) - ?`
      )
      .run(AUDIT_KEEP_ROWS);
  } catch (e) {
    console.warn("[mcp] audit write failed:", (e as Error).message);
  }
}
