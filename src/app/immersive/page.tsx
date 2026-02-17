import { Suspense } from "react";
import { StoryCardSkeleton } from "@/components/immersive/skeleton-story-card";
import { ImmersivePageContent } from "./immersive-page-content";
import { isFeatureFlagEnabled } from "@/lib/feature-flags-server";
import { getStoriesServer } from "@/lib/stories-server";

/**
 * Server Component wrapper that:
 * 1. Fetches stories and randomized_order flag in parallel (server-side)
 * 2. Generates a random seed if shuffle is enabled
 * 3. Passes both seed and stories to the client to avoid waterfall + flicker
 */
export default async function ImmersivePage() {
  // Fetch stories and flag in parallel — both use Next.js cache
  const [isRandomEnabled, serverStories] = await Promise.all([
    isFeatureFlagEnabled("randomized_order"),
    getStoriesServer(),
  ]);

  const serverShuffleSeed = isRandomEnabled
    ? Math.floor(Math.random() * 2147483647)
    : null;

  return (
    <Suspense fallback={<StoryCardSkeleton />}>
      <ImmersivePageContent
        serverShuffleSeed={serverShuffleSeed}
        initialStories={serverStories}
      />
    </Suspense>
  );
}
