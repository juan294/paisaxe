import type { BalanceInvoiceStatus, BookingView } from "@/types/booking-page";

/** What the booking page shows, derived from the booking and its latest payment. */
export type Phase = "pay" | "confirming" | "confirmed" | "expired" | "attention" | "refundFailed" | "refunding" | "refunded" | "cancelled";

export type StepState = "done" | "current" | "upcoming" | "stopped";
export type StepKey = "offer" | "deposit" | "balance";

/** The deposit left the buyer's account (it may since have been refunded). */
const DEPOSIT_TAKEN = new Set(["captured", "refund_pending", "refunded", "refund_failed"]);
/** A balance invoice that is out and not yet fully paid. */
const BALANCE_DUE = new Set<BalanceInvoiceStatus>(["sent", "partially_paid", "payment_pending"]);
/** Phases after which the balance will never be collected. */
const BALANCE_OFF = new Set<Phase>(["expired", "cancelled", "refunding", "refunded", "refundFailed"]);

function depositState(view: BookingView, phase: Phase): StepState {
  if (phase === "confirmed" || (view.payment && DEPOSIT_TAKEN.has(view.payment.status))) return "done";
  if (phase === "pay" || phase === "confirming") return "current";
  return phase === "expired" ? "stopped" : "upcoming";
}

function balanceState(view: BookingView, phase: Phase): StepState {
  if (view.invoice?.status === "paid") return "done";
  if (BALANCE_OFF.has(phase)) return "stopped";
  return phase === "confirmed" && view.invoice && BALANCE_DUE.has(view.invoice.status) ? "current" : "upcoming";
}

/**
 * The ticket's three steps (docs/plans/2026-10-07-booking-ui-polish.md, phase 2):
 * the offer accepted in the chat, the deposit paid through PayPal Orders, and the
 * balance paid through a PayPal invoice. A booking exists only after acceptance,
 * so the first step is always done.
 */
export function journeySteps(view: BookingView, phase: Phase): { key: StepKey; state: StepState }[] {
  return [
    { key: "offer", state: "done" },
    { key: "deposit", state: depositState(view, phase) },
    { key: "balance", state: balanceState(view, phase) },
  ];
}
