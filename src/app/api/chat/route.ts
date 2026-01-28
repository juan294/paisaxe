import { NextRequest, NextResponse } from "next/server";
import type { ChatResponse } from "@/types";

export async function POST(request: NextRequest) {
  // Dynamic imports — Turbopack corrupts the HTTP stack for api.anthropic.com
  // when lib modules (embeddings, search, supabase, claude) are statically
  // co-bundled in the same route. Each module works fine individually, but the
  // combination breaks outbound HTTPS to Anthropic. Dynamic imports isolate
  // each module's loading context and avoid the bundle corruption.
  const { generateChatResponse, extractSourcesFromChunks } = await import("@/lib/claude");
  const { generateEmbedding } = await import("@/lib/embeddings");
  const { search } = await import("@/lib/search");
  const { validateChatRequest } = await import("@/lib/validation");
  const { checkRateLimit } = await import("@/lib/rate-limit");
  const { supabase } = await import("@/lib/supabase");

  try {
    // Rate limiting - check before any processing
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimit = checkRateLimit(ip);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfter),
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(rateLimit.resetAt),
          },
        }
      );
    }

    // Input validation
    const body = await request.json();
    const validation = validateChatRequest(body);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { sanitizedMessage: message, sanitizedContext: context } = validation;

    // Generate embedding for the user's query
    const queryEmbedding = await generateEmbedding(message!);

    // Search for relevant content (with reranking via query text)
    const { chunks, images } = await search(queryEmbedding, 3, message!);

    // If context is provided (e.g., from immersive mode), prepend it
    const enrichedMessage = context
      ? `${context}\n\nPregunta del usuario: ${message}`
      : message!;

    // Check if Asturianu touches feature is enabled
    let asturianEnabled = false;
    try {
      const { data: flagData } = await supabase
        .from("feature_flags")
        .select("enabled")
        .eq("flag_key", "asturianu_touches")
        .single();
      asturianEnabled = flagData?.enabled ?? false;
    } catch {
      // Default to false on error
    }

    // Generate response using Claude with context
    const responseText = await generateChatResponse(enrichedMessage, chunks, asturianEnabled);

    // Extract sources from chunks
    const sources = extractSourcesFromChunks(chunks);

    const response: ChatResponse = {
      message: responseText,
      sources,
      images,
    };

    return NextResponse.json(response, {
      headers: {
        "X-RateLimit-Remaining": String(rateLimit.remaining),
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);

    // In development, return detailed error for debugging
    if (process.env.NODE_ENV === "development") {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      return NextResponse.json(
        {
          error: "Internal server error",
          debug: {
            message: errorMessage,
            stack: errorStack,
          }
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
