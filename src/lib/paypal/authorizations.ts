/**
 * Authorize, capture and void through the SDK (PayPal hackathon plan, Phase
 * 8b, decision R7; contract sheet pay-pal-server-sdk-plan.md, "Operations").
 *
 * Only a phone-confirmed merchant's AUTHORIZE order reaches these calls. The
 * deposit is authorized when the buyer approves, captured only after the
 * merchant confirms on the phone, voided otherwise. A PayPal authorization is
 * valid for 29 days; capture is guaranteed only within the 3-day honor period
 * (Phase 0 evidence).
 *
 * Idempotency is PayPal-Request-Id only, derived from the payment's operation
 * key: "authorize:", "capture-authorization:" and "void:" + key. A capture is
 * always final and for the full deposit, so an authorization is captured at
 * most once.
 */
import "server-only";

import type { CapturedPayment, PaymentAuthorization } from "pay-pal-server-sdk";
import { callPaypal } from "./client";
import { centsToValue } from "./money";
import { getOrder, normalizeAuthorization, normalizeCapture, normalizeOrder } from "./orders";
import { PaypalError, type PaypalAuthorization, type PaypalCapture, type PaypalOrder } from "./types";

const PREFER_REPRESENTATION = "return=representation";

function relatedOrderId(payment: CapturedPayment | PaymentAuthorization): string | null {
  return payment.supplementaryData?.relatedIds?.orderId ?? null;
}

/**
 * Authorizes a buyer-approved AUTHORIZE order. Returns the order with
 * `authorization` set; a response without one is an error (the outcome is
 * then unknown and the caller reconciles through getOrder). An order already
 * authorized under another request id (422 ORDER_ALREADY_AUTHORIZED) returns
 * its existing authorization.
 */
export async function authorizeOrder(orderId: string, operationKey: string): Promise<PaypalOrder> {
  let order: PaypalOrder;
  let status: number | null = null;
  try {
    const response = await callPaypal("authorizeOrder", (client) =>
      client.orders.authorizeOrder({
        id: orderId,
        payPalRequestId: `authorize:${operationKey}`,
        prefer: PREFER_REPRESENTATION,
        body: {},
      }),
    );
    status = response.status;
    order = normalizeOrder(response.value, status);
  } catch (error) {
    if (!(error instanceof PaypalError && error.status === 422 && error.issue === "ORDER_ALREADY_AUTHORIZED")) throw error;
    order = await getOrder(orderId);
  }
  if (!order.authorization) {
    throw new PaypalError(`PayPal authorizeOrder left order ${order.status} without an authorization`, { status });
  }
  return order;
}

/** Captures the full deposit of an authorization, as its final capture. */
export async function captureAuthorization(
  authorizationId: string,
  amountCents: number,
  operationKey: string
): Promise<PaypalCapture> {
  const value = centsToValue(amountCents);
  const { value: capture, status } = await callPaypal("captureAuthorization", (client) =>
    client.payments.captureAuthorizedPayment({
      authorizationId,
      payPalRequestId: `capture-authorization:${operationKey}`,
      prefer: PREFER_REPRESENTATION,
      body: { amount: { currencyCode: "EUR", value }, finalCapture: true },
    }),
  );
  return normalizeCapture(capture, relatedOrderId(capture), status);
}

export async function getAuthorization(authorizationId: string): Promise<PaypalAuthorization> {
  const { value, status } = await callPaypal("getAuthorization", (client) =>
    client.payments.getAuthorizedPayment({ authorizationId }),
  );
  return normalizeAuthorization(value, relatedOrderId(value), status);
}

/**
 * Voids an authorization. An authorization already voided under another
 * request id (422 PREVIOUSLY_VOIDED) is reported as it stands; any other
 * refusal (PREVIOUSLY_CAPTURED, AUTHORIZATION_EXPIRED) is thrown for the caller
 * to resolve with getAuthorization.
 */
export async function voidAuthorization(authorizationId: string, operationKey: string): Promise<PaypalAuthorization> {
  try {
    const { value, status } = await callPaypal("voidAuthorization", (client) =>
      client.payments.voidPayment({
        authorizationId,
        payPalRequestId: `void:${operationKey}`,
        prefer: PREFER_REPRESENTATION,
      }),
    );
    return normalizeAuthorization(value, relatedOrderId(value), status);
  } catch (error) {
    if (error instanceof PaypalError && error.status === 422 && error.issue === "PREVIOUSLY_VOIDED") {
      return getAuthorization(authorizationId);
    }
    throw error;
  }
}
