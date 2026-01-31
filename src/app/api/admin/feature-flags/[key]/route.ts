import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase";
import type { FeatureFlagRow } from "@/types/feature-flags";
import { rowToFeatureFlag } from "@/types/feature-flags";
import { getEnvironment } from "@/lib/environment";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const { key } = await params;
    const body = await request.json();
    const { enabled, config } = body;

    // Validate enabled if provided (must be boolean if present)
    if (enabled !== undefined && typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be a boolean" },
        { status: 400 }
      );
    }

    // Validate config if provided (must be a plain object)
    if (config !== undefined && (typeof config !== "object" || config === null || Array.isArray(config))) {
      return NextResponse.json(
        { error: "config must be an object" },
        { status: 400 }
      );
    }

    // Validate that at least one valid field is provided
    const hasEnabled = typeof enabled === "boolean";
    const hasConfig = config !== undefined;

    if (!hasEnabled && !hasConfig) {
      return NextResponse.json(
        { error: "Must provide enabled (boolean) or config (object)" },
        { status: 400 }
      );
    }

    // Build update object with only the provided fields
    const updateData: { enabled?: boolean; config?: Record<string, unknown> } = {};
    if (hasEnabled) {
      updateData.enabled = enabled;
    }
    if (hasConfig) {
      updateData.config = config;
    }

    const adminClient = createAdminClient();
    const environment = getEnvironment();

    const { data, error } = await adminClient
      .from("feature_flags")
      .update(updateData)
      .eq("flag_key", key)
      .eq("environment", environment)
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
