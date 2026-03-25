import { Suspense } from "react";
import { StoryCardSkeleton } from "@/components/immersive/skeleton-story-card";
import { ImmersivePageContent } from "./immersive-page-content";
import { isFeatureFlagEnabled } from "@/lib/feature-flags-server";
import { getStoriesServer } from "@/lib/stories-server";
import { connection } from "next/server";

/**
 * Synchronous page component — PPR prebuilds this as the static shell.
 * The skeleton fallback is baked into the CDN-cached HTML.
 * Dynamic content streams in via ImmersiveDataLoader inside Suspense.
 */
export default function ImmersivePage() {
  return (
    <Suspense fallback={<StoryCardSkeleton />}>
      <ImmersiveDataLoader />
    </Suspense>
  );
}

/**
 * Async server component — the dynamic "hole" that streams in after the shell.
 * Fetches stories and feature flag in parallel, then renders the client content.
 *
 * @internal Exported for testing — not part of the public API.
 */
export async function ImmersiveDataLoader() {
  // Mark this component as dynamic — it's inside Suspense (the PPR boundary).
  // Required because Math.random() can't be used in cached components.
  await connection();

  const [isRandomEnabled, serverStories] = await Promise.all([
    isFeatureFlagEnabled("randomized_order"),
    getStoriesServer(),
  ]);

  const serverShuffleSeed = isRandomEnabled
    ? Math.floor(Math.random() * 2147483647)
    : null;

  return (
    <ImmersivePageContent
      serverShuffleSeed={serverShuffleSeed}
      initialStories={serverStories}
    />
  );
}
