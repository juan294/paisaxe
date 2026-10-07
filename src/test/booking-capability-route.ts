/**
 * Shared mocks for the booking-page route tests (PayPal hackathon plan,
 * Phase 4): the capability check, the per-IP rate limit and the admin client.
 * Call `vi.mock` with these factories in each test file, then import the route.
 */
import { NextRequest } from "next/server";
import { vi } from "vitest";
import type { Booking } from "@/lib/booking/types";

export const CAPABILITY = "11111111-2222-4333-8444-555555555555.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";

export const capabilityRouteState = {
  booking: null as Booking | null,
  allowed: true,
  admin: { tag: "admin" } as unknown,
};

export const testBooking: Booking = {
  id: "11111111-2222-4333-8444-555555555555",
  reference: "RS-ABC123",
  userId: "user-1",
  quoteId: "q1",
  experienceId: "6f1d9c1e-1111-4222-8333-444444444444",
  slotDate: "2026-11-21",
  slotTime: "10:00",
  partySize: 4,
  totalCents: 12000,
  depositCents: 3000,
  balanceCents: 9000,
  currency: "EUR",
  cancellationWindowHours: 24,
  status: "pending_payment",
  confirmedAt: null,
  linkVersion: 1,
};

export const linksMock = () => ({
  verifyBookingCapability: vi.fn(async (_client: unknown, capability: string) =>
    capability === CAPABILITY ? capabilityRouteState.booking : null
  ),
});

export const rateLimitMock = () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: capabilityRouteState.allowed,
    limit: 30,
    remaining: capabilityRouteState.allowed ? 29 : 0,
    resetAt: Date.now() + 60_000,
    retryAfter: 60,
  })),
});

export const adminMock = () => ({ createAdminClient: vi.fn(() => capabilityRouteState.admin) });

export function routeRequest(path: string, init: { method?: string; body?: unknown } = {}): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.7" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

export const capabilityParams = (capability = CAPABILITY) => ({ params: Promise.resolve({ capability }) });
