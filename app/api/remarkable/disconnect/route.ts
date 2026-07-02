import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { unpairRemarkable, remarkableStatus } from "@/lib/remarkableCloud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// POST — forget the paired reMarkable cloud account (clears the device token
// and related settings). Local-only; does not revoke on reMarkable's side.
export async function POST() {
  if (!isAuthenticated()) return LOCKED();
  unpairRemarkable();
  return NextResponse.json({ ok: true, status: remarkableStatus() });
}
