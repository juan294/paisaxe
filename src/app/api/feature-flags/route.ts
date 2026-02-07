import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { FeatureFlagRow } from "@/types/feature-flags";
import { rowToFeatureFlag } from "@/types/feature-flags";
import { getEnvironment } from "@/lib/environment";

export async function GET() {
  // Skip database call when using dummy/invalid Supabase credentials (CI/E2E).
  // Real Supabase anon keys are JWTs that start with 'eyJ'.
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseKey || !supabaseKey.startsWith("eyJ")) {
    return NextResponse.json({ data: [] }, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
      },
    });
  }

  try {
    const environment = getEnvironment();

    const { data, error } = await supabase
      .from("feature_flags")
      .select("*")
      .eq("environment", environment)
      .order("flag_key", { ascending: true });

    if (error) {
      console.error("Failed to fetch feature flags:", error.message);
      return NextResponse.json(
        { error: "Failed to fetch feature flags" },
        { status: 500 }
      );
    }

    const flags = (data as FeatureFlagRow[]).map(rowToFeatureFlag);

    return NextResponse.json({ data: flags }, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("Feature flags API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
