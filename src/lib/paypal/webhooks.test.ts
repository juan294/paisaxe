// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPaypalMock, type PaypalMock } from "@/test/paypal-mock-server";
import { getAccessToken, resetPaypalClientForTests } from "./client";
import { PaypalError, PaypalNotConfigured } from "./types";
import { verifyWebhookSignature } from "./webhooks";

const VERIFY_PATH = "/v1/notifications/verify-webhook-signature";
const EVENT = {
  id: "WH-1PV2024973077974R-7X8769942S685491N",
  event_type: "CHECKOUT.ORDER.APPROVED",
  resource: { id: "5E496120FM196690K" },
};
const RAW_BODY = JSON.stringify(EVENT);

function signedHeaders(): Headers {
  return new Headers({
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1",
    "paypal-transmission-id": "tx-1",
    "paypal-transmission-sig": "sig==",
    "paypal-transmission-time": "2026-10-03T14:07:02Z",
  });
}

let mock: PaypalMock;

beforeEach(async () => {
  mock = await startPaypalMock();
  vi.stubEnv("PAYPAL_CLIENT_ID", "client-id");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "client-secret");
  vi.stubEnv("PAYPAL_API_BASE", mock.baseUrl);
  vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-ID-1");
  resetPaypalClientForTests();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  resetPaypalClientForTests();
  await mock.close();
});

describe("verifyWebhookSignature", () => {
  it("returns SUCCESS and sends the transmission headers, webhook id and event", async () => {
    expect(await verifyWebhookSignature(signedHeaders(), RAW_BODY)).toBe("SUCCESS");

    const [request] = mock.requestsTo("POST", VERIFY_PATH);
    expect(request.headers.authorization).toBe(`Bearer ${await getAccessToken()}`);
    expect(request.headers["content-type"]).toBe("application/json");
    expect(request.body).toEqual({
      auth_algo: "SHA256withRSA",
      cert_url: "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1",
      transmission_id: "tx-1",
      transmission_sig: "sig==",
      transmission_time: "2026-10-03T14:07:02Z",
      webhook_id: "WH-ID-1",
      webhook_event: EVENT,
    });
  });

  it("returns FAILURE when PayPal does not verify the signature", async () => {
    mock.setVerification("FAILURE");
    expect(await verifyWebhookSignature(signedHeaders(), RAW_BODY)).toBe("FAILURE");
  });

  it.each([
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time",
  ])("returns FAILURE without calling PayPal when %s is missing", async (name) => {
    const headers = signedHeaders();
    headers.delete(name);

    expect(await verifyWebhookSignature(headers, RAW_BODY)).toBe("FAILURE");
    expect(mock.requests).toHaveLength(0);
  });

  it.each(["", "not json", "[1,2]", "null"])("returns FAILURE without calling PayPal for the body %j", async (body) => {
    expect(await verifyWebhookSignature(signedHeaders(), body)).toBe("FAILURE");
    expect(mock.requests).toHaveLength(0);
  });

  it("throws PaypalNotConfigured when PAYPAL_WEBHOOK_ID is unset", async () => {
    vi.stubEnv("PAYPAL_WEBHOOK_ID", "");
    await expect(verifyWebhookSignature(signedHeaders(), RAW_BODY)).rejects.toBeInstanceOf(PaypalNotConfigured);
    expect(mock.requests).toHaveLength(0);
  });

  it("throws PaypalError on a non-2xx answer so the webhook route returns 500", async () => {
    mock.injectNext({
      method: "POST",
      path: VERIFY_PATH,
      status: 503,
      body: { name: "SERVICE_UNAVAILABLE", message: "down", debug_id: "dbg-503" },
    });

    const error = await verifyWebhookSignature(signedHeaders(), RAW_BODY).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PaypalError);
    expect(error).toMatchObject({ status: 503, debugId: "dbg-503" });
  });

  it("throws PaypalError with a null status when PayPal is unreachable", async () => {
    await getAccessToken();
    await mock.close();

    const error = await verifyWebhookSignature(signedHeaders(), RAW_BODY).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PaypalError);
    expect((error as PaypalError).status).toBeNull();
    mock = await startPaypalMock();
  });
});
