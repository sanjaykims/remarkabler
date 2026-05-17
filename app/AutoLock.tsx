"use client";

import { useEffect, useState } from "react";
import LockScreen from "./LockScreen";
import { isUnlocking, isPickingFile } from "./lockState";

/**
 * Locks the app whenever it is sent to the background. The moment the page is
 * hidden it drops the server session and covers the screen with the lock
 * overlay, so returning to the app requires the passkey again.
 */
export default function AutoLock() {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== "hidden") return;
      // Don't re-lock while a passkey prompt or the file picker is open.
      if (isUnlocking() || isPickingFile()) return;
      setLocked(true);
      // keepalive lets the logout finish even as the page is being hidden.
      fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
        keepalive: true,
      }).catch(() => {});
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (!locked) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-stone-50 dark:bg-stone-950">
      <LockScreen />
    </div>
  );
}
