import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { isLocationEnabled, setLocationEnabled } from "@/lib/location";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

export async function GET() {
  if (!isAuthenticated()) return LOCKED();
  return NextResponse.json({ enabled: isLocationEnabled() });
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return LOCKED();
  const body = await req.json().catch(() => ({}));
  const enabled = Boolean((body as { enabled?: unknown }).enabled);
  setLocationEnabled(enabled);
  return NextResponse.json({ enabled });
}
