import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { CreateSuggestionRequest, StorySuggestionRow } from "@/types/suggestions";
import { rowToStorySuggestion } from "@/types/suggestions";
import { getSupabaseClient, getUserFromRequest } from "@/lib/supabase-auth";
import { getClientIp } from "@/lib/request-utils";
import { checkRateLimit } from "@/lib/rate-limit";

const SUGGESTION_RATE_LIMIT = {
  windowMs: 60_000,     // 1 minute
  maxRequests: 1,        // 1 suggestion per minute
  maxEntries: 10_000,
};

// GET /api/suggestions - Get user's own suggestions (requires auth)
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
    .from("story_suggestions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching suggestions:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 }
    );
  }

  const suggestions = (data as StorySuggestionRow[]).map(rowToStorySuggestion);
  return NextResponse.json({ data: suggestions });
}

// POST /api/suggestions - Submit a new suggestion (auth optional)
export async function POST(request: NextRequest) {
  // Detect user from cookie session (covers logged-in users without Authorization header)
  const supabase = await getSupabaseClient();
  const { data: { user: sessionUser } } = await supabase.auth.getUser();
  const user = sessionUser ?? await getUserFromRequest(request);

  // Rate limit by user ID or IP
  const ip = getClientIp(request);
  const identifier = `suggestion:${user?.id ?? ip}`;
  const rateLimit = await checkRateLimit(identifier, SUGGESTION_RATE_LIMIT);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait before submitting another suggestion." },
      { status: 429 }
    );
  }

  let body: CreateSuggestionRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  // Validate place_name
  const placeName = body.placeName?.trim();
  if (!placeName || placeName.length < 3 || placeName.length > 100) {
    return NextResponse.json(
      { error: "Place name must be between 3 and 100 characters" },
      { status: 400 }
    );
  }

  // Validate comment if provided
  const comment = body.comment?.trim() || null;
  if (comment && comment.length > 500) {
    return NextResponse.json(
      { error: "Comment must not exceed 500 characters" },
      { status: 400 }
    );
  }

  // Validate location if provided
  const validLocations = ["eastern", "central", "western"];
  const location = body.location || null;
  if (location && !validLocations.includes(location)) {
    return NextResponse.json(
      { error: "Invalid location. Must be eastern, central, or western." },
      { status: 400 }
    );
  }

  // Validate attribution if provided (how they want to be credited)
  const attribution = body.attribution?.trim() || null;
  if (attribution && attribution.length > 100) {
    return NextResponse.json(
      { error: "Attribution must not exceed 100 characters" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("story_suggestions")
    .insert({
      user_id: user?.id ?? null,
      place_name: placeName,
      comment,
      location,
      attribution,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating suggestion:", error);
    return NextResponse.json(
      { error: "Failed to create suggestion" },
      { status: 500 }
    );
  }

  const suggestion = rowToStorySuggestion(data as StorySuggestionRow);
  return NextResponse.json({ data: suggestion }, { status: 201 });
}
