import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { addLocation, listRecentLocations } from "@/lib/location";

export const runtime = "nodejs";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

export async function GET() {
  if (!isAuthenticated()) return LOCKED();
  return NextResponse.json({ locations: listRecentLocations(20) });
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) return LOCKED();
  const body = await req.json().catch(() => ({}));
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }
  addLocation({
    lat,
    lng,
    place: String(body.place || "").slice(0, 200),
    localTime: String(body.localTime || "").slice(0, 60),
  });
  return NextResponse.json({ ok: true });
}
