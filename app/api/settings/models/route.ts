import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSetting, setSetting, clearSetting } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

type Slot = { key: string; env: string; def: string };

const SLOTS: Record<"main" | "chat" | "fallback", Slot> = {
  main: { key: "model_main", env: "CLAUDE_MODEL", def: "claude-opus-4-7" },
  chat: { key: "model_chat", env: "CHAT_MODEL", def: "claude-sonnet-5" },
  fallback: {
    key: "model_chat_fallback",
    env: "CHAT_FALLBACK_MODEL",
    def: "claude-sonnet-4-6",
  },
};

function resolve(s: Slot): { value: string; source: "db" | "env" | "default" } {
  const db = getSetting(s.key);
  if (db) return { value: db, source: "db" };
  const ev = process.env[s.env];
  if (ev) return { value: ev, source: "env" };
  return { value: s.def, source: "default" };
}

export async function GET() {
  if (!(await isAuthenticated())) return LOCKED();
  return NextResponse.json({
    main: resolve(SLOTS.main),
    chat: resolve(SLOTS.chat),
    fallback: resolve(SLOTS.fallback),
  });
}

// Body shape: { main?: string; chat?: string; fallback?: string }. Each is the
// model ID to save; pass an empty string to clear the in-app override and fall
// back to the env var / default.
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  for (const [slot, cfg] of Object.entries(SLOTS) as Array<
    [keyof typeof SLOTS, Slot]
  >) {
    const v = body[slot];
    if (typeof v !== "string") continue;
    if (v) setSetting(cfg.key, v);
    else clearSetting(cfg.key);
  }
  return NextResponse.json({
    ok: true,
    main: resolve(SLOTS.main),
    chat: resolve(SLOTS.chat),
    fallback: resolve(SLOTS.fallback),
  });
}
