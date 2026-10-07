// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAPABILITY, capabilityRouteState, routeRequest, testBooking } from "@/test/booking-capability-route";
import type { CaptureOutcome } from "@/types/booking-page";

vi.mock("@/lib/booking/links", async () => (await import("@/test/booking-capability-route")).linksMock());
vi.mock("@/lib/rate-limit", async () => (await import("@/test/booking-capability-route")).rateLimitMock());
vi.mock("@/lib/supabase-admin", async () => (await import("@/test/booking-capability-route")).adminMock());
vi.mock("@/lib/booking/capture", () => ({ captureApprovedOrder: vi.fn() }));

const { POST } = await import("./route");
const { captureApprovedOrder } = await import("@/lib/booking/capture");

const ORDER_ID = "5O190127TN364715T";

const capture = (body: unknown = { capability: CAPABILITY, orderId: ORDER_ID }) =>
  POST(routeRequest("/api/booking/payments/capture", { method: "POST", body }));

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(capabilityRouteState, { booking: testBooking, allowed: true });
  vi.mocked(captureApprovedOrder).mockResolvedValue("confirmed");
});

describe("POST /api/booking/payments/capture (the return page)", () => {
  it.each([
    ["confirmed", 200],
    ["pending", 202],
    ["awaiting_approval", 202],
    ["slot_gone", 409],
    ["mismatch", 409],
    ["compensating", 409],
    ["failed", 409],
  ] as [CaptureOutcome, number][])("maps the %s outcome to %i", async (outcome, status) => {
    vi.mocked(captureApprovedOrder).mockResolvedValue(outcome);

    const response = await capture();

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ outcome });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    // The capture path checks PayPal's order id against the booking's payment (mismatch otherwise).
    expect(captureApprovedOrder).toHaveBeenCalledWith(capabilityRouteState.admin, testBooking.id, "return", ORDER_ID);
  });

  it("404s a bad capability", async () => {
    expect((await capture({ capability: "x.y", orderId: ORDER_ID })).status).toBe(404);
    expect(captureApprovedOrder).not.toHaveBeenCalled();
  });

  it.each([{}, { capability: CAPABILITY }, { capability: CAPABILITY, orderId: "" }, { capability: CAPABILITY, orderId: "x".repeat(65) }])(
    "400s a malformed body %j",
    async (body) => {
      expect((await capture(body)).status).toBe(400);
    }
  );

  it("answers 500 when the capture path throws (the return page retries; reconciliation resolves)", async () => {
    vi.mocked(captureApprovedOrder).mockRejectedValue(new Error("PayPal down"));
    expect((await capture()).status).toBe(500);
  });
});
