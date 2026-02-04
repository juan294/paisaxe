import { supabase } from "@/lib/supabase";
import type { FeatureFlagKey, FeatureFlagRow } from "@/types/feature-flags";
import { getEnvironment } from "@/lib/environment";

/**
 * Server-side function to check if a feature flag is enabled.
 * Use this in Server Components and API routes.
 *
 * Falls back to false if the flag doesn't exist or there's an error.
 */
export async function isFeatureFlagEnabled(
  key: FeatureFlagKey
): Promise<boolean> {
  try {
    const environment = getEnvironment();

    const { data, error } = await supabase
      .from("feature_flags")
      .select("enabled")
      .eq("flag_key", key)
      .eq("environment", environment)
      .single();

    if (error) {
      console.warn(`Failed to fetch feature flag "${key}":`, error.message);
      return false;
    }

    return (data as Pick<FeatureFlagRow, "enabled">)?.enabled ?? false;
  } catch (error) {
    console.warn(`Error checking feature flag "${key}":`, error);
    return false;
  }
}
