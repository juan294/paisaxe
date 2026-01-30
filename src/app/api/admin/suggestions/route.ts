import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";
import type { StorySuggestionRow, SuggestionStatus } from "@/types/suggestions";
import { rowToAdminStorySuggestion } from "@/types/suggestions";

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
      console.error("Error fetching suggestions:", error);
      return NextResponse.json(
        { error: "Failed to fetch suggestions" },
        { status: 500 }
      );
    }

    const suggestions = data as StorySuggestionRow[];

    // Get unique user IDs
    const userIds = [...new Set(suggestions.map((s) => s.user_id))];

    // Fetch user emails from auth.users
    // Using admin client to query user metadata
    const userEmails: Record<string, string> = {};
    for (const userId of userIds) {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      if (userData?.user?.email) {
        userEmails[userId] = userData.user.email;
      }
    }

    // Convert to admin suggestions with emails
    const adminSuggestions = suggestions.map((row) => {
      return rowToAdminStorySuggestion({
        ...row,
        user_email: userEmails[row.user_id],
      });
    });

    return NextResponse.json({ data: adminSuggestions });
  } catch (error) {
    console.error("Admin suggestions API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
