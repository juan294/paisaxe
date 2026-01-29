import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";
import type { CurationStatus } from "@/types/admin";

export async function PUT(request: NextRequest) {
  // Validate admin auth
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const body = await request.json();
    const { storyIds, status } = body as { storyIds: string[]; status: CurationStatus };

    // Validate input
    if (!Array.isArray(storyIds) || storyIds.length === 0) {
      return NextResponse.json(
        { error: "Story IDs array is required" },
        { status: 400 }
      );
    }

    if (status !== "needs_curation" && status !== "approved") {
      return NextResponse.json(
        { error: "Invalid status. Must be 'needs_curation' or 'approved'" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Update all stories at once
    const { data, error } = await supabase
      .from("stories")
      .update({ curation_status: status })
      .in("id", storyIds)
      .select("id");

    if (error) {
      console.error("Bulk update error:", error);
      return NextResponse.json(
        { error: "Failed to update stories" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        updatedIds: data?.map((s) => s.id) || [],
        status,
      },
    });
  } catch (error) {
    console.error("Admin bulk status API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
