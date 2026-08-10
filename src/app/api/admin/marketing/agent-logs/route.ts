import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { validateAdminAuth } from "@/lib/admin-auth";
import {
  rowToMarketingAgentLog,
  type MarketingAgentLogRow,
  type AgentStatus,
} from "@/types/marketing";
import { logger } from "@/lib/logger";

const VALID_STATUSES: AgentStatus[] = ["started", "success", "failed"];

/**
 * GET /api/admin/marketing/logs
 * Returns agent activity logs with optional filtering
 * Query params: agent, status, limit, offset
 */
export async function GET(request: NextRequest) {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);

    const agent = searchParams.get("agent");
    const status = searchParams.get("status") as AgentStatus | null;
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build query
    let query = supabase
      .from("marketing_agent_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // Apply filters
    if (agent) {
      query = query.eq("agent_name", agent);
    }

    if (status && VALID_STATUSES.includes(status)) {
      query = query.eq("status", status);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error("Error fetching marketing logs:", { error: error.message });
      return NextResponse.json(
        { error: "Failed to fetch logs" },
        { status: 500 }
      );
    }

    const logs = (data as MarketingAgentLogRow[]).map(rowToMarketingAgentLog);

    return NextResponse.json({
      data: logs,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    logger.error("Marketing logs GET error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
