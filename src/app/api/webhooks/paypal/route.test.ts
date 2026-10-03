// @vitest-environment node
/**
 * POST /api/webhooks/paypal before the inbox: signature verification against
 * the PayPal mock server (src/test/paypal-mock-server.ts) through the real
 * adapter. Nothing here may reach the database. The inbox and processing
 * paths run against the live local stack in
 * src/lib/booking/reconcile.postgrest-integration.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { startPaypalMock, type PaypalMock } from "@/test/paypal-mock-server";
import { resetPaypalClientForTests } from "@/lib/paypal/client";

const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger }));

const admin = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => admin);

import { POST } from "./route";

const VERIFY_PATH = "/v1/notifications/verify-webhook-signature";
const SIGNATURE = "c2lnbmF0dXJlLXRoYXQtbXVzdC1uZXZlci1iZS1sb2dnZWQ=";
const RAW_BODY = JSON.stringify({
  id: "WH-ROUTE-1",
  event_type: "CHECKOUT.ORDER.APPROVED",
  resource: { id: "ORDER-SECRET-BODY", purchase_units: [{ custom_id: "b0050000-0000-4000-8000-0000000000c1" }] },
});

const SIGNED_HEADERS = {
  "content-type": "application/json",
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1",
  "paypal-transmission-id": "tx-1",
  "paypal-transmission-sig": SIGNATURE,
  "paypal-transmission-time": "2026-10-03T14:07:02Z",
};

function request(headers: Record<string, string> = SIGNED_HEADERS, body = RAW_BODY): NextRequest {
  return new NextRequest("http://localhost/api/webhooks/paypal", { method: "POST", headers, body });
}

/** Everything the route logged, as one string. */
function logged(): string {
  return JSON.stringify([logger.error.mock.calls, logger.warn.mock.calls, logger.info.mock.calls, logger.debug.mock.calls]);
}

let mock: PaypalMock;

beforeEach(async () => {
  vi.clearAllMocks();
  mock = await startPaypalMock();
  vi.stubEnv("PAYPAL_CLIENT_ID", "client-id");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "client-secret");
  vi.stubEnv("PAYPAL_API_BASE", mock.baseUrl);
  vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-ID-1");
  resetPaypalClientForTests();
  admin.createAdminClient.mockImplementation(() => {
    throw new Error("the database must not be reached");
  });
});

afterEach(async () => {
  vi.unstubAllEnvs();
  resetPaypalClientForTests();
  await mock.close();
});

describe("POST /api/webhooks/paypal before the inbox", () => {
  it("answers 401 to a request with no transmission headers without asking PayPal", async () => {
    const response = await POST(request({ "content-type": "application/json" }));

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBeTruthy();
    expect(mock.requestsTo("POST", VERIFY_PATH)).toHaveLength(0);
    expect(admin.createAdminClient).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith("[PAYPAL_WEBHOOK_INVALID]", expect.anything());
  });

  it("answers 401 when PayPal reports FAILURE, and never logs the signature or the body", async () => {
    mock.setVerification("FAILURE");

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(mock.requestsTo("POST", VERIFY_PATH)).toHaveLength(1);
    expect(admin.createAdminClient).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith("[PAYPAL_WEBHOOK_INVALID]", expect.anything());
    expect(logged()).not.toContain(SIGNATURE);
    expect(logged()).not.toContain("ORDER-SECRET-BODY");
  });

  it("answers 500 when PayPal cannot verify, so PayPal redelivers", async () => {
    mock.injectNext({ method: "POST", path: VERIFY_PATH, status: 503, body: { name: "SERVICE_UNAVAILABLE", debug_id: "dbg-1" } });

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(admin.createAdminClient).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_WEBHOOK_VERIFY_FAILED]", expect.anything());
    expect(logged()).not.toContain(SIGNATURE);
  });

  it("answers 500 when the webhook id is not configured", async () => {
    vi.stubEnv("PAYPAL_WEBHOOK_ID", "");

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(admin.createAdminClient).not.toHaveBeenCalled();
  });
});
