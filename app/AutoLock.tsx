"use client";

import { useEffect, useState } from "react";
import LockScreen from "./LockScreen";
import { isUnlocking, isPickingFile } from "./lockState";

/**
 * Locks the app the moment it's sent to the background — no grace window.
 * The user opted for strict lock-on-every-switch; even a quick notification
 * tap will force a fingerprint prompt on return.
 *
 * The "have we been hidden?" decision can't be made by an in-memory
 * setTimeout alone: Android Chrome pauses JavaScript when a tab is
 * backgrounded, so any timer may not fire. Instead we persist a
 * `hidden_since` timestamp to localStorage on hide, and on every visible
 * event AND every fresh mount we recompute "ms since we were last visible"
 * — past the grace window (now zero), we lock immediately. That makes the
 * lock survive every lifecycle the browser might subject the page to.
 */
const LOCK_GRACE_MS = 0;
const HIDDEN_KEY = "remarkabler:hidden_since";

function readHiddenSince(): number | null {
  try {
    const v = localStorage.getItem(HIDDEN_KEY);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeHiddenSince(t: number): void {
  try {
    localStorage.setItem(HIDDEN_KEY, String(t));
  } catch {
    // private mode / quota — best-effort
  }
}

function clearHiddenSince(): void {
  try {
    localStorage.removeItem(HIDDEN_KEY);
  } catch {
    // best-effort
  }
}

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
      clearHiddenSince();
      setLocked(true);
      // keepalive lets the logout finish even if the page is being unloaded.
      fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
        keepalive: true,
      }).catch(() => {});
    }

    function markHiddenIfNeeded() {
      if (readHiddenSince() === null) writeHiddenSince(Date.now());
    }

    // On mount: if the page was hidden longer than the grace window before
    // (whether because the timer was paused, or the tab was killed, or the
    // user closed the PWA entirely and reopened it), lock right now.
    const hiddenSince = readHiddenSince();
    if (hiddenSince !== null && Date.now() - hiddenSince >= LOCK_GRACE_MS) {
      lockNow();
    } else {
      clearHiddenSince();
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        // Came back. Check elapsed time directly — don't rely on the timer
        // having fired, because Android Chrome pauses JS for hidden tabs.
        const hs = readHiddenSince();
        cancelPending();
        if (hs !== null && Date.now() - hs >= LOCK_GRACE_MS) {
          lockNow();
        } else {
          clearHiddenSince();
        }
        return;
      }
      // Hidden. Don't re-lock while a passkey prompt or file picker is open.
      if (isUnlocking() || isPickingFile()) return;
      markHiddenIfNeeded();
      if (pending) return; // grace timer already running
      pending = setTimeout(lockNow, LOCK_GRACE_MS);
    }

    function onPageHide() {
      // pagehide fires more reliably than visibilitychange when the OS is
      // about to kill the tab — write the hidden_since timestamp so the
      // next mount can recover and lock if appropriate.
      if (isUnlocking() || isPickingFile()) return;
      markHiddenIfNeeded();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
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
