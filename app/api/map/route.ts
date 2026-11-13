import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { mapData } from "@/lib/owntracks";
import { clampMapDays } from "@/lib/mapData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  const days = clampMapDays(req.nextUrl.searchParams.get("days"));
  return NextResponse.json({ days, ...mapData(days) });
}
