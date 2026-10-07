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
vi.mock("@/lib/booking/cancel", () => ({ cancellationPreview: vi.fn() }));

const { GET } = await import("./route");
const { cancellationPreview } = await import("@/lib/booking/cancel");

const terms = {
  refundCents: 3000,
  depositCents: 3000,
  currency: "EUR",
  cancellationWindowHours: 24,
  slotStart: "2026-11-21T09:00:00.000Z",
  termsValidUntil: "2026-11-20T09:00:00.000Z",
};
const preview = (capability = CAPABILITY) =>
  GET(routeRequest(`/api/booking/bookings/${capability}/cancellation-preview`), capabilityParams(capability));

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(capabilityRouteState, { booking: { ...testBooking, status: "confirmed" }, allowed: true });
  vi.mocked(cancellationPreview).mockResolvedValue(terms);
});

describe("GET /api/booking/bookings/[capability]/cancellation-preview (read-only)", () => {
  it("returns the terms with the capability headers", async () => {
    const response = await preview();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(terms);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("409s a booking that is not confirmed", async () => {
    vi.mocked(cancellationPreview).mockRejectedValue(new BookingError("invalid_state"));
    const response = await preview();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "invalid_state" });
  });

  it("404s an unknown capability", async () => {
    expect((await preview("x.y")).status).toBe(404);
    expect(cancellationPreview).not.toHaveBeenCalled();
  });
});
