import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { buildDiaryGraph } from "@/lib/diaryGraph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/graph
// Returns the diary-native graph payload used by /graph: entities, diary days,
// exported Claude notes, co-occurrence links, and typed relationships.
export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  try {
    return NextResponse.json(buildDiaryGraph());
  } catch (e) {
    return NextResponse.json(
      { error: `Graph data failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
