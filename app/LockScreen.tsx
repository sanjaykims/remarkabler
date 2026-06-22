"use client";

import { useEffect, useRef, useState } from "react";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
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
  // Pre-fetched WebAuthn options. The reason this exists: iOS Safari
  // treats "transient user activation" as expired after even one short
  // await between the user's tap and navigator.credentials.get(). The
  // /api/auth login-options roundtrip takes ~200-500ms on LTE — enough
  // for activation to lapse, so the FIRST tap silently fails and the
  // user has to tap a SECOND time (when the options are now cached by
  // the browser, the round-trip is fast enough to preserve activation).
  // Pre-fetching options on mount lets the click handler call
  // startAuthentication synchronously (no preceding await) and the Face
  // ID modal opens within the same tick as the click event. The server
  // generates a fresh challenge each fetch and stores it in a 5-min
  // cookie, so a pre-fetched challenge is good as long as the user taps
  // within five minutes.
  const cachedAuthOptions = useRef<unknown>(null);
  const optionsFetchInFlight = useRef(false);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => setRegistered(!!d.registered))
      .catch(() => setRegistered(false));
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

  // Fetch fresh WebAuthn options into the cache. Best-effort: silent
  // failure is fine because unlockBiometric will fall back to a live
  // fetch (it just won't preserve iOS user activation on that path).
  async function prefetchAuthOptions() {
    if (cachedAuthOptions.current || optionsFetchInFlight.current) return;
    optionsFetchInFlight.current = true;
    try {
      const options = await post({ action: "login-options" });
      cachedAuthOptions.current = options;
    } catch {
      // ignore — fallback path in unlockBiometric will retry
    } finally {
      optionsFetchInFlight.current = false;
    }
  }

  // `silent` is used by the automatic prompt: a failure there (e.g. iOS needs
  // a tap) should quietly fall back to the buttons, not show an error.
  async function unlockBiometric(silent = false) {
    if (inFlight.current) return; // drop racing calls (e.g. tap + silent)
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setUnlocking(true);
    // Consume the cached options synchronously so there's no await
    // between this click handler and the navigator.credentials.get()
    // call inside startAuthentication. iOS Safari's user-activation
    // requirement is the whole reason this cache exists; see the
    // cachedAuthOptions field comment for why.
    const cached = cachedAuthOptions.current;
    cachedAuthOptions.current = null;
    try {
      const options = cached ?? (await post({ action: "login-options" }));
      const cred = await startAuthentication({ optionsJSON: options });
      await post({ action: "login-verify", response: cred });
      rememberDevice();
      track("unlock_success", { method: "biometric" });
      location.reload();
    } catch (e) {
      if (!silent) setError(friendly(e, "Couldn't unlock with biometrics."));
      setBusy(false);
      setUnlocking(false);
      inFlight.current = false;
      // Refresh the cache so a retry doesn't lose the user gesture
      // again on its own server roundtrip.
      void prefetchAuthOptions();
    }
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
