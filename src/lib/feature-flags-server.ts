import type { FeatureFlagKey } from "@/types/feature-flags";
import { getEnvironment } from "@/lib/environment";

/**
 * Server-side function to check if a feature flag is enabled.
 * Uses Supabase REST API with Next.js cache revalidation.
 * Falls back to false if the flag doesn't exist or there's an error.
 * Errors are logged with [FEATURE_FLAG_FAILURE] so Supabase outages are observable.
 */
export async function isFeatureFlagEnabled(
  key: FeatureFlagKey
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

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
        signal: controller.signal,
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
      console.error("[FEATURE_FLAG_FAILURE]", {
        flag: key,
        statusCode: response.status,
      });
      return false;
    }

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return data[0].enabled === true;
    }

    return false;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[FEATURE_FLAG_FAILURE]", {
      flag: key,
      error: err.message,
    });
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
