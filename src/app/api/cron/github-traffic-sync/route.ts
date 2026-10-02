import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-admin";
import { verifyVercelCron, verifyWebhookSecret } from "@/lib/cron-auth";
import { acquireCronJobLease, releaseCronJobLease } from "@/lib/cron-job-lock";
import { validateCsrfForAdminFallback } from "@/lib/csrf";
import { ALLOWED_ORIGINS } from "@/lib/proxy/cors";

const GITHUB_API_BASE = "https://api.github.com";
const REPO = "juan294/paisaxe";

const LOCK_KEY = "github-traffic-sync";
const LOCK_LEASE_SECONDS = 20 * 60;

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
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text}`);
  }

  return response.json();
}

/** Core sync logic shared by GET (Vercel Cron) and POST (pg_cron/admin). */
async function syncGitHubTraffic(): Promise<NextResponse> {
  const start = Date.now();
  const githubToken = process.env.GITHUB_TOKEN?.trim();
  if (!githubToken) {
    return NextResponse.json(
      { error: "Missing GITHUB_TOKEN environment variable" },
      { status: 500 }
    );
  }

  const supabase = createAdminClient();
  let lockToken: string | null = null;

  const lease = await acquireCronJobLease(supabase, LOCK_KEY, LOCK_LEASE_SECONDS);
  if (!lease.acquired) {
    if (lease.error) {
      logger.error("[GITHUB_TRAFFIC_SYNC_LOCK_FAILED]", { error: lease.error });
    }
    return NextResponse.json(
      { status: "skipped", reason: "concurrent run in progress" },
      { status: 409 }
    );
  }
  lockToken = lease.token;

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
        logger.error("[GITHUB_TRAFFIC_SYNC_DAILY_UPSERT_FAILED]", { error: dailyError });
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
        logger.error("[GITHUB_TRAFFIC_SYNC_REFERRERS_INSERT_FAILED]", { error: refError });
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
        logger.error("[GITHUB_TRAFFIC_SYNC_PATHS_INSERT_FAILED]", { error: pathError });
      } else {
        pathCount = pathRows.length;
      }
    }

    // Cleanup: remove referrer/path snapshots older than 90 days
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("github_traffic_referrers").delete().lte("fetched_at", cutoff);
    await supabase.from("github_traffic_paths").delete().lte("fetched_at", cutoff);

    logger.info("[CRON_SUCCESS]", { job: "github-traffic-sync", duration_ms: Date.now() - start });
    return NextResponse.json({
      synced: true,
      syncedAt: now,
      daily: dailyCount,
      referrers: referrerCount,
      paths: pathCount,
    });
  } catch (error) {
    logger.error("[CRON_FAILURE]", { job: "github-traffic-sync", error: error instanceof Error ? error.message : "Unknown error" });
    logger.error("[GITHUB_TRAFFIC_SYNC_UNHANDLED_ERROR]", { error });
    return NextResponse.json(
      { error: "Sync failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  } finally {
    try {
      await releaseCronJobLease(supabase, LOCK_KEY, lockToken);
    } catch (error) {
      logger.error("[GITHUB_TRAFFIC_SYNC_LOCK_RELEASE_FAILED]", { error });
    }
  }
}

/** Vercel Cron handler — triggered via GET with Authorization: Bearer <CRON_SECRET>. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyVercelCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return syncGitHubTraffic();
}

/** pg_cron / admin handler — triggered via POST with x-webhook-secret or admin session. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyWebhookSecret(request)) {
    const auth = await validateAdminAuth();
    if (!auth.valid) {
      return auth.error;
    }
    // BE-H5/SE-M1: admin-cookie fallback is exactly the CSRF attack surface —
    // require a valid CSRF token + Origin before trusting the session cookie.
    if (!validateCsrfForAdminFallback(request, ALLOWED_ORIGINS)) {
      return NextResponse.json(
        { error: "CSRF token missing or invalid" },
        { status: 403 }
      );
    }
    // BE-M1: webhook secret was absent/wrong but admin auth succeeded — log for ops visibility
    logger.warn("[CRON_AUTH_FALLBACK]", { source: "webhook", fellBackTo: "admin_auth" });
  }
  return syncGitHubTraffic();
}
