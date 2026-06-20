/**
 * Marketing Posts API
 *
 * Handles CRUD operations for marketing posts/drafts.
 * Supports the manual posting workflow where agents create drafts
 * that are manually posted by the user.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";
import {
  createDraft,
  getDrafts,
  markAsPosted,
  deleteDraft,
  updateDraft,
  type CreateDraftInput,
} from "@/lib/posting-service";
import type { MarketingPlatform } from "@/types/marketing";
import { marketingDraftSchema, marketingDraftPatchSchema } from "@/lib/schemas";

/**
 * GET /api/admin/marketing/posts
 * Get posts filtered by status and/or platform
 *
 * Query params:
 * - status: "draft" | "scheduled" | "posted" | "failed" (default: "draft")
 * - platform: "x" | "instagram" | "pinterest" (optional)
 */
export async function GET(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "draft";
    const platform = searchParams.get("platform") as MarketingPlatform | null;

    // For now, we only support fetching drafts via the posting service
    // Other statuses would need direct database queries
    if (status === "draft") {
      const drafts = await getDrafts(platform || undefined);
      return NextResponse.json({ data: drafts });
    }

    // For other statuses, query directly
    const { createAdminClient } = await import("@/lib/supabase-admin");
    const supabase = createAdminClient();

    let query = supabase
      .from("marketing_posts")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (platform) {
      query = query.eq("platform", platform);
    }

    const { data, error } = await query.limit(50);

    if (error) {
      logger.error("[MARKETING_POSTS_FETCH_FAILED]", { error });
      return NextResponse.json(
        { error: "Failed to fetch posts" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    logger.error("[MARKETING_POSTS_GET_UNHANDLED_ERROR]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/marketing/posts
 * Create a new draft post
 */
export async function POST(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const rawBody: unknown = await request.json();
    const parsed = marketingDraftSchema.safeParse(rawBody);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? "Invalid request body" },
        { status: 400 }
      );
    }

    const result = await createDraft(parsed.data as CreateDraftInput);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          validationErrors: result.validationErrors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: result.post }, { status: 201 });
  } catch (error) {
    logger.error("[MARKETING_POSTS_CREATE_DRAFT_FAILED]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/marketing/posts
 * Update a draft or mark as posted
 *
 * Query params:
 * - id: post ID (required)
 * - action: "update" | "mark-posted" (default: "update")
 */
export async function PATCH(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("id");
    const action = searchParams.get("action") || "update";

    if (!postId) {
      return NextResponse.json(
        { error: "Post ID required" },
        { status: 400 }
      );
    }

    if (action === "mark-posted") {
      const body = await request.json().catch(() => ({}));
      const result = await markAsPosted({
        postId,
        platformPostId: body.platformPostId,
        postUrl: body.postUrl,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // Regular update
    const rawPatch: unknown = await request.json();
    const parsedPatch = marketingDraftPatchSchema.safeParse(rawPatch);
    if (!parsedPatch.success) {
      const firstIssue = parsedPatch.error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? "Invalid request body" },
        { status: 400 }
      );
    }
    const result = await updateDraft(postId, parsedPatch.data as Partial<CreateDraftInput>);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[MARKETING_POSTS_UPDATE_FAILED]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/marketing/posts?id=<post_id>
 * Delete a draft post
 */
export async function DELETE(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("id");

    if (!postId) {
      return NextResponse.json(
        { error: "Post ID required" },
        { status: 400 }
      );
    }

    const result = await deleteDraft(postId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[MARKETING_POSTS_DELETE_FAILED]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
