import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { FeatureFlagRow } from "@/types/feature-flags";
import type { StoryRow } from "@/types/immersive";
import { getEnvironment } from "./environment";

type PostgresChangeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

interface SubscribeToTableOptions {
  /** Filter by event type. Defaults to "*" (all events). */
  event?: PostgresChangeEvent;
  /** Optional Postgres filter expression (e.g., "is_active=eq.true"). */
  filter?: string;
}

/**
 * Subscribe to Postgres Changes on a specific table via Supabase Realtime.
 *
 * Returns a cleanup function that removes the channel when called. The
 * Supabase browser client is dynamically imported so this module doesn't pull
 * the ~324 KB Supabase JS chunk onto the first-paint path for pages that only
 * import `realtime.ts` for its type-level exports (see stories-data.ts for
 * the same pattern).
 *
 * @param tableName - The database table to subscribe to
 * @param callback - Called with the full payload on each change event
 * @param options - Optional event type and column filter
 */
export async function subscribeToTable(
  tableName: string,
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
  options?: SubscribeToTableOptions
): Promise<() => void> {
  const { createSupabaseBrowserClient } = await import("./supabase-browser");
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
 * the updated database row immediately. Only receives updates for
 * the current environment (development or production).
 *
 * @param callback - Called with the updated FeatureFlagRow
 * @returns Cleanup function to remove the subscription
 */
export async function subscribeToFeatureFlags(
  callback: (row: FeatureFlagRow) => void
): Promise<() => void> {
  const environment = getEnvironment();

  return subscribeToTable(
    "feature_flags",
    (payload) => {
      const newRow = payload.new as FeatureFlagRow;
      // Only process updates for the current environment
      if (newRow.environment === environment) {
        callback(newRow);
      }
    },
    {
      event: "UPDATE",
      // Filter at database level for the current environment
      filter: `environment=eq.${environment}`,
    }
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
export async function subscribeToStories(
  callback: (row: StoryRow) => void
): Promise<() => void> {
  return subscribeToTable(
    "stories",
    (payload) => {
      const newRow = payload.new as StoryRow;
      callback(newRow);
    },
    { event: "UPDATE" }
  );
}
