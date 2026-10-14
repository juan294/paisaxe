/** Pure provider normalization. No provider reads: incomplete evidence is retained
 * for operator reconciliation rather than inferred from cumulative snapshots. */
export type EntitlementFact =
  | { kind: "charge"; id: string; amount: number; currency: string; status: string; created: number }
  | { kind: "refund"; id: string; charge_id: string; amount: number; currency: string; status: string; created: number }
  | { kind: "dispute"; id: string; charge_id?: string; status: string; created: number }
  | { kind: "reconciliation"; reason: string };
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value !== null && typeof value === "object" ? value as RecordValue : {};
export const stripeObjectId = (value: unknown): string | null => typeof value === "string" ? value : typeof record(value).id === "string" ? record(value).id as string : null;
export const ADJUSTMENT_EVENTS = new Set(["charge.refunded", "refund.created", "refund.updated", "refund.failed", "charge.dispute.created", "charge.dispute.updated", "charge.dispute.closed"]);
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;

export function normalizeStripeAdjustment(type: string, input: unknown, created = 0) {
  const object = record(input);
  const charge = type === "charge.refunded" ? object : record(object.charge);
  const paymentIntent = stripeObjectId(object.payment_intent) ?? stripeObjectId(charge.payment_intent);
  const facts: EntitlementFact[] = [];
  const problem = (reason: string) => facts.push({ kind: "reconciliation", reason });
  const expandedChargePayment = stripeObjectId(charge.payment_intent);
  if (expandedChargePayment && paymentIntent !== expandedChargePayment) return { paymentIntent: paymentIntent?.startsWith("pi_") ? paymentIntent : null, facts: [{ kind: "reconciliation", reason: "conflicting_expanded_charge_payment" } satisfies EntitlementFact] };
  const chargeId = type === "charge.refunded" ? stripeObjectId(object) : stripeObjectId(object.charge);
  if (Object.keys(charge).length > 0) {
    if (chargeId && integer(charge.amount_captured) && typeof charge.currency === "string") facts.push({ kind: "charge", id: chargeId, amount: charge.amount_captured, currency: charge.currency, status: type === "charge.refunded" && record(object.refunds).has_more === false ? "complete" : "captured", created });
    else problem("missing_captured_charge_evidence");
  }
  const refund = (raw: unknown) => {
    const item = record(raw);
    const id = stripeObjectId(item);
    const status = item.status;
    if (!id || !chargeId || !integer(item.amount) || typeof item.currency !== "string" || typeof status !== "string" || !["pending", "requires_action", "succeeded", "failed", "canceled"].includes(status)) {
      problem(`unsupported_refund:${id ?? "missing_id"}`); return;
    }
    const refundCharge = stripeObjectId(item.charge);
    if (refundCharge && refundCharge !== chargeId) { problem(`conflicting_refund_charge:${id}`); return; }
    const refundPayment = stripeObjectId(item.payment_intent);
    if (refundPayment && refundPayment !== paymentIntent) { problem(`conflicting_refund_payment:${id}`); return; }
    if (typeof charge.currency === "string" && item.currency !== charge.currency) problem(`currency_mismatch:${id}`);
    facts.push({ kind: "refund", id, charge_id: chargeId, amount: item.amount, currency: item.currency, status, created });
  };
  if (type === "charge.refunded") {
    const list = record(object.refunds);
    if (list.has_more !== false || !Array.isArray(list.data)) problem(`incomplete_refund_pagination:${chargeId ?? "missing_id"}`);
    if (Array.isArray(list.data)) {
      list.data.forEach(refund);
      if (list.has_more === false && list.data.length === 0 && integer(object.amount_refunded) && object.amount_refunded > 0) problem(`missing_physical_refunds:${chargeId ?? "missing_id"}`);
    }
  } else if (type.startsWith("refund.")) refund(object);
  else {
    const id = stripeObjectId(object);
    const status = object.status;
    if (!id || typeof status !== "string" || !["needs_response", "under_review", "warning_needs_response", "warning_under_review", "won", "lost"].includes(status)) problem(`unsupported_dispute:${id ?? "missing_id"}`);
    else facts.push({ kind: "dispute", id, charge_id: chargeId ?? undefined, status, created });
  }
  return { paymentIntent: paymentIntent?.startsWith("pi_") ? paymentIntent : null, facts };
}
