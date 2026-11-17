import { NextRequest, NextResponse } from "next/server";
import { findDuplicateCandidates } from "@/lib/notebookDedupDb";
import { isAuthenticated } from "@/lib/auth";
import { notebooksPinDenied } from "@/lib/notebooksPin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () =>
  NextResponse.json({ error: "Locked" }, { status: 401 });

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
  const pinDenied = notebooksPinDenied(req);
  if (pinDenied) return pinDenied;
  return NextResponse.json({ candidates: findDuplicateCandidates() });
}
