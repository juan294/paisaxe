// @vitest-environment node
/**
 * Authorize / capture / void against the local PayPal stand-in (PayPal
 * hackathon plan, Phase 8b, decision R7).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPaypalMock, type PaypalMock } from "@/test/paypal-mock-server";
import { authorizeOrder, captureAuthorization, getAuthorization, voidAuthorization } from "./authorizations";
import { resetPaypalClientForTests } from "./client";
import { captureOrder, createOrder, getOrder } from "./orders";
import { PaypalError, type CreateOrderInput } from "./types";

const BOOKING_ID = "11111111-2222-4333-8444-555555555555";
const OPERATION_KEY = "00000000-0000-4000-8000-000000000001";
const SITE = "https://paisaxe.es";

const input: CreateOrderInput = {
  bookingId: BOOKING_ID,
  amountCents: 4000,
  currency: "EUR",
  description: "Visita a una quesería artesana (demo)",
  returnUrl: `${SITE}/booking/cap-token/return`,
  cancelUrl: `${SITE}/booking/cap-token?cancelled=1`,
  operationKey: OPERATION_KEY,
  intent: "AUTHORIZE",
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

async function approvedOrder(): Promise<string> {
  const { orderId } = await createOrder(input);
  mock.approve(orderId);
  return orderId;
}

async function authorized(): Promise<{ orderId: string; authorizationId: string }> {
  const orderId = await approvedOrder();
  const order = await authorizeOrder(orderId, OPERATION_KEY);
  return { orderId, authorizationId: order.authorization!.id };
}

describe("createOrder with intent AUTHORIZE", () => {
  it("sends intent AUTHORIZE; an order without intent stays CAPTURE", async () => {
    await createOrder(input);
    await createOrder({ ...input, intent: undefined, operationKey: "another-key" });

    const [authorizeIntent, captureIntent] = mock.requestsTo("POST", "/v2/checkout/orders");
    expect((authorizeIntent.body as { intent: string }).intent).toBe("AUTHORIZE");
    expect((captureIntent.body as { intent: string }).intent).toBe("CAPTURE");
  });

  it("an AUTHORIZE order can never be captured as an order", async () => {
    const orderId = await approvedOrder();
    const error = await caught(captureOrder(orderId, OPERATION_KEY));
    expect(error.status).toBe(422);
    expect(error.issue).toBe("ACTION_DOES_NOT_MATCH_INTENT");
  });
});

describe("authorizeOrder", () => {
  it("authorizes an approved order with authorize:<key> and returns the normalized authorization", async () => {
    const orderId = await approvedOrder();

    const order = await authorizeOrder(orderId, OPERATION_KEY);

    const [request] = mock.requestsTo("POST", `/v2/checkout/orders/${orderId}/authorize`);
    expect(request.headers["paypal-request-id"]).toBe(`authorize:${OPERATION_KEY}`);
    expect(request.headers.prefer).toBe("return=representation");
    expect(order.status).toBe("COMPLETED");
    expect(order.capture).toBeNull();
    expect(order.authorization).toEqual({
      id: expect.stringMatching(/^AUTH/),
      status: "CREATED",
      amountCents: 4000,
      currency: "EUR",
      customId: BOOKING_ID,
      orderId,
      expiresAt: expect.any(String),
    });
    // 29-day authorization (Phase 0 evidence).
    const days = (Date.parse(order.authorization!.expiresAt!) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(28.9);
  });

  it("a retry with the same key replays the same authorization", async () => {
    const orderId = await approvedOrder();
    const first = await authorizeOrder(orderId, OPERATION_KEY);
    const second = await authorizeOrder(orderId, OPERATION_KEY);
    expect(second.authorization!.id).toBe(first.authorization!.id);
    expect(mock.authorizations.size).toBe(1);
  });

  it("an already authorized order (422 ORDER_ALREADY_AUTHORIZED, new key) returns its existing authorization", async () => {
    const orderId = await approvedOrder();
    const first = await authorizeOrder(orderId, OPERATION_KEY);
    const again = await authorizeOrder(orderId, "a-new-key");
    expect(again.authorization!.id).toBe(first.authorization!.id);
    expect(mock.authorizations.size).toBe(1);
  });

  it("an order the buyer has not approved is a PaypalError ORDER_NOT_APPROVED", async () => {
    const { orderId } = await createOrder(input);
    const error = await caught(authorizeOrder(orderId, OPERATION_KEY));
    expect(error.issue).toBe("ORDER_NOT_APPROVED");
  });

  it("a response without an authorization is an error (outcome unknown)", async () => {
    const orderId = await approvedOrder();
    mock.injectNext({
      method: "POST",
      path: `/v2/checkout/orders/${orderId}/authorize`,
      status: 201,
      body: { id: orderId, status: "COMPLETED", purchase_units: [{ reference_id: "default" }] },
    });
    const error = await caught(authorizeOrder(orderId, OPERATION_KEY));
    expect(error.message).toMatch(/without an authorization/);
  });

  it("getOrder reports the authorization of an authorized order", async () => {
    const { orderId, authorizationId } = await authorized();
    const order = await getOrder(orderId);
    expect(order.authorization?.id).toBe(authorizationId);
    expect(order.authorization?.status).toBe("CREATED");
  });
});

describe("captureAuthorization", () => {
  it("captures the full deposit once, as a final capture, with capture-authorization:<key>", async () => {
    const { orderId, authorizationId } = await authorized();

    const capture = await captureAuthorization(authorizationId, 4000, OPERATION_KEY);

    const [request] = mock.requestsTo("POST", `/v2/payments/authorizations/${authorizationId}/capture`);
    expect(request.headers["paypal-request-id"]).toBe(`capture-authorization:${OPERATION_KEY}`);
    expect(request.body).toEqual({ amount: { currency_code: "EUR", value: "40.00" }, final_capture: true });
    expect(capture).toEqual({
      id: expect.stringMatching(/^CAP/),
      status: "COMPLETED",
      amountCents: 4000,
      currency: "EUR",
      customId: BOOKING_ID,
      orderId,
    });
    expect((await getOrder(orderId)).capture?.id).toBe(capture.id);
  });

  it("is never captured twice: a retry replays, a new key is refused AUTHORIZATION_ALREADY_CAPTURED", async () => {
    const { authorizationId } = await authorized();
    const first = await captureAuthorization(authorizationId, 4000, OPERATION_KEY);
    const replayed = await captureAuthorization(authorizationId, 4000, OPERATION_KEY);
    expect(replayed.id).toBe(first.id);

    const error = await caught(captureAuthorization(authorizationId, 4000, "a-new-key"));
    expect(error.issue).toBe("AUTHORIZATION_ALREADY_CAPTURED");
    expect(mock.captures.size).toBe(1);
  });

  it("a voided or expired authorization cannot be captured", async () => {
    const voided = await authorized();
    await voidAuthorization(voided.authorizationId, OPERATION_KEY);
    expect((await caught(captureAuthorization(voided.authorizationId, 4000, OPERATION_KEY))).issue).toBe("AUTHORIZATION_VOIDED");

    const { orderId } = await createOrder({ ...input, operationKey: "second-order" });
    mock.approve(orderId);
    const second = await authorizeOrder(orderId, "second-order");
    mock.setAuthorizationStatus(second.authorization!.id, "EXPIRED");
    expect((await caught(captureAuthorization(second.authorization!.id, 4000, "second-order"))).issue).toBe("AUTHORIZATION_EXPIRED");
  });
});

describe("voidAuthorization", () => {
  it("voids with void:<key> and returns the voided authorization", async () => {
    const { orderId, authorizationId } = await authorized();

    const result = await voidAuthorization(authorizationId, OPERATION_KEY);

    const [request] = mock.requestsTo("POST", `/v2/payments/authorizations/${authorizationId}/void`);
    expect(request.headers["paypal-request-id"]).toBe(`void:${OPERATION_KEY}`);
    expect(request.headers.prefer).toBe("return=representation");
    expect(result).toMatchObject({ id: authorizationId, status: "VOIDED", orderId });
  });

  it("a second void with a new key (422 PREVIOUSLY_VOIDED) reports the voided authorization", async () => {
    const { authorizationId } = await authorized();
    await voidAuthorization(authorizationId, OPERATION_KEY);
    const again = await voidAuthorization(authorizationId, "a-new-key");
    expect(again.status).toBe("VOIDED");
  });

  it("a captured authorization cannot be voided: PREVIOUSLY_CAPTURED is thrown", async () => {
    const { authorizationId } = await authorized();
    await captureAuthorization(authorizationId, 4000, OPERATION_KEY);
    const error = await caught(voidAuthorization(authorizationId, OPERATION_KEY));
    expect(error.issue).toBe("PREVIOUSLY_CAPTURED");
  });

  it("a void answered without a body (204) reads the authorization instead", async () => {
    const { authorizationId } = await authorized();
    mock.setAuthorizationStatus(authorizationId, "VOIDED");
    mock.injectNext({ method: "POST", path: `/v2/payments/authorizations/${authorizationId}/void`, status: 204 });

    const result = await voidAuthorization(authorizationId, OPERATION_KEY);

    expect(result).toMatchObject({ id: authorizationId, status: "VOIDED" });
    expect(mock.requestsTo("GET", `/v2/payments/authorizations/${authorizationId}`)).toHaveLength(1);
  });

  it("an expired authorization is thrown as AUTHORIZATION_EXPIRED", async () => {
    const { authorizationId } = await authorized();
    mock.setAuthorizationStatus(authorizationId, "EXPIRED");
    expect((await caught(voidAuthorization(authorizationId, OPERATION_KEY))).issue).toBe("AUTHORIZATION_EXPIRED");
  });
});

describe("getAuthorization", () => {
  it("reads the authorization's current status", async () => {
    const { authorizationId } = await authorized();
    mock.setAuthorizationStatus(authorizationId, "EXPIRED");
    expect(await getAuthorization(authorizationId)).toMatchObject({ id: authorizationId, status: "EXPIRED", amountCents: 4000 });
  });

  it("optional fields PayPal leaves out are null", async () => {
    mock.injectNext({ method: "GET", path: "/v2/payments/authorizations/AUTH-MIN", status: 200, body: { id: "AUTH-MIN", status: "CREATED" } });
    expect(await getAuthorization("AUTH-MIN")).toEqual({
      id: "AUTH-MIN",
      status: "CREATED",
      amountCents: null,
      currency: null,
      customId: null,
      orderId: null,
      expiresAt: null,
    });
  });

  it("an authorization without id or status is an adapter error", async () => {
    mock.injectNext({ method: "GET", path: "/v2/payments/authorizations/AUTH-X", status: 200, body: { amount: { currency_code: "EUR", value: "1.00" } } });
    const error = await caught(getAuthorization("AUTH-X"));
    expect(error.message).toMatch(/without id or status/);
  });

  it("an unknown authorization is a 404 PaypalError", async () => {
    expect((await caught(getAuthorization("AUTH-NOPE"))).status).toBe(404);
  });
});
