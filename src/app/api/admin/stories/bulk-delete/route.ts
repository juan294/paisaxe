import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";

export async function DELETE(request: NextRequest) {
  // Validate admin auth
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const body = await request.json();
    const { storyIds } = body as { storyIds: string[] };

    // Validate input
    if (!Array.isArray(storyIds) || storyIds.length === 0) {
      return NextResponse.json(
        { error: "Story IDs array is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Delete all stories at once
    const { data, error } = await supabase
      .from("stories")
      .delete()
      .in("id", storyIds)
      .select("id");

    if (error) {
      console.error("Bulk delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete stories" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        deletedIds: data?.map((s) => s.id) || [],
      },
    });
  } catch (error) {
    console.error("Admin bulk delete API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
