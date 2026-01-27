import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";
import { rowToAdminStory, type AdminStoryRow, type CurationStatus } from "@/types/admin";

export async function GET(request: NextRequest) {
  // Validate admin auth
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const supabase = createAdminClient();

    // Get optional filter from query params
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") as CurationStatus | null;

    // Build query
    let query = supabase
      .from("stories")
      .select("*")
      .order("display_order", { ascending: true });

    // Apply filter if provided
    if (filter === "needs_curation" || filter === "approved") {
      query = query.eq("curation_status", filter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching stories:", error);
      return NextResponse.json(
        { error: "Failed to fetch stories" },
        { status: 500 }
      );
    }

    // Convert to admin stories
    const stories = (data as AdminStoryRow[]).map(rowToAdminStory);

    return NextResponse.json({ data: stories });
  } catch (error) {
    console.error("Admin stories API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
