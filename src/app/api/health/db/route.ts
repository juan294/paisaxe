import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

function failureResponse(error: string, latencyMs?: number) {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(latencyMs === undefined ? {} : { latencyMs }),
    },
    { status: 500 }
  );
}

/**
 * GET /api/health/db
 *
 * Tests database connectivity by running a simple query.
 * Used by QA agent to detect configuration issues that
 * wouldn't trigger Supabase's own monitoring.
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  // Check env vars are configured
  if (!supabaseUrl || !supabaseKey) {
    logger.error("[HEALTH_DB_CONFIG_MISSING]", {
      has_supabase_url: !!supabaseUrl,
      has_supabase_anon_key: !!supabaseKey,
    });
    return failureResponse("Database diagnostic unavailable");
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Simple query: check if we can read from feature_flags table
    // This table always exists and is safe to query
    const { data, error } = await supabase
      .from("feature_flags")
      .select("flag_key")
      .limit(1);

    const latencyMs = Date.now() - startTime;

    if (error) {
      logger.error("[HEALTH_DB_QUERY_FAILED]", {
        code: error.code,
        error: error.message,
        latency_ms: latencyMs,
      });
      return failureResponse("Database diagnostic check failed", latencyMs);
    }

    return NextResponse.json({
      success: true,
      latencyMs,
      tablesAccessible: true,
      rowsReturned: data?.length ?? 0,
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "Unknown error";

    logger.error("[HEALTH_DB_CLIENT_FAILED]", {
      error: message,
      latency_ms: latencyMs,
    });
    return failureResponse("Database diagnostic check failed", latencyMs);
  }
}
