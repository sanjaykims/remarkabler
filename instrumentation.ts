// Runs once when the Next.js server starts (needs experimental.instrumentationHook
// in next.config.mjs on Next 14.2; default-on from Next 15).
//
// This app does a lot of fire-and-forget background work (OCR, Dropbox
// ingest, reMarkable sync, chat-memory extraction, entity-wiki refresh — see
// runMaintenanceSweep in lib/notes.ts) that's deliberately never awaited by
// the request that triggers it. Every one of those call sites is guarded
// with its own .catch(), but a single missed one — here or in a future
// change, or in a dependency — becomes an unhandled promise rejection. Node
// 15+ treats that as fatal by default and kills the whole process, taking
// the app down for the one person using it until Railway restarts it. Log
// and keep running instead: a background job failing is recoverable (the
// maintenance sweep retries on its own schedule); the server going down is
// not.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection]", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("[uncaughtException]", err);
  });
}
