import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  discardPendingShare,
  listPendingShares,
  readPendingShare,
} from "@/lib/pendingShares";
import { createNotebook, queueNotebookProcessing } from "@/lib/notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

export async function GET() {
  if (!(await isAuthenticated())) return LOCKED();
  return NextResponse.json({ shares: listPendingShares() });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
  const body = (await req.json().catch(() => null)) as
    | { id?: unknown; action?: unknown }
    | null;
  if (body?.action !== "approve" || typeof body.id !== "string") {
    return NextResponse.json({ error: "Invalid approval request" }, { status: 400 });
  }

  const pending = readPendingShare(body.id);
  if (!pending) {
    return NextResponse.json({ error: "Pending share not found" }, { status: 404 });
  }

  const existing = db()
    .prepare(`SELECT id FROM notebooks WHERE id = ?`)
    .get(pending.share.notebookId) as { id: string } | undefined;
  const notebook = existing
    ? { id: existing.id, name: pending.share.name.replace(/\.pdf$/i, "") }
    : createNotebook(
        pending.share.name,
        pending.bytes,
        pending.share.notebookId
      );

  // The deterministic notebook id makes a retry safe if the process stopped
  // between notebook creation and quarantine cleanup.
  discardPendingShare(body.id);
  queueNotebookProcessing(notebook.id);
  return NextResponse.json({ ok: true, notebook });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  if (!discardPendingShare(id)) {
    return NextResponse.json({ error: "Pending share not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
