// Runs once when the Next.js server starts (needs experimental.instrumentationHook
// in next.config.mjs on Next 14.2; default-on from Next 15).
//
// Two jobs:
//
// 1. This app does a lot of fire-and-forget background work (OCR, Dropbox
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
//
// 2. Starts the real background timer that actually drives that maintenance
// sweep (startBackgroundMaintenanceScheduler, lib/notes.ts) — this is the
// ONE place in the app that runs independent of any HTTP request, so it's
// what makes zero-tap sync (reMarkable cloud polling, Dropbox ingest) work
// purely from writing on the device and closing the cover, with no need to
// ever open the app. Without this, that background work only ever ran as a
// side effect of someone loading a page.
export async function register() {
  // The inline `process.env.NEXT_RUNTIME === "nodejs"` form (not an early
  // return, not the condition stored in a variable first) is required —
  // Next.js pattern-matches on exactly this shape to exclude the guarded
  // import from the edge bundle it also builds this file for. lib/notes.ts
  // pulls in Node builtins (fs/path via lib/cleanup.ts) that don't exist on
  // edge, so without this exact form the build fails trying to resolve them
  // for a runtime this code never actually executes on.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.on("unhandledRejection", (reason) => {
      console.error("[unhandledRejection]", reason);
    });
    process.on("uncaughtException", (err) => {
      console.error("[uncaughtException]", err);
    });

    const { startBackgroundMaintenanceScheduler } = await import("./lib/notes");
    startBackgroundMaintenanceScheduler();
  }
}
