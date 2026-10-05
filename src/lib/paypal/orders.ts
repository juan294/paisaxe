/**
 * Orders v2 through the SDK: create, read and capture the deposit order
 * (PayPal hackathon plan, Phase 4, unit [adapter]; contract sheet
 * pay-pal-server-sdk-plan.md, "Operations").
 *
 * Idempotency is PayPal-Request-Id only (the SDK never retries): the payment's
 * operation key on create, "capture:" + key on capture. A capture of an order
 * that is already captured returns that order's existing capture, whether
 * PayPal answers 422 ORDER_ALREADY_CAPTURED or 201 (Phase 0 finding 6).
 */
import "server-only";

import {
  type AuthorizationWithAdditionalData,
  CheckoutPaymentIntent,
  PayPalExperienceUserAction,
  PayPalWalletContextShippingPreference,
  type LinkDescription,
  type Order,
  type OrdersCapture,
} from "pay-pal-server-sdk";
import { callPaypal } from "./client";
import { centsToValue, valueToCents } from "./money";
import {
  PaypalError,
  type CreateOrderInput,
  type PaypalAuthorization,
  type PaypalCapture,
  type PaypalOrder,
} from "./types";

const PREFER_REPRESENTATION = "return=representation";
const APPROVAL_RELS = new Set(["payer-action", "approve"]);

function approvalLink(links: LinkDescription[] | undefined): string | null {
  return links?.find((link) => APPROVAL_RELS.has(link.rel))?.href ?? null;
}

export function normalizeCapture(capture: OrdersCapture, orderId: string | null, status: number | null): PaypalCapture {
  if (!capture.id || !capture.status) {
    throw new PaypalError("PayPal returned a capture without id or status", { status });
  }
  return {
    id: capture.id,
    status: capture.status,
    amountCents: capture.amount ? valueToCents(capture.amount.value) : null,
    currency: capture.amount?.currencyCode ?? null,
    customId: capture.customId ?? null,
    orderId,
  };
}

type AuthorizationLike = Pick<AuthorizationWithAdditionalData, "id" | "status" | "amount" | "customId" | "expirationTime">;

/** Phase 8b: an authorization as the adapter's callers see it. */
export function normalizeAuthorization(
  authorization: AuthorizationLike,
  orderId: string | null,
  status: number | null
): PaypalAuthorization {
  if (!authorization.id || !authorization.status) {
    throw new PaypalError("PayPal returned an authorization without id or status", { status });
  }
  return {
    id: authorization.id,
    status: authorization.status,
    amountCents: authorization.amount ? valueToCents(authorization.amount.value) : null,
    currency: authorization.amount?.currencyCode ?? null,
    customId: authorization.customId ?? null,
    orderId,
    expiresAt: authorization.expirationTime ?? null,
  };
}

export function normalizeOrder(order: Order, status: number | null): PaypalOrder {
  if (!order.id || !order.status) {
    throw new PaypalError("PayPal returned an order without id or status", { status });
  }
  const unit = order.purchaseUnits?.[0];
  const capture = unit?.payments?.captures?.[0];
  const payerEmail = order.payer?.emailAddress || order.paymentSource?.paypal?.emailAddress;
  const authorization = unit?.payments?.authorizations?.[0];
  return {
    id: order.id,
    status: order.status,
    amountCents: unit?.amount ? valueToCents(unit.amount.value) : null,
    currency: unit?.amount?.currencyCode ?? null,
    customId: unit?.customId ?? null,
    capture: capture ? normalizeCapture(capture, order.id, status) : null,
    approveUrl: approvalLink(order.links),
    ...(payerEmail ? { payerEmail } : {}),
    ...(authorization ? { authorization: normalizeAuthorization(authorization, order.id, status) } : {}),
  };
}

/**
 * Creates the order for a booking deposit: intent CAPTURE, or AUTHORIZE for a
 * phone-confirmed merchant (Phase 8b). Returns the order id and the buyer's approval URL.
 */
export async function createOrder(input: CreateOrderInput): Promise<{ orderId: string; approveUrl: string }> {
  const value = centsToValue(input.amountCents);
  const { value: order, status } = await callPaypal("createOrder", (client) =>
    client.orders.createOrder({
      payPalRequestId: input.operationKey,
      prefer: PREFER_REPRESENTATION,
      body: {
        intent: input.intent === "AUTHORIZE" ? CheckoutPaymentIntent.Authorize : CheckoutPaymentIntent.Capture,
        purchaseUnits: [
          {
            amount: { currencyCode: input.currency, value },
            customId: input.bookingId,
            description: input.description,
          },
        ],
        paymentSource: {
          paypal: {
            experienceContext: {
              returnUrl: input.returnUrl,
              cancelUrl: input.cancelUrl,
              userAction: PayPalExperienceUserAction.PayNow,
              shippingPreference: PayPalWalletContextShippingPreference.NoShipping,
            },
          },
        },
      },
    }),
  );
  if (!order.id) throw new PaypalError("PayPal createOrder returned no order id", { status });
  const approveUrl = approvalLink(order.links);
  if (!approveUrl) throw new PaypalError("PayPal createOrder returned no approval link", { status });
  return { orderId: order.id, approveUrl };
}

export async function getOrder(orderId: string): Promise<PaypalOrder> {
  const { value, status } = await callPaypal("getOrder", (client) => client.orders.getOrder({ id: orderId }));
  return normalizeOrder(value, status);
}

/**
 * Captures a buyer-approved order. Returns the order with `capture` set; a
 * response without a capture is an error (the outcome is then unknown and the
 * caller reconciles through getOrder). ORDER_NOT_APPROVED is thrown as a
 * PaypalError with that issue.
 */
export async function captureOrder(orderId: string, operationKey: string): Promise<PaypalOrder> {
  let order: PaypalOrder;
  let status: number | null = null;
  try {
    const response = await callPaypal("captureOrder", (client) =>
      client.orders.captureOrder({
        id: orderId,
        payPalRequestId: `capture:${operationKey}`,
        prefer: PREFER_REPRESENTATION,
        body: {},
      }),
    );
    status = response.status;
    order = normalizeOrder(response.value, status);
  } catch (error) {
    if (!(error instanceof PaypalError && error.status === 422 && error.issue === "ORDER_ALREADY_CAPTURED")) throw error;
    order = await getOrder(orderId);
  }
  if (!order.capture) {
    throw new PaypalError(`PayPal captureOrder left order ${order.status} without a capture`, { status });
  }
  return order;
}
