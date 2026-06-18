import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { resetBatchForRetry, maybeCompressChatSessions } from "@/lib/chatMemory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// Reset a permanently-skipped chat archive batch so the next sweep picks it
// up again. Used by the /memory page's "Retry stuck batches" button when
// failed_attempts hit MAX_EXTRACTION_ATTEMPTS.
export async function POST(
  _req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  if (!isAuthenticated()) return LOCKED();
  const batchId = Number(params.batchId);
  if (!Number.isFinite(batchId) || batchId <= 0) {
    return NextResponse.json({ error: "Bad batch id" }, { status: 400 });
  }
  const ok = resetBatchForRetry(batchId);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Fire-and-forget — same path the Clear handler uses.
  try {
    void maybeCompressChatSessions();
  } catch {
    // best-effort
  }
  return NextResponse.json({ ok: true });
}
