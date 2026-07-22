"use client";

import { useEffect, useState } from "react";

// Shown only when the app lock is OFF (APP_PASSCODE unset) — see
// app/layout.tsx, which renders this solely in that case. When the lock is
// off the whole app + every API is open to anyone with the URL, so this
// nags the owner to turn it on.
//
// Uses the red/danger tone from DESIGN.md, NOT amber — amber is reserved for
// the single primary CTA ("the yellow is sacred"). Dismiss is stored in
// sessionStorage so it re-appears on the next app open rather than being
// silenced forever: a standing security warning should keep coming back.
const DISMISS_KEY = "lockoff_banner_dismissed";

export default function LockOffBanner() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // Start hidden and only reveal after checking sessionStorage, so a
    // dismissed banner never flashes on navigation within the same session.
    setHidden(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (hidden) return null;

  return (
    <div
      role="alert"
      className="border-b border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200 pt-safe pl-safe pr-safe"
    >
      <div className="mx-auto flex max-w-5xl items-start gap-3">
        <span className="flex-1">
          <strong className="font-semibold">This diary is unlocked.</strong>{" "}
          No passcode is set, so anyone with the link can read everything. Set{" "}
          <code className="rounded bg-red-100 px-1 dark:bg-red-900/60">
            APP_PASSCODE
          </code>{" "}
          in your environment (Railway) to require a passkey or passcode.
        </span>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, "1");
            setHidden(true);
          }}
          className="shrink-0 rounded px-2 py-0.5 text-red-700 underline underline-offset-2 hover:opacity-80 dark:text-red-300"
          aria-label="Dismiss for this session"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
