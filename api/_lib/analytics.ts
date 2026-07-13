import { PostHog } from "posthog-node";

// Server-side capture for the ask_question event (Fase 4, paso 5). Reuses
// the same PostHog project key the frontend uses — PostHog project API
// keys work for both client and server ingestion, no separate secret key.
// No-op if the key isn't configured, same policy as the client-side helper
// in power-flow-os's src/lib/track.ts.
const posthogKey = process.env.VITE_POSTHOG_KEY;
const client = posthogKey
  ? new PostHog(posthogKey, { host: process.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com" })
  : null;

// Single-user internal tool — there's no per-visitor identity to track, so
// every ask_question event shares one distinct ID by design.
const DISTINCT_ID = "power-flow-insights-ask";

export async function trackAskQuestion(props: Record<string, string | number | boolean>) {
  if (!client) return;
  await client.captureImmediate({ distinctId: DISTINCT_ID, event: "ask_question", properties: props });
}
