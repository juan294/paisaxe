// @vitest-environment node
/**
 * GET /api/operator/<capability>/paypal-ledger with the real PayPal adapter
 * against the local stand-in (APIMatic plan, Phase 2). The operator view is
 * mocked; the capability, rate limit and admin client use the shared mocks.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAPABILITY, capabilityParams, capabilityRouteState, routeRequest } from "@/test/booking-capability-route";
import { startPaypalMock, type PaypalMock } from "@/test/paypal-mock-server";
import type { OperatorAccess } from "@/lib/booking/links";
import type { OperatorBooking } from "@/lib/booking/operator";
import type { OperatorLedgerResponse } from "@/types/operator-ledger";

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
  loadOperatorBookings: vi.fn(),
}));

const { GET } = await import("./route");
const { loadOperatorBookings } = await import("@/lib/booking/operator");
const { verifyOperatorCapability } = await import("@/lib/booking/links");
const { logger } = await import("@/lib/logger");
const { captureOrder, createOrder } = await import("@/lib/paypal/orders");
const { resetPaypalClientForTests } = await import("@/lib/paypal/client");

const access: OperatorAccess = {
  id: "11111111-2222-4333-8444-555555555555",
  merchantId: "m1",
  label: "Operador demo",
  linkVersion: 1,
  expiresAt: "2099-01-01T00:00:00Z",
};
const BOOKING_ID = "b1111111-2222-4333-8444-555555555555";

let mock: PaypalMock;

function operatorBooking(overrides: Partial<OperatorBooking>): OperatorBooking {
  return {
    id: BOOKING_ID,
    reference: "RS-CONF01",
    experienceTitle: "Paseo",
    slotDate: "2026-11-21",
    slotTime: "10:00",
    partySize: 2,
    status: "confirmed",
    depositCents: 3000,
    balanceCents: 9000,
    currency: "EUR",
    payment: null,
    exception: false,
    ...overrides,
  };
}

/** A deposit captured at the stand-in; returns its capture id. */
async function capturedDeposit(): Promise<string> {
  const { orderId } = await createOrder({
    bookingId: BOOKING_ID,
    amountCents: 3000,
    currency: "EUR",
    description: "Paseo (demo)",
    returnUrl: "https://paisaxe.es/booking/c/return",
    cancelUrl: "https://paisaxe.es/booking/c?cancelled=1",
    operationKey: "00000000-0000-4000-8000-000000000001",
  });
  mock.approve(orderId);
  return (await captureOrder(orderId, "00000000-0000-4000-8000-000000000001")).capture?.id ?? "";
}

const get = (capability = CAPABILITY) =>
  GET(routeRequest(`/api/operator/${capability}/paypal-ledger`), capabilityParams(capability));

beforeEach(async () => {
  vi.clearAllMocks();
  mock = await startPaypalMock();
  vi.stubEnv("PAYPAL_CLIENT_ID", "client-id");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "client-secret");
  vi.stubEnv("PAYPAL_API_BASE", mock.baseUrl);
  resetPaypalClientForTests({ retryInterval: 0.01 });
  state.access = access;
  capabilityRouteState.allowed = true;
  vi.mocked(loadOperatorBookings).mockResolvedValue([]);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  resetPaypalClientForTests();
  await mock.close();
});

describe("GET /api/operator/[capability]/paypal-ledger", () => {
  it("answers each booking's match against PayPal's records, with the capability headers", async () => {
    const captureId = await capturedDeposit();
    vi.mocked(loadOperatorBookings).mockResolvedValue([
        operatorBooking({
          payment: { status: "captured", orderId: "O", captureId, refundId: null, capturedAt: new Date().toISOString() },
        }),
      operatorBooking({ id: "b2", payment: null }),
    ]);

    const response = await get();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    const body = (await response.json()) as Extract<OperatorLedgerResponse, { state: "ok" }>;
    expect(body).toMatchObject({ state: "ok", truncated: false, bookings: { [BOOKING_ID]: "matches", b2: "not_applicable" } });
    expect(Date.parse(body.refreshedAt ?? "")).not.toBeNaN();
    // The window is PayPal's maximum, ending now.
    expect(Date.now() - Date.parse(body.windowStart)).toBeGreaterThan(30.9 * 24 * 3_600_000);
    expect(loadOperatorBookings).toHaveBeenCalledWith(capabilityRouteState.admin, access, expect.any(Date));
    // Read-only: one search, nothing posted.
    expect(mock.requestsTo("GET", "/v1/reporting/transactions")).toHaveLength(1);
  });

  it("passes PayPal's truncation through", async () => {
    mock.injectNext({
      method: "GET",
      path: "/v1/reporting/transactions",
      status: 200,
      body: { transaction_details: [], total_items: 900, total_pages: 2, last_refreshed_datetime: "2026-10-08T09:00:00+0000" },
    });

    const body = (await (await get()).json()) as Extract<OperatorLedgerResponse, { state: "ok" }>;

    expect(body).toMatchObject({ state: "ok", truncated: true, refreshedAt: "2026-10-08T09:00:00.000Z" });
  });

  it("answers error when PayPal keeps failing past its retries", async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      mock.injectNext({ method: "GET", path: "/v1/reporting/transactions", status: 503, body: { name: "SERVICE_UNAVAILABLE", debug_id: "d" } });
    }

    const response = await get();

    expect(await response.json()).toEqual({ state: "unavailable", reason: "error" });
    expect(mock.requestsTo("GET", "/v1/reporting/transactions")).toHaveLength(3);
    expect(logger.error).toHaveBeenCalledWith("[OPERATOR_LEDGER_FAILED]", expect.objectContaining({ reason: "error", status: 503 }));
  });

  it("answers not_authorized when the PayPal app lacks the Transaction Search permission", async () => {
    mock.setTransactionSearchDenied(true);

    const response = await get();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: "unavailable", reason: "not_authorized" });
    expect(logger.warn).toHaveBeenCalledWith(
      "[OPERATOR_LEDGER_FAILED]",
      expect.objectContaining({ reason: "not_authorized", status: 403, issue: "NOT_AUTHORIZED" }),
    );
  });

  it("answers not_configured without PayPal credentials, calling nothing", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "");

    const response = await get();

    expect(await response.json()).toEqual({ state: "unavailable", reason: "not_configured" });
    expect(mock.requests).toHaveLength(0);
  });

  it("answers error when the bookings cannot load, logging without the capability", async () => {
    vi.mocked(loadOperatorBookings).mockRejectedValue(new Error("db down"));

    const response = await get();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ state: "unavailable", reason: "error" });
    expect(logger.error).toHaveBeenCalledWith("[OPERATOR_LEDGER_FAILED]", expect.objectContaining({ reason: "error", error: "db down" }));
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(CAPABILITY.split(".")[1]);
  });

  it("404s a capability that does not verify, with no PayPal call", async () => {
    const response = await get("x.y");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(mock.requests).toHaveLength(0);
  });

  it("404s on a Preview deployment and 429s over the per-IP limit", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await get()).status).toBe(404);
    vi.unstubAllEnvs();
    vi.stubEnv("PAYPAL_API_BASE", mock.baseUrl);

    capabilityRouteState.allowed = false;
    expect((await get()).status).toBe(429);
    expect(verifyOperatorCapability).not.toHaveBeenCalled();
    expect(mock.requests).toHaveLength(0);
  });
});
