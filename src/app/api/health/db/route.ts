import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    return NextResponse.json(
      {
        success: false,
        error: "Supabase not configured",
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
      },
      { status: 500 }
    );
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
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          latencyMs,
        },
        { status: 500 }
      );
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

    return NextResponse.json(
      {
        success: false,
        error: message,
        latencyMs,
      },
      { status: 500 }
    );
  }
}
