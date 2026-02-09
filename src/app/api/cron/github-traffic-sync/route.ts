import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { validateAdminAuth } from "@/lib/admin-auth";

const GITHUB_API_BASE = "https://api.github.com";
const REPO = "juan294/paisaxe";

interface GitHubTrafficViewsResponse {
  count: number;
  uniques: number;
  views: Array<{ timestamp: string; count: number; uniques: number }>;
}

interface GitHubTrafficClonesResponse {
  count: number;
  uniques: number;
  clones: Array<{ timestamp: string; count: number; uniques: number }>;
}

interface GitHubReferrer {
  referrer: string;
  count: number;
  uniques: number;
}

interface GitHubPath {
  path: string;
  title: string;
  count: number;
  uniques: number;
}

async function fetchGitHub<T>(endpoint: string, token: string): Promise<T> {
  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text}`);
  }

  return response.json();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth: verify webhook secret (pg_cron) OR admin session (manual sync)
  const secret = request.headers.get("x-webhook-secret");
  const expectedSecret = process.env.WEBHOOK_SECRET?.trim();

  // Check webhook secret first (for pg_cron calls)
  const hasValidSecret =
    !!secret &&
    !!expectedSecret &&
    secret.length === expectedSecret.length &&
    timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret));

  // Fallback: check admin session (for manual sync from admin panel)
  if (!hasValidSecret) {
    const auth = await validateAdminAuth();
    if (!auth.valid) {
      return auth.error;
    }
  }

  const githubToken = process.env.GITHUB_TOKEN?.trim();
  if (!githubToken) {
    return NextResponse.json(
      { error: "Missing GITHUB_TOKEN environment variable" },
      { status: 500 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Missing Supabase configuration" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch all 4 GitHub Traffic endpoints in parallel
    const [viewsData, clonesData, referrersData, pathsData] = await Promise.all([
      fetchGitHub<GitHubTrafficViewsResponse>(`/repos/${REPO}/traffic/views`, githubToken),
      fetchGitHub<GitHubTrafficClonesResponse>(`/repos/${REPO}/traffic/clones`, githubToken),
      fetchGitHub<GitHubReferrer[]>(`/repos/${REPO}/traffic/popular/referrers`, githubToken),
      fetchGitHub<GitHubPath[]>(`/repos/${REPO}/traffic/popular/paths`, githubToken),
    ]);

    const now = new Date().toISOString();

    // Merge views + clones into daily records keyed by date
    const dailyMap = new Map<string, {
      date: string;
      views: number;
      views_unique: number;
      clones: number;
      clones_unique: number;
    }>();

    for (const view of viewsData.views || []) {
      const date = view.timestamp.split("T")[0];
      const existing = dailyMap.get(date) || {
        date,
        views: 0,
        views_unique: 0,
        clones: 0,
        clones_unique: 0,
      };
      existing.views = view.count;
      existing.views_unique = view.uniques;
      dailyMap.set(date, existing);
    }

    for (const clone of clonesData.clones || []) {
      const date = clone.timestamp.split("T")[0];
      const existing = dailyMap.get(date) || {
        date,
        views: 0,
        views_unique: 0,
        clones: 0,
        clones_unique: 0,
      };
      existing.clones = clone.count;
      existing.clones_unique = clone.uniques;
      dailyMap.set(date, existing);
    }

    // Upsert daily traffic (ON CONFLICT on date PK)
    const dailyRows = Array.from(dailyMap.values()).map((row) => ({
      ...row,
      fetched_at: now,
    }));

    let dailyCount = 0;
    if (dailyRows.length > 0) {
      const { error: dailyError } = await supabase
        .from("github_traffic_daily")
        .upsert(dailyRows, { onConflict: "date" });

      if (dailyError) {
        console.error("Failed to upsert daily traffic:", dailyError);
      } else {
        dailyCount = dailyRows.length;
      }
    }

    // Insert referrer snapshot (delete old snapshots > 90 days to avoid bloat)
    let referrerCount = 0;
    const referrerRows = (referrersData || []).map((r) => ({
      fetched_at: now,
      referrer: r.referrer,
      count: r.count,
      uniques: r.uniques,
    }));

    if (referrerRows.length > 0) {
      const { error: refError } = await supabase
        .from("github_traffic_referrers")
        .insert(referrerRows);

      if (refError) {
        console.error("Failed to insert referrers:", refError);
      } else {
        referrerCount = referrerRows.length;
      }
    }

    // Insert paths snapshot
    let pathCount = 0;
    const pathRows = (pathsData || []).map((p) => ({
      fetched_at: now,
      path: p.path,
      title: p.title,
      count: p.count,
      uniques: p.uniques,
    }));

    if (pathRows.length > 0) {
      const { error: pathError } = await supabase
        .from("github_traffic_paths")
        .insert(pathRows);

      if (pathError) {
        console.error("Failed to insert paths:", pathError);
      } else {
        pathCount = pathRows.length;
      }
    }

    // Cleanup: remove referrer/path snapshots older than 90 days
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("github_traffic_referrers").delete().lte("fetched_at", cutoff);
    await supabase.from("github_traffic_paths").delete().lte("fetched_at", cutoff);

    return NextResponse.json({
      synced: true,
      syncedAt: now,
      daily: dailyCount,
      referrers: referrerCount,
      paths: pathCount,
    });
  } catch (error) {
    console.error("GitHub traffic sync error:", error);
    return NextResponse.json(
      { error: "Sync failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
