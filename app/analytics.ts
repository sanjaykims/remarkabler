import posthog from "posthog-js";

// Fire an anonymous product event. No-op unless PostHog is configured, and
// never throws — analytics must not break the app. Only pass non-sensitive
// properties: never note content, chat text, or transcriptions.
export function track(event: string, props?: Record<string, unknown>) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.capture(event, props);
  } catch {
    // ignore
  }
}
