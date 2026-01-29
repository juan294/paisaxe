import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import type {
  AnalyticsSummary,
  TopPage,
  TopReferrer,
  CountryBreakdown,
  DeviceBreakdown,
} from "@/types/analytics";

interface HogQLResult {
  results: unknown[][];
}

async function queryPostHog(
  hogql: string,
  projectId: string,
  apiKey: string
): Promise<HogQLResult> {
  const response = await fetch(
    `https://eu.posthog.com/api/projects/${projectId}/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query: hogql,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PostHog API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export async function GET(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  const projectId = process.env.POSTHOG_PROJECT_ID;
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;

  if (!projectId || !apiKey) {
    console.error("Missing POSTHOG_PROJECT_ID or POSTHOG_PERSONAL_API_KEY");
    return NextResponse.json(
      { error: "Analytics configuration missing" },
      { status: 500 }
    );
  }

  try {
    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from") ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const toParam = url.searchParams.get("to") || new Date().toISOString();

    // Format dates for HogQL: 'YYYY-MM-DD HH:MM:SS' (no milliseconds, no timezone)
    // PostHog EU uses DateTime64 with Europe/Madrid timezone, simpler format works better
    const formatForHogQL = (isoString: string) => {
      const date = new Date(isoString);
      return date.toISOString().slice(0, 19).replace("T", " ");
    };
    const from = formatForHogQL(fromParam);
    const to = formatForHogQL(toParam);

    // Run all queries in parallel
    const [
      pageviewsResult,
      visitorsResult,
      topPagesResult,
      topReferrersResult,
      countriesResult,
      devicesResult,
    ] = await Promise.all([
      // Total pageviews
      queryPostHog(
        `SELECT count() FROM events WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}'`,
        projectId,
        apiKey
      ),
      // Unique visitors
      queryPostHog(
        `SELECT count(DISTINCT distinct_id) FROM events WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}'`,
        projectId,
        apiKey
      ),
      // Top pages
      queryPostHog(
        `SELECT properties.$current_url as url, count() as count FROM events WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}' GROUP BY url ORDER BY count DESC LIMIT 10`,
        projectId,
        apiKey
      ),
      // Top referrers
      queryPostHog(
        `SELECT properties.$referrer as referrer, count() as count FROM events WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}' AND referrer IS NOT NULL AND referrer != '' GROUP BY referrer ORDER BY count DESC LIMIT 10`,
        projectId,
        apiKey
      ),
      // Countries
      queryPostHog(
        `SELECT properties.$geoip_country_name as country, count() as count FROM events WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}' AND country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT 10`,
        projectId,
        apiKey
      ),
      // Devices
      queryPostHog(
        `SELECT properties.$device_type as device, count() as count FROM events WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}' AND device IS NOT NULL GROUP BY device ORDER BY count DESC LIMIT 10`,
        projectId,
        apiKey
      ),
    ]);

    const summary: AnalyticsSummary = {
      totalPageviews: Number(pageviewsResult.results[0]?.[0] || 0),
      uniqueVisitors: Number(visitorsResult.results[0]?.[0] || 0),
    };

    const topPages: TopPage[] = topPagesResult.results.map((row) => ({
      url: String(row[0] || ""),
      count: Number(row[1] || 0),
    }));

    const topReferrers: TopReferrer[] = topReferrersResult.results.map((row) => ({
      referrer: String(row[0] || ""),
      count: Number(row[1] || 0),
    }));

    const countries: CountryBreakdown[] = countriesResult.results.map((row) => ({
      country: String(row[0] || "Unknown"),
      count: Number(row[1] || 0),
    }));

    const devices: DeviceBreakdown[] = devicesResult.results.map((row) => ({
      device: String(row[0] || "Unknown"),
      count: Number(row[1] || 0),
    }));

    return NextResponse.json({
      data: {
        summary,
        topPages,
        topReferrers,
        countries,
        devices,
        dateRange: { from: fromParam, to: toParam },
      },
    });
  } catch (error) {
    console.error("Admin analytics API error:", error);

    // Return empty data structure instead of error for query failures
    // (e.g., new project with no events yet)
    const url = new URL(request.url);
    const fromFallback = url.searchParams.get("from") ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const toFallback = url.searchParams.get("to") || new Date().toISOString();

    return NextResponse.json({
      data: {
        summary: { totalPageviews: 0, uniqueVisitors: 0 },
        topPages: [],
        topReferrers: [],
        countries: [],
        devices: [],
        dateRange: { from: fromFallback, to: toFallback },
      },
    });
  }
}
