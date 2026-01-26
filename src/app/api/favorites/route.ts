import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

async function getSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore in server component context
          }
        },
      },
    }
  );
}

async function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabase = await getSupabaseClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

// GET /api/favorites - Get user's favorites
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("user_favorites")
    .select("story_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching favorites:", error);
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

  const body = await request.json();
  const { storyIds } = body;

  if (!Array.isArray(storyIds) || storyIds.length === 0) {
    return NextResponse.json(
      { error: "storyIds array is required" },
      { status: 400 }
    );
  }

  const supabase = await getSupabaseClient();

  const rows = storyIds.map((storyId: string) => ({
    user_id: user.id,
    story_id: storyId,
  }));

  const { error } = await supabase
    .from("user_favorites")
    .upsert(rows, { onConflict: "user_id,story_id" });

  if (error) {
    console.error("Error adding favorites:", error);
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

  const supabase = await getSupabaseClient();

  const { error } = await supabase
    .from("user_favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("story_id", storyId);

  if (error) {
    console.error("Error removing favorite:", error);
    return NextResponse.json(
      { error: "Failed to remove favorite" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
