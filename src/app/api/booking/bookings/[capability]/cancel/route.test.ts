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
vi.mock("@/lib/booking/cancel", () => ({ confirmCancellation: vi.fn() }));

const { POST } = await import("./route");
const { confirmCancellation } = await import("@/lib/booking/cancel");

const confirmed = { ...testBooking, status: "confirmed" as const };
const cancel = (body: unknown = { expectedRefundCents: 3000 }, capability = CAPABILITY) =>
  POST(routeRequest(`/api/booking/bookings/${capability}/cancel`, { method: "POST", body }), capabilityParams(capability));

const terms = {
  refundCents: 0,
  depositCents: 3000,
  currency: "EUR",
  cancellationWindowHours: 24,
  slotStart: "2026-11-21T09:00:00.000Z",
  termsValidUntil: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(capabilityRouteState, { booking: confirmed, allowed: true });
  vi.mocked(confirmCancellation).mockResolvedValue({ outcome: "cancelled", status: "refund_pending", refundCents: 3000 });
});

describe("POST /api/booking/bookings/[capability]/cancel (the only authorization, F01)", () => {
  it("confirms with the visitor's expected refund and returns the new status", async () => {
    const response = await cancel();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "refund_pending", refundCents: 3000 });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(confirmCancellation).toHaveBeenCalledWith(capabilityRouteState.admin, confirmed, 3000);
  });

  it("a second confirm answers 200 with the current status (idempotent)", async () => {
    vi.mocked(confirmCancellation).mockResolvedValue({ outcome: "unchanged", status: "refunded", refundCents: 3000 });
    const response = await cancel();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "refunded", refundCents: 3000 });
  });

  it("changed terms answer 409 with the fresh terms (R2-05)", async () => {
    vi.mocked(confirmCancellation).mockResolvedValue({ outcome: "terms_changed", terms });
    const response = await cancel();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "terms_changed", terms });
  });

  it("a refund PayPal could not take now answers 502 (the cancellation stands)", async () => {
    vi.mocked(confirmCancellation).mockRejectedValue(new BookingError("refund_unavailable"));
    const response = await cancel();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "refund_unavailable" });
  });

  it("a booking that is not in the cancellation flow answers 409 invalid_state", async () => {
    vi.mocked(confirmCancellation).mockRejectedValue(new BookingError("invalid_state"));
    const response = await cancel();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "invalid_state" });
  });

  it.each([{}, { expectedRefundCents: -1 }, { expectedRefundCents: 1.5 }, { expectedRefundCents: "3000" }])(
    "400s a malformed body %j without touching the booking",
    async (body) => {
      expect((await cancel(body)).status).toBe(400);
      expect(confirmCancellation).not.toHaveBeenCalled();
    }
  );

  it("404s an unknown capability", async () => {
    expect((await cancel(undefined, "x.y")).status).toBe(404);
    expect(confirmCancellation).not.toHaveBeenCalled();
  });

  it("answers 500 on an unexpected failure", async () => {
    vi.mocked(confirmCancellation).mockRejectedValue(new Error("db down"));
    expect((await cancel()).status).toBe(500);
  });
});
