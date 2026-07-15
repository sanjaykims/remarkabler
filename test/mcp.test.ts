import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// The MCP bridge (lib/mcp.ts + app/api/mcp/route.ts) exposes the in-app
// chat's read-only diary tools to Claude on the user's subscription. These
// pins lock:
//   - the tool list mirrors CHAT_TOOLS (zero drift) + the MCP-only
//     get_profile tool;
//   - auth fails CLOSED (no token / weak token → disabled, not open);
//   - the bearer check is forgiving about the "Bearer " prefix but strict
//     about the token;
//   - the actual route handler speaks MCP end-to-end (initialize →
//     tools/list → tools/call) with a valid token, and rejects without one.

type McpMod = typeof import("@/lib/mcp");
type ChatToolsMod = typeof import("@/lib/chatTools");
type RouteMod = typeof import("@/app/api/mcp/route");

let mcp: McpMod;
let chatTools: ChatToolsMod;
let route: RouteMod;

const TOKEN = "test-mcp-token-0123456789";

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "mcp-test-"));
  mcp = await import("@/lib/mcp");
  chatTools = await import("@/lib/chatTools");
  route = await import("@/app/api/mcp/route");
});

afterEach(() => {
  delete process.env.MCP_AUTH_TOKEN;
});

describe("mcpToolList", () => {
  it("mirrors every chat tool plus get_profile, schemas passed through", () => {
    const tools = mcp.mcpToolList();
    const names = tools.map((t) => t.name);
    for (const t of chatTools.CHAT_TOOLS) {
      expect(names).toContain(t.name);
    }
    expect(names).toContain(mcp.PROFILE_TOOL_NAME);
    expect(tools.length).toBe(chatTools.CHAT_TOOLS.length + 1);

    const search = tools.find((t) => t.name === "search_diary")!;
    const original = chatTools.CHAT_TOOLS.find((t) => t.name === "search_diary")!;
    expect(search.inputSchema).toEqual(original.input_schema);
    expect(search.description!.length).toBeGreaterThan(0);
  });
});

describe("checkMcpAuth", () => {
  it("is disabled when MCP_AUTH_TOKEN is unset (fail closed)", () => {
    expect(mcp.checkMcpAuth(`Bearer ${TOKEN}`)).toBe("disabled");
    expect(mcp.mcpEnabled()).toBe(false);
  });

  it("is disabled when the token is too short to be safe", () => {
    process.env.MCP_AUTH_TOKEN = "short";
    expect(mcp.checkMcpAuth("Bearer short")).toBe("disabled");
  });

  it("accepts Bearer <token>, any scheme casing, and the bare token", () => {
    process.env.MCP_AUTH_TOKEN = TOKEN;
    expect(mcp.checkMcpAuth(`Bearer ${TOKEN}`)).toBe("ok");
    expect(mcp.checkMcpAuth(`bearer ${TOKEN}`)).toBe("ok");
    expect(mcp.checkMcpAuth(TOKEN)).toBe("ok");
  });

  it("rejects wrong or missing tokens", () => {
    process.env.MCP_AUTH_TOKEN = TOKEN;
    expect(mcp.checkMcpAuth("Bearer nope-nope-nope-nope")).toBe("unauthorized");
    expect(mcp.checkMcpAuth(null)).toBe("unauthorized");
    expect(mcp.checkMcpAuth("")).toBe("unauthorized");
    // A token that merely prefixes the real one must not pass.
    expect(mcp.checkMcpAuth(`Bearer ${TOKEN.slice(0, -1)}`)).toBe("unauthorized");
  });
});

describe("callMcpTool", () => {
  it("get_profile reports the empty state without throwing", async () => {
    const out = JSON.parse(await mcp.callMcpTool(mcp.PROFILE_TOOL_NAME, {}));
    expect(out.profile).toBeNull();
    expect(out.note).toContain("No profile");
  });

  it("dispatches chat tools and returns their JSON", async () => {
    const out = JSON.parse(await mcp.callMcpTool("current_time_kst", {}));
    expect(out).toBeTruthy();
  });

  it("unknown tools come back as an error payload, not a throw", async () => {
    const out = JSON.parse(await mcp.callMcpTool("no_such_tool", {}));
    expect(out.error).toContain("Unknown tool");
  });
});

// --- Route-level protocol round trip ------------------------------------

function rpcRequest(body: unknown, token?: string): Request {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

// The streamable HTTP transport may answer application/json or a one-shot
// SSE stream — accept both, like a real MCP client must.
async function readRpcResponse(res: Response): Promise<any> {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  if (ct.includes("text/event-stream")) {
    const dataLines = text
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim());
    expect(dataLines.length).toBeGreaterThan(0);
    return JSON.parse(dataLines[dataLines.length - 1]);
  }
  return JSON.parse(text);
}

describe("POST /api/mcp", () => {
  it("returns 503 when the endpoint is not configured", async () => {
    const res = await route.POST(
      rpcRequest({ jsonrpc: "2.0", id: 1, method: "ping" }, TOKEN)
    );
    expect(res.status).toBe(503);
  });

  it("returns 401 without a valid token", async () => {
    process.env.MCP_AUTH_TOKEN = TOKEN;
    const res = await route.POST(
      rpcRequest({ jsonrpc: "2.0", id: 1, method: "ping" })
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("Bearer");
  });

  it("initialize → tools/list → tools/call round trip", async () => {
    process.env.MCP_AUTH_TOKEN = TOKEN;

    const init = await route.POST(
      rpcRequest(
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "vitest", version: "0" },
          },
        },
        TOKEN
      )
    );
    expect(init.status).toBe(200);
    const initRpc = await readRpcResponse(init);
    expect(initRpc.result.serverInfo.name).toBe("remarkabler-diary");
    expect(initRpc.result.capabilities.tools).toBeTruthy();

    const list = await route.POST(
      rpcRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" }, TOKEN)
    );
    expect(list.status).toBe(200);
    const listRpc = await readRpcResponse(list);
    const names = listRpc.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("search_diary");
    expect(names).toContain("get_entries_by_date");
    expect(names).toContain(mcp.PROFILE_TOOL_NAME);

    const call = await route.POST(
      rpcRequest(
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "get_writing_stats", arguments: {} },
        },
        TOKEN
      )
    );
    expect(call.status).toBe(200);
    const callRpc = await readRpcResponse(call);
    expect(callRpc.result.content[0].type).toBe("text");
    // Empty throwaway DB — stats should still come back as valid JSON.
    expect(() => JSON.parse(callRpc.result.content[0].text)).not.toThrow();
  });
});
