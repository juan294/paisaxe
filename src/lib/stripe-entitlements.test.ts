import { requiredValue } from "@/test/required-value";
import { describe, expect, it } from "vitest";
import { normalizeStripeAdjustment, stripeObjectId } from "./stripe-entitlements";
describe("Stripe adjustment normalization", () => {
  const charge = { id: "ch_local", payment_intent: { id: "pi_local" }, amount: 9999, amount_captured: 300, currency: "eur", refunds: { has_more: false, data: [{ id: "re_local", charge: "ch_local", payment_intent: { id: "pi_local" }, amount: 300, currency: "eur", status: "succeeded" }] } };
  it("uses captured amount and physical refund identity with expanded payment IDs", () => {
    expect(normalizeStripeAdjustment("charge.refunded", charge, 42)).toEqual({ paymentIntent: "pi_local", facts: [
      { kind: "charge", id: "ch_local", amount: 300, currency: "eur", status: "complete", created: 42 },
      { kind: "refund", id: "re_local", charge_id: "ch_local", amount: 300, currency: "eur", status: "succeeded", created: 42 },
    ] });
    expect(stripeObjectId({ id: "pi_local" })).toBe("pi_local");
  });
  it.each(["unknown", null, undefined])("classifies unsupported refund status %s", status => {
    const value = structuredClone(charge) as typeof charge;
    requiredValue(value.refunds.data[0], "src/lib/stripe-entitlements.test.ts:14 value.refunds.data[0]").status = status as string;
    expect(normalizeStripeAdjustment("charge.refunded", value).facts).toContainEqual({ kind: "reconciliation", reason: "unsupported_refund:re_local" });
  });
  it("quarantines nested refund charge mismatch", () => {
    const value = structuredClone(charge); requiredValue(value.refunds.data[0], "src/lib/stripe-entitlements.test.ts:18 value.refunds.data[0]").charge = "ch_other";
    expect(normalizeStripeAdjustment("charge.refunded", value).facts).toContainEqual({ kind: "reconciliation", reason: "conflicting_refund_charge:re_local" });
    expect(normalizeStripeAdjustment("charge.refunded", value).facts.some(f => f.kind === "refund")).toBe(false);
  });
  it("quarantines expanded charge payment mismatch", () => {
    expect(normalizeStripeAdjustment("refund.updated", { id: "re_local", payment_intent: "pi_local", charge: { id: "ch_local", payment_intent: "pi_other", amount_captured: 300, currency: "eur" } }).facts).toEqual([{ kind: "reconciliation", reason: "conflicting_expanded_charge_payment" }]);
  });
  it("quarantines ambiguous warning_closed rather than restoring an open dispute", () => {
    expect(normalizeStripeAdjustment("charge.dispute.closed", {id:"dp_local",payment_intent:"pi_local",status:"warning_closed"}).facts).toEqual([{kind:"reconciliation",reason:"unsupported_dispute:dp_local"}]);
  });
  it("classifies a complete snapshot missing physical refunds despite its positive aggregate", () => {
    expect(normalizeStripeAdjustment("charge.refunded", { ...charge, amount_refunded: 300, refunds: { has_more: false, data: [] } }).facts).toContainEqual({kind:"reconciliation",reason:"missing_physical_refunds:ch_local"});
  });
  it("classifies refund currency conflicting with its known captured charge", () => {
    const value=structuredClone(charge); requiredValue(value.refunds.data[0], "src/lib/stripe-entitlements.test.ts:32 value.refunds.data[0]").currency="usd";
    expect(normalizeStripeAdjustment("charge.refunded", value).facts).toContainEqual({kind:"reconciliation",reason:"currency_mismatch:re_local"});
  });
  it("retains incomplete pagination rather than adding cumulative amount_refunded", () => {
    expect(normalizeStripeAdjustment("charge.refunded", { ...charge, amount_refunded: 9999, refunds: { has_more: true, data: [] } }).facts).toContainEqual({ kind: "reconciliation", reason: "incomplete_refund_pagination:ch_local" });
  });
});
