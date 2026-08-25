import { NextResponse } from "next/server";
import { findDuplicateCandidates } from "@/lib/notebookDedupDb";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () =>
  NextResponse.json({ error: "Locked" }, { status: 401 });

export async function GET() {
  if (!(await isAuthenticated())) return LOCKED();
  return NextResponse.json({ candidates: findDuplicateCandidates() });
}
