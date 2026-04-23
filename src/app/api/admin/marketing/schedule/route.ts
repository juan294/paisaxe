import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";
import {
  rowToMarketingSchedule,
  type MarketingScheduleRow,
  type UpdateScheduleRequest,
  type MarketingPlatform,
  type ContentType,
} from "@/types/marketing";

const VALID_PLATFORMS: MarketingPlatform[] = ["x", "instagram", "pinterest"];
const VALID_CONTENT_TYPES: (ContentType | "auto")[] = [
  "photo_caption",
  "reel_caption",
  "thread",
  "pin_description",
  "story_prompt",
  "auto",
];

/**
 * GET /api/admin/marketing/schedule
 * Returns all schedule entries
 * Query params: platform (optional filter)
 */
export async function GET(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") as MarketingPlatform | null;

    let query = supabase
      .from("marketing_schedule")
      .select("*")
      .order("platform")
      .order("day_of_week")
      .order("time_utc");

    if (platform && VALID_PLATFORMS.includes(platform)) {
      query = query.eq("platform", platform);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("[MARKETING_SCHEDULE_FETCH_FAILED]", { error });
      return NextResponse.json(
        { error: "Failed to fetch schedule" },
        { status: 500 }
      );
    }

    const schedules = (data as MarketingScheduleRow[]).map(
      rowToMarketingSchedule
    );

    return NextResponse.json({ data: schedules });
  } catch (error) {
    logger.error("[MARKETING_SCHEDULE_GET_UNHANDLED_ERROR]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/marketing/schedule
 * Create a new schedule entry
 */
export async function POST(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const body: UpdateScheduleRequest = await request.json();

    // Validate required fields
    if (!body.platform || !body.timeUtc) {
      return NextResponse.json(
        { error: "Missing required fields: platform, timeUtc" },
        { status: 400 }
      );
    }

    // Validate platform
    if (!VALID_PLATFORMS.includes(body.platform)) {
      return NextResponse.json(
        { error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate time format (HH:MM)
    if (!/^\d{2}:\d{2}$/.test(body.timeUtc)) {
      return NextResponse.json(
        { error: "Invalid timeUtc format. Use HH:MM (e.g., 14:00)" },
        { status: 400 }
      );
    }

    // Validate content type if provided
    if (body.contentType && !VALID_CONTENT_TYPES.includes(body.contentType)) {
      return NextResponse.json(
        { error: `Invalid contentType. Must be one of: ${VALID_CONTENT_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate day_of_week if provided
    if (
      body.dayOfWeek !== undefined &&
      body.dayOfWeek !== null &&
      (body.dayOfWeek < 0 || body.dayOfWeek > 6)
    ) {
      return NextResponse.json(
        { error: "Invalid dayOfWeek. Must be 0-6 (Sunday-Saturday) or null for every day" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("marketing_schedule")
      .insert({
        platform: body.platform,
        day_of_week: body.dayOfWeek ?? null,
        time_utc: body.timeUtc,
        content_type: body.contentType || "auto",
        is_active: body.isActive ?? true,
      })
      .select()
      .single();

    if (error) {
      // Check for unique constraint violation
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Schedule entry already exists for this platform/day/time combination" },
          { status: 409 }
        );
      }
      logger.error("[MARKETING_SCHEDULE_CREATE_FAILED]", {
        platform: body.platform,
        error,
      });
      return NextResponse.json(
        { error: "Failed to create schedule" },
        { status: 500 }
      );
    }

    const schedule = rowToMarketingSchedule(data as MarketingScheduleRow);

    return NextResponse.json({ data: schedule }, { status: 201 });
  } catch (error) {
    logger.error("[MARKETING_SCHEDULE_POST_UNHANDLED_ERROR]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/marketing/schedule?id=xxx
 * Update a schedule entry
 */
export async function PUT(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Schedule id query parameter required" },
        { status: 400 }
      );
    }

    const body: Partial<UpdateScheduleRequest> = await request.json();

    // Build update object
    const updates: Record<string, unknown> = {};

    if (body.timeUtc !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(body.timeUtc)) {
        return NextResponse.json(
          { error: "Invalid timeUtc format. Use HH:MM (e.g., 14:00)" },
          { status: 400 }
        );
      }
      updates.time_utc = body.timeUtc;
    }

    if (body.contentType !== undefined) {
      if (!VALID_CONTENT_TYPES.includes(body.contentType)) {
        return NextResponse.json(
          { error: `Invalid contentType. Must be one of: ${VALID_CONTENT_TYPES.join(", ")}` },
          { status: 400 }
        );
      }
      updates.content_type = body.contentType;
    }

    if (body.isActive !== undefined) {
      updates.is_active = body.isActive;
    }

    if (body.dayOfWeek !== undefined) {
      if (body.dayOfWeek !== null && (body.dayOfWeek < 0 || body.dayOfWeek > 6)) {
        return NextResponse.json(
          { error: "Invalid dayOfWeek. Must be 0-6 or null" },
          { status: 400 }
        );
      }
      updates.day_of_week = body.dayOfWeek;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("marketing_schedule")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[MARKETING_SCHEDULE_UPDATE_FAILED]", { id, error });
      return NextResponse.json(
        { error: "Failed to update schedule" },
        { status: 500 }
      );
    }

    const schedule = rowToMarketingSchedule(data as MarketingScheduleRow);

    return NextResponse.json({ data: schedule });
  } catch (error) {
    logger.error("[MARKETING_SCHEDULE_PUT_UNHANDLED_ERROR]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/marketing/schedule?id=xxx
 * Delete a schedule entry
 */
export async function DELETE(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Schedule id query parameter required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { error } = await supabase
      .from("marketing_schedule")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[MARKETING_SCHEDULE_DELETE_FAILED]", { id, error });
      return NextResponse.json(
        { error: "Failed to delete schedule" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[MARKETING_SCHEDULE_DELETE_UNHANDLED_ERROR]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
