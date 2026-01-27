import { createSupabaseBrowserClient } from "./supabase-browser";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { FeatureFlagRow } from "@/types/feature-flags";
import type { StoryRow } from "@/types/immersive";

type PostgresChangeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

export interface SubscribeToTableOptions {
  /** Filter by event type. Defaults to "*" (all events). */
  event?: PostgresChangeEvent;
  /** Optional Postgres filter expression (e.g., "is_active=eq.true"). */
  filter?: string;
}

/**
 * Subscribe to Postgres Changes on a specific table via Supabase Realtime.
 *
 * Returns a cleanup function that removes the channel when called.
 *
 * @param tableName - The database table to subscribe to
 * @param callback - Called with the full payload on each change event
 * @param options - Optional event type and column filter
 */
export function subscribeToTable(
  tableName: string,
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
  options?: SubscribeToTableOptions
): () => void {
  const supabase = createSupabaseBrowserClient();
  const event = options?.event ?? "*";

  const channelConfig: Record<string, string> = {
    event,
    schema: "public",
    table: tableName,
  };

  if (options?.filter) {
    channelConfig.filter = options.filter;
  }

  const channel = supabase
    .channel(`table-${tableName}`)
    .on("postgres_changes", channelConfig as never, callback)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to feature flag updates via Supabase Realtime.
 *
 * When a flag is toggled in the admin panel, the callback receives
 * the updated database row immediately.
 *
 * @param callback - Called with the updated FeatureFlagRow
 * @returns Cleanup function to remove the subscription
 */
export function subscribeToFeatureFlags(
  callback: (row: FeatureFlagRow) => void
): () => void {
  return subscribeToTable(
    "feature_flags",
    (payload) => {
      const newRow = payload.new as FeatureFlagRow;
      callback(newRow);
    },
    { event: "UPDATE" }
  );
}

/**
 * Subscribe to story updates via Supabase Realtime.
 *
 * Fires when any story is updated (curation status changed, image updated, etc.).
 *
 * @param callback - Called with the updated StoryRow
 * @returns Cleanup function to remove the subscription
 */
export function subscribeToStories(
  callback: (row: StoryRow) => void
): () => void {
  return subscribeToTable(
    "stories",
    (payload) => {
      const newRow = payload.new as StoryRow;
      callback(newRow);
    },
    { event: "UPDATE" }
  );
}
