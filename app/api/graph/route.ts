import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { buildDiaryGraph } from "@/lib/diaryGraph";
import { addVaultNotesToGraph } from "@/lib/vaultGraph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/graph
// Returns the diary-native graph payload used by /graph: entities, diary days,
// exported Claude notes, co-occurrence links, and typed relationships.
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  try {
    const base = buildDiaryGraph();
    return NextResponse.json(await addVaultNotesToGraph(base).catch(() => base));
  } catch (e) {
    return NextResponse.json(
      { error: `Graph data failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
