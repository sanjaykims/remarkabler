import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getCurrentProfileRow, saveProfile } from "@/lib/profile";
import { buildSelfModel } from "@/lib/claude";
import { buildNotesContext } from "@/lib/notes";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 120;

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

function hasNotes(): boolean {
  const r = db()
    .prepare(
      `SELECT COUNT(*) AS c FROM pages WHERE ocr_text IS NOT NULL AND ocr_text != ''`
    )
    .get() as { c: number };
  return r.c > 0;
}

export async function GET() {
  if (!isAuthenticated()) return LOCKED();
  const row = getCurrentProfileRow();
  return NextResponse.json({
    content: row?.content ?? "",
    updatedAt: row?.created_at ?? null,
    hasNotes: hasNotes(),
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return LOCKED();
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "save") {
    const content = String(body.content || "").trim();
    if (!content) {
      return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
    }
    saveProfile(content, "edit");
    return NextResponse.json({ ok: true });
  }

  if (action === "rebuild") {
    if (!hasNotes()) {
      return NextResponse.json(
        { error: "Add some notebooks first — there's nothing to build from yet." },
        { status: 400 }
      );
    }
    let content: string;
    try {
      content = await buildSelfModel({ notesContext: buildNotesContext() });
    } catch (err) {
      return NextResponse.json(
        { error: `Rebuild failed: ${(err as Error).message}` },
        { status: 500 }
      );
    }
    if (!content.trim()) {
      return NextResponse.json(
        { error: "No profile was produced. Please try again." },
        { status: 500 }
      );
    }
    saveProfile(content, "rebuild");
    return NextResponse.json({ ok: true, content });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
