import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { isDisciplineEnabled, setDisciplineEnabled } from "@/lib/notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

export async function GET() {
  if (!isAuthenticated()) return LOCKED();
  return NextResponse.json({ enabled: isDisciplineEnabled() });
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return LOCKED();
  const body = await req.json().catch(() => ({}));
  const enabled = Boolean((body as { enabled?: unknown }).enabled);
  setDisciplineEnabled(enabled);
  return NextResponse.json({ enabled });
}
