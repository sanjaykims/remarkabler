import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { remarkableStatus } from "@/lib/remarkableCloud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// GET — current pairing status (no network call; reads stored settings).
export async function GET() {
  if (!isAuthenticated()) return LOCKED();
  return NextResponse.json(remarkableStatus());
}
