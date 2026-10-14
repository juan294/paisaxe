import { Suspense } from "react";
import { StoryCardSkeleton } from "@/components/immersive/skeleton-story-card";
import { StoryNavigationRecovery } from "@/components/immersive/story-toolbar";
import styles from "./page.module.css";
import { ImmersiveDataLoader } from "./immersive-data-loader";

/**
 * Synchronous page component — PPR prebuilds this as the static shell.
 * The skeleton fallback is baked into the CDN-cached HTML.
 * Dynamic content streams in via ImmersiveDataLoader inside Suspense.
 */
export default function ImmersivePage() {
  return (
    <div className={styles.page}>
      <StoryNavigationRecovery className={styles.recovery} />
      <Suspense fallback={<StoryCardSkeleton />}>
        <ImmersiveDataLoader />
      </Suspense>
    </div>
  );
}
