import posthog from "posthog-js";

/**
 * Product analytics — see docs/instrumentation.md. Disabled entirely (no
 * init, no network requests) when VITE_POSTHOG_KEY isn't set, matching the
 * same no-op policy as power-flow-os's src/lib/track.ts.
 */
const posthogKey = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const enabled = Boolean(posthogKey);

export function initAnalytics() {
  if (!enabled) return;
  posthog.init(posthogKey!, {
    api_host: (import.meta.env.VITE_POSTHOG_HOST as string) || "https://us.i.posthog.com",
    capture_pageview: false,
    autocapture: false,
  });
}

export function track(event: string, props?: Record<string, string | number | boolean>) {
  if (!enabled) return;
  posthog.capture(event, props);
}
