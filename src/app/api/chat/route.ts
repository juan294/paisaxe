import { NextRequest, NextResponse } from "next/server";
import type { ChatResponse } from "@/types";
import { chatRequestSchema } from "@/lib/schemas";

// --- Lightweight imports: no heavy deps (Anthropic, Voyage, Supabase).
// Static here so they are resolved once at module load, not on every request.
// This removes 100-300 ms of cold-start dynamic-import cost for rejected
// requests (rate-limit, validation, injection) that never need the AI stack.
import { checkRateLimit } from "@/lib/rate-limit";
import { withRouteContext } from "@/lib/request-validation";
import { getClientIp } from "@/lib/request-utils";
import {
  detectInjectionAttempt,
  sanitizeInput,
  assessTopicRelevance,
} from "@/lib/chat-safety";
import { GENERIC_REDIRECT_RESPONSE } from "@/lib/chat-config";
import { logger } from "@/lib/logger";
import { buildEnrichedChatMessage, buildRateLimitHeaders } from "@/lib/chat-route-utils";
import {
  isChatStreamStageTimeout,
  withChatStreamStageTiming,
} from "@/lib/chat-stream-timeouts";

// PE-H5 (#808): explicit ceiling for this legacy JSON route, replacing
// Vercel's implicit project default. This route's stages are all wrapped in
// a single non-resetting withChatStreamStageTiming call each (no idle-reset
// loop like the SSE route), so the worst case is a fixed sum: embedding
// (12s) + search (5s) + featureFlag (2s) + response (30s) = 49s. 60s keeps
// this internal budget as the binding constraint with a comfortable margin.
export const maxDuration = 60;

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
  // DO-M1 (#619): bind X-Request-ID into the request context so handler logs
  // carry request_id.
  return withRouteContext(request, () => handlePost(request));
}

// BE-H1: stricter shared-bucket rate limit for requests without a trusted Vercel IP
// header. All such clients share one bucket with a tighter cap (3 req/60s) to prevent
// the "unknown" key from being used as a bypass. On Vercel production, all real
// requests carry x-vercel-forwarded-for, so this only fires in unusual conditions.
const UNTRUSTED_RATE_LIMIT = { windowMs: 60_000, maxRequests: 3, maxEntries: 1 };

async function handlePost(request: NextRequest) {
  try {
    // Rate limiting - check before any processing
    const ip = getClientIp(request);
    if (ip === "unknown") {
      logger.warn("[CHAT_UNTRUSTED_IP]", {
        path: "/api/chat",
        reason: "no_vercel_forwarded_for",
      });
    }
    const rateLimit = await checkRateLimit(
      ip === "unknown" ? "untrusted" : ip,
      ip === "unknown" ? UNTRUSTED_RATE_LIMIT : undefined
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: buildRateLimitHeaders(rateLimit, true),
        }
      );
    }

    // Input validation — single Zod parse path (BE-L3 #524).
    // The schema sanitizes message/context and validates post-sanitization
    // lengths, so the former validateChatRequest helper is no longer needed.
    const body = await request.json().catch(() => null);
    const zodResult = chatRequestSchema.safeParse(body);
    if (!zodResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: zodResult.error.flatten() },
        { status: 400 }
      );
    }

    const { message, context, messageIndex } = zodResult.data;

    // === SECURITY PRE-PROCESSING ===

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
    const cleanMessage = sanitizeInput(message);

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

    // Keep the feature-flag lookup concurrent with retrieval, but cap every
    // pre-response stage so this legacy JSON route cannot hang indefinitely.
    const asturianEnabledPromise = isFeatureFlagEnabled("asturianu_touches");
    void asturianEnabledPromise.catch(() => {});

    let chunks: Awaited<ReturnType<typeof search>>["chunks"] = [];
    let images: Awaited<ReturnType<typeof search>>["images"] = [];
    try {
      const queryEmbedding = await withChatStreamStageTiming(
        "embedding",
        generateEmbedding(cleanMessage)
      );
      ({ chunks, images } = await withChatStreamStageTiming(
        "search",
        search(queryEmbedding, 3, cleanMessage)
      ));
    } catch (searchErr) {
      if (!isChatStreamStageTimeout(searchErr)) {
        throw searchErr;
      }

      logger.warn("[CHAT_SEARCH_UNAVAILABLE]", {
        error: searchErr,
        stage: searchErr.stage,
      });
      return NextResponse.json(
        { error: "search_unavailable" },
        {
          status: 503,
          headers: {
            "X-RateLimit-Remaining": String(rateLimit.remaining),
          },
        }
      );
    }

    // If context is provided (e.g., from immersive mode), prepend it
    const enrichedMessage = buildEnrichedChatMessage(cleanMessage, context);

    let asturianEnabled = false;
    try {
      asturianEnabled = await withChatStreamStageTiming("featureFlag", asturianEnabledPromise);
    } catch (flagErr) {
      logger.warn("[CHAT_FEATURE_FLAG_FALLBACK]", { error: flagErr });
    }

    // Generate response using Claude with context
    let responseText: string;
    try {
      responseText = await withChatStreamStageTiming(
        "response",
        generateChatResponse(
          enrichedMessage,
          chunks,
          asturianEnabled,
          messageIndex
        )
      );
    } catch (responseErr) {
      if (!isChatStreamStageTimeout(responseErr)) {
        throw responseErr;
      }

      logger.warn("[CHAT_RESPONSE_TIMEOUT]", {
        error: responseErr,
        stage: responseErr.stage,
      });
      return NextResponse.json(
        { error: "response_timeout" },
        {
          status: 504,
          headers: {
            "X-RateLimit-Remaining": String(rateLimit.remaining),
          },
        }
      );
    }

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
