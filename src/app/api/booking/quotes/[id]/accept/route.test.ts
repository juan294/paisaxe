// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingError } from "@/lib/booking/types";

const deps = vi.hoisted(() => ({
  access: null as unknown,
  meter: { allowed: true, remaining: 9 },
}));
const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }));

vi.mock("@/lib/logger", () => ({ logger }));
vi.mock("@/lib/booking/gate", () => ({ requireBookingAccess: vi.fn(async () => deps.access) }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: vi.fn(() => ({ admin: true })) }));
vi.mock("@/lib/booking/metering", () => ({ consume: vi.fn(async () => deps.meter) }));
vi.mock("@/lib/booking/quotes", () => ({ acceptQuote: vi.fn() }));

const { POST } = await import("./route");
const { acceptQuote } = await import("@/lib/booking/quotes");
const { consume } = await import("@/lib/booking/metering");

const QUOTE_ID = "99999999-2222-4333-8444-555555555555";
const accept = () =>
  POST(new NextRequest(`http://localhost/api/booking/quotes/${QUOTE_ID}/accept`, { method: "POST" }), {
    params: Promise.resolve({ id: QUOTE_ID }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BOOKING_LINK_SECRET", "unit-test-secret-that-is-at-least-32-bytes-long");
  deps.access = { userId: "user-1", redemption: { id: "r1" } };
  deps.meter = { allowed: true, remaining: 9 };
});

describe("POST /api/booking/quotes/[id]/accept", () => {
  it("is the gate's 404 without booking access", async () => {
    deps.access = NextResponse.json({ error: "Not found" }, { status: 404 });
    expect((await accept()).status).toBe(404);
    expect(acceptQuote).not.toHaveBeenCalled();
  });

  it("spends a booking attempt and returns the booking card with its link", async () => {
    const bookingId = "11111111-2222-4333-8444-555555555555";
    vi.mocked(acceptQuote).mockResolvedValue({
      booking: { id: bookingId, reference: "RS-ABC123", status: "pending_payment", linkVersion: 1 } as never,
      link: "unused",
    });

    const response = await accept();

    expect(consume).toHaveBeenCalledWith({ admin: true }, "r1", "booking_attempts");
    expect(acceptQuote).toHaveBeenCalledWith({ admin: true }, "user-1", QUOTE_ID);
    expect(response.status).toBe(200);
    const { card } = await response.json();
    expect(card).toMatchObject({ kind: "booking", bookingId, reference: "RS-ABC123", status: "pending_payment" });
    expect(card.link).toMatch(new RegExp(`^/booking/${bookingId}\\.[A-Za-z0-9_-]{43}$`));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("is 429 limit_reached when the booking attempts are used up", async () => {
    deps.meter = { allowed: false, remaining: 0 };
    const response = await accept();
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "limit_reached" });
    expect(acceptQuote).not.toHaveBeenCalled();
  });

  it.each(["quote_expired", "no_capacity"] as const)("is 409 %s", async (code) => {
    vi.mocked(acceptQuote).mockRejectedValue(new BookingError(code));
    const response = await accept();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: code });
  });

  it("is 404 for a quote that is not the visitor's", async () => {
    vi.mocked(acceptQuote).mockRejectedValue(new BookingError("not_found"));
    expect((await accept()).status).toBe(404);
  });

  it("is 500 and logs on an unexpected failure", async () => {
    vi.mocked(acceptQuote).mockRejectedValue(new Error("db down"));
    expect((await accept()).status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith("[BOOKING_ACCEPT_FAILED]", expect.objectContaining({ quoteId: QUOTE_ID }));
  });
});
