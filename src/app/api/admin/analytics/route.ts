import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import type {
  AnalyticsSummary,
  TimeSeriesPoint,
  TopPage,
  TopReferrer,
  CountryBreakdown,
  CityBreakdown,
  DeviceBreakdown,
  BrowserBreakdown,
  OSBreakdown,
  ScreenSizeBreakdown,
  EntryPageBreakdown,
  ExitPageBreakdown,
  UTMBreakdown,
  NewVsReturning,
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

function getEmptyData(fromParam: string, toParam: string) {
  return {
    summary: {
      totalPageviews: 0,
      uniqueVisitors: 0,
      totalSessions: 0,
      avgPagesPerSession: 0,
      bounceRate: 0,
    },
    timeSeries: [],
    topPages: [],
    topReferrers: [],
    countries: [],
    cities: [],
    devices: [],
    browsers: [],
    operatingSystems: [],
    screenSizes: [],
    entryPages: [],
    exitPages: [],
    utmCampaigns: [],
    newVsReturning: { newVisitors: 0, returningVisitors: 0 },
    dateRange: { from: fromParam, to: toParam },
  };
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
      sessionsResult,
      avgPagesResult,
      bounceRateResult,
      timeSeriesResult,
      topPagesResult,
      topReferrersResult,
      countriesResult,
      citiesResult,
      devicesResult,
      browsersResult,
      osResult,
      screenSizesResult,
      entryPagesResult,
      exitPagesResult,
      utmResult,
      newVsReturningResult,
    ] = await Promise.all([
      // 1. Total pageviews
      queryPostHog(
        `SELECT count() FROM events WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}'`,
        projectId,
        apiKey
      ),
      // 2. Unique visitors
      queryPostHog(
        `SELECT count(DISTINCT distinct_id) FROM events WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}'`,
        projectId,
        apiKey
      ),
      // 3. Total sessions
      queryPostHog(
        `SELECT count(DISTINCT properties.$session_id) FROM events WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}'`,
        projectId,
        apiKey
      ),
      // 4. Avg pages per session (fetch both counts to calculate)
      queryPostHog(
        `SELECT count() as pageviews, count(DISTINCT properties.$session_id) as sessions FROM events WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}'`,
        projectId,
        apiKey
      ),
      // 5. Bounce rate (sessions with only 1 pageview)
      queryPostHog(
        `SELECT
          countIf(c = 1) as single_page_sessions,
          count() as total_sessions
        FROM (
          SELECT properties.$session_id as session_id, count() as c
          FROM events
          WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}' AND session_id IS NOT NULL
          GROUP BY session_id
        )`,
        projectId,
        apiKey
      ),
      // 6. Time series (pageviews and visitors per day)
      queryPostHog(
        `SELECT
          toDate(timestamp) as date,
          count() as pageviews,
          count(DISTINCT distinct_id) as visitors
        FROM events
        WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}'
        GROUP BY date
        ORDER BY date ASC`,
        projectId,
        apiKey
      ),
      // 7. Top pages
      queryPostHog(
        `SELECT properties.$current_url as url, count() as count FROM events WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}' GROUP BY url ORDER BY count DESC LIMIT 10`,
        projectId,
        apiKey
      ),
      // 8. Top referrers
      queryPostHog(
        `SELECT properties.$referrer as referrer, count() as count FROM events WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}' AND referrer IS NOT NULL AND referrer != '' GROUP BY referrer ORDER BY count DESC LIMIT 10`,
        projectId,
        apiKey
      ),
      // 9. Countries
      queryPostHog(
        `SELECT properties.$geoip_country_name as country, count() as count FROM events WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}' AND country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT 10`,
        projectId,
        apiKey
      ),
      // 10. Cities
      queryPostHog(
        `SELECT
          properties.$geoip_city_name as city,
          properties.$geoip_country_name as country,
          count() as count
        FROM events
        WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}' AND city IS NOT NULL
        GROUP BY city, country
        ORDER BY count DESC
        LIMIT 10`,
        projectId,
        apiKey
      ),
      // 11. Devices
      queryPostHog(
        `SELECT properties.$device_type as device, count() as count FROM events WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}' AND device IS NOT NULL GROUP BY device ORDER BY count DESC LIMIT 10`,
        projectId,
        apiKey
      ),
      // 12. Browsers
      queryPostHog(
        `SELECT properties.$browser as browser, count() as count FROM events WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}' AND browser IS NOT NULL GROUP BY browser ORDER BY count DESC LIMIT 10`,
        projectId,
        apiKey
      ),
      // 13. Operating systems
      queryPostHog(
        `SELECT properties.$os as os, count() as count FROM events WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}' AND os IS NOT NULL GROUP BY os ORDER BY count DESC LIMIT 10`,
        projectId,
        apiKey
      ),
      // 14. Screen sizes
      queryPostHog(
        `SELECT
          properties.$viewport_width as width,
          properties.$viewport_height as height,
          count() as count
        FROM events
        WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}' AND width IS NOT NULL AND height IS NOT NULL
        GROUP BY width, height
        ORDER BY count DESC
        LIMIT 10`,
        projectId,
        apiKey
      ),
      // 15. Entry pages (first page per session)
      queryPostHog(
        `SELECT page, count() as count
        FROM (
          SELECT
            properties.$session_id as session_id,
            argMin(properties.$pathname, timestamp) as page
          FROM events
          WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}' AND session_id IS NOT NULL
          GROUP BY session_id
        )
        GROUP BY page
        ORDER BY count DESC
        LIMIT 10`,
        projectId,
        apiKey
      ),
      // 16. Exit pages (last page per session)
      queryPostHog(
        `SELECT page, count() as count
        FROM (
          SELECT
            properties.$session_id as session_id,
            argMax(properties.$pathname, timestamp) as page
          FROM events
          WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}' AND session_id IS NOT NULL
          GROUP BY session_id
        )
        GROUP BY page
        ORDER BY count DESC
        LIMIT 10`,
        projectId,
        apiKey
      ),
      // 17. UTM campaigns
      queryPostHog(
        `SELECT
          properties.utm_source as source,
          properties.utm_medium as medium,
          properties.utm_campaign as campaign,
          count() as count
        FROM events
        WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}'
          AND (source IS NOT NULL OR medium IS NOT NULL OR campaign IS NOT NULL)
        GROUP BY source, medium, campaign
        ORDER BY count DESC
        LIMIT 10`,
        projectId,
        apiKey
      ),
      // 18. New vs returning visitors
      queryPostHog(
        `SELECT
          countIf(is_new = 1) as new_visitors,
          countIf(is_new = 0) as returning_visitors
        FROM (
          SELECT
            distinct_id,
            if(min(timestamp) >= '${from}', 1, 0) as is_new
          FROM events
          WHERE event = '$pageview' AND distinct_id IN (
            SELECT DISTINCT distinct_id FROM events WHERE event = '$pageview' AND timestamp >= '${from}' AND timestamp <= '${to}'
          )
          GROUP BY distinct_id
        )`,
        projectId,
        apiKey
      ),
    ]);

    // Calculate summary stats
    const totalPageviews = Number(pageviewsResult.results[0]?.[0] || 0);
    const uniqueVisitors = Number(visitorsResult.results[0]?.[0] || 0);
    const totalSessions = Number(sessionsResult.results[0]?.[0] || 0);

    const avgPagesPageviews = Number(avgPagesResult.results[0]?.[0] || 0);
    const avgPagesSessions = Number(avgPagesResult.results[0]?.[1] || 0);
    const avgPagesPerSession = avgPagesSessions > 0 ? avgPagesPageviews / avgPagesSessions : 0;

    const singlePageSessions = Number(bounceRateResult.results[0]?.[0] || 0);
    const totalSessionsForBounce = Number(bounceRateResult.results[0]?.[1] || 0);
    const bounceRate = totalSessionsForBounce > 0 ? (singlePageSessions / totalSessionsForBounce) * 100 : 0;

    const summary: AnalyticsSummary = {
      totalPageviews,
      uniqueVisitors,
      totalSessions,
      avgPagesPerSession: Math.round(avgPagesPerSession * 100) / 100,
      bounceRate: Math.round(bounceRate * 100) / 100,
    };

    // Process time series
    const timeSeries: TimeSeriesPoint[] = timeSeriesResult.results.map((row) => ({
      date: String(row[0] || ""),
      pageviews: Number(row[1] || 0),
      visitors: Number(row[2] || 0),
    }));

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

    const cities: CityBreakdown[] = citiesResult.results.map((row) => ({
      city: String(row[0] || "Unknown"),
      country: String(row[1] || "Unknown"),
      count: Number(row[2] || 0),
    }));

    const devices: DeviceBreakdown[] = devicesResult.results.map((row) => ({
      device: String(row[0] || "Unknown"),
      count: Number(row[1] || 0),
    }));

    const browsers: BrowserBreakdown[] = browsersResult.results.map((row) => ({
      browser: String(row[0] || "Unknown"),
      count: Number(row[1] || 0),
    }));

    const operatingSystems: OSBreakdown[] = osResult.results.map((row) => ({
      os: String(row[0] || "Unknown"),
      count: Number(row[1] || 0),
    }));

    const screenSizes: ScreenSizeBreakdown[] = screenSizesResult.results.map((row) => ({
      width: Number(row[0] || 0),
      height: Number(row[1] || 0),
      count: Number(row[2] || 0),
    }));

    const entryPages: EntryPageBreakdown[] = entryPagesResult.results.map((row) => ({
      page: String(row[0] || "/"),
      count: Number(row[1] || 0),
    }));

    const exitPages: ExitPageBreakdown[] = exitPagesResult.results.map((row) => ({
      page: String(row[0] || "/"),
      count: Number(row[1] || 0),
    }));

    const utmCampaigns: UTMBreakdown[] = utmResult.results.map((row) => ({
      source: row[0] ? String(row[0]) : "(direct)",
      medium: row[1] ? String(row[1]) : "(none)",
      campaign: row[2] ? String(row[2]) : "(none)",
      count: Number(row[3] || 0),
    }));

    const newVsReturning: NewVsReturning = {
      newVisitors: Number(newVsReturningResult.results[0]?.[0] || 0),
      returningVisitors: Number(newVsReturningResult.results[0]?.[1] || 0),
    };

    return NextResponse.json({
      data: {
        summary,
        timeSeries,
        topPages,
        topReferrers,
        countries,
        cities,
        devices,
        browsers,
        operatingSystems,
        screenSizes,
        entryPages,
        exitPages,
        utmCampaigns,
        newVsReturning,
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
      data: getEmptyData(fromFallback, toFallback),
    });
  }
}
