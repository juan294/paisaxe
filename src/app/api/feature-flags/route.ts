import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { FeatureFlagRow } from "@/types/feature-flags";
import { rowToFeatureFlag } from "@/types/feature-flags";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("feature_flags")
      .select("*")
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
