// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPaypalMock, type PaypalMock } from "@/test/paypal-mock-server";
import {
  callPaypal,
  createPaypalFetch,
  getAccessToken,
  getPaypalClient,
  resetPaypalClientForTests,
} from "./client";
import { PaypalError, PaypalNotConfigured } from "./types";

const TOKEN_PATH = "/v1/oauth2/token";

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
  resetPaypalClientForTests();
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

    const error = await caught(callPaypal("getOrder", (client) => client.orders.getOrder({ id: "MISSING" })));

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
      await caught(callPaypal("getOrder", (client) => client.orders.getOrder({ id: "X" })));

      expect(other.requestsTo("POST", TOKEN_PATH)).toHaveLength(1);
      expect(other.requestsTo("GET", "/v2/checkout/orders/X")).toHaveLength(1);
      expect(mock.requests).toHaveLength(0);
    } finally {
      await other.close();
    }
  });

  it("drops the cached token when PayPal answers 401, so the next call fetches a new one", async () => {
    mock.injectNext({
      method: "GET",
      path: "/v2/checkout/orders/A",
      status: 401,
      body: { name: "AUTHENTICATION_FAILURE", message: "expired", debug_id: "dbg-401", details: [{ issue: "INVALID_TOKEN" }] },
    });

    const error = await caught(callPaypal("getOrder", (client) => client.orders.getOrder({ id: "A" })));
    expect((error as PaypalError).status).toBe(401);

    await caught(callPaypal("getOrder", (client) => client.orders.getOrder({ id: "B" })));
    expect(mock.requestsTo("POST", TOKEN_PATH)).toHaveLength(2);
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

    const error = (await caught(callPaypal("getOrder", (client) => client.orders.getOrder({ id: "A" })))) as PaypalError;

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

    const error = (await caught(callPaypal("getOrder", (client) => client.orders.getOrder({ id: "A" })))) as PaypalError;

    expect(error).toMatchObject({ status: 422, issue: "ORDER_ALREADY_CAPTURED", debugId: "dbg-header" });
  });

  it("reports an unreadable success body with the recorded status", async () => {
    mock.injectNext({ method: "GET", path: "/v2/checkout/orders/A", status: 200, body: "not json" });

    const error = (await caught(callPaypal("getOrder", (client) => client.orders.getOrder({ id: "A" })))) as PaypalError;

    expect(error).toBeInstanceOf(PaypalError);
    expect(error.status).toBe(200);
    expect(error.message).toMatch(/unreadable/);
  });

  it("reports a connection failure with a null status", async () => {
    await getAccessToken();
    await mock.close();

    const error = (await caught(callPaypal("getOrder", (client) => client.orders.getOrder({ id: "A" })))) as PaypalError;

    expect(error).toBeInstanceOf(PaypalError);
    expect(error.status).toBeNull();
    expect(error.message).toMatch(/connection/);
    mock = await startPaypalMock();
  });

  it("returns the value with the response status and debug id", async () => {
    const created = await callPaypal("createOrder", (client) =>
      client.orders.createOrder({
        body: { intent: "CAPTURE", purchaseUnits: [{ amount: { currencyCode: "EUR", value: "30.00" } }] },
      }),
    );

    expect(created.status).toBe(201);
    expect(created.debugId).toMatch(/^mockdebug/);
    expect(created.value.id).toMatch(/^ORDER/);
  });
});

describe("createPaypalFetch", () => {
  it("refuses a request to any other origin without sending it", async () => {
    const guarded = createPaypalFetch(mock.baseUrl);

    await expect(guarded("https://api-m.sandbox.paypal.com.evil.com/v1/oauth2/token")).rejects.toBeInstanceOf(
      PaypalNotConfigured,
    );
    await expect(guarded(`${mock.baseUrl.replace("127.0.0.1", "localhost")}/v1/oauth2/token`)).rejects.toBeInstanceOf(
      PaypalNotConfigured,
    );
    expect(mock.requests).toHaveLength(0);
  });

  it("forwards the abort signal", async () => {
    const guarded = createPaypalFetch(mock.baseUrl);
    await expect(guarded(`${mock.baseUrl}/v1/oauth2/token`, { method: "POST", signal: AbortSignal.abort() })).rejects.toThrow();
    expect(mock.requests).toHaveLength(0);
  });
});
