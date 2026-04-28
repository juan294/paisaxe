import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { StorySuggestionRow } from "@/types/suggestions";
import { rowToStorySuggestion } from "@/types/suggestions";
import { getSupabaseClient, getUserFromRequest } from "@/lib/supabase-auth";
import { getClientIp } from "@/lib/request-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSuggestionSchema } from "@/lib/schemas";
import { logger } from "@/lib/logger";

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
    logger.error("Error fetching suggestions:", { error: error.message });
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

  // Parse and validate body BEFORE rate limiting — invalid requests shouldn't consume tokens
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const parsed = createSuggestionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { placeName, comment: rawComment, location: rawLocation, attribution: rawAttribution, website } = parsed.data;

  // Honeypot check: bots fill hidden fields, humans never see them.
  // Return a fake 200 success to avoid revealing the honeypot mechanism.
  // TODO: Add Turnstile/hCaptcha token verification (#492) when CAPTCHA_SECRET_KEY env var is available
  if (website && website.trim().length > 0) {
    logger.warn("[HONEYPOT_TRIGGERED] Bot submission detected and silently rejected", {
      ip: getClientIp(request),
      placeName,
    });
    return NextResponse.json({ success: true });
  }

  const comment = rawComment?.trim() || null;
  const location = rawLocation ?? null;
  const attribution = rawAttribution?.trim() || null;

  // Rate limit after validation — only valid requests consume tokens
  const ip = getClientIp(request);
  const identifier = `suggestion:${user?.id ?? ip}`;
  const rateLimit = await checkRateLimit(identifier, SUGGESTION_RATE_LIMIT);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait before submitting another suggestion." },
      { status: 429 }
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
    logger.error("Error creating suggestion:", { error: error.message });
    return NextResponse.json(
      { error: "Failed to create suggestion" },
      { status: 500 }
    );
  }

  const suggestion = rowToStorySuggestion(data as StorySuggestionRow);
  return NextResponse.json({ data: suggestion }, { status: 201 });
}
