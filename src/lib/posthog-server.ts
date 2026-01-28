import "server-only";

import { PostHog } from "posthog-node";

// Singleton pattern for PostHog server client
let posthogClient: PostHog | null = null;

export function getPostHogServerClient(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: "https://us.i.posthog.com",
      flushAt: 1, // Flush immediately for serverless
      flushInterval: 0, // No interval batching
    });
  }

  return posthogClient;
}

// Shutdown function for graceful cleanup
export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown();
    posthogClient = null;
  }
}
