import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";
import type { CurationStatus } from "@/types/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  // Validate admin auth
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Story ID is required" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { status } = body as { status: CurationStatus };

    // Validate status
    if (status !== "needs_curation" && status !== "approved") {
      return NextResponse.json(
        { error: "Invalid status. Must be 'needs_curation' or 'approved'" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Update story curation status
    const { data, error } = await supabase
      .from("stories")
      .update({ curation_status: status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update error:", error);
      return NextResponse.json(
        { error: "Failed to update story status" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Story not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: { id: data.id, curationStatus: status },
    });
  } catch (error) {
    console.error("Admin status API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
