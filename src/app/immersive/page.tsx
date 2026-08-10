import { Suspense } from "react";
import { StoryCardSkeleton } from "@/components/immersive/skeleton-story-card";
import { ImmersiveDataLoader } from "./immersive-data-loader";

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
