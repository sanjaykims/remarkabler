import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { isAuthenticated, isLockEnabled } from "@/lib/auth";
import LockScreen from "./LockScreen";
import AutoLock from "./AutoLock";
import PostHogProvider from "./PostHogProvider";

export const metadata: Metadata = {
  title: "Remarkabler",
  description: "OCR your reMarkable notebooks with Claude and chat over your notes.",
  manifest: "/manifest.json",
};

// Render every route per-request: the lock check depends on the request's
// cookies and on APP_PASSCODE, so no page may be statically prerendered.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const authed = isAuthenticated();

  return (
    <html lang="en">
      <body>
        <PostHogProvider>
          {authed ? (
            <>
              <header className="border-b border-stone-200 dark:border-stone-800">
                <nav className="mx-auto max-w-5xl px-6 py-3 flex items-center gap-6 text-sm">
                  <Link href="/" className="font-semibold">Remarkabler</Link>
                  <Link href="/notebooks" className="opacity-70 hover:opacity-100">Notebooks</Link>
                  <Link href="/chat" className="opacity-70 hover:opacity-100">Chat</Link>
                  <Link href="/insights" className="opacity-70 hover:opacity-100">Insights</Link>
                </nav>
              </header>
              <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
              {isLockEnabled() && <AutoLock />}
            </>
          ) : (
            <LockScreen />
          )}
        </PostHogProvider>
      </body>
    </html>
  );
}
