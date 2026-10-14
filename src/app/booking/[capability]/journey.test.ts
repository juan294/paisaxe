import { describe, expect, it } from "vitest";
import type { BookingView } from "@/types/booking-page";
import { journeySteps, type Phase, type StepState } from "./journey";

function view(overrides: Partial<BookingView> = {}): BookingView {
  return {
    reference: "RS-ABC123",
    status: "pending_payment",
    experienceTitle: "Paseo",
    experienceSlug: null,
    slotDate: "2026-11-21",
    slotTime: "10:00",
    partySize: 2,
    totalCents: 12000,
    depositCents: 3000,
    balanceCents: 9000,
    currency: "EUR",
    cancellationWindowHours: 24,
    holdExpiresAt: null,
    payment: null,
    invoice: null,
    ...overrides,
  };
}

const pay = (status: string) => ({ status, orderId: "O", captureId: null, refundId: null });
const states = (v: BookingView, phase: Phase): StepState[] => journeySteps(v, phase).map((step) => step.state);

describe("journeySteps (plan phase 2, U05)", () => {
  it.each<[string, BookingView, Phase, StepState[]]>([
    ["waiting for the deposit", view(), "pay", ["done", "current", "upcoming"]],
    ["deposit approved, capture running", view({ payment: pay("approved") }), "confirming", ["done", "current", "upcoming"]],
    ["deposit authorized while the merchant confirms by phone", view({ payment: pay("authorized") }), "confirming", ["done", "current", "upcoming"]],
    ["confirmed, no invoice yet", view({ status: "confirmed", payment: pay("captured") }), "confirmed", ["done", "done", "upcoming"]],
    [
      "confirmed, balance invoice sent",
      view({ status: "confirmed", payment: pay("captured"), invoice: { status: "sent", url: "u" } }),
      "confirmed",
      ["done", "done", "current"],
    ],
    [
      "confirmed, balance partly paid",
      view({ status: "confirmed", payment: pay("captured"), invoice: { status: "partially_paid", url: "u" } }),
      "confirmed",
      ["done", "done", "current"],
    ],
    [
      "balance paid",
      view({ status: "confirmed", payment: pay("captured"), invoice: { status: "paid", url: null } }),
      "confirmed",
      ["done", "done", "done"],
    ],
    ["hold lapsed without payment", view({ status: "expired" }), "expired", ["done", "stopped", "stopped"]],
    ["refund running", view({ status: "refund_pending", payment: pay("refund_pending") }), "refunding", ["done", "done", "stopped"]],
    ["refunded", view({ status: "refunded", payment: pay("refunded") }), "refunded", ["done", "done", "stopped"]],
    ["refund refused", view({ status: "needs_attention", payment: pay("refund_failed") }), "refundFailed", ["done", "done", "stopped"]],
    ["cancelled after capture", view({ status: "cancelled", payment: pay("captured") }), "cancelled", ["done", "done", "stopped"]],
    ["in review before any capture", view({ status: "needs_attention", payment: pay("capture_failed") }), "attention", ["done", "upcoming", "upcoming"]],
  ])("%s", (_name, v, phase, expected) => {
    expect(states(v, phase)).toEqual(expected);
  });

  it("names the steps in order", () => {
    expect(journeySteps(view(), "pay").map((step) => step.key)).toEqual(["offer", "deposit", "balance"]);
  });
});
