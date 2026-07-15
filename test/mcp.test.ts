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
  delete process.env.MCP_EXCLUDE_TOOLS;
  delete process.env.MCP_ALLOW_SENSITIVE_TOOLS;
  mcp.resetMcpThrottle();
});

describe("mcpToolList", () => {
  it("mirrors every non-sensitive chat tool plus get_profile, schemas passed through", () => {
    // Sensitive tools are excluded by default (see the sensitive-default
    // suite below); everything else mirrors CHAT_TOOLS 1:1, plus get_profile.
    const tools = mcp.mcpToolList();
    const names = tools.map((t) => t.name);
    for (const t of chatTools.CHAT_TOOLS) {
      if (mcp.SENSITIVE_TOOL_NAMES.has(t.name)) continue;
      expect(names).toContain(t.name);
    }
    expect(names).toContain(mcp.PROFILE_TOOL_NAME);
    expect(tools.length).toBe(
      chatTools.CHAT_TOOLS.length - mcp.SENSITIVE_TOOL_NAMES.size + 1
    );

    const search = tools.find((t) => t.name === "search_diary")!;
    const original = chatTools.CHAT_TOOLS.find((t) => t.name === "search_diary")!;
    expect(search.inputSchema).toEqual(original.input_schema);
    expect(search.description!.length).toBeGreaterThan(0);
  });

  it("mirrors ALL chat tools when sensitive tools are explicitly allowed", () => {
    process.env.MCP_ALLOW_SENSITIVE_TOOLS = "true";
    const names = mcp.mcpToolList().map((t) => t.name);
    for (const t of chatTools.CHAT_TOOLS) {
      expect(names).toContain(t.name);
    }
    expect(names.length).toBe(chatTools.CHAT_TOOLS.length + 1);
  });
});

describe("sensitive tools are fail-safe by default", () => {
  it("hides get_recent_locations and search_chat_history unless opted in", () => {
    const def = mcp.mcpToolList().map((t) => t.name);
    expect(def).not.toContain("get_recent_locations");
    expect(def).not.toContain("search_chat_history");
    // Non-sensitive tools are still there.
    expect(def).toContain("search_diary");
    expect(def).toContain(mcp.PROFILE_TOOL_NAME);
  });

  it("refuses to CALL a sensitive tool by default, even by name", async () => {
    const out = JSON.parse(await mcp.callMcpTool("get_recent_locations", {}));
    expect(out.error).toContain("not available");
    const out2 = JSON.parse(await mcp.callMcpTool("search_chat_history", {}));
    expect(out2.error).toContain("not available");
  });

  it("exposes and executes them only with MCP_ALLOW_SENSITIVE_TOOLS=true", async () => {
    process.env.MCP_ALLOW_SENSITIVE_TOOLS = "true";
    const names = mcp.mcpToolList().map((t) => t.name);
    expect(names).toContain("get_recent_locations");
    expect(names).toContain("search_chat_history");
    // ...and they now dispatch (empty DB → valid JSON, not the exclusion error).
    const out = JSON.parse(await mcp.callMcpTool("search_chat_history", { query: "x" }));
    expect(out.error).toBeUndefined();
  });

  it("only 'true' opts in — other truthy-ish values do not", () => {
    for (const v of ["1", "yes", "TRUE", "on", ""]) {
      process.env.MCP_ALLOW_SENSITIVE_TOOLS = v;
      expect(mcp.mcpToolList().map((t) => t.name)).not.toContain(
        "get_recent_locations"
      );
    }
  });

  it("MCP_EXCLUDE_TOOLS composes on top; it cannot re-include a sensitive tool", () => {
    process.env.MCP_EXCLUDE_TOOLS = "get_insights";
    const names = mcp.mcpToolList().map((t) => t.name);
    expect(names).not.toContain("get_insights"); // manual exclusion honored
    expect(names).not.toContain("get_recent_locations"); // sensitive still hidden
    // The allow flag is the ONLY way in — MCP_EXCLUDE_TOOLS can't grant access.
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

  it("supports comma-separated tokens for zero-downtime rotation", () => {
    const other = "second-rotation-token-abcdef";
    process.env.MCP_AUTH_TOKEN = `${TOKEN}, ${other}`;
    expect(mcp.checkMcpAuth(`Bearer ${TOKEN}`)).toBe("ok");
    expect(mcp.checkMcpAuth(`Bearer ${other}`)).toBe("ok");
    expect(mcp.checkMcpAuth("Bearer neither-of-those-tokens")).toBe("unauthorized");
  });

  it("ignores too-short entries in a token list; all-short means disabled", () => {
    process.env.MCP_AUTH_TOKEN = `short, ${TOKEN}`;
    expect(mcp.checkMcpAuth("Bearer short")).toBe("unauthorized");
    expect(mcp.checkMcpAuth(`Bearer ${TOKEN}`)).toBe("ok");
    process.env.MCP_AUTH_TOKEN = "short, tiny";
    expect(mcp.checkMcpAuth("Bearer short")).toBe("disabled");
  });
});

describe("brute-force throttle", () => {
  it("throttles an IP after repeated failures within the window", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < mcp.THROTTLE_MAX_FAILURES; i++) {
      expect(mcp.isThrottled("1.2.3.4", t0 + i)).toBe(false);
      mcp.recordAuthFailure("1.2.3.4", t0 + i);
    }
    expect(mcp.isThrottled("1.2.3.4", t0 + 1000)).toBe(true);
    // A different IP is unaffected.
    expect(mcp.isThrottled("5.6.7.8", t0 + 1000)).toBe(false);
  });

  it("failures age out of the sliding window", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < mcp.THROTTLE_MAX_FAILURES; i++) {
      mcp.recordAuthFailure("1.2.3.4", t0 + i);
    }
    expect(mcp.isThrottled("1.2.3.4", t0 + 1000)).toBe(true);
    expect(mcp.isThrottled("1.2.3.4", t0 + mcp.THROTTLE_WINDOW_MS + 1001)).toBe(
      false
    );
  });
});

describe("clientIp", () => {
  it("takes the first X-Forwarded-For value, else unknown", () => {
    expect(
      mcp.clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))
    ).toBe("9.9.9.9");
    expect(mcp.clientIp(new Headers())).toBe("unknown");
  });
});

describe("MCP_EXCLUDE_TOOLS", () => {
  it("drops manually excluded tools from the list AND refuses calls to them", async () => {
    // Use non-sensitive tools so this exercises the manual-exclusion path
    // itself, not the sensitive-by-default behaviour tested above.
    process.env.MCP_EXCLUDE_TOOLS = "get_insights, get_profile";
    const names = mcp.mcpToolList().map((t) => t.name);
    expect(names).not.toContain("get_insights");
    expect(names).not.toContain(mcp.PROFILE_TOOL_NAME);
    expect(names).toContain("search_diary");
    const out = JSON.parse(await mcp.callMcpTool("get_insights", {}));
    expect(out.error).toContain("not available");
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

  it("throttles repeated failures with 429, but a valid token still passes", async () => {
    process.env.MCP_AUTH_TOKEN = TOKEN;
    const failing = () =>
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          authorization: "Bearer wrong-token-wrong-token",
          "x-forwarded-for": "203.0.113.7",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
      });
    for (let i = 0; i < mcp.THROTTLE_MAX_FAILURES; i++) {
      expect((await route.POST(failing())).status).toBe(401);
    }
    const throttled = await route.POST(failing());
    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("retry-after")).toBeTruthy();

    // The real user (valid token) is NOT throttled — even from the same IP.
    const valid = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${TOKEN}`,
        "x-forwarded-for": "203.0.113.7",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    expect((await route.POST(valid)).status).toBe(200);
  });

  it("audits tool calls and failed attempts", async () => {
    process.env.MCP_AUTH_TOKEN = TOKEN;
    const { db } = await import("@/lib/db");
    db().prepare("DELETE FROM mcp_audit").run();

    await route.POST(
      rpcRequest({ jsonrpc: "2.0", id: 1, method: "ping" }) // no token → auth_fail
    );
    await route.POST(
      rpcRequest(
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "get_writing_stats", arguments: {} },
        },
        TOKEN
      )
    );

    const rows = db()
      .prepare("SELECT event, tool, ok FROM mcp_audit ORDER BY id ASC")
      .all() as Array<{ event: string; tool: string | null; ok: number }>;
    expect(rows.some((r) => r.event === "auth_fail" && r.ok === 0)).toBe(true);
    expect(
      rows.some(
        (r) => r.event === "tools_call" && r.tool === "get_writing_stats" && r.ok === 1
      )
    ).toBe(true);
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
