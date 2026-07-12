import "./globals.css";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { isAuthenticated, isLockEnabled } from "@/lib/auth";
import LockScreen from "./LockScreen";
import AutoLock from "./AutoLock";
import Nav from "./Nav";
import PostHogProvider from "./PostHogProvider";

// Clear Sans — single font for the whole app. Self-hosted from
// public/fonts/ so there is zero build-time and zero runtime network
// for fonts. See DESIGN.md § Typography.
//
// `font-semibold` (Tailwind's 600) is remapped to weight 500 in
// globals.css because Clear Sans ships no 600 face.
const clearSans = localFont({
  src: [
    { path: "../public/fonts/clear-sans-400.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/clear-sans-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../public/fonts/clear-sans-500.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/clear-sans-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

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
    { media: "(prefers-color-scheme: light)", color: "#f0f9ff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

// Render every route per-request: the lock check depends on the request's
// cookies and on APP_PASSCODE, so no page may be statically prerendered.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const authed = isAuthenticated();

  return (
    <html lang="en" className={clearSans.variable}>
      <body>
        <PostHogProvider>
          {authed ? (
            <>
              <header className="border-b border-slate-200 dark:border-slate-800 pt-safe pl-safe pr-safe">
                <Nav />
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
