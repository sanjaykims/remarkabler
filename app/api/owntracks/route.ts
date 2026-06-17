import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  owntracksConfigured,
  checkOwntracksToken,
  addPoint,
  owntracksStatus,
  owntracksDebug,
} from "@/lib/owntracks";
import { isLocationEnabled } from "@/lib/location";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Status for the Memory page — gated by the app session (the owner).
// `?debug=1` adds a diagnostic snapshot of what the chat tool would see
// (point counts, stay counts, sample raw points, server clock). Cheap.
export async function GET(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  const wantDebug = req.nextUrl.searchParams.get("debug") === "1";
  if (wantDebug) return NextResponse.json(owntracksDebug());
  return NextResponse.json(owntracksStatus());
}

// Ingestion from the OwnTracks app — gated by OWNTRACKS_TOKEN (the app isn't
// logged in). OwnTracks expects a JSON array response.
export async function POST(req: NextRequest) {
  if (!owntracksConfigured()) {
    return NextResponse.json(
      { error: "OwnTracks ingestion is disabled. Set OWNTRACKS_TOKEN in Railway." },
      { status: 503 }
    );
  }

  // Token may arrive as ?token=, an Authorization header, or HTTP Basic password.
  const url = req.nextUrl;
  let token = url.searchParams.get("token");
  const auth = req.headers.get("authorization") || "";
  if (!token && auth.startsWith("Bearer ")) token = auth.slice(7);
  if (!token && auth.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
      token = decoded.split(":")[1] || decoded.split(":")[0];
    } catch {
      // ignore
    }
  }
  if (!checkOwntracksToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isLocationEnabled()) {
    return NextResponse.json(
      { error: "Location sharing is turned off in Remarkabler." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  if (
    body &&
    body._type === "location" &&
    typeof body.lat === "number" &&
    typeof body.lon === "number" &&
    typeof body.tst === "number" &&
    isPlausiblePoint(body.lat, body.lon, body.tst)
  ) {
    addPoint({
      lat: body.lat,
      lng: body.lon,
      tst: body.tst,
      acc: typeof body.acc === "number" ? body.acc : null,
    });
  }
  // OwnTracks expects an array (friend/card list) — empty is fine.
  // Bad/out-of-range points are silently dropped — OwnTracks will retry
  // its own queue on the next publish, no benefit to telling it the
  // payload was rejected.
  return NextResponse.json([]);
}

// Drop points with impossible coordinates or implausible timestamps. The
// route is token-protected so this isn't a security check — it's data
// hygiene. currentLocation() orders by MAX(tst), so a single point with
// tst far in the future would dominate the chat's "where are you now?"
// answer until wall-clock caught up. Real-world OwnTracks publishes are
// always within seconds of real time; allow a small future slop for
// clock skew between the phone and the server.
function isPlausiblePoint(lat: number, lng: number, tst: number): boolean {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return false;
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return false;
  if (!Number.isFinite(tst) || tst <= 0) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  // Allow up to 10 min of phone-side future skew. Anything beyond that is
  // a clock bug or a malformed payload.
  if (tst > nowSec + 10 * 60) return false;
  // 10-year past cutoff. Backfill is fine, time travel from 1970 is not.
  const TEN_YEARS_SEC = 10 * 365 * 86400;
  if (tst < nowSec - TEN_YEARS_SEC) return false;
  return true;
}
