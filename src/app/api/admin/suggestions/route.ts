import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { validateAdminAuth } from "@/lib/admin-auth";
import type { StorySuggestionRow, SuggestionStatus } from "@/types/suggestions";
import { rowToAdminStorySuggestion } from "@/types/suggestions";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * PE-L1 (#815): bound how many `auth.admin.getUserById` calls run at once.
 * A plain sequential loop made this linear in submitter count with no
 * timeout; an unbounded `Promise.all` would instead fan out N concurrent
 * admin-API calls, which for a large backlog could trip Supabase's
 * auth-admin rate limits. This keeps a fixed number of calls in flight.
 */
const GET_USER_BY_ID_CONCURRENCY = 5;

async function fetchUserEmails(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Record<string, string>> {
  const userEmails: Record<string, string> = {};
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < userIds.length) {
      const userId = userIds[nextIndex++];
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      if (userData?.user?.email) {
        userEmails[userId] = userData.user.email;
      }
    }
  }

  const workerCount = Math.min(GET_USER_BY_ID_CONCURRENCY, userIds.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return userEmails;
}

export async function GET(request: NextRequest) {
  // Validate admin auth
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const supabase = createAdminClient();

    // Get optional status filter from query params
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") as SuggestionStatus | null;

    // Build query - join with auth.users to get email
    // We need to use a raw query or RPC since auth.users is protected
    // Instead, we'll fetch suggestions and then get user emails separately
    let query = supabase
      .from("story_suggestions")
      .select("*")
      .order("created_at", { ascending: false });

    // Apply status filter if provided
    const validStatuses: SuggestionStatus[] = ["pending", "reviewed", "converted", "rejected"];
    if (statusFilter && validStatuses.includes(statusFilter)) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Error fetching suggestions:", { error: error.message });
      return NextResponse.json(
        { error: "Failed to fetch suggestions" },
        { status: 500 }
      );
    }

    const suggestions = data as StorySuggestionRow[];

    // Get unique user IDs (filter out nulls for anonymous submissions)
    const userIds = [...new Set(suggestions.map((s) => s.user_id).filter(Boolean))] as string[];

    // Fetch user emails from auth.users (bounded concurrency — see PE-L1 #815)
    const userEmails = await fetchUserEmails(supabase, userIds);

    // Convert to admin suggestions with emails
    const adminSuggestions = suggestions.map((row) => {
      return rowToAdminStorySuggestion({
        ...row,
        user_email: row.user_id ? userEmails[row.user_id] : undefined,
      });
    });

    return NextResponse.json({ data: adminSuggestions });
  } catch (error) {
    logger.error("Admin suggestions API error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
