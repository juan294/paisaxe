import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";
import {
  rowToMarketingAccountPublic,
  rowToMarketingPost,
  rowToMarketingSchedule,
  type MarketingAccountRow,
  type MarketingPostRow,
  type MarketingScheduleRow,
  type MarketingDashboardSummary,
  type MarketingStats,
  type MarketingPlatform,
  type PlatformStats,
  type PostEngagement,
} from "@/types/marketing";

/**
 * GET /api/admin/marketing/dashboard
 * Returns a summary of marketing automation status for the admin dashboard
 */
export async function GET() {
  // Validate admin auth
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const supabase = createAdminClient();

    // Fetch all data in parallel
    const [accountsResult, postsResult, schedulesResult] = await Promise.all([
      supabase.from("marketing_accounts").select("*").order("platform"),

      supabase
        .from("marketing_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100), // Get recent posts for stats

      supabase
        .from("marketing_schedule")
        .select("*")
        .order("platform")
        .order("day_of_week"),
    ]);

    if (accountsResult.error) {
      console.error("Error fetching accounts:", accountsResult.error);
      return NextResponse.json(
        { error: "Failed to fetch accounts" },
        { status: 500 }
      );
    }

    if (postsResult.error) {
      console.error("Error fetching posts:", postsResult.error);
      return NextResponse.json(
        { error: "Failed to fetch posts" },
        { status: 500 }
      );
    }

    if (schedulesResult.error) {
      console.error("Error fetching schedules:", schedulesResult.error);
      return NextResponse.json(
        { error: "Failed to fetch schedules" },
        { status: 500 }
      );
    }

    // Convert to typed objects
    const accounts = (accountsResult.data as MarketingAccountRow[]).map(
      rowToMarketingAccountPublic
    );
    const allPosts = (postsResult.data as MarketingPostRow[]).map(
      rowToMarketingPost
    );
    const schedules = (schedulesResult.data as MarketingScheduleRow[]).map(
      rowToMarketingSchedule
    );

    // Calculate time ranges
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Filter posts for different views
    const recentPosts = allPosts
      .filter((p) => p.status === "posted")
      .slice(0, 10);

    const upcomingPosts = allPosts
      .filter((p) => p.status === "scheduled" && p.scheduledFor)
      .sort(
        (a, b) =>
          new Date(a.scheduledFor!).getTime() -
          new Date(b.scheduledFor!).getTime()
      )
      .slice(0, 10);

    // Calculate stats
    const stats = calculateStats(
      allPosts,
      oneWeekAgo,
      oneMonthAgo
    );

    const summary: MarketingDashboardSummary = {
      accounts,
      recentPosts,
      upcomingPosts,
      schedules,
      stats,
    };

    return NextResponse.json({ data: summary });
  } catch (error) {
    console.error("Marketing dashboard API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function calculateStats(
  posts: ReturnType<typeof rowToMarketingPost>[],
  oneWeekAgo: Date,
  oneMonthAgo: Date
): MarketingStats {
  // Initialize platform stats
  const byPlatform: Record<MarketingPlatform, PlatformStats> = {
    x: createEmptyPlatformStats(),
    instagram: createEmptyPlatformStats(),
    pinterest: createEmptyPlatformStats(),
    tiktok: createEmptyPlatformStats(),
  };

  let totalPosts = 0;
  let postsThisWeek = 0;
  let postsThisMonth = 0;
  let failedPosts = 0;
  const totalEngagement: PostEngagement = {};

  for (const post of posts) {
    const platform = post.platform;
    const postedAt = post.postedAt ? new Date(post.postedAt) : null;

    // Count by status
    if (post.status === "posted") {
      totalPosts++;
      byPlatform[platform].posts++;

      if (postedAt) {
        if (postedAt >= oneWeekAgo) {
          postsThisWeek++;
        }
        if (postedAt >= oneMonthAgo) {
          postsThisMonth++;
        }

        // Track last posted
        if (
          !byPlatform[platform].lastPostedAt ||
          new Date(byPlatform[platform].lastPostedAt!) < postedAt
        ) {
          byPlatform[platform].lastPostedAt = post.postedAt;
        }
      }

      // Aggregate engagement
      if (post.engagement) {
        aggregateEngagement(totalEngagement, post.engagement);
        aggregateEngagement(byPlatform[platform].engagement, post.engagement);
      }
    } else if (post.status === "scheduled") {
      byPlatform[platform].scheduled++;
    } else if (post.status === "failed") {
      failedPosts++;
    }
  }

  return {
    totalPosts,
    postsThisWeek,
    postsThisMonth,
    failedPosts,
    totalEngagement,
    byPlatform,
  };
}

function createEmptyPlatformStats(): PlatformStats {
  return {
    posts: 0,
    scheduled: 0,
    engagement: {},
    lastPostedAt: null,
  };
}

function aggregateEngagement(
  target: PostEngagement,
  source: PostEngagement
): void {
  for (const key of Object.keys(source) as (keyof PostEngagement)[]) {
    const value = source[key];
    if (typeof value === "number") {
      target[key] = (target[key] || 0) + value;
    }
  }
}
