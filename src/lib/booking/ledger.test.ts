import { describe, expect, it } from "vitest";
import type { PaypalLedger, PaypalLedgerEntry } from "@/lib/paypal/types";
import { matchLedger, type LedgerBooking } from "./ledger";

const WINDOW_START = new Date("2026-09-07T10:00:00.000Z");
const REFRESHED_AT = "2026-10-08T09:00:00.000Z";

function booking(overrides: Partial<LedgerBooking> = {}): LedgerBooking {
  return {
    id: "b1",
    depositCents: 3000,
    currency: "EUR",
    payment: { captureId: "CAP1", capturedAt: "2026-10-08T08:00:00.000Z" },
    ...overrides,
  };
}

function capture(overrides: Partial<PaypalLedgerEntry> = {}): PaypalLedgerEntry {
  return {
    transactionId: "CAP1",
    referenceId: null,
    eventCode: "T0006",
    status: "S",
    amountCents: 3000,
    currency: "EUR",
    customId: "b1",
    ...overrides,
  };
}

function refund(overrides: Partial<PaypalLedgerEntry> = {}): PaypalLedgerEntry {
  return capture({ transactionId: "REF1", referenceId: "CAP1", eventCode: "T1107", amountCents: -3000, ...overrides });
}

function ledger(entries: PaypalLedgerEntry[], refreshedAt: string | null = REFRESHED_AT): PaypalLedger {
  return { entries, refreshedAt, truncated: false };
}

const match = (subject: LedgerBooking, entries: PaypalLedgerEntry[], refreshedAt?: string | null) =>
  matchLedger([subject], ledger(entries, refreshedAt), WINDOW_START)[subject.id];

describe("matchLedger", () => {
  it.each<[string, LedgerBooking, PaypalLedgerEntry[], string | null | undefined, string]>([
    ["no payment yet", booking({ payment: null }), [capture()], undefined, "not_applicable"],
    ["a payment without a capture", booking({ payment: { captureId: null, capturedAt: null } }), [capture()], undefined, "not_applicable"],
    ["the capture listed with the deposit", booking(), [capture()], undefined, "matches"],
    ["the capture and its refund listed", booking(), [capture(), refund()], undefined, "refunded"],
    ["a refund PayPal has not settled", booking(), [capture(), refund({ status: "P" })], undefined, "refunded"],
    ["another capture's refund only", booking(), [capture(), refund({ referenceId: "CAP9" })], undefined, "matches"],
    ["a different amount", booking(), [capture({ amountCents: 2000 })], undefined, "mismatch"],
    ["a different currency", booking(), [capture({ currency: "USD" })], undefined, "mismatch"],
    ["an unreadable amount", booking(), [capture({ amountCents: null })], undefined, "mismatch"],
    ["a denied capture", booking(), [capture({ status: "D" })], undefined, "mismatch"],
    ["a capture PayPal has not settled", booking(), [capture({ status: "P" })], undefined, "pending"],
    ["a fully reversed capture (V) with its refund", booking(), [capture({ status: "V" }), refund()], undefined, "refunded"],
    ["a fully reversed capture (V) whose refund is not listed", booking(), [capture({ status: "V" })], undefined, "refunded"],
    ["a reversed capture of another amount", booking(), [capture({ status: "V", amountCents: 2000 }), refund()], undefined, "mismatch"],
    [
      "not listed, captured after PayPal's refresh",
      booking({ payment: { captureId: "CAP1", capturedAt: "2026-10-08T09:30:00.000Z" } }),
      [],
      undefined,
      "pending",
    ],
    ["not listed and PayPal gave no refresh time", booking(), [], null, "pending"],
    ["not listed, no capture time recorded", booking({ payment: { captureId: "CAP1", capturedAt: null } }), [], undefined, "pending"],
    [
      "not listed, captured before the window",
      booking({ payment: { captureId: "CAP1", capturedAt: "2026-09-01T10:00:00.000Z" } }),
      [],
      undefined,
      "outside_window",
    ],
    ["not listed, inside the window, before the refresh", booking(), [], undefined, "pending"],
  ])("%s -> %s", (_case, subject, entries, refreshedAt, expected) => {
    expect(match(subject, entries, refreshedAt === undefined ? REFRESHED_AT : refreshedAt)).toBe(expected);
  });

  it("answers for every booking, keyed by id", () => {
    const result = matchLedger(
      [booking(), booking({ id: "b2", payment: null }), booking({ id: "b3", payment: { captureId: "CAP3", capturedAt: null } })],
      ledger([capture()]),
      WINDOW_START,
    );

    expect(result).toEqual({ b1: "matches", b2: "not_applicable", b3: "pending" });
  });
});
