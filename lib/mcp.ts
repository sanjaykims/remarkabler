import { createHash, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { CHAT_TOOLS, executeTool } from "@/lib/chatTools";
import { getCurrentProfile } from "@/lib/profile";

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

// Tools removed from the MCP surface via env (comma-separated names).
// Filtered from tools/list AND refused on tools/call — an excluded tool must
// not be reachable by a client that remembers its name.
export function excludedToolNames(): Set<string> {
  return new Set(
    (process.env.MCP_EXCLUDE_TOOLS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export function mcpToolList(): McpToolDef[] {
  const excluded = excludedToolNames();
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
  return tools;
}

// Returns the tool result as a JSON string (executeTool's own convention —
// it never throws; errors come back as {"error": ...} JSON).
export async function callMcpTool(
  name: string,
  args: unknown
): Promise<string> {
  if (excludedToolNames().has(name)) {
    return JSON.stringify({ error: `Tool not available: ${name}` });
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
  return executeTool(name, args ?? {});
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
  let ok = false;
  for (const t of expected) if (tokenMatches(presented, t)) ok = true;
  return ok ? "ok" : "unauthorized";
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
