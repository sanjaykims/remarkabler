import { NextResponse } from "next/server";
import { createMcpHandler } from "mcp-handler";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  mcpToolList,
  callMcpTool,
  checkMcpAuth,
  clientIp,
  isThrottled,
  recordAuthFailure,
  recordMcpAudit,
} from "@/lib/mcp";
import { publicOrigin, RESOURCE_METADATA_PATH } from "@/lib/mcpOauth";

// Remote MCP endpoint (Streamable HTTP, stateless) exposing the diary's
// read-only chat tools to Claude on the user's subscription — added at
// claude.ai as a custom connector (Settings → Connectors → Add custom
// connector, with an "Authorization: Bearer <MCP_AUTH_TOKEN>" request
// header) and to Claude Code via `claude mcp add --transport http`.
// claude.ai connectors propagate automatically into Claude Code sessions,
// so one registration covers both surfaces. See docs/mcp-setup.md.
//
// Auth is a bearer token checked BEFORE the protocol handler runs; without
// MCP_AUTH_TOKEN configured the endpoint is disabled (fail closed). This
// route deliberately bypasses the app's cookie/passkey lock — the token is
// its lock. Failed attempts are throttled per IP and audited (lib/mcp.ts);
// a valid token is never throttled. Tool registration uses the SDK's raw
// request handlers (not zod-based server.tool()) so CHAT_TOOLS' existing
// JSON schemas pass through verbatim.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const handler = createMcpHandler(
  (server) => {
    server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: mcpToolList(),
    }));
    server.server.setRequestHandler(CallToolRequestSchema, async (req) => {
      const text = await callMcpTool(
        req.params.name,
        req.params.arguments ?? {}
      );
      // executeTool never throws; tool failures come back as {"error": ...}
      // JSON. Surface those as MCP tool errors so the model sees them as
      // failures rather than data.
      let isError = false;
      try {
        const parsed = JSON.parse(text) as { error?: unknown };
        isError =
          typeof parsed === "object" && parsed !== null && "error" in parsed;
      } catch {
        // Non-JSON text is still a valid tool result.
      }
      return { content: [{ type: "text", text }], isError };
    });
  },
  {
    serverInfo: { name: "remarkabler-diary", version: "1.0.0" },
    capabilities: { tools: {} },
  },
  {
    streamableHttpEndpoint: "/api/mcp",
    disableSse: true,
    maxDuration: 120,
    verboseLogs: false,
  }
);

// Best-effort request audit: peek at the JSON-RPC method so tool calls and
// handshakes land in mcp_audit with the tool name. Never blocks serving.
async function auditRequest(req: Request, ip: string): Promise<void> {
  try {
    if (req.method !== "POST") return;
    const body = (await req.clone().json()) as {
      method?: string;
      params?: { name?: string };
    };
    if (body?.method === "tools/call") {
      recordMcpAudit("tools_call", { ip, tool: body.params?.name ?? null });
    } else if (body?.method === "initialize") {
      recordMcpAudit("initialize", { ip });
    }
  } catch {
    // Unparseable body — the protocol handler will reject it; nothing to audit.
  }
}

async function guarded(req: Request): Promise<Response> {
  const ip = clientIp(req.headers);
  const verdict = checkMcpAuth(req.headers.get("authorization"));

  if (verdict === "ok") {
    // A valid token always passes — deliberately not subject to the
    // throttle, so failed-attempt spam can never lock the real user out.
    await auditRequest(req, ip);
    return handler(req);
  }

  if (verdict === "disabled") {
    return NextResponse.json(
      {
        error:
          "MCP endpoint is disabled. Set MCP_AUTH_TOKEN (16+ chars) to enable it.",
      },
      { status: 503 }
    );
  }

  // Invalid or missing token from here on.
  if (isThrottled(ip)) {
    recordMcpAudit("throttled", { ip, ok: false });
    return NextResponse.json(
      { error: "Too many failed attempts. Try again later." },
      { status: 429, headers: { "retry-after": "600" } }
    );
  }
  recordAuthFailure(ip);
  recordMcpAudit("auth_fail", { ip, ok: false });
  console.warn(`[mcp] failed auth attempt from ${ip}`);
  // The WWW-Authenticate header MUST point at the Protected Resource Metadata
  // (RFC 9728) — that's what makes claude.ai discover the OAuth authorization
  // server and run the handshake (lib/mcpOauth.ts) instead of failing with
  // "couldn't register with sign-in service". Without resource_metadata here,
  // the claude.ai web connector can't complete a custom-connector add.
  const origin = publicOrigin(req);
  return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: {
      "content-type": "application/json",
      "www-authenticate": `Bearer realm="remarkabler-mcp", resource_metadata="${origin}${RESOURCE_METADATA_PATH}"`,
    },
  });
}

export { guarded as GET, guarded as POST, guarded as DELETE };
