"use client";

import { useState } from "react";

type Mode = "setup" | "unlock" | "reset";

// The 4-digit PIN screen shown before the map. The server enforces the PIN;
// this is only the UI for getting an unlock cookie.
export default function PinGate({
  configured,
  lockedMs,
  attemptsLeft,
  onUnlocked,
}: {
  configured: boolean;
  lockedMs: number;
  attemptsLeft: number;
  onUnlocked: () => void;
}) {
  const [mode, setMode] = useState<Mode>(configured ? "unlock" : "setup");
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState<string | null>(null); // setup: first entry
  const [passcode, setPasscode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [locked, setLocked] = useState(lockedMs);
  const [left, setLeft] = useState(attemptsLeft);
  const [busy, setBusy] = useState(false);

  async function post(body: Record<string, string>) {
    setBusy(true);
    try {
      const r = await fetch("/api/map/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return { ok: r.ok, data: await r.json().catch(() => ({})) };
    } finally {
      setBusy(false);
    }
  }

  async function submit(value: string) {
    setMsg(null);
    if (mode === "setup") {
      if (first === null) {
        setFirst(value);
        setPin("");
        return;
      }
      if (first !== value) {
        setFirst(null);
        setPin("");
        setMsg("The two PINs didn't match. Start again.");
        return;
      }
      const r = await post({ action: "setup", pin: value });
      if (r.ok) onUnlocked();
      else setMsg(r.data.error || "Couldn't save the PIN.");
      return;
    }
    if (mode === "reset") {
      if (!passcode) {
        setMsg("Enter your app passcode too.");
        return;
      }
      const r = await post({ action: "reset", pin: value, passcode });
      if (r.ok) onUnlocked();
      else {
        setPin("");
        setMsg(r.data.error || "Couldn't reset the PIN.");
      }
      return;
    }
    const r = await post({ action: "unlock", pin: value });
    if (r.ok) {
      onUnlocked();
      return;
    }
    setPin("");
    setLocked(r.data.lockedMs || 0);
    setLeft(r.data.attemptsLeft ?? 0);
    setMsg(
      r.data.lockedMs > 0
        ? `Too many wrong PINs. Locked for ${Math.ceil(r.data.lockedMs / 60000)} min.`
        : `Wrong PIN. ${r.data.attemptsLeft} tries left.`
    );
  }

  function onChange(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    setPin(digits);
    if (digits.length === 4 && !busy) void submit(digits);
  }

  const isLocked = mode === "unlock" && locked > 0;
  const title =
    mode === "setup"
      ? first === null
        ? "Create a 4-digit map PIN"
        : "Enter it again to confirm"
      : mode === "reset"
        ? "Set a new map PIN"
        : "Enter your map PIN";

  return (
    <div className="rounded border border-slate-200 dark:border-slate-800 p-5 space-y-4 max-w-sm">
      <h2 className="text-lg font-medium">{title}</h2>
      {mode === "setup" && first === null && (
        <p className="text-sm opacity-70">
          Your location trail has its own PIN on top of the app lock. You&apos;ll be asked for it
          every time you open the Map.
        </p>
      )}
      {mode === "reset" && (
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="App passcode"
          autoComplete="current-password"
          className="w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
        />
      )}
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={4}
        value={pin}
        disabled={isLocked || busy}
        onChange={(e) => onChange(e.target.value)}
        aria-label="4-digit PIN"
        placeholder="••••"
        autoFocus
        className="w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-3 text-center text-2xl tracking-[0.6em]"
      />
      {isLocked && (
        <p className="text-sm text-red-600">
          Locked for about {Math.ceil(locked / 60000)} min after too many wrong tries.
        </p>
      )}
      {msg && !isLocked && <p className="text-sm text-red-600">{msg}</p>}
      {mode === "unlock" && !isLocked && left < 5 && !msg && (
        <p className="text-xs opacity-70">{left} tries left before a lockout.</p>
      )}
      {configured && mode !== "setup" && (
        <button
          type="button"
          onClick={() => {
            setMode(mode === "reset" ? "unlock" : "reset");
            setPin("");
            setMsg(null);
          }}
          className="text-xs underline opacity-70"
        >
          {mode === "reset" ? "Back to PIN" : "Forgot PIN? Reset with app passcode"}
        </button>
      )}
    </div>
  );
}
