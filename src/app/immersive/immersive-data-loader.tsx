import { connection } from "next/server";
import { ImmersivePageContent } from "./immersive-page-content";
import { getAllFeatureFlagsServer } from "@/lib/feature-flags-server";
import { getStoriesServer } from "@/lib/stories-server";

/**
 * Async server component: the dynamic "hole" that streams in after the shell.
 */
export async function ImmersiveDataLoader() {
  // Mark this component as dynamic because Math.random() cannot be used in cached components.
  await connection();

  const [initialFlags, serverStories] = await Promise.all([
    getAllFeatureFlagsServer(),
    getStoriesServer(),
  ]);

  const serverShuffleSeed = initialFlags.randomized_order === true
    ? Math.floor(Math.random() * 2147483647)
    : null;

  return (
    <ImmersivePageContent
      serverShuffleSeed={serverShuffleSeed}
      initialStories={serverStories}
      initialFlags={initialFlags}
    />
  );
}
