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

  it("labels a payment card as PayPal sandbox", () => {
    renderCards([{ kind: "payment", bookingId: "b1", approvalUrl: "https://www.sandbox.paypal.com/checkoutnow?token=x", amountCents: 3000, currency: "EUR" }]);

    expect(screen.getByText("booking.cards.sandbox")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "booking.cards.pay" })).toHaveAttribute(
      "href",
      "https://www.sandbox.paypal.com/checkoutnow?token=x"
    );
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
  });
});

