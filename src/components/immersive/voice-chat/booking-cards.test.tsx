import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BookingCard } from "@/types/booking-cards";
import { BookingCards } from "./booking-cards";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: "es",
  }),
}));

const QUOTE_ID = "99999999-2222-4333-8444-555555555555";
const quote: BookingCard = {
  kind: "quote",
  quoteId: QUOTE_ID,
  version: 1,
  experienceTitle: "Paseo por la senda costera",
  slotDate: "2026-11-21",
  slotTime: "10:00",
  partySize: 4,
  totalCents: 12000,
  depositCents: 3000,
  balanceCents: 9000,
  currency: "EUR",
  cancellationWindowHours: 24,
  expiresAt: "2026-11-20T09:20:00.000Z",
  accepted: false,
};

function renderCards(cards: BookingCard[], quoteStates = {}, busy = false) {
  const onAccept = vi.fn();
  const onRequote = vi.fn();
  render(<BookingCards cards={cards} quoteStates={quoteStates} onAccept={onAccept} onRequote={onRequote} busy={busy} />);
  return { onAccept, onRequote };
}

describe("BookingCards", () => {
  it("shows the quote's total, deposit now and balance later, labelled as demo, and accepts with the button", () => {
    const { onAccept } = renderCards([quote]);

    expect(screen.getByText("Paseo por la senda costera")).toBeInTheDocument();
    expect(screen.getByText(/120,00/)).toBeInTheDocument();
    expect(screen.getByText(/30,00/)).toBeInTheDocument();
    expect(screen.getByText(/90,00/)).toBeInTheDocument();
    expect(screen.getAllByText("booking.cards.demo").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "booking.cards.accept" }));
    expect(onAccept).toHaveBeenCalledWith(QUOTE_ID);
  });

  it("shows the slot as a readable day and accepts with the brand button (U01, U03)", () => {
    renderCards([quote]);
    expect(screen.queryByText(/2026-11-21/)).toBeNull();
    expect(screen.getByText(/21 nov/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "booking.cards.accept" })).toHaveClass("from-paisaxe-green-500");
  });

  it("labels cards with one quiet neutral chip, not an amber badge (U08)", () => {
    renderCards([quote]);
    const chip = screen.getByText("booking.cards.demo");
    expect(chip).toHaveClass("bg-white/10");
    expect(chip).not.toHaveClass("bg-amber-400/20");
  });

  it("disables the accept button while accepting", () => {
    renderCards([quote], { [QUOTE_ID]: "accepting" });
    expect(screen.getByRole("button", { name: "booking.cards.accepting" })).toBeDisabled();
  });

  it.each([
    ["expired", "booking.cards.expired"],
    ["noCapacity", "booking.cards.noCapacity"],
  ])("a %s quote explains why and offers a new quote instead of accepting", (state, message) => {
    const { onRequote, onAccept } = renderCards([quote], { [QUOTE_ID]: state });

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "booking.cards.accept" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "booking.cards.requote" }));
    expect(onRequote).toHaveBeenCalled();
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("shows the booking reference, its status and the link to the booking page", () => {
    renderCards([{ kind: "booking", bookingId: "b1", reference: "RS-ABC123", status: "pending_payment", link: "/booking/b1.tok" }]);

    expect(screen.getByText(/RS-ABC123/)).toBeInTheDocument();
    expect(screen.getByText("booking.cards.status.pending_payment")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "booking.cards.viewBooking" })).toHaveAttribute("href", "/booking/b1.tok");
  });

  it("lists offer options with suitability and an unconfirmed notice for unknown facts", () => {
    renderCards([
      {
        kind: "offer",
        options: [
          {
            experienceId: "e1",
            title: "Ruta de miradores en 4x4",
            priceCents: 20000,
            depositCents: 5000,
            currency: "EUR",
            maxParty: 6,
            suitability: "rejected",
            reasons: ["over_budget"],
            verdicts: [{ key: "step_free", verdict: "unknown", detail: "Sin confirmar", confirmedByProvider: false }],
            slots: [],
          },
        ],
      },
    ]);

    expect(screen.getByText("Ruta de miradores en 4x4")).toBeInTheDocument();
    expect(screen.getByText("booking.cards.suitability.rejected")).toBeInTheDocument();
    expect(screen.getByText("booking.cards.reason.over_budget")).toBeInTheDocument();
    expect(screen.getByText(/booking.cards.verdict.unknown/)).toBeInTheDocument();
  });

  it("a cancellation card offers the confirm button with the refund it shows", () => {
    renderCards([
      {
        kind: "cancellation",
        bookingId: "b1",
        capability: "11111111-2222-4333-8444-555555555555.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde",
        refundCents: 3000,
        depositCents: 3000,
        currency: "EUR",
        cancellationWindowHours: 24,
        slotStart: "2026-11-21T09:00:00.000Z",
        termsValidUntil: "2026-11-20T09:00:00.000Z",
      },
    ]);

    expect(screen.getByText("booking.cards.cancellationTitle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "booking.cancel.confirmRefund" })).toBeEnabled();
  });

  it("labels a payment card as PayPal sandbox, with the hold's expiry", () => {
    renderCards([
      {
        kind: "payment",
        bookingId: "b1",
        approvalUrl: "https://www.sandbox.paypal.com/checkoutnow?token=x",
        amountCents: 3000,
        currency: "EUR",
        expiresAt: "2026-11-20T09:20:00.000Z",
      },
    ]);

    // One "Demo · sandbox" chip replaces the demo badge and the sandbox paragraph (plan D3).
    expect(screen.getByText("booking.cards.demoSandbox")).toBeInTheDocument();
    expect(screen.queryByText("booking.cards.sandbox")).toBeNull();
    expect(screen.queryByText("booking.cards.demo")).toBeNull();
    expect(screen.getByText("booking.cards.payBefore")).toBeInTheDocument();
    // Still a link named "Pagar con PayPal" (E2E selector, D5), now a PayPal-gold button with the logo (U02).
    const pay = screen.getByRole("link", { name: "booking.cards.pay" });
    expect(pay).toHaveAttribute("href", "https://www.sandbox.paypal.com/checkoutnow?token=x");
    expect(pay).toHaveClass("bg-[#FFC439]");
    expect(screen.getByAltText("PayPal")).toBeInTheDocument();
  });

  it("disables accept and re-quote while a turn is streaming", () => {
    renderCards([quote], {}, true);
    expect(screen.getByRole("button", { name: "booking.cards.accept" })).toBeDisabled();
  });

  it("announces a lapsed quote and disables re-quote while busy", () => {
    renderCards([quote], { [QUOTE_ID]: "expired" }, true);
    expect(screen.getByText("booking.cards.expired").closest("[aria-live]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "booking.cards.requote" })).toBeDisabled();
  });

  it("opens the booking link in a new tab without a referrer", () => {
    renderCards([{ kind: "booking", bookingId: "b1", reference: "RS-ABC123", status: "pending_payment", link: "/booking/b1.tok" }]);
    const link = screen.getByRole("link", { name: "booking.cards.viewBooking" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveClass("bg-white/10");
  });
  describe("invoice card (Phase 8a)", () => {
    const INVOICE_URL = "https://www.sandbox.paypal.com/invoice/p/#INV2-1";
    const invoiceCard = (status: "draft" | "sent" | "payment_pending" | "partially_paid" | "paid" | "cancelled", invoiceUrl: string | null = INVOICE_URL): BookingCard => ({
      kind: "invoice",
      bookingId: "b1",
      reference: "RS-ABC123",
      amountCents: 9000,
      currency: "EUR",
      dueDate: "2026-11-21",
      status,
      invoiceUrl,
    });

    it("shows the balance, its due date and status, and the PayPal link in a new tab without a referrer", () => {
      renderCards([invoiceCard("sent")]);

      expect(screen.getByText("booking.invoice.title RS-ABC123")).toBeInTheDocument();
      expect(screen.getByText(/90,00/)).toBeInTheDocument();
      expect(screen.getByText("booking.invoice.dueOn")).toBeInTheDocument();
      expect(screen.getByText("booking.invoice.status.sent")).toBeInTheDocument();
      expect(screen.getByText("booking.cards.demoSandbox")).toBeInTheDocument();
      expect(screen.queryByText("booking.cards.sandbox")).toBeNull();
      const link = screen.getByRole("link", { name: "booking.invoice.pay" });
      expect(link).toHaveAttribute("href", INVOICE_URL);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("keeps the link for a partially paid invoice (there is still a balance due)", () => {
      renderCards([invoiceCard("partially_paid")]);
      expect(screen.getByText("booking.invoice.status.partially_paid")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "booking.invoice.pay" })).toBeInTheDocument();
    });

    it.each(["paid", "payment_pending", "cancelled"] as const)("offers no payment link for a %s invoice", (status) => {
      renderCards([invoiceCard(status)]);
      expect(screen.getByText(`booking.invoice.status.${status}`)).toBeInTheDocument();
      expect(screen.queryByRole("link")).toBeNull();
    });

    it("offers no link while the invoice is a draft without one", () => {
      renderCards([invoiceCard("draft", null)]);
      expect(screen.getByText("booking.invoice.status.draft")).toBeInTheDocument();
      expect(screen.queryByRole("link")).toBeNull();
    });
  });
});

