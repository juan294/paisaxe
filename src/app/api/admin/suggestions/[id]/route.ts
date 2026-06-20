import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { validateAdminAuth } from "@/lib/admin-auth";
import type { StorySuggestionRow, UpdateSuggestionRequest } from "@/types/suggestions";
import { rowToStorySuggestion } from "@/types/suggestions";
import { updateSuggestionSchema } from "@/lib/schemas";
import { logger } from "@/lib/logger";

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

  const rawBody = await request.json().catch(() => null);
  if (rawBody === null) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const parsed = updateSuggestionSchema.safeParse(rawBody);
  if (!parsed.success) {
    const issues = parsed.error.issues;
    // Surface the refine message ("No updates provided") as a top-level error
    const noUpdates = issues.find((i) => i.message === "No updates provided");
    if (noUpdates) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }
    // Status enum error
    const statusIssue = issues.find((i) => i.path[0] === "status");
    if (statusIssue) {
      return NextResponse.json(
        { error: "Invalid status. Must be pending, reviewed, converted, or rejected." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const body = parsed.data as UpdateSuggestionRequest;

  // Build update object
  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) {
    updates.status = body.status;
  }
  if (body.adminNotes !== undefined) {
    updates.admin_notes = body.adminNotes;
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
      logger.error("Error updating suggestion:", { error: error.message });
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
    logger.error("Admin suggestion update error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/suggestions/[id] - Delete a suggestion
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
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
      logger.error("Error deleting suggestion:", { error: error.message });
      return NextResponse.json(
        { error: "Failed to delete suggestion" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error) {
    logger.error("Admin suggestion delete error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
