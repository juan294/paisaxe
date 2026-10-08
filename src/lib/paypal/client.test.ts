// @vitest-environment node
import { CheckoutPaymentIntent, OrdersController } from "@paypal/paypal-server-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPaypalMock, type PaypalMock } from "@/test/paypal-mock-server";
import { authorizeOrder, captureAuthorization, voidAuthorization } from "./authorizations";
import {
  callPaypal,
  createPaypalFetch,
  getAccessToken,
  getPaypalClient,
  resetPaypalClientForTests,
} from "./client";
import { captureOrder, createOrder } from "./orders";
import { refundCapture } from "./payments";
import { PaypalError, PaypalNotConfigured, type CreateOrderInput } from "./types";

const TOKEN_PATH = "/v1/oauth2/token";
const SANDBOX_ORIGIN = "https://api-m.sandbox.paypal.com";
const ORDER_INPUT: CreateOrderInput = {
  bookingId: "11111111-2222-4333-8444-555555555555",
  amountCents: 3000,
  currency: "EUR",
  description: "Paseo (demo)",
  returnUrl: "https://paisaxe.es/booking/c/return",
  cancelUrl: "https://paisaxe.es/booking/c?cancelled=1",
  operationKey: "6f1c2d3e-4b5a-4c6d-8e7f-001122334455",
};
const UNAVAILABLE = { name: "SERVICE_UNAVAILABLE", message: "down", debug_id: "dbg-503" };

let mock: PaypalMock;

function useMock(target: PaypalMock): void {
  vi.stubEnv("PAYPAL_API_BASE", target.baseUrl);
}

beforeEach(async () => {
  mock = await startPaypalMock({ clientId: "client-id", clientSecret: "client-secret" });
  vi.stubEnv("PAYPAL_CLIENT_ID", "client-id");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "client-secret");
  vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-TEST");
  useMock(mock);
  resetPaypalClientForTests({ retryInterval: 0.01 });
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  resetPaypalClientForTests();
  await mock.close();
});

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected a rejection");
}

/** getOrder through callPaypal and the SDK, without the adapter's normalization. */
function sdkGetOrder(id: string) {
  return callPaypal("getOrder", ({ orders }) => orders.getOrder({ id }));
}

/** An approved order through the adapter; returns its id. */
async function approvedOrder(input: Partial<CreateOrderInput> = {}): Promise<string> {
  const { orderId } = await createOrder({ ...ORDER_INPUT, ...input });
  mock.approve(orderId);
  return orderId;
}

describe("getAccessToken", () => {
  it("requests a client-credentials token with Basic auth", async () => {
    const token = await getAccessToken();

    expect(token).toMatch(/^A21AA\.mock-token-/);
    const [request] = mock.requestsTo("POST", TOKEN_PATH);
    expect(request.headers.authorization).toBe(`Basic ${Buffer.from("client-id:client-secret").toString("base64")}`);
    expect(request.headers["content-type"]).toBe("application/x-www-form-urlencoded");
    expect(request.rawBody).toBe("grant_type=client_credentials");
  });

  it("shares one in-flight token request between concurrent callers", async () => {
    const tokens = await Promise.all([getAccessToken(), getAccessToken(), getAccessToken()]);

    expect(new Set(tokens).size).toBe(1);
    expect(mock.requestsTo("POST", TOKEN_PATH)).toHaveLength(1);
  });

  it("caches the token until 60 s before it expires, then fetches a new one", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T10:00:00Z"));
    mock.setTokenExpiresIn(3600);

    const first = await getAccessToken();
    vi.setSystemTime(new Date("2026-10-20T10:58:59Z"));
    expect(await getAccessToken()).toBe(first);
    expect(mock.requestsTo("POST", TOKEN_PATH)).toHaveLength(1);

    vi.setSystemTime(new Date("2026-10-20T10:59:01Z"));
    const second = await getAccessToken();
    expect(second).not.toBe(first);
    expect(mock.requestsTo("POST", TOKEN_PATH)).toHaveLength(2);
  });

  it("reports rejected credentials as a PaypalError with the token endpoint's status", async () => {
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "wrong-secret");

    const error = await caught(getAccessToken());

    expect(error).toBeInstanceOf(PaypalError);
    expect((error as PaypalError).status).toBe(401);
    expect((error as PaypalError).issue).toBe("invalid_client");
    expect((error as PaypalError).message).not.toContain("wrong-secret");
  });

  it("throws PaypalNotConfigured without credentials", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "");
    await expect(getAccessToken()).rejects.toBeInstanceOf(PaypalNotConfigured);
    expect(mock.requests).toHaveLength(0);
  });
});

describe("SDK client", () => {
  it("authenticates SDK operations with the shared token cache", async () => {
    const token = await getAccessToken();

    const error = await caught(sdkGetOrder("MISSING"));

    expect((error as PaypalError).status).toBe(404);
    expect(mock.requestsTo("POST", TOKEN_PATH)).toHaveLength(1);
    const [request] = mock.requestsTo("GET", "/v2/checkout/orders/MISSING");
    expect(request.headers.authorization).toBe(`Bearer ${token}`);
  });

  it("reuses one client per configuration and rebuilds it when the configuration changes", async () => {
    const other = await startPaypalMock();
    try {
      const first = getPaypalClient();
      expect(getPaypalClient()).toBe(first);

      useMock(other);
      expect(getPaypalClient()).not.toBe(first);
      await caught(sdkGetOrder("X"));

      expect(other.requestsTo("POST", TOKEN_PATH)).toHaveLength(1);
      expect(other.requestsTo("GET", "/v2/checkout/orders/X")).toHaveLength(1);
      expect(mock.requests).toHaveLength(0);
    } finally {
      await other.close();
    }
  });

  it("drops the cached token when PayPal answers 401, so the next call sends a new one", async () => {
    mock.injectNext({
      method: "GET",
      path: "/v2/checkout/orders/A",
      status: 401,
      body: { name: "AUTHENTICATION_FAILURE", message: "expired", debug_id: "dbg-401", details: [{ issue: "INVALID_TOKEN" }] },
    });

    const error = await caught(sdkGetOrder("A"));
    expect((error as PaypalError).status).toBe(401);

    await caught(sdkGetOrder("B"));
    expect(mock.requestsTo("POST", TOKEN_PATH)).toHaveLength(2);
    const [first] = mock.requestsTo("GET", "/v2/checkout/orders/A");
    const [second] = mock.requestsTo("GET", "/v2/checkout/orders/B");
    expect(second.headers.authorization).not.toBe(first.headers.authorization);
  });

  it("recovers from a failed token request on the next call", async () => {
    mock.injectNext({ method: "POST", path: TOKEN_PATH, status: 500, body: { error: "server_error" } });

    const error = await caught(sdkGetOrder("A"));
    expect(error).toBeInstanceOf(PaypalError);
    expect((error as PaypalError).status).toBe(500);

    const second = await caught(sdkGetOrder("B"));
    expect((second as PaypalError).status).toBe(404);
    expect(mock.requestsTo("GET", "/v2/checkout/orders/B")).toHaveLength(1);
  });
});

describe("SDK token provider", () => {
  it("never rejects: a token failure inside the SDK fails that call and the next one recovers", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T10:00:00Z"));
    mock.setTokenExpiresIn(120);

    const error = await caught(
      callPaypal("getOrder", ({ orders }) => {
        // callPaypal's own token is now past its refresh time and PayPal refuses the next one,
        // so the SDK's provider has to fetch inside the call and fails.
        vi.setSystemTime(new Date("2026-10-20T10:01:01Z"));
        mock.injectNext({ method: "POST", path: TOKEN_PATH, status: 500, body: { error: "server_error" } });
        return orders.getOrder({ id: "A" });
      }),
    );
    expect(error).toBeInstanceOf(PaypalError);
    expect((error as PaypalError).message).toMatch(/could not obtain a token/);
    expect(mock.requestsTo("GET", "/v2/checkout/orders/A")).toHaveLength(0);

    const next = await caught(sdkGetOrder("B"));
    expect((next as PaypalError).status).toBe(404);
    expect(mock.requestsTo("GET", "/v2/checkout/orders/B")).toHaveLength(1);
  });
});

describe("retries", () => {
  it("retries a GET answered 503 and returns the later success", async () => {
    const orderId = await approvedOrder();
    mock.injectNext({ method: "GET", path: `/v2/checkout/orders/${orderId}`, status: 503, body: UNAVAILABLE });

    const { value, status } = await sdkGetOrder(orderId);

    expect(status).toBe(200);
    expect(value.id).toBe(orderId);
    expect(mock.requestsTo("GET", `/v2/checkout/orders/${orderId}`)).toHaveLength(2);
  });

  it("retries a capture answered 503 with the same PayPal-Request-Id and creates one capture", async () => {
    const orderId = await approvedOrder();
    const path = `/v2/checkout/orders/${orderId}/capture`;
    mock.injectNext({ method: "POST", path, status: 503, body: UNAVAILABLE });

    const order = await captureOrder(orderId, ORDER_INPUT.operationKey);

    expect(order.capture?.status).toBe("COMPLETED");
    const attempts = mock.requestsTo("POST", path);
    expect(attempts).toHaveLength(2);
    expect(attempts.map((request) => request.headers["paypal-request-id"])).toEqual([
      `capture:${ORDER_INPUT.operationKey}`,
      `capture:${ORDER_INPUT.operationKey}`,
    ]);
    expect(mock.captures.size).toBe(1);
  });

  it("sends a 422 on POST exactly once (retryOnTimeout stays off)", async () => {
    const orderId = await approvedOrder();
    await captureOrder(orderId, ORDER_INPUT.operationKey);
    const path = `/v2/checkout/orders/${orderId}/capture`;

    const error = await caught(
      callPaypal("captureOrder", ({ orders }) =>
        orders.captureOrder({ id: orderId, paypalRequestId: "capture:another-key", body: {} }),
      ),
    );

    expect(error).toMatchObject({ status: 422, issue: "ORDER_ALREADY_CAPTURED" });
    expect(mock.requestsTo("POST", path).filter((request) => request.headers["paypal-request-id"] === "capture:another-key")).toHaveLength(1);
  });

  it("retries a 500 only where the operation does not declare it (the SDK's declared arms are never retried)", async () => {
    // getOrder declares 401 and 404 only: its 500 goes through the retry by status.
    const orderId = await approvedOrder();
    mock.injectNext({ method: "GET", path: `/v2/checkout/orders/${orderId}`, status: 500, body: UNAVAILABLE });
    expect((await sdkGetOrder(orderId)).status).toBe(200);
    expect(mock.requestsTo("GET", `/v2/checkout/orders/${orderId}`)).toHaveLength(2);

    // captureOrder declares throwOn(500): thrown inside the retry interceptor, sent once, left to reconciliation.
    const path = `/v2/checkout/orders/${orderId}/capture`;
    mock.injectNext({ method: "POST", path, status: 500, body: UNAVAILABLE });
    const error = await caught(captureOrder(orderId, ORDER_INPUT.operationKey));
    expect(error).toMatchObject({ status: 500, debugId: "dbg-503" });
    expect(mock.requestsTo("POST", path)).toHaveLength(1);
    expect(mock.captures.size).toBe(0);
  });

  it.each([400, 401])("never retries a %i", async (status) => {
    mock.injectNext({ method: "GET", path: "/v2/checkout/orders/A", status, body: { name: "X", message: "x", debug_id: "dbg" } });

    const error = await caught(sdkGetOrder("A"));

    expect((error as PaypalError).status).toBe(status);
    expect(mock.requestsTo("GET", "/v2/checkout/orders/A")).toHaveLength(1);
  });

  it("gives up after two retries and reports the last status", async () => {
    for (let i = 0; i < 3; i++) {
      mock.injectNext({ method: "GET", path: "/v2/checkout/orders/A", status: 503, body: UNAVAILABLE });
    }

    const error = await caught(sdkGetOrder("A"));

    expect(error).toBeInstanceOf(PaypalError);
    expect(error).toMatchObject({ status: 503, debugId: "dbg-503" });
    expect(mock.requestsTo("GET", "/v2/checkout/orders/A")).toHaveLength(3);
  });

  it("does not retry a timeout", async () => {
    const orderId = await approvedOrder();
    resetPaypalClientForTests({ timeoutMs: 300, retryInterval: 0.01 });
    mock.setCaptureFailure("timeout");

    const error = await caught(captureOrder(orderId, ORDER_INPUT.operationKey));

    expect(error).toBeInstanceOf(PaypalError);
    expect((error as PaypalError).status).toBeNull();
    expect((error as PaypalError).message).toMatch(/timed out/);
    expect(mock.requestsTo("POST", `/v2/checkout/orders/${orderId}/capture`)).toHaveLength(1);
  });

  it("sends a PayPal-Request-Id on every SDK POST", async () => {
    const captureOrderId = await approvedOrder();
    const capture = await captureOrder(captureOrderId, ORDER_INPUT.operationKey);
    await refundCapture(capture.capture?.id ?? "", 3000, ORDER_INPUT.operationKey);

    const authorizeOrderId = await approvedOrder({ intent: "AUTHORIZE", operationKey: "op-authorize" });
    const authorized = await authorizeOrder(authorizeOrderId, "op-authorize");
    await captureAuthorization(authorized.authorization?.id ?? "", 3000, "op-authorize");
    const voidOrderId = await approvedOrder({ intent: "AUTHORIZE", operationKey: "op-void" });
    const toVoid = await authorizeOrder(voidOrderId, "op-void");
    await voidAuthorization(toVoid.authorization?.id ?? "", "op-void");

    const posts = mock.requests.filter((request) => request.method === "POST" && request.path !== TOKEN_PATH);
    expect(posts.map((request) => request.path.replace(/[A-Z]+\d{6,}/g, ":id"))).toEqual([
      "/v2/checkout/orders",
      "/v2/checkout/orders/:id/capture",
      "/v2/payments/captures/:id/refund",
      "/v2/checkout/orders",
      "/v2/checkout/orders/:id/authorize",
      "/v2/payments/authorizations/:id/capture",
      "/v2/checkout/orders",
      "/v2/checkout/orders/:id/authorize",
      "/v2/payments/authorizations/:id/void",
    ]);
    for (const request of posts) expect(request.headers["paypal-request-id"]).toBeTruthy();
  });
});

describe("callPaypal error translation", () => {
  it("maps a declared error body to status, issue and debug id", async () => {
    mock.injectNext({
      method: "GET",
      path: "/v2/checkout/orders/A",
      status: 422,
      body: { name: "UNPROCESSABLE_ENTITY", message: "nope", debug_id: "dbg-422", details: [{ issue: "SOME_ISSUE" }] },
    });

    const error = (await caught(sdkGetOrder("A"))) as PaypalError;

    expect(error).toBeInstanceOf(PaypalError);
    expect(error).toMatchObject({ status: 422, issue: "SOME_ISSUE", debugId: "dbg-422" });
    expect(error.message).toContain("getOrder");
  });

  it("keeps the status and issue when an error body does not match PayPal's schema", async () => {
    mock.injectNext({
      method: "GET",
      path: "/v2/checkout/orders/A",
      status: 422,
      body: { details: [{ issue: "ORDER_ALREADY_CAPTURED" }] },
      headers: { "paypal-debug-id": "dbg-header" },
    });

    const error = (await caught(sdkGetOrder("A"))) as PaypalError;

    expect(error).toMatchObject({ status: 422, issue: "ORDER_ALREADY_CAPTURED", debugId: "dbg-header" });
  });

  it("reports an unreadable success body with the recorded status", async () => {
    mock.injectNext({ method: "GET", path: "/v2/checkout/orders/A", status: 200, body: "not json" });

    const error = (await caught(sdkGetOrder("A"))) as PaypalError;

    expect(error).toBeInstanceOf(PaypalError);
    expect(error.status).toBe(200);
    expect(error.message).toMatch(/unreadable/);
  });

  it("reports a success body that fails the schema as unreadable, with its status", async () => {
    mock.injectNext({ method: "GET", path: "/v2/checkout/orders/A", status: 200, body: { id: 42 } });

    const error = (await caught(sdkGetOrder("A"))) as PaypalError;

    expect(error).toBeInstanceOf(PaypalError);
    expect(error.status).toBe(200);
    expect(error.message).toMatch(/unreadable/);
  });

  it("reports a connection failure with a null status", async () => {
    await getAccessToken();
    await mock.close();

    const error = (await caught(sdkGetOrder("A"))) as PaypalError;

    expect(error).toBeInstanceOf(PaypalError);
    expect(error.status).toBeNull();
    expect(error.message).toMatch(/connection/);
    mock = await startPaypalMock();
  });

  it("returns the value with the response status and debug id", async () => {
    const created = await callPaypal("createOrder", ({ orders }) =>
      orders.createOrder({
        body: { intent: CheckoutPaymentIntent.Capture, purchaseUnits: [{ amount: { currencyCode: "EUR", value: "30.00" } }] },
      }),
    );

    expect(created.status).toBe(201);
    expect(created.debugId).toMatch(/^mockdebug/);
    expect(created.value.id).toMatch(/^ORDER/);
  });
});

describe("the SDK's fetch", () => {
  it("sends the SDK's requests for its fixed sandbox origin to the configured base", async () => {
    await caught(sdkGetOrder("ROUTED"));

    const [request] = mock.requestsTo("GET", "/v2/checkout/orders/ROUTED");
    expect(request.headers["user-agent"]).toMatch(/PayPal REST API TypeScript SDK, Version: 2\.5\.0/);
  });
});

describe("createPaypalFetch", () => {
  it("refuses a request to any other origin without sending it, the SDK's sandbox origin included", async () => {
    const guarded = createPaypalFetch(mock.baseUrl);

    await expect(guarded(`${SANDBOX_ORIGIN}/v1/oauth2/token`)).rejects.toBeInstanceOf(PaypalNotConfigured);
    await expect(guarded("https://api-m.sandbox.paypal.com.evil.com/v1/oauth2/token")).rejects.toBeInstanceOf(
      PaypalNotConfigured,
    );
    await expect(guarded("https://api-m.paypal.com/v1/oauth2/token")).rejects.toBeInstanceOf(PaypalNotConfigured);
    await expect(guarded(`${mock.baseUrl.replace("127.0.0.1", "localhost")}/v1/oauth2/token`)).rejects.toBeInstanceOf(
      PaypalNotConfigured,
    );
    expect(mock.requests).toHaveLength(0);
  });

  it("refuses an SDK request to another origin as PaypalNotConfigured, unsent", async () => {
    await getAccessToken();
    const before = mock.requests.length;

    const error = await caught(
      callPaypal("getOrder", ({ client }) =>
        new OrdersController(client.withConfiguration({ environment: "Production" as never })).getOrder({ id: "A" }),
      ),
    );

    expect(error).toBeInstanceOf(PaypalNotConfigured);
    expect(mock.requests).toHaveLength(before);
  });

  it("forwards the abort signal", async () => {
    const guarded = createPaypalFetch(mock.baseUrl);
    await expect(guarded(`${mock.baseUrl}/v1/oauth2/token`, { method: "POST", signal: AbortSignal.abort() })).rejects.toThrow();
    expect(mock.requests).toHaveLength(0);
  });
});
