import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
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
} from "@/types/marketing";
import { logger } from "@/lib/logger";

/**
 * Default empty stats object — used when the SQL aggregation RPC returns no
 * rows (e.g. an empty marketing_posts table). Guarantees the response always
 * has all three platforms present so the dashboard can render unconditionally.
 */
function emptyMarketingStats(): MarketingStats {
  const emptyPlatform = (): PlatformStats => ({
    posts: 0,
    scheduled: 0,
    engagement: {},
    lastPostedAt: null,
  });
  return {
    totalPosts: 0,
    postsThisWeek: 0,
    postsThisMonth: 0,
    failedPosts: 0,
    totalEngagement: {},
    byPlatform: {
      x: emptyPlatform(),
      instagram: emptyPlatform(),
      pinterest: emptyPlatform(),
    },
  };
}

/**
 * Merge the SQL-aggregated stats over the empty defaults so every platform key
 * is always present even if the RPC omitted a platform with no rows.
 */
function normalizeMarketingStats(raw: unknown): MarketingStats {
  const base = emptyMarketingStats();
  if (!raw || typeof raw !== "object") return base;
  const stats = raw as Partial<MarketingStats>;

  const platforms: MarketingPlatform[] = ["x", "instagram", "pinterest"];
  const byPlatform = (stats.byPlatform ?? {}) as Partial<
    Record<MarketingPlatform, PlatformStats>
  >;

  for (const platform of platforms) {
    const p = byPlatform[platform];
    if (p) {
      base.byPlatform[platform] = {
        posts: p.posts ?? 0,
        scheduled: p.scheduled ?? 0,
        engagement: p.engagement ?? {},
        lastPostedAt: p.lastPostedAt ?? null,
      };
    }
  }

  return {
    totalPosts: stats.totalPosts ?? 0,
    postsThisWeek: stats.postsThisWeek ?? 0,
    postsThisMonth: stats.postsThisMonth ?? 0,
    failedPosts: stats.failedPosts ?? 0,
    totalEngagement: stats.totalEngagement ?? {},
    byPlatform: base.byPlatform,
  };
}

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

    // Fetch all data in parallel. Stats are aggregated in SQL via the
    // get_marketing_post_stats RPC (PE-M4) instead of folding 100 rows in JS.
    // The 100-row post fetch is still used for the recent/upcoming lists only.
    const [accountsResult, postsResult, schedulesResult, statsResult] =
      await Promise.all([
        supabase.from("marketing_accounts").select("*").order("platform"),

        supabase
          .from("marketing_posts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100), // Recent posts for the recent/upcoming lists

        supabase
          .from("marketing_schedule")
          .select("*")
          .order("platform")
          .order("day_of_week"),

        supabase.rpc("get_marketing_post_stats"),
      ]);

    if (accountsResult.error) {
      logger.error("Error fetching accounts:", { error: accountsResult.error.message });
      return NextResponse.json(
        { error: "Failed to fetch accounts" },
        { status: 500 }
      );
    }

    if (postsResult.error) {
      logger.error("Error fetching posts:", { error: postsResult.error.message });
      return NextResponse.json(
        { error: "Failed to fetch posts" },
        { status: 500 }
      );
    }

    if (schedulesResult.error) {
      logger.error("Error fetching schedules:", { error: schedulesResult.error.message });
      return NextResponse.json(
        { error: "Failed to fetch schedules" },
        { status: 500 }
      );
    }

    if (statsResult.error) {
      logger.error("Error fetching stats:", { error: statsResult.error.message });
      return NextResponse.json(
        { error: "Failed to fetch stats" },
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

    // Stats are pre-aggregated in SQL (get_marketing_post_stats RPC).
    const stats = normalizeMarketingStats(statsResult.data);

    const summary: MarketingDashboardSummary = {
      accounts,
      recentPosts,
      upcomingPosts,
      schedules,
      stats,
    };

    return NextResponse.json({ data: summary });
  } catch (error) {
    logger.error("Marketing dashboard API error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
