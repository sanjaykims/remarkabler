import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  owntracksConfigured,
  checkOwntracksToken,
  addPoint,
  owntracksStatus,
} from "@/lib/owntracks";

export const runtime = "nodejs";

// Status for the Memory page — gated by the app session (the owner).
export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
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

  const body = await req.json().catch(() => null);
  if (
    body &&
    body._type === "location" &&
    typeof body.lat === "number" &&
    typeof body.lon === "number" &&
    typeof body.tst === "number"
  ) {
    addPoint({
      lat: body.lat,
      lng: body.lon,
      tst: body.tst,
      acc: typeof body.acc === "number" ? body.acc : null,
    });
  }
  // OwnTracks expects an array (friend/card list) — empty is fine.
  return NextResponse.json([]);
}
