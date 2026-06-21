import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  clearCompressionInFlight,
  maybeCompressChatSessions,
} from "@/lib/chatMemory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// Force a chat-memory extraction sweep right now. Used by the /memory page's
// "Process pending now" button when a batch has been sitting at
// memory_extracted_at IS NULL longer than feels normal — either because the
// throttled background sweep hasn't fired (5-minute window), or because a
// previous in-flight call hung and left the lock set.
//
// Clears the in-flight guard first (defensive — any sweep older than 5
// minutes is already considered stale, but this guarantees the kicked sweep
// runs synchronously rather than no-op'ing). Awaits the sweep so the caller
// sees the real outcome (processed / inserted / failed) instead of
// fire-and-forget silence.
export async function POST() {
  if (!isAuthenticated()) return LOCKED();
  clearCompressionInFlight();
  const result = await maybeCompressChatSessions(25);
  return NextResponse.json({ ok: true, result });
}
