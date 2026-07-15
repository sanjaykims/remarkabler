import { createHash, timingSafeEqual } from "crypto";
import { CHAT_TOOLS, executeTool } from "@/lib/chatTools";
import { getCurrentProfile } from "@/lib/profile";

// MCP bridge: exposes the SAME read-only diary tools the in-app chat uses
// (lib/chatTools.ts) over the Model Context Protocol, so Claude on the user's
// subscription (claude.ai custom connector, Claude Code) can reach the diary
// without per-token API billing. The tool list is derived from CHAT_TOOLS at
// runtime — add a chat tool and the MCP surface picks it up automatically, so
// the two can never drift. Everything here must stay READ-ONLY: no tool may
// mutate the DB or filesystem (see the "do not regress" rule in CLAUDE.md).

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

export function mcpToolList(): McpToolDef[] {
  const tools: McpToolDef[] = CHAT_TOOLS.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    // Anthropic's input_schema and MCP's inputSchema are both plain JSON
    // Schema — pass through verbatim.
    inputSchema: t.input_schema as unknown as Record<string, unknown>,
  }));
  tools.push(PROFILE_TOOL);
  return tools;
}

// Returns the tool result as a JSON string (executeTool's own convention —
// it never throws; errors come back as {"error": ...} JSON).
export async function callMcpTool(
  name: string,
  args: unknown
): Promise<string> {
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

function configuredToken(): string | null {
  const t = (process.env.MCP_AUTH_TOKEN || "").trim();
  if (t.length < MIN_TOKEN_LENGTH) return null;
  return t;
}

export function mcpEnabled(): boolean {
  return configuredToken() !== null;
}

// Accepts "Bearer <token>" (any scheme casing) or the bare token itself —
// claude.ai's connector UI has users type the full header value, and a
// missing "Bearer " prefix is the most likely slip.
export function checkMcpAuth(authorizationHeader: string | null): McpAuthVerdict {
  const expected = configuredToken();
  if (!expected) return "disabled";
  const raw = (authorizationHeader || "").trim();
  if (!raw) return "unauthorized";
  const presented = /^bearer\s+/i.test(raw)
    ? raw.replace(/^bearer\s+/i, "").trim()
    : raw;
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b) ? "ok" : "unauthorized";
}
