import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingView } from "@/types/booking-page";

const CAPABILITY = "11111111-2222-4333-8444-555555555555.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";
const nav = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ capability: CAPABILITY }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: "es" }),
}));
vi.mock("@/lib/csrf-client", () => ({ csrfHeaders: () => ({ "x-csrf-token": "csrf-1" }) }));

const { BookingStatus, nextPollDelay } = await import("./booking-status");

const mockFetch = vi.fn();
const assign = vi.fn();

function json(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body };
}

function view(overrides: Partial<BookingView> = {}): BookingView {
  return {
    reference: "RS-ABC123",
    status: "pending_payment",
    experienceTitle: "Paseo por la senda costera",
    slotDate: "2026-11-21",
    slotTime: "10:00",
    partySize: 4,
    totalCents: 12000,
    depositCents: 3000,
    balanceCents: 9000,
    currency: "EUR",
    cancellationWindowHours: 24,
    holdExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    payment: null,
    ...overrides,
  };
}

const confirming = () => view({ payment: { status: "capture_pending", orderId: "ORDER-1", captureId: null } });

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("location", { ...window.location, assign });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("nextPollDelay", () => {
  it("polls every 5 s for two minutes, then every 30 s for 15 minutes, then stops", () => {
    expect(nextPollDelay(0)).toBe(5_000);
    expect(nextPollDelay(119_999)).toBe(5_000);
    expect(nextPollDelay(120_000)).toBe(30_000);
    expect(nextPollDelay(17 * 60_000 - 1)).toBe(30_000);
    expect(nextPollDelay(17 * 60_000)).toBeNull();
  });
});

describe("BookingStatus", () => {
  it("loads the booking through the capability API and shows the pay state", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view()));
    render(<BookingStatus />);

    expect(await screen.findByText("Paseo por la senda costera")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith(`/api/booking/bookings/${CAPABILITY}`, expect.objectContaining({ cache: "no-store" }));
    expect(screen.getByText("RS-ABC123")).toBeInTheDocument();
    expect(screen.getByText("booking.page.payIntro")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "booking.cards.pay" })).toBeEnabled();
  });

  it("shows the not-found state for a capability the API does not know", async () => {
    mockFetch.mockResolvedValueOnce(json(404, { error: "Not found" }));
    render(<BookingStatus />);
    expect(await screen.findByText("booking.page.notFound")).toBeInTheDocument();
  });

  it("the pay button starts the order with CSRF and sends the visitor to PayPal", async () => {
    mockFetch
      .mockResolvedValueOnce(json(200, view()))
      .mockResolvedValueOnce(json(200, { approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=T1", amountCents: 3000, currency: "EUR", expiresAt: "x" }));
    render(<BookingStatus />);

    fireEvent.click(await screen.findByRole("button", { name: "booking.cards.pay" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://www.sandbox.paypal.com/checkoutnow?token=T1"));
    const [url, init] = mockFetch.mock.calls[1];
    expect(url).toBe(`/api/booking/bookings/${CAPABILITY}/payment`);
    expect(init).toMatchObject({ method: "POST", headers: { "x-csrf-token": "csrf-1" } });
  });

  it.each([
    [409, "hold_expired", "booking.page.holdExpired"],
    [503, "payment_unavailable", "booking.page.paymentUnavailable"],
    [500, "x", "booking.page.payFailed"],
  ])("a %i %s from the pay call shows its message", async (status, error, message) => {
    mockFetch.mockResolvedValueOnce(json(200, view())).mockResolvedValueOnce(json(status, { error }));
    render(<BookingStatus />);

    fireEvent.click(await screen.findByRole("button", { name: "booking.cards.pay" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it("a stale page whose payment is already in progress switches to confirming, with no error", async () => {
    mockFetch
      .mockResolvedValueOnce(json(200, view()))
      .mockResolvedValueOnce(json(409, { error: "payment_in_progress" }))
      .mockResolvedValue(json(200, confirming()));
    render(<BookingStatus />);

    fireEvent.click(await screen.findByRole("button", { name: "booking.cards.pay" }));

    expect(await screen.findByText("booking.page.confirming")).toBeInTheDocument();
    expect(screen.queryByText("booking.page.payFailed")).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it("a lapsed hold replaces the pay button with the way back to the assistant", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view({ holdExpiresAt: new Date(Date.now() - 1_000).toISOString() })));
    render(<BookingStatus />);

    expect(await screen.findByText("booking.page.holdExpired")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "booking.cards.pay" })).toBeNull();
    expect(screen.getByRole("link", { name: "booking.page.backToChat" })).toHaveAttribute("href", "/immersive?booking=1");
  });

  it("after a cancel at PayPal (?cancelled=1) says so and still offers to pay", async () => {
    nav.search = "cancelled=1";
    mockFetch.mockResolvedValueOnce(json(200, view()));
    render(<BookingStatus />);

    expect(await screen.findByText("booking.page.cancelled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "booking.cards.pay" })).toBeInTheDocument();
  });

  it("shows the receipt with the order and capture ids once confirmed", async () => {
    mockFetch.mockResolvedValueOnce(json(200, view({ status: "confirmed", holdExpiresAt: null, payment: { status: "captured", orderId: "ORDER-1", captureId: "CAP-1" } })));
    render(<BookingStatus />);

    expect(await screen.findByText("booking.page.confirmedTitle")).toBeInTheDocument();
    expect(screen.getByText("ORDER-1")).toBeInTheDocument();
    expect(screen.getByText("CAP-1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "booking.cards.pay" })).toBeNull();
  });

  it.each([
    ["expired", "booking.page.expiredBody"],
    ["needs_attention", "booking.page.attentionBody"],
    ["refund_pending", "booking.page.refundingBody"],
    ["refunded", "booking.page.refundedBody"],
    ["cancelled", "booking.page.cancelledBody"],
  ])("renders the %s state", async (status, message) => {
    mockFetch.mockResolvedValueOnce(json(200, view({ status, holdExpiresAt: null })));
    render(<BookingStatus />);
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("while confirming, polls every 5 s, switches to 30 s at two minutes and stops when confirmed", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    mockFetch.mockResolvedValue(json(200, confirming()));
    render(<BookingStatus />);
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByText("booking.page.confirming")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(mockFetch).toHaveBeenCalledTimes(2);

    await act(() => vi.advanceTimersByTimeAsync(115_000)); // two minutes since confirming began
    const atTwoMinutes = mockFetch.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(29_000));
    expect(mockFetch).toHaveBeenCalledTimes(atTwoMinutes);
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(mockFetch).toHaveBeenCalledTimes(atTwoMinutes + 1);

    mockFetch.mockResolvedValue(json(200, view({ status: "confirmed", holdExpiresAt: null, payment: { status: "captured", orderId: "ORDER-1", captureId: "CAP-1" } })));
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(screen.getByText("booking.page.confirmedTitle")).toBeInTheDocument();
    const settled = mockFetch.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(120_000));
    expect(mockFetch).toHaveBeenCalledTimes(settled);
  });

  it("the refresh button reloads the booking on demand", async () => {
    mockFetch.mockResolvedValue(json(200, confirming()));
    render(<BookingStatus />);

    fireEvent.click(await screen.findByRole("button", { name: "booking.page.refresh" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });
});
