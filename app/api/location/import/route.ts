import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { parseTimeline, saveStops, routeStopCount } from "@/lib/timeline";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "That file is too large (max 50 MB). Export a shorter date range." },
      { status: 400 }
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    return NextResponse.json(
      { error: "That file isn't valid JSON. Upload the Timeline/Location History export from Google." },
      { status: 400 }
    );
  }

  const { stops, hint } = parseTimeline(json);
  if (stops.length === 0) {
    return NextResponse.json(
      {
        error: `Couldn't find any place visits in that file. Detected structure: ${hint}. Tell Claude this so the format can be added.`,
      },
      { status: 400 }
    );
  }

  const added = saveStops(stops);
  return NextResponse.json({
    ok: true,
    found: stops.length,
    added,
    total: routeStopCount(),
  });
}
