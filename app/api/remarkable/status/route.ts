import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { remarkableStatus } from "@/lib/remarkableCloud";
import { remarkableSyncStatus } from "@/lib/remarkableSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// GET — current pairing status (no network call; reads stored settings),
// plus the zero-tap sync status (folders, last run, last error/note).
export async function GET() {
  if (!(await isAuthenticated())) return LOCKED();
  return NextResponse.json({ ...remarkableStatus(), sync: remarkableSyncStatus() });
}
