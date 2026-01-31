/**
 * Marketing Posts API
 *
 * Handles CRUD operations for marketing posts/drafts.
 * Supports the manual posting workflow where agents create drafts
 * that are manually posted by the user.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import {
  createDraft,
  getDrafts,
  markAsPosted,
  deleteDraft,
  updateDraft,
  type CreateDraftInput,
} from "@/lib/posting-service";
import type { MarketingPlatform } from "@/types/marketing";

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
    const { createAdminClient } = await import("@/lib/supabase");
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
      console.error("Error fetching posts:", error);
      return NextResponse.json(
        { error: "Failed to fetch posts" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error("Marketing posts API error:", error);
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
    const body: CreateDraftInput = await request.json();

    // Validate required fields
    if (!body.platform || !body.content) {
      return NextResponse.json(
        { error: "Missing required fields: platform, content" },
        { status: 400 }
      );
    }

    const result = await createDraft(body);

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
    console.error("Create draft error:", error);
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
    const body: Partial<CreateDraftInput> = await request.json();
    const result = await updateDraft(postId, body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update post error:", error);
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
    console.error("Delete post error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
