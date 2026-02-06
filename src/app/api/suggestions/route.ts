import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { CreateSuggestionRequest, StorySuggestionRow } from "@/types/suggestions";
import { rowToStorySuggestion } from "@/types/suggestions";

// In-memory rate limiting (per user ID or IP)
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

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

function getRateLimitKey(request: NextRequest, userId: string | null): string {
  if (userId) return `user:${userId}`;
  // For anonymous users, rate limit by IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  return `ip:${ip}`;
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const lastSubmission = rateLimitMap.get(key);

  if (lastSubmission && now - lastSubmission < RATE_LIMIT_WINDOW_MS) {
    return true;
  }

  return false;
}

function recordSubmission(key: string): void {
  rateLimitMap.set(key, Date.now());

  // Clean up old entries periodically (every 100 entries)
  if (rateLimitMap.size > 100) {
    const now = Date.now();
    for (const [k, timestamp] of rateLimitMap.entries()) {
      if (now - timestamp > RATE_LIMIT_WINDOW_MS * 5) {
        rateLimitMap.delete(k);
      }
    }
  }
}

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
  // Auth is optional - anonymous users can submit too
  const user = await getUserFromRequest(request);
  const rateLimitKey = getRateLimitKey(request, user?.id ?? null);

  // Check rate limit
  if (isRateLimited(rateLimitKey)) {
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

  const supabase = await getSupabaseClient();

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

  // Record the submission for rate limiting
  recordSubmission(rateLimitKey);

  const suggestion = rowToStorySuggestion(data as StorySuggestionRow);
  return NextResponse.json({ data: suggestion }, { status: 201 });
}
