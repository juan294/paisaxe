import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase";
import type {
  GitHubTrafficDaily,
  GitHubTrafficReferrer,
  GitHubTrafficPath,
  GitHubTrafficSummary,
} from "@/types/github-analytics";

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

    // Fetch daily traffic within date range
    const { data: dailyData, error: dailyError } = await supabase
      .from("github_traffic_daily")
      .select("date, views, views_unique, clones, clones_unique")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true });

    if (dailyError) {
      console.error("Failed to fetch daily traffic:", dailyError);
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

    // Fetch most recent referrer snapshot
    const { data: referrerData } = await supabase
      .from("github_traffic_referrers")
      .select("referrer, count, uniques, fetched_at")
      .order("fetched_at", { ascending: false })
      .order("count", { ascending: false })
      .limit(20);

    // Deduplicate: only keep the latest snapshot
    const latestReferrerFetch = referrerData?.[0]?.fetched_at;
    const referrers: GitHubTrafficReferrer[] = (referrerData || [])
      .filter((r) => r.fetched_at === latestReferrerFetch)
      .map((r) => ({
        referrer: r.referrer,
        count: r.count,
        uniques: r.uniques,
        fetched_at: r.fetched_at,
      }));

    // Fetch most recent paths snapshot
    const { data: pathData } = await supabase
      .from("github_traffic_paths")
      .select("path, title, count, uniques, fetched_at")
      .order("fetched_at", { ascending: false })
      .order("count", { ascending: false })
      .limit(20);

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

    // Last synced timestamp from daily data
    const { data: lastSync } = await supabase
      .from("github_traffic_daily")
      .select("fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(1);

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
    console.error("GitHub analytics API error:", error);

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
