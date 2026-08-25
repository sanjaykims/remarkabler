"use client";

import { useState } from "react";

export default function LockAllButton() {
  const [busy, setBusy] = useState(false);

  async function lockAllDevices() {
    if (!window.confirm("Lock Remarkabler on every signed-in device?")) return;

    setBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout-all" }),
      });
      if (!res.ok) throw new Error("Could not lock all devices.");
      window.location.reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not lock all devices.");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={lockAllDevices}
      disabled={busy}
      className="border-b-2 border-transparent pb-0.5 opacity-70 transition-opacity hover:opacity-100 disabled:opacity-40"
      title="Lock every signed-in device"
    >
      {busy ? "Locking..." : "Lock all"}
    </button>
  );
}
