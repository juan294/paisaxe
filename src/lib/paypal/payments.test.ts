// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPaypalMock, type PaypalMock } from "@/test/paypal-mock-server";
import { resetPaypalClientForTests } from "./client";
import { captureOrder, createOrder } from "./orders";
import { getCapture, getRefund, refundCapture } from "./payments";
import { PaypalError } from "./types";

const BOOKING_ID = "11111111-2222-4333-8444-555555555555";
const OPERATION_KEY = "00000000-0000-4000-8000-000000000001";

let mock: PaypalMock;

beforeEach(async () => {
  mock = await startPaypalMock();
  vi.stubEnv("PAYPAL_CLIENT_ID", "client-id");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "client-secret");
  vi.stubEnv("PAYPAL_API_BASE", mock.baseUrl);
  resetPaypalClientForTests();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  resetPaypalClientForTests();
  await mock.close();
});

/** A captured 30.00 EUR order; returns the order and capture ids. */
async function capturedOrder(): Promise<{ orderId: string; captureId: string }> {
  const { orderId } = await createOrder({
    bookingId: BOOKING_ID,
    amountCents: 3000,
    currency: "EUR",
    description: "Paseo (demo)",
    returnUrl: "https://paisaxe.es/booking/c/return",
    cancelUrl: "https://paisaxe.es/booking/c?cancelled=1",
    operationKey: OPERATION_KEY,
  });
  mock.approve(orderId);
  const order = await captureOrder(orderId, OPERATION_KEY);
  return { orderId, captureId: order.capture?.id ?? "" };
}

describe("getCapture", () => {
  it("normalizes the capture with its related order id", async () => {
    const { orderId, captureId } = await capturedOrder();

    expect(await getCapture(captureId)).toEqual({
      id: captureId,
      status: "COMPLETED",
      amountCents: 3000,
      currency: "EUR",
      customId: BOOKING_ID,
      orderId,
    });
  });

  it("fails on an unknown capture with PayPal's 404", async () => {
    await expect(getCapture("NOPE")).rejects.toMatchObject({ status: 404, issue: "INVALID_RESOURCE_ID" });
  });

  it("reports a 500 with a body as a PaypalError carrying the recorded status", async () => {
    mock.injectNext({ method: "GET", path: "/v2/payments/captures/CAP-1", status: 500, body: { oops: true } });

    const error = await getCapture("CAP-1").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PaypalError);
    expect((error as PaypalError).status).toBe(500);
  });
});

describe("refundCapture", () => {
  it("refunds with a refund-scoped request id and the amount in PayPal's wire format", async () => {
    const { captureId } = await capturedOrder();

    const refund = await refundCapture(captureId, 3000, OPERATION_KEY);

    const [request] = mock.requestsTo("POST", `/v2/payments/captures/${captureId}/refund`);
    expect(request.headers["paypal-request-id"]).toBe(`refund:${OPERATION_KEY}`);
    expect(request.headers.prefer).toBe("return=representation");
    expect(request.body).toEqual({ amount: { currency_code: "EUR", value: "30.00" } });
    expect(refund).toEqual({ id: expect.stringMatching(/^REF/), status: "COMPLETED" });
  });

  it("returns the same refund when retried with the same operation key", async () => {
    const { captureId } = await capturedOrder();

    const first = await refundCapture(captureId, 3000, OPERATION_KEY);
    const retry = await refundCapture(captureId, 3000, OPERATION_KEY);

    expect(retry).toEqual(first);
    expect(mock.refunds.size).toBe(1);
  });

  it("maps a PayPal rejection to PaypalError with its issue", async () => {
    const { captureId } = await capturedOrder();
    await refundCapture(captureId, 3000, OPERATION_KEY);

    await expect(refundCapture(captureId, 3000, "another-key")).rejects.toMatchObject({
      status: 422,
      issue: "CAPTURE_FULLY_REFUNDED",
    });
  });

  it("rejects an invalid amount before calling PayPal", async () => {
    await expect(refundCapture("CAP-1", -5, OPERATION_KEY)).rejects.toThrow(RangeError);
    expect(mock.requestsTo("POST", /refund$/)).toHaveLength(0);
  });
});

describe("getRefund", () => {
  it("reads the refund's current status", async () => {
    const { captureId } = await capturedOrder();
    mock.setRefundStatus("PENDING");
    const refund = await refundCapture(captureId, 3000, OPERATION_KEY);
    expect(refund.status).toBe("PENDING");

    mock.setRefundStatus("COMPLETED");

    expect(await getRefund(refund.id)).toEqual({ id: refund.id, status: "COMPLETED" });
  });

  it("fails on an unknown refund with PayPal's 404", async () => {
    await expect(getRefund("NOPE")).rejects.toMatchObject({ status: 404 });
  });
});
