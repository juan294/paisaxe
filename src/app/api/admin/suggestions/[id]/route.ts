import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";
import type { StorySuggestionRow, SuggestionStatus, UpdateSuggestionRequest } from "@/types/suggestions";
import { rowToStorySuggestion } from "@/types/suggestions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/admin/suggestions/[id] - Update suggestion status/notes
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // Validate admin auth
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Suggestion ID is required" },
      { status: 400 }
    );
  }

  let body: UpdateSuggestionRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  // Validate status if provided
  const validStatuses: SuggestionStatus[] = ["pending", "reviewed", "converted", "rejected"];
  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json(
      { error: "Invalid status. Must be pending, reviewed, converted, or rejected." },
      { status: 400 }
    );
  }

  // Build update object
  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) {
    updates.status = body.status;
  }
  if (body.adminNotes !== undefined) {
    updates.admin_notes = body.adminNotes;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No updates provided" },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("story_suggestions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating suggestion:", error);
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Suggestion not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update suggestion" },
        { status: 500 }
      );
    }

    const suggestion = rowToStorySuggestion(data as StorySuggestionRow);
    return NextResponse.json({ data: suggestion });
  } catch (error) {
    console.error("Admin suggestion update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/suggestions/[id] - Delete a suggestion
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Validate admin auth
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Suggestion ID is required" },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("story_suggestions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting suggestion:", error);
      return NextResponse.json(
        { error: "Failed to delete suggestion" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error) {
    console.error("Admin suggestion delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
