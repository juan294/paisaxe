import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";

export async function POST(_request: NextRequest) {
  // Validate admin auth
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  try {
    const supabase = createAdminClient();

    // Update all stories with needs_curation status to approved
    const { data, error } = await supabase
      .from("stories")
      .update({ curation_status: "approved" })
      .eq("curation_status", "needs_curation")
      .select("id");

    if (error) {
      console.error("Approve all error:", error);
      return NextResponse.json(
        { error: "Failed to approve stories" },
        { status: 500 }
      );
    }

    const approvedIds = data?.map((s) => s.id) || [];

    return NextResponse.json({
      data: {
        approvedCount: approvedIds.length,
        approvedIds,
      },
    });
  } catch (error) {
    console.error("Admin approve-all API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
