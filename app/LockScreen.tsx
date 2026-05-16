"use client";

import { useEffect, useState } from "react";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";

export default function LockScreen() {
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function unlockBiometric() {
    setBusy(true);
    setError(null);
    try {
      const options = await post({ action: "login-options" });
      const cred = await startAuthentication({ optionsJSON: options });
      await post({ action: "login-verify", response: cred });
      location.reload();
    } catch (e) {
      setError(friendly(e, "Couldn't unlock with biometrics."));
      setBusy(false);
    }
  }

  async function unlockPasscode() {
    setBusy(true);
    setError(null);
    try {
      await post({ action: "passcode", passcode });
      location.reload();
    } catch (e) {
      setError(friendly(e, "Wrong passcode."));
      setBusy(false);
    }
  }

  async function registerDevice() {
    setBusy(true);
    setError(null);
    try {
      const options = await post({ action: "register-options", passcode });
      const cred = await startRegistration({ optionsJSON: options });
      await post({ action: "register-verify", response: cred });
      location.reload();
    } catch (e) {
      setError(friendly(e, "Couldn't set up this device."));
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-5 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Feed Claude</h1>
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
              onClick={unlockBiometric}
              disabled={busy}
              className="w-full rounded bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              {busy ? "Please wait…" : "Unlock with fingerprint / Face ID"}
            </button>
            <button
              onClick={() => setShowPasscode((v) => !v)}
              className="text-xs opacity-60 hover:opacity-100 underline"
            >
              Use backup passcode instead
            </button>
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
              inputMode="numeric"
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
  return msg || fallback;
}
