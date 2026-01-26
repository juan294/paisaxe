import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase";
import type { FeatureFlagRow } from "@/types/feature-flags";
import { rowToFeatureFlag } from "@/types/feature-flags";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const auth = validateAdminAuth(request);
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const { key } = await params;
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be a boolean" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("feature_flags")
      .update({ enabled })
      .eq("flag_key", key)
      .select()
      .single();

    if (error) {
      console.error("Failed to update feature flag:", error.message);
      return NextResponse.json(
        { error: "Failed to update feature flag" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Feature flag not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: rowToFeatureFlag(data as FeatureFlagRow),
    });
  } catch (error) {
    console.error("Feature flag update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
