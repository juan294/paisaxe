import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";
import {
  rowToMarketingPost,
  type MarketingPostRow,
  type CreatePostRequest,
  type MarketingPlatform,
  type PostStatus,
  PLATFORM_LIMITS,
} from "@/types/marketing";

const VALID_PLATFORMS: MarketingPlatform[] = ["x", "instagram", "pinterest", "tiktok"];
const VALID_STATUSES: PostStatus[] = ["draft", "scheduled", "posting", "posted", "failed"];

/**
 * GET /api/admin/marketing/posts
 * Returns posts with optional filtering
 * Query params: platform, status, limit, offset
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
    const status = searchParams.get("status") as PostStatus | null;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build query
    let query = supabase
      .from("marketing_posts")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // Apply filters
    if (platform && VALID_PLATFORMS.includes(platform)) {
      query = query.eq("platform", platform);
    }

    if (status && VALID_STATUSES.includes(status)) {
      query = query.eq("status", status);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching marketing posts:", error);
      return NextResponse.json(
        { error: "Failed to fetch posts" },
        { status: 500 }
      );
    }

    const posts = (data as MarketingPostRow[]).map(rowToMarketingPost);

    return NextResponse.json({
      data: posts,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Marketing posts GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/marketing/posts
 * Create a new post (draft or scheduled)
 */
export async function POST(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const body: CreatePostRequest = await request.json();

    // Validate required fields
    if (!body.platform || !body.content) {
      return NextResponse.json(
        { error: "Missing required fields: platform, content" },
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

    // Validate content length against platform limits
    const limits = PLATFORM_LIMITS[body.platform];
    if (body.content.length > limits.maxLength) {
      return NextResponse.json(
        {
          error: `Content exceeds ${body.platform} limit of ${limits.maxLength} characters`,
        },
        { status: 400 }
      );
    }

    // Validate media count
    if (body.mediaUrls && body.mediaUrls.length > limits.maxMedia) {
      return NextResponse.json(
        {
          error: `Too many media items. ${body.platform} allows max ${limits.maxMedia}`,
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get account for this platform
    const { data: account, error: accountError } = await supabase
      .from("marketing_accounts")
      .select("id")
      .eq("platform", body.platform)
      .eq("is_active", true)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: `No active ${body.platform} account configured` },
        { status: 400 }
      );
    }

    // Extract hashtags from content
    const hashtags = extractHashtags(body.content);

    // Determine status
    const status: PostStatus = body.scheduledFor ? "scheduled" : "draft";

    // Create post
    const { data, error } = await supabase
      .from("marketing_posts")
      .insert({
        account_id: account.id,
        platform: body.platform,
        content: body.content,
        media_urls: body.mediaUrls || [],
        hashtags,
        link_url: null, // Will be set based on storyId
        scheduled_for: body.scheduledFor || null,
        status,
        story_id: body.storyId || null,
        content_theme: body.contentTheme || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating marketing post:", error);
      return NextResponse.json(
        { error: "Failed to create post" },
        { status: 500 }
      );
    }

    const post = rowToMarketingPost(data as MarketingPostRow);

    return NextResponse.json({ data: post }, { status: 201 });
  } catch (error) {
    console.error("Marketing posts POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Extract hashtags from content string
 */
function extractHashtags(content: string): string[] {
  const hashtagRegex = /#[\w\u00C0-\u024F]+/g;
  const matches = content.match(hashtagRegex);
  return matches ? [...new Set(matches)] : [];
}
