import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { listRemarkableNotebooks, remarkableStatus } from "@/lib/remarkableCloud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// POST — re-list notebooks from the paired cloud account (a live connectivity
// re-check). Read-only.
export async function POST() {
  if (!isAuthenticated()) return LOCKED();
  const list = await listRemarkableNotebooks();
  return NextResponse.json({
    ok: list.ok,
    count: list.notebooks?.length ?? 0,
    error: list.error,
    status: remarkableStatus(),
  });
}
