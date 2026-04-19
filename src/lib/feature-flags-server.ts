import type { FeatureFlagKey } from "@/types/feature-flags";
import { getEnvironment } from "@/lib/environment";

/**
 * Server-side function to fetch ALL feature flags as a key→enabled map.
 * Use this in server components to pass `initialFlags` to useFeatureFlags,
 * eliminating the client-side flag flash on first paint.
 *
 * Falls back to an empty object on error (all flags treated as disabled).
 */
export async function getAllFeatureFlagsServer(): Promise<
  Partial<Record<FeatureFlagKey, boolean>>
> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (!supabaseUrl || !supabaseKey) return {};
    if (!supabaseKey.startsWith("eyJ")) return {};

    const environment = getEnvironment();

    const response = await fetch(
      `${supabaseUrl}/rest/v1/feature_flags?environment=eq.${environment}&select=flag_key,enabled`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        // 60-second server-side cache — matches client CACHE_TTL
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      console.warn("Failed to fetch all feature flags:", response.status);
      return {};
    }

    const rows: { flag_key: string; enabled: boolean }[] =
      await response.json();

    return Object.fromEntries(
      rows.map((r) => [r.flag_key, r.enabled])
    ) as Partial<Record<FeatureFlagKey, boolean>>;
  } catch (error) {
    console.warn("Error fetching all feature flags:", error);
    return {};
  }
}

/**
 * Server-side function to check if a feature flag is enabled.
 * Uses Supabase REST API with Next.js cache revalidation.
 * Falls back to false if the flag doesn't exist or there's an error.
 */
export async function isFeatureFlagEnabled(
  key: FeatureFlagKey
): Promise<boolean> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (!supabaseUrl || !supabaseKey) {
      return false;
    }

    // Skip fetch with dummy credentials (CI/E2E) — real Supabase anon keys are JWTs starting with 'eyJ'
    if (!supabaseKey.startsWith("eyJ")) {
      return false;
    }

    const environment = getEnvironment();
    const isDev = environment === "development";

    const response = await fetch(
      `${supabaseUrl}/rest/v1/feature_flags?flag_key=eq.${key}&environment=eq.${environment}&select=enabled`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        ...(isDev
          ? { cache: "no-store" as const }
          : { next: { revalidate: 60 } }),
      }
    );

    if (!response.ok) {
      console.warn(`Failed to fetch feature flag "${key}":`, response.status);
      return false;
    }

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return data[0].enabled === true;
    }

    return false;
  } catch (error) {
    console.warn(`Error checking feature flag "${key}":`, error);
    return false;
  }
}
