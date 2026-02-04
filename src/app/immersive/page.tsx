import { Suspense } from "react";
import { StoryCardSkeleton } from "@/components/immersive/skeleton-story-card";
import { ImmersivePageContent } from "./immersive-page-content";
import { isFeatureFlagEnabled } from "@/lib/feature-flags-server";

/**
 * Server Component wrapper that:
 * 1. Fetches the randomized_order flag server-side
 * 2. Generates a random seed if shuffle is enabled
 * 3. Passes the seed to the client to avoid flicker
 *
 * This ensures the first story displayed is already the randomly selected one,
 * rather than showing the default first story and then switching (which causes flicker).
 */
export default async function ImmersivePage() {
  // Check if random ordering is enabled - server-side
  const isRandomEnabled = await isFeatureFlagEnabled("randomized_order");

  // Generate seed server-side if randomization is enabled
  // This ensures the client renders with the shuffled order from the start
  const serverShuffleSeed = isRandomEnabled
    ? Math.floor(Math.random() * 2147483647)
    : null;

  return (
    <Suspense fallback={<StoryCardSkeleton />}>
      <ImmersivePageContent serverShuffleSeed={serverShuffleSeed} />
    </Suspense>
  );
}
