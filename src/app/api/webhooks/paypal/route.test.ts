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

// The real adapter, wrapped so one test can make verification throw a non-Error.
vi.mock("@/lib/paypal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/paypal")>();
  return { ...actual, verifyWebhookSignature: vi.fn(actual.verifyWebhookSignature) };
});

import { POST } from "./route";
import { verifyWebhookSignature } from "@/lib/paypal";
import { createBookingSupabaseFake, type BookingSupabaseFake } from "@/test/booking-supabase-fake";

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

  it("answers 401 to a transmission header that is only whitespace, without asking PayPal", async () => {
    const response = await POST(request({ ...SIGNED_HEADERS, "paypal-transmission-sig": "   " }));

    expect(response.status).toBe(401);
    expect(mock.requestsTo("POST", VERIFY_PATH)).toHaveLength(0);
  });

  it("answers 500 when verification throws something that is not an Error", async () => {
    vi.mocked(verifyWebhookSignature).mockRejectedValueOnce("socket hang up");

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_WEBHOOK_VERIFY_FAILED]", { transmissionId: "tx-1", error: "socket hang up" });
    expect(admin.createAdminClient).not.toHaveBeenCalled();
  });

  it("answers 401 to a body that is not JSON: the adapter never sends it to PayPal", async () => {
    const response = await POST(request(SIGNED_HEADERS, "{not json"));

    expect(response.status).toBe(401);
    expect(mock.requestsTo("POST", VERIFY_PATH)).toHaveLength(0);
    expect(admin.createAdminClient).not.toHaveBeenCalled();
  });

  it.each([
    ["a body that is not JSON (defensive: verified anyway)", "{not json", true],
    ["an event without an id", JSON.stringify({ event_type: "CHECKOUT.ORDER.APPROVED", resource: {} }), false],
  ])("answers 400 to a verified request with %s, before the inbox", async (_label, body, forceVerified) => {
    if (forceVerified) vi.mocked(verifyWebhookSignature).mockResolvedValueOnce("SUCCESS");

    const response = await POST(request(SIGNED_HEADERS, body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid event" });
    expect(admin.createAdminClient).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_WEBHOOK_INVALID]", { reason: "missing_event_id_or_type", transmissionId: "tx-1" });
  });
});

describe("POST /api/webhooks/paypal through the inbox (F03)", () => {
  let fake: BookingSupabaseFake;

  beforeEach(() => {
    fake = createBookingSupabaseFake();
    admin.createAdminClient.mockImplementation(() => fake.client);
  });

  const rpcNames = () => fake.rpc.mock.calls.map(([name]) => name);

  it("records the verified event with its normalized ids, processes it and marks it processed -> 200", async () => {
    const body = JSON.stringify({ id: "WH-ROUTE-2", event_type: "PAYMENT.SALE.COMPLETED", resource: { id: "SALE-1" } });
    fake.onRpc("upsert_paypal_event", { data: "received" });
    fake.onRpc("mark_paypal_event_processed", {});

    const response = await POST(request(SIGNED_HEADERS, body));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "processed" });
    expect(fake.rpc).toHaveBeenCalledWith("upsert_paypal_event", {
      p_event_id: "WH-ROUTE-2",
      p_event_type: "PAYMENT.SALE.COMPLETED",
      p_payload: JSON.parse(body),
      p_order_id: null,
      p_capture_id: null,
      p_refund_id: null,
      p_custom_id: null,
      p_verification: "SUCCESS",
    });
    expect(rpcNames()).toEqual(["upsert_paypal_event", "mark_paypal_event_processed"]);
    expect(logger.info).toHaveBeenCalledWith("[PAYPAL_WEBHOOK_PROCESSED]", expect.objectContaining({ eventId: "WH-ROUTE-2", outcome: "ignored" }));
  });

  it("acknowledges an already processed event with 200 without reprocessing it", async () => {
    fake.onRpc("upsert_paypal_event", { data: "processed" });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "duplicate" });
    expect(rpcNames()).toEqual(["upsert_paypal_event"]);
    expect(fake.client.from).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("[PAYPAL_WEBHOOK_DUPLICATE]", { eventId: "WH-ROUTE-1", eventType: "CHECKOUT.ORDER.APPROVED" });
  });

  it("answers 500 when the event cannot be recorded in the inbox, before processing", async () => {
    fake.onRpc("upsert_paypal_event", { error: { message: "db down" } });

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(rpcNames()).toEqual(["upsert_paypal_event"]);
    expect(fake.client.from).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_WEBHOOK_INBOX_FAILED]", { eventId: "WH-ROUTE-1", error: "db down" });
  });

  it("answers 500 and leaves the event unprocessed, with its error recorded, when processing throws", async () => {
    fake.onRpc("upsert_paypal_event", { data: "received" });
    // ORDER-SECRET-BODY and the booking id resolve to no payment: the event is unmatched.
    const byOrder = fake.onTable("payments", { data: null });
    const byBooking = fake.onTable("payments", { data: null });
    fake.onRpc("mark_paypal_event_failed", {});

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Event processing failed" });
    expect(byOrder.eq).toHaveBeenCalledWith("order_id", "ORDER-SECRET-BODY");
    expect(byBooking.eq).toHaveBeenCalledWith("booking_id", "b0050000-0000-4000-8000-0000000000c1");
    expect(rpcNames()).toEqual(["upsert_paypal_event", "mark_paypal_event_failed"]);
    expect(fake.rpc).toHaveBeenCalledWith("mark_paypal_event_failed", {
      p_event_id: "WH-ROUTE-1",
      p_error: expect.stringContaining("[PAYPAL_WEBHOOK_UNMATCHED]"),
    });
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_WEBHOOK_PROCESSING_FAILED]", expect.objectContaining({ eventId: "WH-ROUTE-1" }));
    expect(logged()).not.toContain(SIGNATURE);
  });

  it("logs a non-Error processing failure by its string form", async () => {
    const client = fake.client as unknown as { from: unknown };
    client.from = () => {
      throw "connection reset";
    };
    fake.onRpc("upsert_paypal_event", { data: "received" });
    fake.onRpc("mark_paypal_event_failed", {});

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_WEBHOOK_PROCESSING_FAILED]", expect.objectContaining({ error: "connection reset" }));
  });
});
