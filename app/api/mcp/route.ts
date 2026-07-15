import { NextResponse } from "next/server";
import { createMcpHandler } from "mcp-handler";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { mcpToolList, callMcpTool, checkMcpAuth } from "@/lib/mcp";

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
// its lock. Tool registration uses the SDK's raw request handlers (not
// zod-based server.tool()) so CHAT_TOOLS' existing JSON schemas pass
// through verbatim.

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
        isError = typeof parsed === "object" && parsed !== null && "error" in parsed;
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

async function guarded(req: Request): Promise<Response> {
  const verdict = checkMcpAuth(req.headers.get("authorization"));
  if (verdict === "disabled") {
    return NextResponse.json(
      { error: "MCP endpoint is disabled. Set MCP_AUTH_TOKEN (16+ chars) to enable it." },
      { status: 503 }
    );
  }
  if (verdict === "unauthorized") {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate": 'Bearer realm="remarkabler-mcp"',
      },
    });
  }
  return handler(req);
}

export { guarded as GET, guarded as POST, guarded as DELETE };
