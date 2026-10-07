// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CAPABILITY,
  capabilityParams,
  capabilityRouteState,
  routeRequest,
  testBooking,
} from "@/test/booking-capability-route";
import type { BookingView } from "@/types/booking-page";

vi.mock("@/lib/booking/links", async () => (await import("@/test/booking-capability-route")).linksMock());
vi.mock("@/lib/rate-limit", async () => (await import("@/test/booking-capability-route")).rateLimitMock());
vi.mock("@/lib/supabase-admin", async () => (await import("@/test/booking-capability-route")).adminMock());
vi.mock("@/lib/booking/view", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/booking/view")>()),
  loadBookingView: vi.fn(),
}));

const { GET } = await import("./route");
const { loadBookingView } = await import("@/lib/booking/view");

const view = { reference: "RS-ABC123", status: "pending_payment", payment: null } as BookingView;

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  Object.assign(capabilityRouteState, { booking: testBooking, allowed: true });
  vi.mocked(loadBookingView).mockResolvedValue(view);
});

describe("GET /api/booking/bookings/[capability]", () => {
  it("returns the booking view with the capability headers", async () => {
    const response = await GET(routeRequest(`/api/booking/bookings/${CAPABILITY}`), capabilityParams());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(view);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(loadBookingView).toHaveBeenCalledWith(capabilityRouteState.admin, testBooking);
  });

  it("404s an unknown capability", async () => {
    const response = await GET(routeRequest("/api/booking/bookings/x.y"), capabilityParams("x.y"));
    expect(response.status).toBe(404);
    expect(loadBookingView).not.toHaveBeenCalled();
  });

  it("404s every capability on a Preview deployment", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const response = await GET(routeRequest(`/api/booking/bookings/${CAPABILITY}`), capabilityParams());
    expect(response.status).toBe(404);
  });

  it("429s over the per-IP limit before checking the capability", async () => {
    capabilityRouteState.allowed = false;
    const response = await GET(routeRequest(`/api/booking/bookings/${CAPABILITY}`), capabilityParams());
    expect(response.status).toBe(429);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(loadBookingView).not.toHaveBeenCalled();
  });
});
