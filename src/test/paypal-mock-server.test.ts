// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startPaypalMock, type PaypalMock } from "./paypal-mock-server";

let mock: PaypalMock;
let auth: string;

async function call(method: string, path: string, body?: unknown, requestId?: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${mock.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function createOrder(): Promise<string> {
  const { body } = await call("POST", "/v2/checkout/orders", {
    intent: "CAPTURE",
    purchase_units: [{ amount: { currency_code: "EUR", value: "30.00" }, custom_id: "booking-1" }],
    payment_source: { paypal: { experience_context: { return_url: "https://x/return" } } },
  });
  return body.id as string;
}

beforeEach(async () => {
  mock = await startPaypalMock();
  const response = await fetch(`${mock.baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from("id:secret").toString("base64")}` },
    body: "grant_type=client_credentials",
  });
  auth = `Bearer ${((await response.json()) as { access_token: string }).access_token}`;
});

afterEach(async () => {
  await mock.close();
});

describe("paypal mock server", () => {
  it("rejects API calls without a token it issued", async () => {
    auth = "Bearer forged";
    const { status, body } = await call("GET", "/v2/checkout/orders/X");
    expect(status).toBe(401);
    expect(body).toMatchObject({ name: "AUTHENTICATION_FAILURE", debug_id: expect.any(String) });
  });

  it("replays the first response for a repeated PayPal-Request-Id", async () => {
    const first = await call("POST", "/v2/checkout/orders", { purchase_units: [{ amount: { currency_code: "EUR", value: "1.00" } }] }, "k1");
    const second = await call("POST", "/v2/checkout/orders", { purchase_units: [{ amount: { currency_code: "EUR", value: "9.00" } }] }, "k1");
    expect(second).toEqual(first);
    expect(mock.orders.size).toBe(1);
  });

  it("complete() captures an approved order without a capture request, and the capture links back to it", async () => {
    const orderId = await createOrder();
    expect(() => mock.complete(orderId)).toThrow(/cannot complete/);
    mock.approve(orderId);

    const capture = mock.complete(orderId);

    expect(mock.requestsTo("POST", /\/capture$/)).toHaveLength(0);
    const { body } = await call("GET", `/v2/payments/captures/${capture.id}`);
    expect(body).toMatchObject({ id: capture.id, status: "COMPLETED", supplementary_data: { related_ids: { order_id: orderId } } });
  });

  it("holds a capture open in timeout mode until the mock closes, without capturing", async () => {
    const orderId = await createOrder();
    mock.approve(orderId);
    mock.setCaptureFailure("timeout");

    const pending = fetch(`${mock.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: "{}",
    });
    await expect.poll(() => mock.requestsTo("POST", /\/capture$/).length).toBe(1);
    expect(mock.orders.get(orderId)?.status).toBe("APPROVED");

    await mock.close();
    await expect(pending).rejects.toThrow();
    mock = await startPaypalMock();
  });

  it("setRefundStatus changes existing refunds", async () => {
    const orderId = await createOrder();
    mock.approve(orderId);
    const capture = mock.complete(orderId);
    mock.setRefundStatus("PENDING");
    const { body: refund } = await call("POST", `/v2/payments/captures/${capture.id}/refund`, {}, "r1");
    expect(refund.status).toBe("PENDING");

    mock.setRefundStatus("FAILED");

    expect((await call("GET", `/v2/payments/refunds/${refund.id as string}`)).body.status).toBe("FAILED");
  });
});
