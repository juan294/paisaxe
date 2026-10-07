// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CAPABILITY,
  capabilityParams,
  capabilityRouteState,
  routeRequest,
  testBooking,
} from "@/test/booking-capability-route";
import { BookingError } from "@/lib/booking/types";

vi.mock("@/lib/booking/links", async () => (await import("@/test/booking-capability-route")).linksMock());
vi.mock("@/lib/rate-limit", async () => (await import("@/test/booking-capability-route")).rateLimitMock());
vi.mock("@/lib/supabase-admin", async () => (await import("@/test/booking-capability-route")).adminMock());
vi.mock("@/lib/booking/capture", () => ({ ensurePaymentOrder: vi.fn() }));

const { POST } = await import("./route");
const { ensurePaymentOrder } = await import("@/lib/booking/capture");

const pay = (capability = CAPABILITY) =>
  POST(routeRequest(`/api/booking/bookings/${capability}/payment`, { method: "POST" }), capabilityParams(capability));

const order = {
  approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T",
  amountCents: 3000,
  currency: "EUR",
  expiresAt: "2026-11-20T09:20:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(capabilityRouteState, { booking: testBooking, allowed: true });
  vi.mocked(ensurePaymentOrder).mockResolvedValue(order);
});

describe("POST /api/booking/bookings/[capability]/payment (the pay button, F06 fallback)", () => {
  it("creates or reuses the order and returns its approval link", async () => {
    const response = await pay();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(order);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(ensurePaymentOrder).toHaveBeenCalledWith(capabilityRouteState.admin, testBooking.id);
  });

  it("404s an unknown capability without touching PayPal", async () => {
    expect((await pay("x.y")).status).toBe(404);
    expect(ensurePaymentOrder).not.toHaveBeenCalled();
  });

  it.each([
    ["hold_expired", 409],
    ["invalid_state", 409],
    ["payment_in_progress", 409],
    ["payment_unavailable", 503],
  ] as const)("maps %s to %i", async (code, status) => {
    vi.mocked(ensurePaymentOrder).mockRejectedValue(new BookingError(code));
    const response = await pay();
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
  });

  it("answers 500 on an unexpected failure", async () => {
    vi.mocked(ensurePaymentOrder).mockRejectedValue(new Error("db down"));
    expect((await pay()).status).toBe(500);
  });

  it("429s over the per-IP limit", async () => {
    capabilityRouteState.allowed = false;
    expect((await pay()).status).toBe(429);
    expect(ensurePaymentOrder).not.toHaveBeenCalled();
  });
});
