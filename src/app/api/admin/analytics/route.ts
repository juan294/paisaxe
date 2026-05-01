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

import { queryPostHog, formatForHogQL } from "@/lib/posthog-query";
import { buildDomainFilter } from "@/lib/analytics-filter";
import { logger } from "@/lib/logger";

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

  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();

  if (!projectId || !apiKey) {
    logger.error("Missing POSTHOG_PROJECT_ID or POSTHOG_PERSONAL_API_KEY");
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
    const includeDev = url.searchParams.get("includeLocalhost") === "true";

    const from = formatForHogQL(fromParam);
    const to = formatForHogQL(toParam);

    // When includeDev is false, filter to only production domains (paisaxe.es, paisaxe.com).
    // This excludes localhost, tunnel domains, and any other non-production traffic.
    // When includeDev is true, show all data including development traffic.
    const excludeLocalhost = buildDomainFilter(includeDev);

    // -------------------------------------------------------------------------
    // PE-H1 fix: 18 queries → 5 consolidated queries (#282)
    //
    // Q1: Summary scalars — pageviews, visitors, sessions, bounce, new/returning
    // Q2: Time series — daily pageviews + visitors
    // Q3: 2-column categorical breakdowns (type, key, count)
    //      topPages, referrers, countries, devices, browsers, os, entryPages, exitPages
    // Q4: 3-column categorical breakdowns (type, key1, key2, count)
    //      cities, screenSizes
    // Q5: UTM campaigns
    // -------------------------------------------------------------------------

    const [
      summaryResult,
      timeSeriesResult,
      categorical2Result,
      categorical3Result,
      utmResult,
    ] = await Promise.all([
      // Q1: All scalar summary metrics in one query using CTEs.
      // Returns a single row: [pageviews, visitors, sessions, single_page_sessions, total_sessions_bounce, new_visitors, returning_visitors]
      queryPostHog(
        `WITH
          base AS (
            SELECT distinct_id, properties.$session_id AS session_id, timestamp
            FROM events
            WHERE event = '$pageview'
              AND timestamp >= '${from}'
              AND timestamp <= '${to}'
              ${excludeLocalhost}
          ),
          session_sizes AS (
            SELECT session_id, count() AS page_count
            FROM base
            WHERE session_id IS NOT NULL
            GROUP BY session_id
          ),
          new_vs_ret AS (
            SELECT
              distinct_id,
              if(min(timestamp) >= '${from}', 1, 0) AS is_new
            FROM events
            WHERE event = '$pageview'
              ${excludeLocalhost}
              AND distinct_id IN (
                SELECT DISTINCT distinct_id FROM base
              )
            GROUP BY distinct_id
          )
        SELECT
          (SELECT count() FROM base) AS pageviews,
          (SELECT count(DISTINCT distinct_id) FROM base) AS visitors,
          (SELECT count(DISTINCT session_id) FROM base WHERE session_id IS NOT NULL) AS sessions,
          (SELECT countIf(page_count = 1) FROM session_sizes) AS single_page_sessions,
          (SELECT count() FROM session_sizes) AS total_sessions_bounce,
          (SELECT countIf(is_new = 1) FROM new_vs_ret) AS new_visitors,
          (SELECT countIf(is_new = 0) FROM new_vs_ret) AS returning_visitors`,
        projectId,
        apiKey
      ),

      // Q2: Time series — daily pageviews and visitors
      queryPostHog(
        `SELECT
          toDate(timestamp) AS date,
          count() AS pageviews,
          count(DISTINCT distinct_id) AS visitors
        FROM events
        WHERE event = '$pageview'
          AND timestamp >= '${from}'
          AND timestamp <= '${to}'
          ${excludeLocalhost}
        GROUP BY date
        ORDER BY date ASC`,
        projectId,
        apiKey
      ),

      // Q3: All 2-column categorical breakdowns via UNION ALL with type discriminator.
      // Each sub-query is pre-ranked to top 10 via ROW_NUMBER() per partition.
      // Columns: [type, key, count]
      queryPostHog(
        `SELECT type, key, cnt AS count
        FROM (
          SELECT type, key, cnt,
                 ROW_NUMBER() OVER (PARTITION BY type ORDER BY cnt DESC) AS rn
          FROM (
            SELECT 'topPages' AS type, properties.$current_url AS key, count() AS cnt
            FROM events
            WHERE event = '$pageview'
              AND timestamp >= '${from}'
              AND timestamp <= '${to}'
              ${excludeLocalhost}
            GROUP BY key

            UNION ALL

            SELECT 'referrers' AS type, properties.$referrer AS key, count() AS cnt
            FROM events
            WHERE event = '$pageview'
              AND timestamp >= '${from}'
              AND timestamp <= '${to}'
              ${excludeLocalhost}
              AND properties.$referrer IS NOT NULL
              AND properties.$referrer != ''
            GROUP BY key

            UNION ALL

            SELECT 'countries' AS type, properties.$geoip_country_name AS key, count() AS cnt
            FROM events
            WHERE event = '$pageview'
              AND timestamp >= '${from}'
              AND timestamp <= '${to}'
              ${excludeLocalhost}
              AND properties.$geoip_country_name IS NOT NULL
            GROUP BY key

            UNION ALL

            SELECT 'devices' AS type, properties.$device_type AS key, count() AS cnt
            FROM events
            WHERE event = '$pageview'
              AND timestamp >= '${from}'
              AND timestamp <= '${to}'
              ${excludeLocalhost}
              AND properties.$device_type IS NOT NULL
            GROUP BY key

            UNION ALL

            SELECT 'browsers' AS type, properties.$browser AS key, count() AS cnt
            FROM events
            WHERE event = '$pageview'
              AND timestamp >= '${from}'
              AND timestamp <= '${to}'
              ${excludeLocalhost}
              AND properties.$browser IS NOT NULL
            GROUP BY key

            UNION ALL

            SELECT 'os' AS type, properties.$os AS key, count() AS cnt
            FROM events
            WHERE event = '$pageview'
              AND timestamp >= '${from}'
              AND timestamp <= '${to}'
              ${excludeLocalhost}
              AND properties.$os IS NOT NULL
            GROUP BY key

            UNION ALL

            SELECT 'entryPages' AS type, page AS key, count() AS cnt
            FROM (
              SELECT
                properties.$session_id AS session_id,
                argMin(properties.$pathname, timestamp) AS page
              FROM events
              WHERE event = '$pageview'
                AND timestamp >= '${from}'
                AND timestamp <= '${to}'
                ${excludeLocalhost}
                AND properties.$session_id IS NOT NULL
              GROUP BY session_id
            )
            GROUP BY key

            UNION ALL

            SELECT 'exitPages' AS type, page AS key, count() AS cnt
            FROM (
              SELECT
                properties.$session_id AS session_id,
                argMax(properties.$pathname, timestamp) AS page
              FROM events
              WHERE event = '$pageview'
                AND timestamp >= '${from}'
                AND timestamp <= '${to}'
                ${excludeLocalhost}
                AND properties.$session_id IS NOT NULL
              GROUP BY session_id
            )
            GROUP BY key
          )
        )
        WHERE rn <= 10
        ORDER BY type, count DESC`,
        projectId,
        apiKey
      ),

      // Q4: 3-column categorical breakdowns via UNION ALL with type discriminator.
      // Columns: [type, key1, key2, count]
      queryPostHog(
        `SELECT type, key1, key2, cnt AS count
        FROM (
          SELECT type, key1, key2, cnt,
                 ROW_NUMBER() OVER (PARTITION BY type ORDER BY cnt DESC) AS rn
          FROM (
            SELECT
              'cities' AS type,
              properties.$geoip_city_name AS key1,
              properties.$geoip_country_name AS key2,
              count() AS cnt
            FROM events
            WHERE event = '$pageview'
              AND timestamp >= '${from}'
              AND timestamp <= '${to}'
              ${excludeLocalhost}
              AND properties.$geoip_city_name IS NOT NULL
            GROUP BY key1, key2

            UNION ALL

            SELECT
              'screenSizes' AS type,
              toString(properties.$viewport_width) AS key1,
              toString(properties.$viewport_height) AS key2,
              count() AS cnt
            FROM events
            WHERE event = '$pageview'
              AND timestamp >= '${from}'
              AND timestamp <= '${to}'
              ${excludeLocalhost}
              AND properties.$viewport_width IS NOT NULL
              AND properties.$viewport_height IS NOT NULL
            GROUP BY key1, key2
          )
        )
        WHERE rn <= 10
        ORDER BY type, count DESC`,
        projectId,
        apiKey
      ),

      // Q5: UTM campaigns
      queryPostHog(
        `SELECT
          properties.utm_source AS source,
          properties.utm_medium AS medium,
          properties.utm_campaign AS campaign,
          count() AS count
        FROM events
        WHERE event = '$pageview'
          AND timestamp >= '${from}'
          AND timestamp <= '${to}'
          ${excludeLocalhost}
          AND (
            properties.utm_source IS NOT NULL
            OR properties.utm_medium IS NOT NULL
            OR properties.utm_campaign IS NOT NULL
          )
        GROUP BY source, medium, campaign
        ORDER BY count DESC
        LIMIT 10`,
        projectId,
        apiKey
      ),
    ]);

    // -------------------------------------------------------------------------
    // Parse Q1 — summary scalars (single row)
    // -------------------------------------------------------------------------
    const summaryRow = summaryResult.results[0] ?? [];
    const totalPageviews = Number(summaryRow[0] || 0);
    const uniqueVisitors = Number(summaryRow[1] || 0);
    const totalSessions = Number(summaryRow[2] || 0);
    const singlePageSessions = Number(summaryRow[3] || 0);
    const totalSessionsForBounce = Number(summaryRow[4] || 0);
    const newVisitorsCount = Number(summaryRow[5] || 0);
    const returningVisitorsCount = Number(summaryRow[6] || 0);

    const avgPagesPerSession = totalSessions > 0 ? totalPageviews / totalSessions : 0;
    const bounceRate = totalSessionsForBounce > 0
      ? (singlePageSessions / totalSessionsForBounce) * 100
      : 0;

    const summary: AnalyticsSummary = {
      totalPageviews,
      uniqueVisitors,
      totalSessions,
      avgPagesPerSession: Math.round(avgPagesPerSession * 100) / 100,
      bounceRate: Math.round(bounceRate * 100) / 100,
    };

    const newVsReturning: NewVsReturning = {
      newVisitors: newVisitorsCount,
      returningVisitors: returningVisitorsCount,
    };

    // -------------------------------------------------------------------------
    // Parse Q2 — time series
    // -------------------------------------------------------------------------
    const timeSeries: TimeSeriesPoint[] = timeSeriesResult.results.map((row) => ({
      date: String(row[0] || ""),
      pageviews: Number(row[1] || 0),
      visitors: Number(row[2] || 0),
    }));

    // -------------------------------------------------------------------------
    // Parse Q3 — 2-col categorical breakdowns (type, key, count)
    // -------------------------------------------------------------------------
    const topPages: TopPage[] = [];
    const topReferrers: TopReferrer[] = [];
    const countries: CountryBreakdown[] = [];
    const devices: DeviceBreakdown[] = [];
    const browsers: BrowserBreakdown[] = [];
    const operatingSystems: OSBreakdown[] = [];
    const entryPages: EntryPageBreakdown[] = [];
    const exitPages: ExitPageBreakdown[] = [];

    for (const row of categorical2Result.results) {
      const type = String(row[0] || "");
      const key = row[1];
      const count = Number(row[2] || 0);
      switch (type) {
        case "topPages":
          topPages.push({ url: String(key || ""), count });
          break;
        case "referrers":
          topReferrers.push({ referrer: String(key || ""), count });
          break;
        case "countries":
          countries.push({ country: String(key || "Unknown"), count });
          break;
        case "devices":
          devices.push({ device: String(key || "Unknown"), count });
          break;
        case "browsers":
          browsers.push({ browser: String(key || "Unknown"), count });
          break;
        case "os":
          operatingSystems.push({ os: String(key || "Unknown"), count });
          break;
        case "entryPages":
          entryPages.push({ page: String(key || "/"), count });
          break;
        case "exitPages":
          exitPages.push({ page: String(key || "/"), count });
          break;
      }
    }

    // -------------------------------------------------------------------------
    // Parse Q4 — 3-col categorical breakdowns (type, key1, key2, count)
    // -------------------------------------------------------------------------
    const cities: CityBreakdown[] = [];
    const screenSizes: ScreenSizeBreakdown[] = [];

    for (const row of categorical3Result.results) {
      const type = String(row[0] || "");
      const count = Number(row[3] || 0);
      switch (type) {
        case "cities":
          cities.push({
            city: String(row[1] || "Unknown"),
            country: String(row[2] || "Unknown"),
            count,
          });
          break;
        case "screenSizes":
          screenSizes.push({
            width: Number(row[1] || 0),
            height: Number(row[2] || 0),
            count,
          });
          break;
      }
    }

    // -------------------------------------------------------------------------
    // Parse Q5 — UTM campaigns
    // -------------------------------------------------------------------------
    const utmCampaigns: UTMBreakdown[] = utmResult.results.map((row) => ({
      source: row[0] ? String(row[0]) : "(direct)",
      medium: row[1] ? String(row[1]) : "(none)",
      campaign: row[2] ? String(row[2]) : "(none)",
      count: Number(row[3] || 0),
    }));

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
    }, {
      headers: {
        // Raised from 120s to 300s (5 min) — admin-only cached data, lower frequency acceptable.
        "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    // Log concisely - full stack traces for timeouts are noisy
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.warn(`Analytics API: ${errorMessage}`);

    // Return empty data structure instead of error for query failures
    // (e.g., new project with no events yet, or PostHog timeout)
    const url = new URL(request.url);
    const fromFallback = url.searchParams.get("from") ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const toFallback = url.searchParams.get("to") || new Date().toISOString();

    return NextResponse.json({
      data: getEmptyData(fromFallback, toFallback),
    });
  }
}
