import { NextRequest, NextResponse } from "next/server";
import type { ChatResponse } from "@/types";

/**
 * Extended response type with security metadata
 */
interface SecureChatResponse extends ChatResponse {
  /** Topic relevance for analytics */
  topicRelevance?: string;
  /** Whether the request was flagged for security reasons */
  flagged?: boolean;
  /** Reason for flagging (only in development) */
  flagReason?: string;
}

export async function POST(request: NextRequest) {
  // Dynamic imports — Turbopack corrupts the HTTP stack for api.anthropic.com
  // when lib modules (embeddings, search, supabase, claude) are statically
  // co-bundled in the same route. Each module works fine individually, but the
  // combination breaks outbound HTTPS to Anthropic. Dynamic imports isolate
  // each module's loading context and avoid the bundle corruption.
  const { generateChatResponse, extractSourcesFromChunks } = await import(
    "@/lib/claude"
  );
  const { generateEmbedding } = await import("@/lib/embeddings");
  const { search } = await import("@/lib/search");
  const { validateChatRequest } = await import("@/lib/validation");
  const { checkRateLimit } = await import("@/lib/rate-limit");
  const { supabase } = await import("@/lib/supabase");

  // Security modules
  const {
    detectInjectionAttempt,
    sanitizeInput,
    assessTopicRelevance,
    detectPromptLeakage,
    MAX_INPUT_LENGTH,
  } = await import("@/lib/chat-safety");
  const { GENERIC_REDIRECT_RESPONSE } = await import("@/lib/chat-config");

  const { getClientIp } = await import("@/lib/request-utils");

  try {
    // Rate limiting - check before any processing
    const ip = getClientIp(request);
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
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { sanitizedMessage: message, sanitizedContext: context, messageIndex } = validation;

    // === SECURITY PRE-PROCESSING ===

    // Check message length (additional check beyond validation)
    if (message && message.length > MAX_INPUT_LENGTH) {
      return NextResponse.json(
        {
          message:
            "Your message is quite long. Could you please summarize your question about Asturias?",
          flagged: true,
          flagReason: "length_exceeded",
        } satisfies SecureChatResponse,
        {
          headers: {
            "X-RateLimit-Remaining": String(rateLimit.remaining),
          },
        }
      );
    }

    // Detect injection attempts
    if (message && detectInjectionAttempt(message)) {
      console.warn("[CHAT_SECURITY] Injection attempt detected", {
        timestamp: new Date().toISOString(),
        ip,
        inputPreview: message.slice(0, 100),
      });

      return NextResponse.json(
        {
          message: GENERIC_REDIRECT_RESPONSE,
          sources: [],
          images: [],
          flagged: true,
          flagReason:
            process.env.NODE_ENV === "development"
              ? "injection_attempt"
              : undefined,
        } satisfies SecureChatResponse,
        {
          headers: {
            "X-RateLimit-Remaining": String(rateLimit.remaining),
          },
        }
      );
    }

    // Sanitize input (remove potential delimiters)
    const cleanMessage = sanitizeInput(message!);

    // Assess topic relevance for analytics
    const topicRelevance = assessTopicRelevance(cleanMessage);

    // === MAIN PROCESSING ===

    // Generate embedding for the user's query
    const queryEmbedding = await generateEmbedding(cleanMessage);

    // Search for relevant content (with reranking via query text)
    const { chunks, images } = await search(queryEmbedding, 3, cleanMessage);

    // If context is provided (e.g., from immersive mode), prepend it
    const enrichedMessage = context
      ? `${context}\n\nPregunta del usuario: ${cleanMessage}`
      : cleanMessage;

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
    const responseText = await generateChatResponse(
      enrichedMessage,
      chunks,
      asturianEnabled,
      messageIndex
    );

    // === SECURITY POST-PROCESSING ===

    // Check for prompt leakage in output
    if (detectPromptLeakage(responseText)) {
      console.error("[CHAT_SECURITY] Prompt leakage detected in output", {
        timestamp: new Date().toISOString(),
        outputPreview: responseText.slice(0, 200),
      });

      return NextResponse.json(
        {
          message: GENERIC_REDIRECT_RESPONSE,
          sources: [],
          images: [],
          flagged: true,
          flagReason:
            process.env.NODE_ENV === "development"
              ? "output_filtered"
              : undefined,
        } satisfies SecureChatResponse,
        {
          headers: {
            "X-RateLimit-Remaining": String(rateLimit.remaining),
          },
        }
      );
    }

    // Extract sources from chunks
    const sources = extractSourcesFromChunks(chunks);

    const response: SecureChatResponse = {
      message: responseText,
      sources,
      images,
      topicRelevance,
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      return NextResponse.json(
        {
          error: "Internal server error",
          debug: {
            message: errorMessage,
            stack: errorStack,
          },
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
