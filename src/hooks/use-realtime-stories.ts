"use client";

import { useEffect } from "react";
import { subscribeToStories } from "@/lib/realtime";
import type { StoryRow } from "@/types/immersive";

/**
 * React hook that subscribes to Supabase Realtime updates on the
 * `stories` table. Notifies the consuming component of changes,
 * letting it decide how to react (e.g., refresh the stories list,
 * update a specific card, show a toast).
 *
 * @param onStoryUpdated - Called with the updated StoryRow whenever
 *                         a story is updated in the database
 */
export function useRealtimeStories(
  onStoryUpdated: (row: StoryRow) => void
): void {
  useEffect(() => {
    const cleanup = subscribeToStories((row: StoryRow) => {
      onStoryUpdated(row);
    });

    return cleanup;
  }, [onStoryUpdated]);
}
