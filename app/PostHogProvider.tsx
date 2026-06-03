"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

// Lazy module reference: only loaded when KEY is set at runtime. Replaces a
// top-level `import posthog from "posthog-js"` so the ~55 KB gzipped library
// doesn't ship in the client bundle when analytics aren't configured.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let posthogRef: any = null;
let starting = false;

async function ensurePosthog() {
  if (!KEY) return null;
  if (posthogRef) return posthogRef;
  if (starting) return null; // another init in flight
  starting = true;
  try {
    const mod = await import("posthog-js");
    const ph = mod.default;
    ph.init(KEY, {
      api_host: HOST,
      capture_pageview: false, // captured manually on route change below
      autocapture: false, // never auto-capture clicks/inputs (avoids leaking notes)
      disable_session_recording: true, // never record the screen
    });
    posthogRef = ph;
    return ph;
  } catch {
    return null;
  } finally {
    starting = false;
  }
}

/**
 * Anonymous, privacy-safe product analytics. Only active when
 * NEXT_PUBLIC_POSTHOG_KEY is set. Autocapture and session recording are
 * disabled so no note content, chat text, or screen contents are ever sent —
 * only page views and the explicit events fired via lib analytics helper.
 */
export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (!KEY) return;
    ensurePosthog();
  }, []);

  useEffect(() => {
    if (!KEY || !pathname) return;
    (async () => {
      const ph = await ensurePosthog();
      ph?.capture("$pageview");
    })();
  }, [pathname]);

  return <>{children}</>;
}

// Exported for the analytics helper, which fires explicit events.
export async function trackEvent(
  event: string,
  props?: Record<string, unknown>
) {
  if (!KEY) return;
  try {
    const ph = await ensurePosthog();
    ph?.capture(event, props);
  } catch {
    // analytics must never break the app
  }
}
