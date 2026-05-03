export interface RouteRateLimitState {
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export function buildEnrichedChatMessage(message: string, context?: string): string {
  return context
    ? `${context}\n\nPregunta del usuario: ${message}`
    : message;
}

export function buildRateLimitHeaders(
  rateLimit: RouteRateLimitState,
  blocked = false
): Record<string, string> {
  return {
    ...(rateLimit.retryAfter !== undefined
      ? { "Retry-After": String(rateLimit.retryAfter) }
      : {}),
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": blocked ? "0" : String(rateLimit.remaining),
    "X-RateLimit-Reset": String(rateLimit.resetAt),
  };
}
