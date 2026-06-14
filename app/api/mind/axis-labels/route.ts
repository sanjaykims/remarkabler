import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { generateAxisLabels } from "@/lib/mind";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mind/axis-labels
// Runs PCA on the corpus, picks the 5 entries at each extreme of each of the
// three axes, sends them to Claude with their cached themes/summary, and
// stores the resulting 6 short labels alongside the PC vectors so subsequent
// map renders project onto the same axes. One Claude call total — cost is
// fixed regardless of how big the corpus is.
export async function POST() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  try {
    const result = await generateAxisLabels();
    if ("error" in result) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: `Labelling failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
