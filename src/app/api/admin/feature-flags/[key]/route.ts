import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import type { FeatureFlagRow } from "@/types/feature-flags";
import { rowToFeatureFlag } from "@/types/feature-flags";
import { getEnvironment } from "@/lib/environment";
import { updateFeatureFlagSchema } from "@/lib/schemas";

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

    // Zod schema validation (BE-M1)
    const parsed = updateFeatureFlagSchema.safeParse(body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      // Preserve backward-compatible single-field error messages
      if (flat.fieldErrors.enabled?.length) {
        return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
      }
      if (flat.fieldErrors.config?.length) {
        return NextResponse.json({ error: "config must be an object" }, { status: 400 });
      }
      // Refinement error (neither enabled nor config provided)
      if (flat.formErrors?.length) {
        return NextResponse.json(
          { error: "Must provide enabled (boolean) or config (object)" },
          { status: 400 }
        );
      }
      return NextResponse.json({ errors: flat.fieldErrors }, { status: 400 });
    }

    const { enabled, config } = parsed.data;

    // Build update object with only the provided fields
    const updateData: { enabled?: boolean; config?: Record<string, unknown> } = {};
    if (enabled !== undefined) {
      updateData.enabled = enabled;
    }
    if (config !== undefined) {
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
      logger.error("[FEATURE_FLAG_UPDATE_FAILED]", { flag_key: key, error });
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
    logger.error("[FEATURE_FLAG_UPDATE_UNHANDLED_ERROR]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
