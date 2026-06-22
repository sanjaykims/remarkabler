"use client";

import { useEffect, useRef, useState } from "react";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { setUnlocking } from "./lockState";
import { track } from "./analytics";

// Set on a device once it has successfully unlocked, so the lock screen knows
// it can prompt the passkey automatically here (and not on a brand-new phone,
// where an automatic prompt would surface the cross-device QR flow).
const DEVICE_KNOWN_KEY = "fc-device-known";

export default function LockScreen() {
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoTried = useRef(false);
  // Hard guard against concurrent unlock attempts. Two callers can race
  // — the silent auto-attempt on mount and the tap-anywhere listener (or
  // the button) — and WebAuthn doesn't take kindly to two
  // navigator.credentials.get() calls in flight at once. busy is a React
  // state and only updates on the next render, so a ref is needed for an
  // immediate same-tick check.
  const inFlight = useRef(false);
  // Pre-fetched WebAuthn options.
  //
  // The real iOS gotcha (which several previous attempts missed): iOS
  // Safari requires `navigator.credentials.get()` to be invoked
  // SYNCHRONOUSLY within the click event handler's run. Not just "within
  // the spec's 5s activation window", and not even "after one microtask
  // boundary" — actually synchronously, no `await` between the click
  // and the call. The previous version stored the prefetch as a Promise
  // and `await`ed it before calling startAuthentication. Even when the
  // Promise was already resolved, the `await` introduced a microtask
  // boundary and iOS treated activation as consumed. Modal didn't open
  // on the first tap; second tap worked because by then state had
  // changed enough that the timing differed.
  //
  // Two slots, used in this priority order at click time:
  //
  //   1. `cachedAuthOptionsValue` — the resolved options object.
  //      The click handler can read this synchronously and pass it
  //      straight to startAuthentication. startAuthentication is async
  //      but its body runs synchronously up to its own await, and that
  //      await is AFTER the navigator.credentials.get() call — so the
  //      Face ID modal opens inside the same synchronous run as the
  //      click event. THIS is the iOS-compatible path.
  //
  //   2. `cachedAuthOptionsPromise` — the in-flight prefetch promise.
  //      If we haven't received the response yet, the click handler
  //      awaits this promise (losing activation, same as a live fetch
  //      would). But we use the SAME promise, never fire a parallel
  //      one, so the server's single fc_challenge cookie never gets
  //      overwritten by a stale response (the race Codex caught on PR
  //      #64).
  //
  // The challenge cookie has a 5-minute TTL; the prefetched challenge
  // is good as long as the user taps within that window.
  const cachedAuthOptionsValue =
    useRef<PublicKeyCredentialRequestOptionsJSON | null>(null);
  const cachedAuthOptionsPromise =
    useRef<Promise<PublicKeyCredentialRequestOptionsJSON> | null>(null);

  useEffect(() => {
    // Kick off the options prefetch in parallel with the registration
    // check, gated on the "known device" localStorage flag — same flag
    // the auto-trigger uses. This way the cached value is usually ready
    // by the time the user taps. Wasted ~5KB on an unknown device is
    // fine.
    let known = false;
    try {
      known = localStorage.getItem(DEVICE_KNOWN_KEY) === "1";
    } catch {
      // localStorage unavailable
    }
    if (known) prefetchAuthOptions();

    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => setRegistered(!!d.registered))
      .catch(() => setRegistered(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post(payload: object) {
    const r = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Something went wrong.");
    return d;
  }

  function rememberDevice() {
    try {
      localStorage.setItem(DEVICE_KNOWN_KEY, "1");
    } catch {
      // localStorage unavailable
    }
  }

  // Start a prefetch of WebAuthn login-options if one isn't already in
  // flight. Stores the in-flight Promise in one slot and, on resolution,
  // moves the value into a second slot the click handler can read
  // SYNCHRONOUSLY. Idempotent; safe to call from multiple places.
  function prefetchAuthOptions() {
    if (cachedAuthOptionsValue.current || cachedAuthOptionsPromise.current) return;
    const p = post({
      action: "login-options",
    }) as Promise<PublicKeyCredentialRequestOptionsJSON>;
    cachedAuthOptionsPromise.current = p;
    p.then((options) => {
      if (cachedAuthOptionsPromise.current === p) {
        cachedAuthOptionsPromise.current = null;
        cachedAuthOptionsValue.current = options;
      }
    }).catch(() => {
      if (cachedAuthOptionsPromise.current === p) {
        cachedAuthOptionsPromise.current = null;
      }
    });
  }

  // Continuation after we have options in hand. Sends the signed
  // assertion to login-verify and reloads on success.
  function completeUnlock(
    credPromise: Promise<Awaited<ReturnType<typeof startAuthentication>>>,
    silent: boolean
  ) {
    credPromise
      .then((cred) => post({ action: "login-verify", response: cred }))
      .then(() => {
        rememberDevice();
        track("unlock_success", { method: "biometric" });
        location.reload();
      })
      .catch((e) => {
        if (!silent) setError(friendly(e, "Couldn't unlock with biometrics."));
        setBusy(false);
        setUnlocking(false);
        inFlight.current = false;
        prefetchAuthOptions();
      });
  }

  // `silent` is used by the automatic prompt: a failure there (e.g. iOS needs
  // a tap) should quietly fall back to the buttons, not show an error.
  //
  // CRITICAL: this function is NOT `async` for the fast (cached-value)
  // path. iOS Safari requires navigator.credentials.get() to be invoked
  // synchronously within the click event handler — even an await on a
  // resolved Promise introduces a microtask boundary that iOS treats as
  // consuming user activation. The fast path therefore calls
  // startAuthentication() synchronously (its body runs to its own
  // internal `await navigator.credentials.get(...)` synchronously, so
  // the Face ID modal opens inside the same tick as the click event).
  // The result is then awaited via .then() chaining in completeUnlock.
  function unlockBiometric(silent = false) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setUnlocking(true);

    // FAST PATH: cached value present. SYNCHRONOUS call to
    // startAuthentication keeps iOS user activation alive.
    const value = cachedAuthOptionsValue.current;
    if (value) {
      cachedAuthOptionsValue.current = null;
      // startAuthentication is async, but its body runs synchronously up
      // to its OWN await — which is `await navigator.credentials.get(…)`.
      // So invoking it here triggers the Face ID modal synchronously
      // within this function's synchronous prefix, which is itself
      // inside the click handler. No microtask boundary before the
      // navigator.credentials.get() call.
      const credPromise = startAuthentication({ optionsJSON: value });
      completeUnlock(credPromise, silent);
      // Re-prime the cache for a possible retry without waiting on
      // anything (don't .then-chain here — that's a microtask too).
      prefetchAuthOptions();
      return;
    }

    // SLOW PATH: no cached value yet. Take the in-flight prefetch
    // promise (or fire one) and await it. Activation may be lost here
    // on iOS, but there's no race — exactly one login-options request
    // is ever in play, so the fc_challenge cookie stays consistent with
    // the assertion we sign (Codex's PR #64 race fix preserved).
    const promise =
      cachedAuthOptionsPromise.current ??
      (post({
        action: "login-options",
      }) as Promise<PublicKeyCredentialRequestOptionsJSON>);
    cachedAuthOptionsPromise.current = null;
    promise
      .then((options) => {
        const credPromise = startAuthentication({ optionsJSON: options });
        completeUnlock(credPromise, silent);
      })
      .catch((e) => {
        if (!silent) setError(friendly(e, "Couldn't unlock with biometrics."));
        setBusy(false);
        setUnlocking(false);
        inFlight.current = false;
        prefetchAuthOptions();
      });
  }

  async function unlockPasscode() {
    setBusy(true);
    setError(null);
    try {
      await post({ action: "passcode", passcode });
      rememberDevice();
      track("unlock_success", { method: "passcode" });
      location.reload();
    } catch (e) {
      setError(friendly(e, "Wrong passcode."));
      setBusy(false);
    }
  }

  async function registerDevice() {
    setBusy(true);
    setError(null);
    setUnlocking(true);
    try {
      const options = await post({ action: "register-options", passcode });
      const cred = await startRegistration({ optionsJSON: options });
      await post({ action: "register-verify", response: cred });
      rememberDevice();
      track("device_registered");
      location.reload();
    } catch (e) {
      setError(friendly(e, "Couldn't set up this device."));
      setBusy(false);
      setUnlocking(false);
    }
  }

  // On a device that has unlocked before, surface Face ID / fingerprint
  // automatically — opening the app should go straight to the biometric
  // prompt without making the user aim at a button.
  //
  // Two paths, picked by platform because the constraints differ:
  //
  //   Android Chrome: silent auto-attempt on mount + on every foreground.
  //     The browser allows navigator.credentials.get() without a user
  //     gesture, so the Face ID/fingerprint prompt just opens.
  //
  //   iOS Safari: silent auto won't work — WebAuthn there requires
  //     "transient user activation". The Springboard tap that opened the
  //     app doesn't carry over into the web view's document. We install a
  //     `click` listener on the document so the user's first tap ANYWHERE
  //     on the lock screen activates the page and fires Face ID. (Tried
  //     `pointerdown` first; the HTML spec only treats pointerdown as
  //     activating for pointerType="mouse", NOT touch. Touch needs
  //     touchend or click to activate. Click works on every platform.)
  //     Skipping silent on iOS also avoids a tiny inFlight race where the
  //     silent attempt's brief lock could swallow the user's tap.
  //
  // Skipped entirely if showPasscode is true — the passcode-setup flow
  // has an input field and shouldn't get a stray Face ID modal.
  useEffect(() => {
    if (registered !== true || showPasscode) return;
    let known = false;
    try {
      known = localStorage.getItem(DEVICE_KNOWN_KEY) === "1";
    } catch {
      known = false;
    }
    if (!known) return;

    // Warm the WebAuthn options cache so the next tap can fire
    // navigator.credentials.get() synchronously and keep its user
    // activation alive on iOS. See cachedAuthOptions field comment.
    void prefetchAuthOptions();

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isIOS =
      /iPhone|iPad|iPod/.test(ua) ||
      (/Mac/.test(ua) &&
        typeof navigator !== "undefined" &&
        navigator.maxTouchPoints > 1);

    // Android-style silent auto-attempt — skipped on iOS.
    let visListener: (() => void) | null = null;
    if (!isIOS) {
      visListener = () => {
        if (autoTried.current || document.visibilityState !== "visible") return;
        autoTried.current = true;
        unlockBiometric(true);
      };
      visListener();
      document.addEventListener("visibilitychange", visListener);
    }

    // Universal: first click anywhere on the page fires the prompt. On
    // iOS this is mandatory (and finally works because `click` actually
    // establishes user activation for touch). On any platform it lets the
    // user tap anywhere instead of finding the small unlock button.
    const onFirstClick = () => {
      unlockBiometric(false);
    };
    document.addEventListener("click", onFirstClick, { once: true });

    return () => {
      if (visListener)
        document.removeEventListener("visibilitychange", visListener);
      document.removeEventListener("click", onFirstClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registered, showPasscode]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-5 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Remarkabler</h1>
          <p className="opacity-60 text-sm mt-1">
            This app is private and locked.
          </p>
        </div>

        {registered === null && (
          <p className="text-sm opacity-60">Loading…</p>
        )}

        {registered === true && (
          <>
            <button
              onClick={() => unlockBiometric(false)}
              disabled={busy}
              className="w-full rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              {busy ? "Please wait…" : "Unlock with fingerprint / Face ID"}
            </button>
            <div className="pt-1">
              <p className="text-xs opacity-60 mb-2">
                New phone, or unlock didn&rsquo;t work? Set this phone up first
                so it opens with its own fingerprint / Face ID. (If you see a
                QR code, it&rsquo;s because this phone isn&rsquo;t set up yet.)
              </p>
              <button
                onClick={() => setShowPasscode((v) => !v)}
                disabled={busy}
                className="w-full rounded border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm disabled:opacity-50"
              >
                Set up this phone
              </button>
            </div>
          </>
        )}

        {registered === false && (
          <p className="text-sm opacity-70">
            First time on this device — set up the lock. Enter the backup
            passcode you set in Railway, then register your fingerprint or
            Face ID.
          </p>
        )}

        {(registered === false || showPasscode) && (
          <div className="space-y-3 pt-1">
            <input
              type="password"
              autoComplete="off"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Backup passcode"
              disabled={busy}
              className="w-full rounded border border-stone-300 dark:border-stone-700 px-3 py-2 bg-transparent text-center"
            />
            <button
              onClick={registerDevice}
              disabled={busy || !passcode}
              className="w-full rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              {busy ? "Please wait…" : "Register fingerprint / Face ID"}
            </button>
            <button
              onClick={unlockPasscode}
              disabled={busy || !passcode}
              className="w-full rounded border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm disabled:opacity-50"
            >
              Unlock with passcode only
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </main>
  );
}

// Browser WebAuthn failures (cancelled prompt, timeout) throw generic
// DOMExceptions — surface a readable message instead.
function friendly(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : "";
  if (/timed out|timeout|NotAllowed/i.test(msg)) {
    return "Cancelled or timed out. Please try again.";
  }
  if (
    /credential manager|InvalidStateError|already (registered|exists)|unknown error/i.test(
      msg
    )
  ) {
    return "Your phone may still have an old Remarkabler passkey from a previous setup. Tap \"Unlock with passcode only\" below — it always works. To fix the fingerprint later, delete the existing Remarkabler passkey in your phone's settings (Passwords & Passkeys, or Samsung Pass) and try Register again.";
  }
  return msg || fallback;
}
