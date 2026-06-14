import "./globals.css";
import type { Metadata, Viewport } from "next";
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

// `viewport-fit=cover` is what lets the app actually use the area around
// the punch-hole / rounded corners on tall phones (Galaxy S, Pixel, iPhone).
// `themeColor` makes the system status bar blend into the app — black in
// dark mode (matches AMOLED pure-black body), warm-stone in light.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
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
              <header className="border-b border-stone-200 dark:border-stone-800 pt-safe pl-safe pr-safe">
                <nav className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-x-3 text-xs whitespace-nowrap overflow-x-auto">
                  <Link href="/" className="font-semibold">Remarkabler</Link>
                  <Link href="/notebooks" className="opacity-70 hover:opacity-100">Notebooks</Link>
                  <Link href="/chat" className="opacity-70 hover:opacity-100">Chat</Link>
                  <Link href="/insights" className="opacity-70 hover:opacity-100">Insights</Link>
                  <Link href="/memory" className="opacity-70 hover:opacity-100">Memory</Link>
                  <Link href="/usage" className="opacity-70 hover:opacity-100">Cost</Link>
                </nav>
              </header>
              <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 pl-safe pr-safe pb-safe">
                {children}
              </main>
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
