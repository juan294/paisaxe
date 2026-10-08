/**
 * Payments v2 through the SDK: the authoritative capture, refunds and their
 * status (PayPal hackathon plan, Phase 4, unit [adapter]). A refund's
 * PayPal-Request-Id is "refund:" + the payment's operation key, the same on
 * every retry, so at most one refund exists per payment.
 */
import "server-only";

import type { Refund } from "@paypal/paypal-server-sdk";
import { callPaypal } from "./client";
import { centsToValue } from "./money";
import { normalizeCapture } from "./orders";
import { PaypalError, type PaypalCapture, type PaypalRefund } from "./types";

function normalizeRefund(refund: Refund, status: number | null): PaypalRefund {
  if (!refund.id || !refund.status) {
    throw new PaypalError("PayPal returned a refund without id or status", { status });
  }
  return { id: refund.id, status: refund.status };
}

export async function getCapture(captureId: string): Promise<PaypalCapture> {
  const { value: capture, status } = await callPaypal("getCapture", ({ payments }) =>
    payments.getCapturedPayment({ captureId }),
  );
  return normalizeCapture(capture, capture.supplementaryData?.relatedIds?.orderId ?? null, status);
}

/** Refunds `amountCents` EUR of a capture. */
export async function refundCapture(captureId: string, amountCents: number, operationKey: string): Promise<PaypalRefund> {
  const value = centsToValue(amountCents);
  const { value: refund, status } = await callPaypal("refundCapture", ({ payments }) =>
    payments.refundCapturedPayment({
      captureId,
      paypalRequestId: `refund:${operationKey}`,
      prefer: "return=representation",
      body: { amount: { currencyCode: "EUR", value } },
    }),
  );
  return normalizeRefund(refund, status);
}

export async function getRefund(refundId: string): Promise<PaypalRefund> {
  const { value, status } = await callPaypal("getRefund", ({ payments }) => payments.getRefund({ refundId }));
  return normalizeRefund(value, status);
}
