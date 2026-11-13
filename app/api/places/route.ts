import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { isLocationEnabled } from "@/lib/location";
import { currentLocation } from "@/lib/owntracks";
import { addSavedPlace, deleteSavedPlace, listSavedPlaces } from "@/lib/savedPlaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

export async function GET() {
  if (!(await isAuthenticated())) return LOCKED();
  return NextResponse.json({ places: listSavedPlaces() });
}

/**
 * Save a named place. With explicit `lat`/`lng` it saves those; with neither,
 * it saves the newest OwnTracks position ("save where I am now") — the phone
 * can't send coordinates from the Memory page reliably, but the server already
 * has the latest point.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
  const body = (await req.json().catch(() => ({}))) as {
    name?: unknown;
    lat?: unknown;
    lng?: unknown;
    radius_m?: unknown;
  };

  let { lat, lng } = body;
  const hasLat = lat !== undefined && lat !== null;
  const hasLng = lng !== undefined && lng !== null;
  if (hasLat !== hasLng) {
    return NextResponse.json({ error: "Send both lat and lng, or neither." }, { status: 400 });
  }
  if (!hasLat) {
    if (!isLocationEnabled()) {
      return NextResponse.json(
        { error: "Location sharing is turned off in Remarkabler." },
        { status: 403 }
      );
    }
    const current = currentLocation();
    if (!current) {
      return NextResponse.json(
        { error: "No recent OwnTracks position yet — open OwnTracks and try again." },
        { status: 409 }
      );
    }
    lat = current.lat;
    lng = current.lng;
  }

  const result = addSavedPlace({ name: body.name, lat, lng, radius_m: body.radius_m });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, place: result.place });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Bad id." }, { status: 400 });
  }
  return NextResponse.json({ ok: deleteSavedPlace(id) });
}
