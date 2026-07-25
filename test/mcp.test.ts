import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
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
// MCP-only tools not present in CHAT_TOOLS: get_profile, recall_memories, get_guidance.
const MCP_ONLY_TOOLS = 3;

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
  delete process.env.MCP_ALLOW_CONVERSATION_EXPORT;
  delete process.env.MCP_ALLOW_REFLECTION_SAVE;
  delete process.env.MCP_ALLOW_DECISION_SAVE;
  delete process.env.MCP_ALLOW_DIARY_WRITE;
  delete process.env.MCP_ALLOW_WIKI_LINKING;
  delete process.env.MCP_AUTO_TAG_EXPORTS;
  mcp.resetMcpThrottle();
  vi.restoreAllMocks();
});

async function flushAsyncWork(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

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
    // Three MCP-only tools (not in CHAT_TOOLS): get_profile, recall_memories,
    // get_guidance — external Claude gets these instead of the in-app
    // system-prompt injection.
    expect(names).toContain(mcp.PROFILE_TOOL_NAME);
    expect(names).toContain(mcp.RECALL_TOOL_NAME);
    expect(names).toContain(mcp.GUIDANCE_TOOL_NAME);
    expect(tools.length).toBe(
      chatTools.CHAT_TOOLS.length - mcp.SENSITIVE_TOOL_NAMES.size + MCP_ONLY_TOOLS
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
    expect(names.length).toBe(chatTools.CHAT_TOOLS.length + MCP_ONLY_TOOLS);
  });
});

describe("MCP-only companion tools (recall_memories, get_guidance)", () => {
  it("get_guidance returns the behavior contract, no side effects", async () => {
    const out = JSON.parse(await mcp.callMcpTool(mcp.GUIDANCE_TOOL_NAME, {}));
    expect(typeof out.guidance).toBe("string");
    expect(out.guidance).toContain("companion");
    // Mirrors the app's anti-confabulation rule.
    expect(out.guidance.toLowerCase()).toContain("gap");
  });

  it("recall_memories returns durable memories, empty-state safe", async () => {
    const { db } = await import("@/lib/db");
    db().prepare("DELETE FROM chat_memories").run();
    // Empty corpus → safe note, no throw.
    const empty = JSON.parse(await mcp.callMcpTool(mcp.RECALL_TOOL_NAME, {}));
    expect(Array.isArray(empty.memories)).toBe(true);
    expect(empty.memories.length).toBe(0);

    // With a memory present, it comes back (recall is fail-open: no embedding
    // needed for a small corpus).
    db()
      .prepare(
        `INSERT INTO chat_memories(source_conversation_id, category, text, text_norm) VALUES(?,?,?,?)`
      )
      .run("c1", "preference", "Prefers tea over coffee in the mornings.", "prefers tea over coffee in the mornings");
    const out = JSON.parse(
      await mcp.callMcpTool(mcp.RECALL_TOOL_NAME, { query: "drinks" })
    );
    expect(out.memories.length).toBeGreaterThan(0);
    expect(out.memories[0].text).toContain("tea");
    expect(out.memories[0].category).toBe("preference");
  });

  it("both are read tools with no DB writes beyond what recall reads", async () => {
    // get_guidance is pure text; recall only SELECTs. A call must not error.
    await expect(mcp.callMcpTool(mcp.GUIDANCE_TOOL_NAME, {})).resolves.toBeTruthy();
    await expect(mcp.callMcpTool(mcp.RECALL_TOOL_NAME, {})).resolves.toBeTruthy();
  });

  it("can be excluded via MCP_EXCLUDE_TOOLS like any tool", async () => {
    process.env.MCP_EXCLUDE_TOOLS = "recall_memories";
    const names = mcp.mcpToolList().map((t) => t.name);
    expect(names).not.toContain(mcp.RECALL_TOOL_NAME);
    expect(names).toContain(mcp.GUIDANCE_TOOL_NAME);
    const out = JSON.parse(await mcp.callMcpTool(mcp.RECALL_TOOL_NAME, {}));
    expect(out.error).toContain("not available");
  });
});

describe("export_conversation write tool (Phase B — opt-in, add-only)", () => {
  it("is HIDDEN and REFUSED by default (endpoint stays read-only)", async () => {
    const names = mcp.mcpToolList().map((t) => t.name);
    expect(names).not.toContain(mcp.EXPORT_TOOL_NAME);
    const out = JSON.parse(
      await mcp.callMcpTool(mcp.EXPORT_TOOL_NAME, { content: "hi" })
    );
    expect(out.error).toContain("not available");
  });

  it("appears and writes ONLY when MCP_ALLOW_CONVERSATION_EXPORT=true", async () => {
    process.env.MCP_ALLOW_CONVERSATION_EXPORT = "true";
    const { db } = await import("@/lib/db");
    db().prepare("DELETE FROM mcp_conversations").run();

    expect(mcp.mcpToolList().map((t) => t.name)).toContain(mcp.EXPORT_TOOL_NAME);

    const out = JSON.parse(
      await mcp.callMcpTool(mcp.EXPORT_TOOL_NAME, {
        content: "User: hi\n\nClaude: hello",
        title: "greeting",
        conversation_id: "s1",
      })
    );
    expect(out.ok).toBe(true);
    expect(out.key).toBe("s1");
    const row = db()
      .prepare("SELECT content, title FROM mcp_conversations WHERE conversation_key = 's1'")
      .get() as { content: string; title: string };
    expect(row.content).toContain("hello"); // full content, verbatim
    expect(row.title).toBe("greeting");
  });

  it("requires content and rejects oversize input", async () => {
    process.env.MCP_ALLOW_CONVERSATION_EXPORT = "true";
    const empty = JSON.parse(await mcp.callMcpTool(mcp.EXPORT_TOOL_NAME, {}));
    expect(empty.error).toContain("required");
    const big = "x".repeat(600_000);
    const over = JSON.parse(
      await mcp.callMcpTool(mcp.EXPORT_TOOL_NAME, { content: big })
    );
    expect(over.error).toContain("too large");
  });

  it("MCP_EXCLUDE_TOOLS still blocks it even when opted in", async () => {
    process.env.MCP_ALLOW_CONVERSATION_EXPORT = "true";
    process.env.MCP_EXCLUDE_TOOLS = "export_conversation";
    expect(mcp.mcpToolList().map((t) => t.name)).not.toContain(mcp.EXPORT_TOOL_NAME);
    const out = JSON.parse(
      await mcp.callMcpTool(mcp.EXPORT_TOOL_NAME, { content: "hi" })
    );
    expect(out.error).toContain("not available");
  });

  it("nudges inline tagging in its description ONLY when the librarian tools are also enabled", () => {
    process.env.MCP_ALLOW_CONVERSATION_EXPORT = "true";
    const withoutLibrarian = mcp
      .mcpToolList()
      .find((t) => t.name === mcp.EXPORT_TOOL_NAME)!;
    expect(withoutLibrarian.description).not.toContain("tag_conversation_entities");

    process.env.MCP_ALLOW_WIKI_LINKING = "true";
    const withLibrarian = mcp
      .mcpToolList()
      .find((t) => t.name === mcp.EXPORT_TOOL_NAME)!;
    expect(withLibrarian.description).toContain("tag_conversation_entities");
    expect(withLibrarian.description).toContain("get_entity_wiki");
    expect(withLibrarian.description).toContain("relate_entities");
  });
});

describe("save_reflection write tool (opt-in, add-only, own flag)", () => {
  it("is HIDDEN and REFUSED by default (endpoint stays read-only)", async () => {
    const names = mcp.mcpToolList().map((t) => t.name);
    expect(names).not.toContain(mcp.REFLECTION_TOOL_NAME);
    const out = JSON.parse(
      await mcp.callMcpTool(mcp.REFLECTION_TOOL_NAME, { content: "hi" })
    );
    expect(out.error).toContain("not available");
  });

  it("appears and writes ONLY when MCP_ALLOW_REFLECTION_SAVE=true", async () => {
    process.env.MCP_ALLOW_REFLECTION_SAVE = "true";
    const { db } = await import("@/lib/db");
    db().prepare("DELETE FROM mcp_reflections").run();

    expect(mcp.mcpToolList().map((t) => t.name)).toContain(mcp.REFLECTION_TOOL_NAME);

    const out = JSON.parse(
      await mcp.callMcpTool(mcp.REFLECTION_TOOL_NAME, {
        content: "You're a builder by nature...",
        title: "Who am I?",
        reflection_id: "r1",
      })
    );
    expect(out.ok).toBe(true);
    expect(out.key).toBe("r1");
    const row = db()
      .prepare("SELECT content, title FROM mcp_reflections WHERE reflection_key = 'r1'")
      .get() as { content: string; title: string };
    expect(row.content).toContain("builder by nature");
    expect(row.title).toBe("Who am I?");
  });

  it("requires content and rejects oversize input", async () => {
    process.env.MCP_ALLOW_REFLECTION_SAVE = "true";
    const empty = JSON.parse(await mcp.callMcpTool(mcp.REFLECTION_TOOL_NAME, {}));
    expect(empty.error).toContain("required");
    const big = "x".repeat(30_000);
    const over = JSON.parse(
      await mcp.callMcpTool(mcp.REFLECTION_TOOL_NAME, { content: big })
    );
    expect(over.error).toContain("too large");
  });

  it("MCP_EXCLUDE_TOOLS still blocks it even when opted in", async () => {
    process.env.MCP_ALLOW_REFLECTION_SAVE = "true";
    process.env.MCP_EXCLUDE_TOOLS = "save_reflection";
    expect(mcp.mcpToolList().map((t) => t.name)).not.toContain(mcp.REFLECTION_TOOL_NAME);
    const out = JSON.parse(
      await mcp.callMcpTool(mcp.REFLECTION_TOOL_NAME, { content: "hi" })
    );
    expect(out.error).toContain("not available");
  });

  it("nudges enrichment (not mandatory tagging) in its description ONLY when the librarian tools are also enabled", () => {
    process.env.MCP_ALLOW_REFLECTION_SAVE = "true";
    const withoutLibrarian = mcp
      .mcpToolList()
      .find((t) => t.name === mcp.REFLECTION_TOOL_NAME)!;
    expect(withoutLibrarian.description).not.toContain("update_entity_conversation_notes");

    process.env.MCP_ALLOW_WIKI_LINKING = "true";
    const withLibrarian = mcp
      .mcpToolList()
      .find((t) => t.name === mcp.REFLECTION_TOOL_NAME)!;
    expect(withLibrarian.description).toContain("get_entity_wiki");
    expect(withLibrarian.description).toContain("update_entity_conversation_notes");
    // Framed as enrichment, not a mandatory follow-up — base tagging is
    // guaranteed automatically (lib/entityTagging.ts), unlike
    // export_conversation's nudge which predates that guarantee.
    expect(withLibrarian.description).toContain("happens automatically");
  });

  it("is independent of MCP_ALLOW_CONVERSATION_EXPORT (separate flags, separate tools)", async () => {
    // Conversation export on, reflection save NOT on -> only export appears.
    process.env.MCP_ALLOW_CONVERSATION_EXPORT = "true";
    let names = mcp.mcpToolList().map((t) => t.name);
    expect(names).toContain(mcp.EXPORT_TOOL_NAME);
    expect(names).not.toContain(mcp.REFLECTION_TOOL_NAME);

    // Flip it around: reflection save on, conversation export off.
    delete process.env.MCP_ALLOW_CONVERSATION_EXPORT;
    process.env.MCP_ALLOW_REFLECTION_SAVE = "true";
    names = mcp.mcpToolList().map((t) => t.name);
    expect(names).not.toContain(mcp.EXPORT_TOOL_NAME);
    expect(names).toContain(mcp.REFLECTION_TOOL_NAME);
  });
});

describe("save_decision write tool (opt-in, add-only, own flag)", () => {
  it("is HIDDEN and REFUSED by default", async () => {
    expect(mcp.mcpToolList().map((t) => t.name)).not.toContain(mcp.DECISION_TOOL_NAME);
    const out = JSON.parse(await mcp.callMcpTool(mcp.DECISION_TOOL_NAME, { content: "hi" }));
    expect(out.error).toContain("not available");
  });

  it("appears and writes ONLY when MCP_ALLOW_DECISION_SAVE=true", async () => {
    process.env.MCP_ALLOW_DECISION_SAVE = "true";
    const { db } = await import("@/lib/db");
    db().prepare("DELETE FROM mcp_decisions").run();
    expect(mcp.mcpToolList().map((t) => t.name)).toContain(mcp.DECISION_TOOL_NAME);

    const out = JSON.parse(
      await mcp.callMcpTool(mcp.DECISION_TOOL_NAME, {
        content: "Decided to defer the Redis migration to Q2.",
        title: "Defer Redis",
        decision_id: "d1",
      })
    );
    expect(out.ok).toBe(true);
    expect(out.key).toBe("d1");
    const row = db()
      .prepare("SELECT content, title FROM mcp_decisions WHERE decision_key = 'd1'")
      .get() as { content: string; title: string };
    expect(row.content).toContain("Redis migration");
    expect(row.title).toBe("Defer Redis");
  });

  it("requires content and rejects oversize input", async () => {
    process.env.MCP_ALLOW_DECISION_SAVE = "true";
    const empty = JSON.parse(await mcp.callMcpTool(mcp.DECISION_TOOL_NAME, {}));
    expect(empty.error).toContain("required");
    const over = JSON.parse(
      await mcp.callMcpTool(mcp.DECISION_TOOL_NAME, { content: "x".repeat(30_000) })
    );
    expect(over.error).toContain("too large");
  });

  it("is independent of the reflection + conversation flags", () => {
    process.env.MCP_ALLOW_DECISION_SAVE = "true";
    const names = mcp.mcpToolList().map((t) => t.name);
    expect(names).toContain(mcp.DECISION_TOOL_NAME);
    expect(names).not.toContain(mcp.REFLECTION_TOOL_NAME);
    expect(names).not.toContain(mcp.EXPORT_TOOL_NAME);
  });
});

describe("save_diary_entry write tool (opt-in, real diary write)", () => {
  it("is HIDDEN and REFUSED by default", async () => {
    expect(mcp.mcpToolList().map((t) => t.name)).not.toContain(mcp.DIARY_TOOL_NAME);
    const out = JSON.parse(await mcp.callMcpTool(mcp.DIARY_TOOL_NAME, { content: "hi" }));
    expect(out.error).toContain("not available");
  });

  it("appears and writes a real diary page ONLY when MCP_ALLOW_DIARY_WRITE=true", async () => {
    process.env.MCP_ALLOW_DIARY_WRITE = "true";
    const { db } = await import("@/lib/db");
    db().prepare("DELETE FROM pages WHERE notebook_id = 'chat-diary'").run();
    expect(mcp.mcpToolList().map((t) => t.name)).toContain(mcp.DIARY_TOOL_NAME);

    const out = JSON.parse(
      await mcp.callMcpTool(mcp.DIARY_TOOL_NAME, {
        content: "Today I finally shipped the chat-diary feature.",
        date: "2026-07-20",
      })
    );
    expect(out.ok).toBe(true);
    expect(out.date).toBe("2026-07-20");
    const row = db()
      .prepare("SELECT ocr_text, entry_date FROM pages WHERE notebook_id = 'chat-diary' LIMIT 1")
      .get() as { ocr_text: string; entry_date: string };
    expect(row.ocr_text).toContain("shipped the chat-diary feature");
    expect(row.entry_date).toBe("2026-07-20");
  });

  it("requires content and rejects oversize input", async () => {
    process.env.MCP_ALLOW_DIARY_WRITE = "true";
    const empty = JSON.parse(await mcp.callMcpTool(mcp.DIARY_TOOL_NAME, {}));
    expect(empty.error).toContain("required");
    const over = JSON.parse(
      await mcp.callMcpTool(mcp.DIARY_TOOL_NAME, { content: "x".repeat(50_000) })
    );
    expect(over.error).toContain("too large");
  });

  it("is independent of the vault-write flags", () => {
    process.env.MCP_ALLOW_DIARY_WRITE = "true";
    const names = mcp.mcpToolList().map((t) => t.name);
    expect(names).toContain(mcp.DIARY_TOOL_NAME);
    expect(names).not.toContain(mcp.REFLECTION_TOOL_NAME);
    expect(names).not.toContain(mcp.DECISION_TOOL_NAME);
    expect(names).not.toContain(mcp.EXPORT_TOOL_NAME);
  });

  it("its description steers 'put this in my diary' to itself, away from export_conversation", () => {
    process.env.MCP_ALLOW_DIARY_WRITE = "true";
    const diary = mcp.mcpToolList().find((t) => t.name === mcp.DIARY_TOOL_NAME)!;
    // The diary tool claims the "in my diary" intent and warns off the archive tool.
    expect(diary.description).toContain("in my diary");
    expect(diary.description).toContain("do NOT use export_conversation");

    // And export_conversation disclaims being the diary + points to save_diary_entry.
    process.env.MCP_ALLOW_CONVERSATION_EXPORT = "true";
    const exp = mcp.mcpToolList().find((t) => t.name === mcp.EXPORT_TOOL_NAME)!;
    expect(exp.description).toContain("does NOT become a diary entry");
    expect(exp.description).toContain("use save_diary_entry");
  });
});

describe("librarian tools (Phase C — opt-in, one flag for all seven)", () => {
  it("are ALL hidden and refused by default, including the reads", async () => {
    const names = mcp.mcpToolList().map((t) => t.name);
    for (const name of [
      mcp.LIST_UNLINKED_TOOL_NAME,
      mcp.GET_CONVERSATION_TOOL_NAME,
      mcp.GET_ENTITY_WIKI_TOOL_NAME,
      mcp.TAG_ENTITIES_TOOL_NAME,
      mcp.RELATE_TOOL_NAME,
      mcp.UPDATE_NOTES_TOOL_NAME,
      mcp.HEARTBEAT_TOOL_NAME,
    ]) {
      expect(names).not.toContain(name);
      const out = JSON.parse(await mcp.callMcpTool(name, {}));
      expect(out.error).toContain("not available");
    }
  });

  it("all seven appear once MCP_ALLOW_WIKI_LINKING=true", () => {
    process.env.MCP_ALLOW_WIKI_LINKING = "true";
    const names = mcp.mcpToolList().map((t) => t.name);
    expect(names).toContain(mcp.LIST_UNLINKED_TOOL_NAME);
    expect(names).toContain(mcp.GET_CONVERSATION_TOOL_NAME);
    expect(names).toContain(mcp.GET_ENTITY_WIKI_TOOL_NAME);
    expect(names).toContain(mcp.TAG_ENTITIES_TOOL_NAME);
    expect(names).toContain(mcp.RELATE_TOOL_NAME);
    expect(names).toContain(mcp.UPDATE_NOTES_TOOL_NAME);
    expect(names).toContain(mcp.HEARTBEAT_TOOL_NAME);
  });

  it("end-to-end: export -> list unlinked -> get -> tag -> notes -> heartbeat", async () => {
    process.env.MCP_ALLOW_CONVERSATION_EXPORT = "true";
    process.env.MCP_ALLOW_WIKI_LINKING = "true";
    const { db } = await import("@/lib/db");
    db().prepare("DELETE FROM mcp_conversations").run();
    db().prepare("DELETE FROM entry_entities").run();
    db().prepare("DELETE FROM entity_conversation_notes").run();

    const exported = JSON.parse(
      await mcp.callMcpTool(mcp.EXPORT_TOOL_NAME, {
        content: "User: what did I do in Suwon?\n\nClaude: You visited a friend.",
        title: "Suwon trip",
        conversation_id: "conv-1",
      })
    );
    expect(exported.ok).toBe(true);

    const unlinked = JSON.parse(
      await mcp.callMcpTool(mcp.LIST_UNLINKED_TOOL_NAME, {})
    );
    expect(unlinked.conversations.map((c: { conversation_key: string }) => c.conversation_key)).toContain(
      "conv-1"
    );

    const fetched = JSON.parse(
      await mcp.callMcpTool(mcp.GET_CONVERSATION_TOOL_NAME, { conversation_key: "conv-1" })
    );
    expect(fetched.conversation.content).toContain("Suwon");

    const wiki = JSON.parse(
      await mcp.callMcpTool(mcp.GET_ENTITY_WIKI_TOOL_NAME, { kind: "person", name: "Suwon Friend" })
    );
    expect(wiki.bio).toBeNull();
    expect(wiki.conversation_notes).toBeNull();

    const tagged = JSON.parse(
      await mcp.callMcpTool(mcp.TAG_ENTITIES_TOOL_NAME, {
        conversation_key: "conv-1",
        entities: [{ kind: "person", name: "Suwon Friend" }],
      })
    );
    expect(tagged.tagged).toBe(1);

    const notesResult = JSON.parse(
      await mcp.callMcpTool(mcp.UPDATE_NOTES_TOOL_NAME, {
        kind: "person",
        name: "Suwon Friend",
        notes: "Visited them in Suwon.",
      })
    );
    expect(notesResult.name).toBe("Suwon Friend");

    const heartbeat = JSON.parse(
      await mcp.callMcpTool(mcp.HEARTBEAT_TOOL_NAME, { ok: true, note: "linked 1 conversation" })
    );
    expect(heartbeat.ok).toBe(true);

    // Now hidden from the unlinked list — it's been tagged.
    const afterTag = JSON.parse(
      await mcp.callMcpTool(mcp.LIST_UNLINKED_TOOL_NAME, {})
    );
    expect(afterTag.conversations.map((c: { conversation_key: string }) => c.conversation_key)).not.toContain(
      "conv-1"
    );
  });

  it("respects MCP_EXCLUDE_TOOLS even when opted in", async () => {
    process.env.MCP_ALLOW_WIKI_LINKING = "true";
    process.env.MCP_EXCLUDE_TOOLS = "tag_conversation_entities";
    expect(mcp.mcpToolList().map((t) => t.name)).not.toContain(mcp.TAG_ENTITIES_TOOL_NAME);
    const out = JSON.parse(
      await mcp.callMcpTool(mcp.TAG_ENTITIES_TOOL_NAME, { conversation_key: "x", entities: [] })
    );
    expect(out.error).toContain("not available");
  });

  it("relate_entities requires a known conversation_key and scoped-replaces that key's edges", async () => {
    process.env.MCP_ALLOW_CONVERSATION_EXPORT = "true";
    process.env.MCP_ALLOW_WIKI_LINKING = "true";
    const { db } = await import("@/lib/db");
    db().prepare("DELETE FROM entity_relationships").run();
    db().prepare("DELETE FROM mcp_conversations").run();

    const missing = JSON.parse(
      await mcp.callMcpTool(mcp.RELATE_TOOL_NAME, {
        conversation_key: "missing",
        relationships: [],
      })
    );
    expect(missing.error).toContain("Unknown conversation_key");

    await mcp.callMcpTool(mcp.EXPORT_TOOL_NAME, {
      content: "User: Jin works at Samsung. Mina lives in Suwon.",
      conversation_id: "c1",
    });
    await mcp.callMcpTool(mcp.EXPORT_TOOL_NAME, {
      content: "User: Mina lives in Suwon.",
      conversation_id: "c2",
    });

    const first = JSON.parse(
      await mcp.callMcpTool(mcp.RELATE_TOOL_NAME, {
        conversation_key: "c1",
        relationships: [
          {
            subject_kind: "person",
            subject_name: "Jin",
            predicate: "works_at",
            object_kind: "project",
            object_name: "Samsung",
          },
        ],
      })
    );
    expect(first.related).toBe(1);

    await mcp.callMcpTool(mcp.RELATE_TOOL_NAME, {
      conversation_key: "c2",
      relationships: [
        {
          subject_kind: "person",
          subject_name: "Mina",
          predicate: "lives_in",
          object_kind: "place",
          object_name: "Suwon",
        },
      ],
    });
    await mcp.callMcpTool(mcp.RELATE_TOOL_NAME, {
      conversation_key: "c1",
      relationships: [
        {
          subject_kind: "person",
          subject_name: "Jin",
          predicate: "studied_at",
          object_kind: "project",
          object_name: "SNU",
        },
      ],
    });

    const rows = db()
      .prepare(
        `SELECT source_key, predicate, object_name
         FROM entity_relationships
         ORDER BY source_key, predicate`
      )
      .all() as Array<{ source_key: string; predicate: string; object_name: string }>;
    expect(rows).toEqual([
      { source_key: "c1", predicate: "studied_at", object_name: "SNU" },
      { source_key: "c2", predicate: "lives_in", object_name: "Suwon" },
    ]);
  });

  it("get_entity_wiki returns known relationships", async () => {
    process.env.MCP_ALLOW_CONVERSATION_EXPORT = "true";
    process.env.MCP_ALLOW_WIKI_LINKING = "true";
    const { db } = await import("@/lib/db");
    db().prepare("DELETE FROM entity_relationships").run();
    db().prepare("DELETE FROM mcp_conversations").run();
    await mcp.callMcpTool(mcp.EXPORT_TOOL_NAME, {
      content: "User: Jin works at Samsung.",
      conversation_id: "c1",
    });
    await mcp.callMcpTool(mcp.RELATE_TOOL_NAME, {
      conversation_key: "c1",
      relationships: [
        {
          subject_kind: "person",
          subject_name: "Jin",
          predicate: "works_at",
          object_kind: "project",
          object_name: "Samsung",
        },
      ],
    });

    const wiki = JSON.parse(
      await mcp.callMcpTool(mcp.GET_ENTITY_WIKI_TOOL_NAME, {
        kind: "person",
        name: "Jin",
      })
    );
    expect(wiki.relationships).toEqual([
      {
        predicate: "works_at",
        otherKind: "project",
        otherName: "Samsung",
        direction: "out",
      },
    ]);
  });

  it("deletes stale relationship-only stubs after a scoped retraction", async () => {
    process.env.MCP_ALLOW_CONVERSATION_EXPORT = "true";
    process.env.MCP_ALLOW_WIKI_LINKING = "true";
    const { db } = await import("@/lib/db");
    db().prepare("DELETE FROM entity_relationships").run();
    db().prepare("DELETE FROM entity_conversation_notes").run();
    db().prepare("DELETE FROM entity_wiki").run();
    db().prepare("DELETE FROM entry_entities").run();
    db().prepare("DELETE FROM mcp_conversations").run();
    db().prepare("DELETE FROM pages").run();
    db().prepare("DELETE FROM notebooks").run();
    const dropbox = await import("@/lib/dropbox");
    const exportSpy = vi
      .spyOn(dropbox, "maybeExportDiaryToDropbox")
      .mockResolvedValue({ ok: true, written: 0 });
    const deleteSpy = vi
      .spyOn(dropbox, "deleteDiaryExportFiles")
      .mockResolvedValue({ deleted: 0, failed: 0 });
    await flushAsyncWork();
    exportSpy.mockClear();
    deleteSpy.mockClear();

    await mcp.callMcpTool(mcp.EXPORT_TOOL_NAME, {
      content: "User: Jin lives in Suwon.",
      conversation_id: "c-retract",
    });
    await mcp.callMcpTool(mcp.RELATE_TOOL_NAME, {
      conversation_key: "c-retract",
      relationships: [
        {
          subject_kind: "person",
          subject_name: "Jin",
          predicate: "lives_in",
          object_kind: "place",
          object_name: "Suwon",
        },
      ],
    });
    await flushAsyncWork();
    expect(exportSpy).toHaveBeenLastCalledWith({
      onlyEntityStubs: ["People/Jin.md", "Places/Suwon.md"],
    });
    expect(deleteSpy).not.toHaveBeenCalled();

    exportSpy.mockClear();
    await mcp.callMcpTool(mcp.RELATE_TOOL_NAME, {
      conversation_key: "c-retract",
      relationships: [],
    });
    await flushAsyncWork();

    expect(exportSpy).toHaveBeenCalledWith({ onlyEntityStubs: [] });
    expect(deleteSpy).toHaveBeenCalledWith(["People/Jin.md", "Places/Suwon.md"]);
  });

  it("MCP_EXCLUDE_TOOLS blocks relate_entities too", async () => {
    process.env.MCP_ALLOW_WIKI_LINKING = "true";
    process.env.MCP_EXCLUDE_TOOLS = "relate_entities";
    expect(mcp.mcpToolList().map((t) => t.name)).not.toContain(mcp.RELATE_TOOL_NAME);
    const out = JSON.parse(
      await mcp.callMcpTool(mcp.RELATE_TOOL_NAME, {
        conversation_key: "x",
        relationships: [],
      })
    );
    expect(out.error).toContain("not available");
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

describe("MCP path is genuinely side-effect-free (read-only)", () => {
  it("get_recent_locations warms geocode in-app but NOT via the readOnly MCP path", async () => {
    const owntracks = await import("@/lib/owntracks");
    const { setLocationEnabled } = await import("@/lib/location");
    const { db } = await import("@/lib/db");

    // Arrange: location on, a recent point with no cached place — exactly the
    // state where the in-app chat kicks off a background Nominatim lookup +
    // geocode_cache write. The MCP endpoint must not.
    setLocationEnabled(true);
    db().prepare("DELETE FROM location_points").run();
    db().prepare("DELETE FROM geocode_cache").run();
    const nowSec = Math.floor(Date.now() / 1000);
    db()
      .prepare("INSERT INTO location_points(lat,lng,tst) VALUES(?,?,?)")
      .run(37.5, 127.0, nowSec - 60);

    const spy = vi
      .spyOn(owntracks, "warmCurrentLocationGeocode")
      .mockImplementation(() => {});

    // In-app path (no opts): the warm IS attempted — proves the point is
    // warm-eligible, so the MCP assertion below is meaningful.
    await chatTools.executeTool("get_recent_locations", {});
    expect(spy.mock.calls.length).toBeGreaterThan(0);

    spy.mockClear();

    // MCP path (readOnly): the warm is NOT attempted — no outbound call, no
    // geocode_cache write.
    await chatTools.executeTool("get_recent_locations", {}, { readOnly: true });
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
    setLocationEnabled(false);
  });

  it("callMcpTool routes through the readOnly path", async () => {
    process.env.MCP_ALLOW_SENSITIVE_TOOLS = "true";
    const owntracks = await import("@/lib/owntracks");
    const { setLocationEnabled } = await import("@/lib/location");
    const { db } = await import("@/lib/db");
    setLocationEnabled(true);
    db().prepare("DELETE FROM location_points").run();
    const nowSec = Math.floor(Date.now() / 1000);
    db()
      .prepare("INSERT INTO location_points(lat,lng,tst) VALUES(?,?,?)")
      .run(37.5, 127.0, nowSec - 60);

    const spy = vi
      .spyOn(owntracks, "warmCurrentLocationGeocode")
      .mockImplementation(() => {});
    await mcp.callMcpTool("get_recent_locations", { days: 7 });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    setLocationEnabled(false);
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
