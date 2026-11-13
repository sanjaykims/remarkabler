import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { addLocation, listRecentLocations, isLocationEnabled } from "@/lib/location";
import { reverseGeocodePlace } from "@/lib/geocode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

export async function GET() {
  if (!(await isAuthenticated())) return LOCKED();
  return NextResponse.json({ locations: listRecentLocations(20) });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
  if (!isLocationEnabled()) {
    return NextResponse.json(
      { error: "Location sharing is turned off in Remarkabler." },
      { status: 403 }
    );
  }
  const body = await req.json().catch(() => ({}));
  const lat = body.lat;
  const lng = body.lng;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }
  const place = (await reverseGeocodePlace(lat, lng)).slice(0, 200);
  addLocation({
    lat,
    lng,
    place,
    localTime: String(body.localTime || "").slice(0, 60),
  });
  return NextResponse.json({ ok: true, place });
}
