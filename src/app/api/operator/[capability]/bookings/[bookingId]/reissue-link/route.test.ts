// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAPABILITY, capabilityRouteState, routeRequest } from "@/test/booking-capability-route";
import type { OperatorAccess } from "@/lib/booking/links";

const state = vi.hoisted(() => ({ access: null as unknown }));

vi.mock("@/lib/booking/links", async () => {
  const { CAPABILITY: valid } = await import("@/test/booking-capability-route");
  return {
    bookingLink: vi.fn(),
    verifyOperatorCapability: vi.fn(async (_client: unknown, capability: string) => (capability === valid ? state.access : null)),
  };
});
vi.mock("@/lib/rate-limit", async () => (await import("@/test/booking-capability-route")).rateLimitMock());
vi.mock("@/lib/supabase-admin", async () => (await import("@/test/booking-capability-route")).adminMock());
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/booking/operator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/booking/operator")>()),
  reissueBookingLink: vi.fn(),
}));

const { POST } = await import("./route");
const { reissueBookingLink } = await import("@/lib/booking/operator");
const { verifyOperatorCapability } = await import("@/lib/booking/links");
const { logger } = await import("@/lib/logger");

const BOOKING = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const NEW_TOKEN = "ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543210_-zyxwv";
const NEW_LINK = `/booking/${BOOKING}.${NEW_TOKEN}`;
const access: OperatorAccess = {
  id: "11111111-2222-4333-8444-555555555555",
  merchantId: "m1",
  label: "Operador demo",
  linkVersion: 1,
  expiresAt: "2099-01-01T00:00:00Z",
};

const reissue = (capability = CAPABILITY, bookingId = BOOKING) =>
  POST(routeRequest(`/api/operator/${capability}/bookings/${bookingId}/reissue-link`, { method: "POST" }), {
    params: Promise.resolve({ capability, bookingId }),
  });

function logged(): string {
  return JSON.stringify([vi.mocked(logger.info).mock.calls, vi.mocked(logger.error).mock.calls]);
}

beforeEach(() => {
  vi.clearAllMocks();
  state.access = access;
  capabilityRouteState.allowed = true;
});

describe("POST /api/operator/[capability]/bookings/[bookingId]/reissue-link", () => {
  it("returns the new visitor link and logs the booking id only (never either capability)", async () => {
    vi.mocked(reissueBookingLink).mockResolvedValue(NEW_LINK);

    const response = await reissue();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ link: NEW_LINK });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(reissueBookingLink).toHaveBeenCalledWith(capabilityRouteState.admin, "m1", BOOKING);
    expect(logger.info).toHaveBeenCalledWith("[OPERATOR_LINK_REISSUED]", { bookingId: BOOKING });
    expect(logged()).not.toContain(NEW_TOKEN);
    expect(logged()).not.toContain(CAPABILITY.split(".")[1]);
  });

  it("404s another merchant's or an unknown booking", async () => {
    vi.mocked(reissueBookingLink).mockResolvedValue(null);

    const response = await reissue();

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("404s a capability that does not verify without touching the booking", async () => {
    expect((await reissue("x.y")).status).toBe(404);
    expect(reissueBookingLink).not.toHaveBeenCalled();
  });

  it("429s over the per-IP limit before reading the capability", async () => {
    capabilityRouteState.allowed = false;

    expect((await reissue()).status).toBe(429);
    expect(verifyOperatorCapability).not.toHaveBeenCalled();
  });

  it("500s on a database error, logging the booking id only", async () => {
    vi.mocked(reissueBookingLink).mockRejectedValue(new Error("db down"));

    const response = await reissue();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(logger.error).toHaveBeenCalledWith("[OPERATOR_LINK_REISSUE_FAILED]", { bookingId: BOOKING, error: "db down" });
  });
});
