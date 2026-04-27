import { NextRequest, NextResponse } from "next/server";
import type { ChatResponse } from "@/types";
import { chatRequestSchema } from "@/lib/schemas";

// --- Lightweight imports: no heavy deps (Anthropic, Voyage, Supabase).
// Static here so they are resolved once at module load, not on every request.
// This removes 100-300 ms of cold-start dynamic-import cost for rejected
// requests (rate-limit, validation, injection) that never need the AI stack.
import { validateChatRequest } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import {
  detectInjectionAttempt,
  sanitizeInput,
  assessTopicRelevance,
  MAX_INPUT_LENGTH,
} from "@/lib/chat-safety";
import { GENERIC_REDIRECT_RESPONSE } from "@/lib/chat-config";
import { logger } from "@/lib/logger";

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
  try {
    // Rate limiting - check before any processing
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(ip);

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

    // Input validation — Zod runtime schema check first
    const body = await request.json().catch(() => null);
    const zodResult = chatRequestSchema.safeParse(body);
    if (!zodResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: zodResult.error.flatten() },
        { status: 400 }
      );
    }

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
      logger.warn("[CHAT_SECURITY] Injection attempt detected", {
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

    // --- Heavy imports: deferred until after validation passes ---
    // WHY DYNAMIC: Turbopack corrupts the outbound HTTP stack for api.anthropic.com
    // when these modules (embeddings, search, supabase, claude) are statically
    // co-bundled in the same route chunk. Each module works fine on its own, but
    // the combination breaks HTTPS to Anthropic in the Turbopack build. Dynamic
    // imports isolate each module's loading context and avoid the corruption.
    // Keeping them dynamic also means rate-limited / invalid requests never pay
    // the cost of loading the AI stack.
    const { generateChatResponse, extractSourcesFromChunks } = await import(
      "@/lib/claude"
    );
    const { generateEmbedding } = await import("@/lib/embeddings");
    const { search } = await import("@/lib/search");
    const { isFeatureFlagEnabled } = await import("@/lib/feature-flags-server");
    const { detectPromptLeakage } = await import("@/lib/chat-safety");

    // === MAIN PROCESSING ===

    // Parallelize the embedding call with the feature flag lookup — they are
    // independent and can be inflight simultaneously. The search step still
    // has to wait for the embedding (data dependency), but the flag check does not.
    const [queryEmbedding, asturianEnabled] = await Promise.all([
      generateEmbedding(cleanMessage),
      isFeatureFlagEnabled("asturianu_touches"),
    ]);

    // Search for relevant content (with reranking via query text)
    const { chunks, images } = await search(queryEmbedding, 3, cleanMessage);

    // If context is provided (e.g., from immersive mode), prepend it
    const enrichedMessage = context
      ? `${context}\n\nPregunta del usuario: ${cleanMessage}`
      : cleanMessage;

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
      logger.error("[CHAT_SECURITY] Prompt leakage detected in output", {
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
    logger.error("Chat API error:", { error: error instanceof Error ? error.message : String(error) });

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
