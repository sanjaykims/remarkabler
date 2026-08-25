import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// Soft delete a chat memory. The row stays so recall can re-skip it on
// future scans (deleted_at IS NOT NULL); a hard delete would let an
// identical text resurface from a future extraction.
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await isAuthenticated())) return LOCKED();
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }
  const r = db()
    .prepare(
      `UPDATE chat_memories SET deleted_at = datetime('now')
       WHERE id = ? AND deleted_at IS NULL`
    )
    .run(id);
  if (r.changes === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
