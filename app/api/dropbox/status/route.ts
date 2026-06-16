import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { dropboxStatus } from "@/lib/dropbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  return NextResponse.json(dropboxStatus());
}
