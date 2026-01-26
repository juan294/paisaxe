import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase";
import type { AnalyticsSummary, FeatureAnalytics } from "@/types/analytics";

export async function GET(request: NextRequest) {
  const auth = validateAdminAuth(request);
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const url = new URL(request.url);
    const from = url.searchParams.get("from") || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const to = url.searchParams.get("to") || new Date().toISOString();

    const adminClient = createAdminClient();

    // Total events in date range
    const { count: totalEvents, error: countError } = await adminClient
      .from("analytics_events")
      .select("*", { count: "exact", head: true })
      .gte("created_at", from)
      .lte("created_at", to);

    if (countError) {
      console.error("Failed to count analytics events:", countError.message);
      return NextResponse.json(
        { error: "Failed to fetch analytics" },
        { status: 500 }
      );
    }

    // Get all events in range for aggregation
    const { data: events, error: eventsError } = await adminClient
      .from("analytics_events")
      .select("feature_flag, session_id")
      .gte("created_at", from)
      .lte("created_at", to);

    if (eventsError) {
      console.error("Failed to fetch analytics events:", eventsError.message);
      return NextResponse.json(
        { error: "Failed to fetch analytics" },
        { status: 500 }
      );
    }

    // Calculate unique sessions
    const allSessions = new Set(events?.map(e => e.session_id).filter(Boolean));

    // Per-feature breakdown
    const featureMap = new Map<string, { count: number; sessions: Set<string> }>();
    for (const event of events || []) {
      if (!event.feature_flag) continue;
      const existing = featureMap.get(event.feature_flag) || { count: 0, sessions: new Set<string>() };
      existing.count++;
      if (event.session_id) existing.sessions.add(event.session_id);
      featureMap.set(event.feature_flag, existing);
    }

    const featureBreakdown: FeatureAnalytics[] = Array.from(featureMap.entries()).map(
      ([featureFlag, { count, sessions }]) => ({
        featureFlag,
        eventCount: count,
        uniqueSessions: sessions.size,
      })
    );

    const summary: AnalyticsSummary = {
      totalEvents: totalEvents || 0,
      totalSessions: allSessions.size,
      featureBreakdown,
    };

    return NextResponse.json({
      data: {
        summary,
        dateRange: { from, to },
      },
    });
  } catch (error) {
    console.error("Admin analytics API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
