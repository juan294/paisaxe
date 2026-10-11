import { requiredValue } from "@/test/required-value";
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

async function createOrder(intent = "CAPTURE"): Promise<string> {
  const { body } = await call("POST", "/v2/checkout/orders", {
    intent,
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
  it.each([
    { operation: "get capture", method: "GET", path: "/v2/payments/captures/missing" },
    { operation: "capture order", method: "POST", path: "/v2/checkout/orders/missing/capture" },
    { operation: "refund capture", method: "POST", path: "/v2/payments/captures/missing/refund" },
    { operation: "authorize order", method: "POST", path: "/v2/checkout/orders/missing/authorize" },
  ])("returns 404 for missing $operation and succeeds with a real order afterward", async ({ operation, method, path }) => {
    const rejected = await call(method, path, method === "POST" ? {} : undefined);
    expect(rejected.status).toBe(404);
    expect(rejected.body).toMatchObject({
      name: "RESOURCE_NOT_FOUND", details: [{ issue: "INVALID_RESOURCE_ID" }],
    });
    expect(mock.orders.size).toBe(0);
    expect(mock.captures.size).toBe(0);
    expect(mock.refunds.size).toBe(0);
    expect(mock.authorizations.size).toBe(0);

    const orderId = await createOrder(operation === "authorize order" ? "AUTHORIZE" : "CAPTURE");
    mock.approve(orderId);
    if (operation === "get capture" || operation === "refund capture") {
      const capture = mock.complete(orderId);
      if (operation === "get capture") {
        const recovered = await call("GET", `/v2/payments/captures/${capture.id}`);
        expect(recovered.status).toBe(200);
        expect(recovered.body).toMatchObject({ id: capture.id, status: "COMPLETED" });
      } else {
        const recovered = await call("POST", `/v2/payments/captures/${capture.id}/refund`, {});
        expect(recovered.status).toBe(201);
        expect(recovered.body).toMatchObject({ status: "COMPLETED", amount: { currency_code: "EUR", value: "30.00" } });
        expect([...mock.refunds.values()]).toMatchObject([{ captureId: capture.id, status: "COMPLETED" }]);
      }
    } else {
      const action = operation === "authorize order" ? "authorize" : "capture";
      const recovered = await call("POST", `/v2/checkout/orders/${orderId}/${action}`, {});
      expect(recovered.status).toBe(201);
      expect(recovered.body).toMatchObject({ id: orderId, status: "COMPLETED" });
      expect(operation === "authorize order" ? mock.authorizations.size : mock.captures.size).toBe(1);
    }
    expect(mock.orders.size).toBe(1);
  });

  it.each([
    "malformed recipients", "nonarray items", "empty items", "bad amount", "nonstring amount",
  ])("rejects invoice %s without recording it and accepts a corrected whole-euro value", async (malformation) => {
    const valid = {
      detail: { currency_code: "EUR" },
      primary_recipients: [{ billing_info: { email_address: "fixture@example.test" } }],
      items: [{ name: "Local fixture", quantity: "1", unit_amount: { currency_code: "EUR", value: "30" } }],
    };
    const invalid = malformation === "malformed recipients"
      ? { ...valid, primary_recipients: { billing_info: { email_address: "fixture@example.test" } } }
      : malformation === "nonarray items"
        ? { ...valid, items: { name: "Local fixture" } }
        : malformation === "empty items"
          ? { ...valid, items: [] }
          : { ...valid, items: [{ name: "Local fixture", quantity: "1", unit_amount: {
            currency_code: "EUR", value: malformation === "bad amount" ? "not-money" : 30,
          } }] };
    const rejected = await call("POST", "/v2/invoicing/invoices", invalid);
    expect(rejected.status).toBe(400);
    expect(rejected.body).toMatchObject({
      name: "INVALID_REQUEST", details: [{ issue: "MISSING_REQUIRED_PARAMETER" }],
    });
    expect(mock.invoices.size).toBe(0);

    const recovered = await call("POST", "/v2/invoicing/invoices", valid);
    expect(recovered.status).toBe(201);
    expect(recovered.body).toMatchObject({ rel: "self", method: "GET" });
    expect(mock.invoices.size).toBe(1);
    expect([...mock.invoices.values()]).toMatchObject([{
      status: "DRAFT", currency: "EUR", amountCents: 3000, paidCents: 0, recipientEmail: "fixture@example.test",
    }]);
  });

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

describe("Transaction Search", () => {
  async function capture(): Promise<string> {
    const orderId = await createOrder();
    mock.approve(orderId);
    const { body } = await call("POST", `/v2/checkout/orders/${orderId}/capture`, {}, `capture-${orderId}`);
    const units = body.purchase_units as Array<{ payments: { captures: Array<{ id: string }> } }>;
    const unit = requiredValue(units[0], "captured purchase unit");
    return requiredValue(unit.payments.captures[0], "capture in purchase unit").id;
  }

  const search = (start: Date, end: Date, page = 1, pageSize = 100) =>
    call("GET", `/v1/reporting/transactions?start_date=${start.toISOString()}&end_date=${end.toISOString()}&page_size=${pageSize}&page=${page}`);

  it("pages the movements in the window, oldest first", async () => {
    const first = await capture();
    const second = await capture();
    const end = new Date(Date.now() + 1000);
    const start = new Date(end.getTime() - 3_600_000);

    const page1 = await search(start, end, 1, 1);
    const page2 = await search(start, end, 2, 1);

    expect(page1.body).toMatchObject({ page: 1, total_items: 2, total_pages: 2 });
    expect((page1.body.transaction_details as Array<{ transaction_info: { transaction_id: string } }>).map((d) => d.transaction_info.transaction_id)).toEqual([first]);
    expect((page2.body.transaction_details as Array<{ transaction_info: { transaction_id: string } }>).map((d) => d.transaction_info.transaction_id)).toEqual([second]);
  });

  it("lists nothing outside start_date..end_date and refuses more than 31 days", async () => {
    await capture();
    const past = new Date(Date.now() - 2 * 3_600_000);

    expect((await search(new Date(past.getTime() - 3_600_000), past)).body).toMatchObject({ total_items: 0, transaction_details: [] });
    expect((await search(new Date(Date.now() - 32 * 86_400_000), new Date())).status).toBe(400);
  });

  it("answers 403 NOT_AUTHORIZED when denied", async () => {
    mock.setTransactionSearchDenied(true);

    const { status, body } = await search(new Date(Date.now() - 3_600_000), new Date());

    expect(status).toBe(403);
    expect(body).toMatchObject({ name: "NOT_AUTHORIZED", details: [{ issue: "NOT_AUTHORIZED" }] });
  });
});
