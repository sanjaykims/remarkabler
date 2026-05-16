"use client";

export default function LockButton() {
  async function lock() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    }).catch(() => {});
    location.href = "/";
  }

  return (
    <button
      onClick={lock}
      className="ml-auto opacity-70 hover:opacity-100"
    >
      Lock
    </button>
  );
}
