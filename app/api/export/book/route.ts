import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { getCurrentProfile } from "@/lib/profile";
import { buildNotesContext } from "@/lib/notes";
import { composeBook } from "@/lib/claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Composing a chaptered book is a long generation. Streaming inside
// composeBook keeps the connection alive, but the route itself needs a
// generous maxDuration too.
export const maxDuration = 600;

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

export async function GET() {
  if (!(await isAuthenticated())) return LOCKED();

  const profile = getCurrentProfile() || "";
  const diary = buildNotesContext();
  const insightRows = db()
    .prepare(
      `SELECT title, content, created_at FROM insights ORDER BY id ASC`
    )
    .all() as Array<{
      title: string | null;
      content: string;
      created_at: string;
    }>;
  const insights = insightRows
    .map((r) => {
      const t = r.title?.trim() ? `## ${r.title.trim()}\n` : "";
      return `${t}${r.content.trim()}`;
    })
    .join("\n\n---\n\n");

  const exportedAt = new Date().toISOString().slice(0, 10);

  let text: string;
  try {
    const result = await composeBook({
      profile,
      diary,
      insights,
      exportedAt,
    });
    text = result.text;
  } catch (err) {
    return NextResponse.json(
      { error: `Book composition failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  if (!text.trim()) {
    return NextResponse.json(
      { error: "No book was produced. Please try again." },
      { status: 500 }
    );
  }

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="remarkabler-book-${exportedAt}.md"`,
    },
  });
}
