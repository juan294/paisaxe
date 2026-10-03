// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPaypalMock, type PaypalMock } from "@/test/paypal-mock-server";
import { resetPaypalClientForTests } from "./client";
import { captureOrder, createOrder, getOrder } from "./orders";
import { PaypalError, type CreateOrderInput } from "./types";

const BOOKING_ID = "11111111-2222-4333-8444-555555555555";
const OPERATION_KEY = "6f1c2d3e-4b5a-4c6d-8e7f-001122334455";
const SITE = "https://paisaxe.es";

const input: CreateOrderInput = {
  bookingId: BOOKING_ID,
  amountCents: 3000,
  currency: "EUR",
  description: "Paseo por la senda costera (demo)",
  returnUrl: `${SITE}/booking/cap-token/return`,
  cancelUrl: `${SITE}/booking/cap-token?cancelled=1`,
  operationKey: OPERATION_KEY,
};

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

async function caught(promise: Promise<unknown>): Promise<PaypalError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(PaypalError);
    return error as PaypalError;
  }
  throw new Error("expected a rejection");
}

/** Creates an order and approves it as the sandbox buyer would. */
async function approvedOrder(): Promise<string> {
  const { orderId } = await createOrder(input);
  mock.approve(orderId);
  return orderId;
}

describe("createOrder", () => {
  it("sends the order body in PayPal's wire format with the idempotency and prefer headers", async () => {
    await createOrder(input);

    const [request] = mock.requestsTo("POST", "/v2/checkout/orders");
    expect(request.headers["paypal-request-id"]).toBe(OPERATION_KEY);
    expect(request.headers.prefer).toBe("return=representation");
    expect(request.headers["content-type"]).toBe("application/json");
    expect(request.body).toEqual({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: "EUR", value: "30.00" },
          custom_id: BOOKING_ID,
          description: "Paseo por la senda costera (demo)",
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            return_url: `${SITE}/booking/cap-token/return`,
            cancel_url: `${SITE}/booking/cap-token?cancelled=1`,
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
          },
        },
      },
    });
  });

  it("returns the order id and the payer-action link", async () => {
    const created = await createOrder(input);

    expect(created.orderId).toMatch(/^ORDER/);
    expect(created.approveUrl).toBe(`https://www.sandbox.paypal.com/checkoutnow?token=${created.orderId}`);
    expect(mock.orders.get(created.orderId)?.status).toBe("PAYER_ACTION_REQUIRED");
  });

  it("returns the same order when retried with the same operation key", async () => {
    const first = await createOrder(input);
    const retry = await createOrder(input);

    expect(retry).toEqual(first);
    expect(mock.orders.size).toBe(1);
  });

  it("accepts an approve link when PayPal sends no payer-action link", async () => {
    mock.injectNext({
      method: "POST",
      path: "/v2/checkout/orders",
      status: 201,
      body: { id: "ORDER-A", status: "CREATED", links: [{ rel: "approve", href: "https://paypal.test/approve" }] },
    });

    expect(await createOrder(input)).toEqual({ orderId: "ORDER-A", approveUrl: "https://paypal.test/approve" });
  });

  it("fails when the response has no order id", async () => {
    mock.injectNext({
      method: "POST",
      path: "/v2/checkout/orders",
      status: 201,
      body: { status: "CREATED", links: [{ rel: "payer-action", href: "https://paypal.test/a" }] },
    });

    const error = await caught(createOrder(input));
    expect(error.status).toBe(201);
    expect(error.message).toMatch(/order id/);
  });

  it("fails when the response has no approval link", async () => {
    mock.injectNext({
      method: "POST",
      path: "/v2/checkout/orders",
      status: 201,
      body: { id: "ORDER-A", status: "CREATED", links: [{ rel: "self", href: "https://paypal.test/self" }] },
    });

    const error = await caught(createOrder(input));
    expect(error.message).toMatch(/approval link/);
  });

  it("maps a PayPal rejection to PaypalError", async () => {
    mock.injectNext({
      method: "POST",
      path: "/v2/checkout/orders",
      status: 400,
      body: { name: "INVALID_REQUEST", message: "bad", debug_id: "dbg-400", details: [{ issue: "INVALID_PARAMETER_VALUE" }] },
    });

    const error = await caught(createOrder(input));
    expect(error).toMatchObject({ status: 400, issue: "INVALID_PARAMETER_VALUE", debugId: "dbg-400" });
  });

  it("rejects a non-positive or fractional amount before calling PayPal", async () => {
    await expect(createOrder({ ...input, amountCents: 0 })).rejects.toThrow(RangeError);
    await expect(createOrder({ ...input, amountCents: 30.5 })).rejects.toThrow(RangeError);
    expect(mock.requestsTo("POST", "/v2/checkout/orders")).toHaveLength(0);
  });
});

describe("getOrder", () => {
  it("normalizes an order awaiting the buyer", async () => {
    const { orderId, approveUrl } = await createOrder(input);

    expect(await getOrder(orderId)).toEqual({
      id: orderId,
      status: "PAYER_ACTION_REQUIRED",
      amountCents: 3000,
      currency: "EUR",
      customId: BOOKING_ID,
      capture: null,
      approveUrl,
    });
  });

  it("normalizes a completed order with its capture", async () => {
    const orderId = await approvedOrder();
    const capture = mock.complete(orderId);

    expect(await getOrder(orderId)).toEqual({
      id: orderId,
      status: "COMPLETED",
      amountCents: 3000,
      currency: "EUR",
      customId: BOOKING_ID,
      capture: { id: capture.id, status: "COMPLETED", amountCents: 3000, currency: "EUR", customId: BOOKING_ID, orderId },
      approveUrl: null,
    });
  });

  it("fails on an unknown order with PayPal's 404", async () => {
    const error = await caught(getOrder("NOPE"));
    expect(error).toMatchObject({ status: 404, issue: "INVALID_RESOURCE_ID" });
  });

  it("fails when the order has no status", async () => {
    mock.injectNext({ method: "GET", path: "/v2/checkout/orders/ORDER-A", status: 200, body: { id: "ORDER-A" } });
    const error = await caught(getOrder("ORDER-A"));
    expect(error.message).toMatch(/status/);
  });
});

describe("captureOrder", () => {
  it("captures an approved order with a capture-scoped request id and returns the normalized capture", async () => {
    const orderId = await approvedOrder();

    const order = await captureOrder(orderId, OPERATION_KEY);

    const [request] = mock.requestsTo("POST", `/v2/checkout/orders/${orderId}/capture`);
    expect(request.headers["paypal-request-id"]).toBe(`capture:${OPERATION_KEY}`);
    expect(request.headers.prefer).toBe("return=representation");
    expect(request.body).toEqual({});
    expect(order.status).toBe("COMPLETED");
    expect(order.capture).toEqual({
      id: mock.orders.get(orderId)?.captureId,
      status: "COMPLETED",
      amountCents: 3000,
      currency: "EUR",
      customId: BOOKING_ID,
      orderId,
    });
  });

  it("returns the same capture when retried with the same operation key", async () => {
    const orderId = await approvedOrder();

    const first = await captureOrder(orderId, OPERATION_KEY);
    const retry = await captureOrder(orderId, OPERATION_KEY);

    expect(retry.capture?.id).toBe(first.capture?.id);
    expect(mock.captures.size).toBe(1);
  });

  it("reads the existing capture when PayPal says ORDER_ALREADY_CAPTURED", async () => {
    const orderId = await approvedOrder();
    const lost = mock.complete(orderId);

    const order = await captureOrder(orderId, OPERATION_KEY);

    expect(order.status).toBe("COMPLETED");
    expect(order.capture?.id).toBe(lost.id);
    expect(mock.captures.size).toBe(1);
    expect(mock.requestsTo("GET", `/v2/checkout/orders/${orderId}`)).toHaveLength(1);
  });

  it("returns the existing capture when a re-capture answers 201 (Phase 0 finding 6)", async () => {
    const orderId = await approvedOrder();
    const first = await captureOrder(orderId, OPERATION_KEY);
    mock.setRecaptureMode("201");

    const again = await captureOrder(orderId, "another-operation-key");

    expect(again.capture?.id).toBe(first.capture?.id);
    expect(mock.captures.size).toBe(1);
  });

  it("throws ORDER_NOT_APPROVED for an order the buyer has not approved", async () => {
    const { orderId } = await createOrder(input);

    const error = await caught(captureOrder(orderId, OPERATION_KEY));

    expect(error).toMatchObject({ status: 422, issue: "ORDER_NOT_APPROVED" });
    expect(error.debugId).toMatch(/^mockdebug/);
  });

  it("reports a declined capture as a normal response with the DECLINED status", async () => {
    const orderId = await approvedOrder();
    mock.setCaptureFailure("declined");

    const order = await captureOrder(orderId, OPERATION_KEY);

    expect(order.capture?.status).toBe("DECLINED");
  });

  it("reports a timeout as a PaypalError with a null status", async () => {
    resetPaypalClientForTests({ timeoutMs: 300 });
    const orderId = await approvedOrder();
    mock.setCaptureFailure("timeout");

    const error = await caught(captureOrder(orderId, OPERATION_KEY));

    expect(error.status).toBeNull();
    expect(error.message).toMatch(/timed out/);
    expect(mock.captures.size).toBe(0);
  });

  it("fails when a successful capture response carries no capture", async () => {
    const orderId = await approvedOrder();
    mock.injectNext({
      method: "POST",
      path: `/v2/checkout/orders/${orderId}/capture`,
      status: 201,
      body: { id: orderId, status: "COMPLETED", purchase_units: [{ amount: { currency_code: "EUR", value: "30.00" } }] },
    });

    const error = await caught(captureOrder(orderId, OPERATION_KEY));
    expect(error.status).toBe(201);
    expect(error.message).toMatch(/capture/);
  });
});
