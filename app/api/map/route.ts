import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { mapData } from "@/lib/owntracks";
import { clampMapDays } from "@/lib/mapData";
import { MAP_UNLOCK_COOKIE, verifyUnlockToken } from "@/lib/mapPin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  // Second layer: a valid map-PIN unlock cookie is required (lib/mapPin.ts).
  if (!verifyUnlockToken(req.cookies.get(MAP_UNLOCK_COOKIE)?.value)) {
    return NextResponse.json({ error: "Map PIN required" }, { status: 403 });
  }
  const days = clampMapDays(req.nextUrl.searchParams.get("days"));
  return NextResponse.json({ days, ...mapData(days) });
}
