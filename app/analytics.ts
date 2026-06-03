import { trackEvent } from "./PostHogProvider";

// Fire an anonymous product event. No-op unless PostHog is configured, and
// never throws — analytics must not break the app. Only pass non-sensitive
// properties: never note content, chat text, or transcriptions.
//
// Implementation note: the underlying posthog-js library is dynamically
// imported by PostHogProvider, so this call ships zero KB to clients when
// NEXT_PUBLIC_POSTHOG_KEY is unset.
export function track(event: string, props?: Record<string, unknown>) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  // Fire-and-forget; never await analytics.
  void trackEvent(event, props);
}
