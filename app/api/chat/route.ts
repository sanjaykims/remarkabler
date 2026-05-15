import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildNotesContext } from "@/lib/sync";
import { chatOverNotes } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const conversationId = String(body.conversationId || "default");
  const userMessage = String(body.message || "").trim();
  if (!userMessage) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const history = db()
    .prepare(
      `SELECT role, content FROM chat_messages
       WHERE conversation_id = ? ORDER BY id ASC LIMIT 50`
    )
    .all(conversationId) as Array<{ role: "user" | "assistant"; content: string }>;

  const notesContext = buildNotesContext();

  const reply = await chatOverNotes({ notesContext, history, userMessage });

  const insert = db().prepare(
    `INSERT INTO chat_messages(conversation_id, role, content) VALUES(?,?,?)`
  );
  insert.run(conversationId, "user", userMessage);
  insert.run(conversationId, "assistant", reply);

  return NextResponse.json({ reply });
}

export async function GET(req: NextRequest) {
  const conversationId = req.nextUrl.searchParams.get("conversationId") || "default";
  const messages = db()
    .prepare(
      `SELECT role, content, created_at FROM chat_messages
       WHERE conversation_id = ? ORDER BY id ASC`
    )
    .all(conversationId);
  return NextResponse.json({ messages });
}
