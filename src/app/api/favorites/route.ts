import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseClient, getUserFromRequest } from "@/lib/supabase-auth";
import { favoritesPostSchema } from "@/lib/schemas";
import { readJsonBody } from "@/lib/request-validation";
import { logger } from "@/lib/logger";

// GET /api/favorites - Get user's favorites
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabase = await getSupabaseClient(request);

  const { data, error } = await supabase
    .from("user_favorites")
    .select("story_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Error fetching favorites:", { error: error.message });
    return NextResponse.json(
      { error: "Failed to fetch favorites" },
      { status: 500 }
    );
  }

  const storyIds = data.map((row) => row.story_id);
  return NextResponse.json(storyIds);
}

// POST /api/favorites - Add favorites
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    return bodyResult.error;
  }
  const parsed = favoritesPostSchema.safeParse(bodyResult.data);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { storyIds } = parsed.data;

  const supabase = await getSupabaseClient(request);

  const rows = storyIds.map((storyId: string) => ({
    user_id: user.id,
    story_id: storyId,
  }));

  const { error } = await supabase
    .from("user_favorites")
    .upsert(rows, { onConflict: "user_id,story_id" });

  if (error) {
    logger.error("Error adding favorites:", { error: error.message });
    return NextResponse.json(
      { error: "Failed to add favorites" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/favorites?storyId=xxx - Remove a favorite
export async function DELETE(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const storyId = searchParams.get("storyId");

  if (!storyId) {
    return NextResponse.json(
      { error: "storyId is required" },
      { status: 400 }
    );
  }

  const supabase = await getSupabaseClient(request);

  const { error } = await supabase
    .from("user_favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("story_id", storyId);

  if (error) {
    logger.error("Error removing favorite:", { error: error.message });
    return NextResponse.json(
      { error: "Failed to remove favorite" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
