"use client";

import { useEffect, useState } from "react";
import LockScreen from "./LockScreen";
import { isUnlocking, isPickingFile } from "./lockState";

/**
 * Locks the app when it is sent to the background — but not the *instant*
 * it's hidden. We wait a short grace window (30s) so brief Android tab
 * switches (notification, copy-paste, switching to a different app to grab
 * one piece of info) don't drag the user through a full re-auth + reload.
 * If the page becomes visible again before the timer fires, the pending
 * lock is cancelled.
 */
const LOCK_GRACE_MS = 30_000;

export default function AutoLock() {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;

    function cancelPending() {
      if (pending) {
        clearTimeout(pending);
        pending = null;
      }
    }

    function lockNow() {
      pending = null;
      setLocked(true);
      // keepalive lets the logout finish even if the page is being hidden.
      fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
        keepalive: true,
      }).catch(() => {});
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        // Came back inside the grace window — never mind.
        cancelPending();
        return;
      }
      // Hidden. Don't re-lock while a passkey prompt or file picker is open.
      if (isUnlocking() || isPickingFile()) return;
      if (pending) return; // grace timer already running
      pending = setTimeout(lockNow, LOCK_GRACE_MS);
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      cancelPending();
    };
  }, []);

  if (!locked) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-stone-50 dark:bg-stone-950">
      <LockScreen />
    </div>
  );
}
