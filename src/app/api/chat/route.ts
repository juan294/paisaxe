import { NextRequest, NextResponse } from "next/server";
import { generateChatResponse, extractSourcesFromChunks } from "@/lib/claude";
import { generateEmbedding } from "@/lib/embeddings";
import { search } from "@/lib/search";
import { validateChatRequest } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { supabase } from "@/lib/supabase";
import type { ChatResponse } from "@/types";

export async function POST(request: NextRequest) {
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

    // Search for relevant content
    const { chunks, images } = await search(queryEmbedding, 3);

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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
