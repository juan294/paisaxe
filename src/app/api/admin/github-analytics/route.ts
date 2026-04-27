import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase";
import type {
  GitHubTrafficDaily,
  GitHubTrafficReferrer,
  GitHubTrafficPath,
  GitHubTrafficSummary,
} from "@/types/github-analytics";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  const supabase = createAdminClient();

  try {
    const url = new URL(request.url);
    const from = url.searchParams.get("from") ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const to = url.searchParams.get("to") ||
      new Date().toISOString().split("T")[0];

    // -------------------------------------------------------------------------
    // PE-L1 fix: 4 sequential Supabase awaits → 1 Promise.all (#307)
    //
    // Q1: daily traffic in date range
    // Q2: most recent referrer snapshot (top 20)
    // Q3: most recent paths snapshot (top 20)
    // Q4: last synced timestamp
    // -------------------------------------------------------------------------
    const [
      { data: dailyData, error: dailyError },
      { data: referrerData },
      { data: pathData },
      { data: lastSync },
    ] = await Promise.all([
      // Q1: daily traffic within date range
      supabase
        .from("github_traffic_daily")
        .select("date, views, views_unique, clones, clones_unique")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true }),

      // Q2: referrers — most recent snapshot, ordered by count desc
      supabase
        .from("github_traffic_referrers")
        .select("referrer, count, uniques, fetched_at")
        .order("fetched_at", { ascending: false })
        .order("count", { ascending: false })
        .limit(20),

      // Q3: paths — most recent snapshot, ordered by count desc
      supabase
        .from("github_traffic_paths")
        .select("path, title, count, uniques, fetched_at")
        .order("fetched_at", { ascending: false })
        .order("count", { ascending: false })
        .limit(20),

      // Q4: last synced timestamp
      supabase
        .from("github_traffic_daily")
        .select("fetched_at")
        .order("fetched_at", { ascending: false })
        .limit(1),
    ]);

    if (dailyError) {
      logger.error("Failed to fetch daily traffic:", { error: dailyError.message });
    }

    const daily: GitHubTrafficDaily[] = (dailyData || []).map((row) => ({
      date: row.date,
      views: row.views,
      views_unique: row.views_unique,
      clones: row.clones,
      clones_unique: row.clones_unique,
    }));

    // Calculate summary
    const summary: GitHubTrafficSummary = {
      totalViews: daily.reduce((sum, d) => sum + d.views, 0),
      totalUniqueViews: daily.reduce((sum, d) => sum + d.views_unique, 0),
      totalClones: daily.reduce((sum, d) => sum + d.clones, 0),
      totalUniqueClones: daily.reduce((sum, d) => sum + d.clones_unique, 0),
      dataPointCount: daily.length,
    };

    // Deduplicate referrers: only keep the latest snapshot
    const latestReferrerFetch = referrerData?.[0]?.fetched_at;
    const referrers: GitHubTrafficReferrer[] = (referrerData || [])
      .filter((r) => r.fetched_at === latestReferrerFetch)
      .map((r) => ({
        referrer: r.referrer,
        count: r.count,
        uniques: r.uniques,
        fetched_at: r.fetched_at,
      }));

    // Deduplicate paths: only keep the latest snapshot
    const latestPathFetch = pathData?.[0]?.fetched_at;
    const popularPaths: GitHubTrafficPath[] = (pathData || [])
      .filter((p) => p.fetched_at === latestPathFetch)
      .map((p) => ({
        path: p.path,
        title: p.title,
        count: p.count,
        uniques: p.uniques,
        fetched_at: p.fetched_at,
      }));

    const lastSyncedAt = lastSync?.[0]?.fetched_at || null;

    return NextResponse.json({
      data: {
        summary,
        daily,
        referrers,
        popularPaths,
        lastSyncedAt,
        dateRange: { from, to },
      },
    }, {
      headers: {
        "Cache-Control": "private, max-age=120, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    logger.error("GitHub analytics API error:", { error: error instanceof Error ? error.message : String(error) });

    return NextResponse.json({
      data: {
        summary: {
          totalViews: 0,
          totalUniqueViews: 0,
          totalClones: 0,
          totalUniqueClones: 0,
          dataPointCount: 0,
        },
        daily: [],
        referrers: [],
        popularPaths: [],
        lastSyncedAt: null,
        dateRange: {
          from: new URL(request.url).searchParams.get("from") || "",
          to: new URL(request.url).searchParams.get("to") || "",
        },
      },
    });
  }
}
