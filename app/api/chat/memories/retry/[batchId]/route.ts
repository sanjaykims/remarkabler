import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { resetBatchForRetry, maybeCompressChatSessions } from "@/lib/chatMemory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// Reset a permanently-skipped chat archive batch so the next sweep picks it
// up again. Used by the /memory page's "Retry stuck batches" button when
// failed_attempts hit MAX_EXTRACTION_ATTEMPTS.
export async function POST(_req: NextRequest, props: { params: Promise<{ batchId: string }> }) {
  const params = await props.params;
  if (!(await isAuthenticated())) return LOCKED();
  const batchId = Number(params.batchId);
  if (!Number.isFinite(batchId) || batchId <= 0) {
    return NextResponse.json({ error: "Bad batch id" }, { status: 400 });
  }
  const ok = resetBatchForRetry(batchId);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Fire-and-forget — same path the Clear handler uses. The .catch() is
  // load-bearing: the outer try/catch only guards the synchronous call setup,
  // so an async rejection (a DB error inside compressBatch) would otherwise be
  // an unhandled rejection (CLAUDE.md's fire-and-forget rule).
  try {
    void maybeCompressChatSessions().catch((e) =>
      console.warn("[chat] memory compression failed:", (e as Error).message)
    );
  } catch {
    // best-effort
  }
  return NextResponse.json({ ok: true });
}
