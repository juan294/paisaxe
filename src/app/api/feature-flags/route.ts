import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { FeatureFlag, FeatureFlagRow } from "@/types/feature-flags";
import { rowToFeatureFlag } from "@/types/feature-flags";
import { getEnvironment } from "@/lib/environment";
import { logger } from "@/lib/logger";

/**
 * SE-H1: Scrub sensitive fields from specific flag configs before sending to clients.
 *
 * visitor_voice_agent may contain whitelisted_emails and agent_id in its config.
 * These must never reach the browser — authorization is performed server-side by
 * /api/voice-access.
 *
 * Defense in depth: the same masking is now also enforced at the DB layer by the
 * feature_flags_public view (migration 101) that this route reads from, so a direct
 * PostgREST call can no longer bypass it. This app-layer scrub stays as a second,
 * independent layer — it's a no-op once the view has already stripped the keys.
 */
const SENSITIVE_CONFIG_KEYS: Partial<Record<FeatureFlag["flagKey"], string[]>> = {
  visitor_voice_agent: ["whitelisted_emails", "agent_id"],
};

function scrubSensitiveConfig(flag: FeatureFlag): FeatureFlag {
  const sensitiveKeys = SENSITIVE_CONFIG_KEYS[flag.flagKey];
  if (!sensitiveKeys || sensitiveKeys.length === 0) return flag;

  const scrubbedConfig = { ...flag.config };
  for (const key of sensitiveKeys) {
    delete scrubbedConfig[key];
  }

  return { ...flag, config: scrubbedConfig };
}

export async function GET() {
  // Skip database call when using dummy/invalid Supabase credentials (CI/E2E).
  // Real Supabase anon keys are JWTs that start with 'eyJ'.
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseKey || !supabaseKey.startsWith("eyJ")) {
    return NextResponse.json({ data: [] }, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
        // BE-M4: Vary: Host prevents CDN from serving wrong flags across deployments/subdomains.
        "Vary": "Host",
      },
    });
  }

  try {
    const environment = getEnvironment();

    // PE-L2: select only the columns that rowToFeatureFlag + scrubSensitiveConfig actually
    // consume, avoiding unnecessary wire transfer of any future wide columns.
    //
    // SE-H1/BE-M9: reads through feature_flags_public, not the base table — see migration
    // 101 and the SENSITIVE_CONFIG_KEYS comment above for why.
    const { data, error } = await supabase
      .from("feature_flags_public")
      .select("id, flag_key, enabled, label, description, config, environment, created_at, updated_at")
      .eq("environment", environment)
      .order("flag_key", { ascending: true });

    if (error) {
      logger.error("Failed to fetch feature flags:", { error: error.message });
      return NextResponse.json(
        { error: "Failed to fetch feature flags" },
        { status: 500 }
      );
    }

    const flags = (data as FeatureFlagRow[]).map(rowToFeatureFlag).map(scrubSensitiveConfig);

    return NextResponse.json({ data: flags }, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
        // BE-M4: Vary: Host prevents CDN from serving wrong flags across deployments/subdomains.
        "Vary": "Host",
      },
    });
  } catch (error) {
    logger.error("Feature flags API error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
