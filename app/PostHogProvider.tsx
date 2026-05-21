"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

// Initialize once across client navigations.
let started = false;

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
    if (!KEY || started) return;
    posthog.init(KEY, {
      api_host: HOST,
      capture_pageview: false, // captured manually on route change below
      autocapture: false, // never auto-capture clicks/inputs (avoids leaking notes)
      disable_session_recording: true, // never record the screen
    });
    started = true;
  }, []);

  useEffect(() => {
    if (!KEY || !started || !pathname) return;
    posthog.capture("$pageview");
  }, [pathname]);

  return <>{children}</>;
}
