import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import type { RouteRateLimitState } from "@/lib/chat-route-utils";

/** Keep caller-specific response bodies; provide actionable retry timing. */
export function rateLimitResponse<T>(body: T, state: Pick<RouteRateLimitState, "retryAfter">, headers: Record<string, string> = {}): NextResponse<T> {
  return NextResponse.json(body, {
    status: 429,
    headers: { "Retry-After": String(state.retryAfter ?? 60), ...headers },
  });
}

const minute = (maxRequests: number, maxEntries = 10_000) => ({ windowMs: 60_000, maxRequests, maxEntries });

/** Per-method controls and explicit cheap-read exemptions. See phase-2 budgets. */
export const REQUEST_BUDGETS = {
  "GET /api/favorites": { namespace: "favorites-read", config: minute(60) },
  "POST /api/favorites": { namespace: "favorites-mutate", config: minute(30) },
  "DELETE /api/favorites": { namespace: "favorites-mutate", config: minute(30) },
  "GET /api/voice-access": { namespace: "voice-access", config: minute(60) },
  "POST /api/checkout/embedded": { namespace: "checkout-embedded", config: minute(10) },
  "POST /api/mcp/save-favorite": { namespace: "mcp-save-favorite", config: minute(30), global: { namespace: "mcp-save-favorite:global", config: minute(180, 10) } },
  "GET /api/feature-flags": { exempt: "Public cached flags; 60s cache and 120s stale window, no paid provider." },
  "GET /api/stories": { exempt: "Cached public catalogue; source revalidates at 60s, no paid provider." },
  "GET /api/mcp/save-favorite": { exempt: "Constant documentation response; no I/O." },
  "GET /api/mcp/make-booking": { exempt: "Constant documentation/config-presence response; no I/O." },
  "POST /api/mcp/make-booking/status": { exempt: "Constant acknowledgement; no I/O or state mutation." },
  "POST /api/mcp/make-booking": { namespace: "mcp-make-booking:customer", config: { windowMs: 600_000, maxRequests: 3, maxEntries: 10_000 }, additionalCap: "Atomic DB daily call cap: 100/day (claim_daily_booking_call_slot), idempotency preserved." },
  "GET /api/mcp/weather": { namespace: "mcp-weather", config: minute(30), global: { namespace: "mcp-weather:global", config: minute(180, 10) } },
  "POST /api/mcp/weather": { namespace: "mcp-weather", config: minute(30), global: { namespace: "mcp-weather:global", config: minute(180, 10) } },
  "GET /api/mcp/places": { namespace: "mcp-places", config: minute(20), global: { namespace: "mcp-places:global", config: minute(120, 10) } },
  "POST /api/mcp/places": { namespace: "mcp-places", config: minute(20), global: { namespace: "mcp-places:global", config: minute(120, 10) } },
  "POST /api/suggestions": { namespace: "suggestion", config: minute(1) },
  "GET /api/suggestions": { namespace: "suggestions-read", config: minute(60) },
  "POST /api/voice-session": { namespace: "voice-session", config: minute(10) },
  "POST /api/chat/stream": { namespace: "IP /64", config: minute(10), untrusted: { windowMs: 60_000, maxRequests: 3, maxEntries: 1 } },
  "POST /api/booking/chat/stream": { namespace: "booking-chat", config: minute(20) },
} as const;

type EnforcedBudgetKey = { [K in keyof typeof REQUEST_BUDGETS]: typeof REQUEST_BUDGETS[K] extends { config: unknown } ? K : never }[keyof typeof REQUEST_BUDGETS];

export async function checkRequestBudget(key: EnforcedBudgetKey, identity: string) {
  const budget = REQUEST_BUDGETS[key];
  if ("global" in budget) {
    const global = await checkRateLimit(budget.global.namespace, budget.global.config);
    if (!global.allowed) return global;
  }
  return checkRateLimit(`${budget.namespace}:${identity}`, budget.config);
}
