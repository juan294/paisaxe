import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CancellationTerms } from "@/types/booking-page";

vi.mock("@/lib/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key, locale: "es" }) }));
vi.mock("@/lib/csrf-client", () => ({ csrfHeaders: () => ({ "x-csrf-token": "csrf-1" }) }));

const { CancellationConfirm } = await import("./cancellation-confirm");

const CAPABILITY = "11111111-2222-4333-8444-555555555555.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";
const mockFetch = vi.fn();
const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

const fullRefund: CancellationTerms = {
  refundCents: 3000,
  depositCents: 3000,
  currency: "EUR",
  cancellationWindowHours: 24,
  slotStart: "2026-11-21T09:00:00.000Z",
  termsValidUntil: "2026-11-20T09:00:00.000Z",
};
const noRefund: CancellationTerms = { ...fullRefund, refundCents: 0, termsValidUntil: null };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
});

describe("CancellationConfirm", () => {
  it("never makes cancelling the loudest control: a red tint, not solid red (U04)", () => {
    render(<CancellationConfirm capability={CAPABILITY} terms={fullRefund} />);
    const button = screen.getByRole("button", { name: "booking.cancel.confirmRefund" });
    expect(button).toHaveClass("bg-red-500/10", "text-red-200");
    expect(button).not.toHaveClass("bg-destructive");
  });

  it("shows the refund and confirms with the refund the visitor saw", async () => {
    const onCancelled = vi.fn();
    mockFetch.mockResolvedValueOnce(json(200, { status: "refund_pending", refundCents: 3000 }));
    render(<CancellationConfirm capability={CAPABILITY} terms={fullRefund} onCancelled={onCancelled} />);

    expect(screen.getByText("booking.cancel.refund")).toBeInTheDocument();
    expect(screen.getByText("booking.cancel.refundUntil")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "booking.cancel.confirmRefund" }));

    await waitFor(() => expect(onCancelled).toHaveBeenCalledWith({ status: "refund_pending", refundCents: 3000 }));
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`/api/booking/bookings/${CAPABILITY}/cancel`);
    expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": "csrf-1" } });
    expect(JSON.parse(init.body)).toEqual({ expectedRefundCents: 3000 });
    expect(screen.getByText("booking.cancel.refundPending")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("on changed terms shows the new refund and needs a second, explicit confirmation of those terms (R2-05)", async () => {
    mockFetch
      .mockResolvedValueOnce(json(409, { error: "terms_changed", terms: noRefund }))
      .mockResolvedValueOnce(json(200, { status: "cancelled", refundCents: 0 }));
    render(<CancellationConfirm capability={CAPABILITY} terms={fullRefund} />);

    fireEvent.click(screen.getByRole("button", { name: "booking.cancel.confirmRefund" }));

    expect(await screen.findByText("booking.cancel.termsChanged")).toBeInTheDocument();
    expect(screen.getByText("booking.cancel.noRefund")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "booking.cancel.confirmNoRefund" }));

    expect(await screen.findByText("booking.cancel.done")).toBeInTheDocument();
    expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({ expectedRefundCents: 0 });
  });

  it("a refund PayPal refused for good says it is being reviewed", async () => {
    const onCancelled = vi.fn();
    mockFetch.mockResolvedValueOnce(json(200, { status: "needs_attention", refundCents: 3000 }));
    render(<CancellationConfirm capability={CAPABILITY} terms={fullRefund} onCancelled={onCancelled} />);

    fireEvent.click(screen.getByRole("button", { name: "booking.cancel.confirmRefund" }));

    expect(await screen.findByText("booking.cancel.refundFailed")).toBeInTheDocument();
    expect(onCancelled).toHaveBeenCalledWith({ status: "needs_attention", refundCents: 3000 });
  });

  it("a 502 says the cancellation is recorded and the refund will be retried", async () => {
    const onCancelled = vi.fn();
    mockFetch.mockResolvedValueOnce(json(502, { error: "refund_unavailable" }));
    render(<CancellationConfirm capability={CAPABILITY} terms={fullRefund} onCancelled={onCancelled} />);

    fireEvent.click(screen.getByRole("button", { name: "booking.cancel.confirmRefund" }));

    expect(await screen.findByText("booking.cancel.retryLater")).toBeInTheDocument();
    expect(onCancelled).toHaveBeenCalledWith({ status: "cancel_pending", refundCents: 3000 });
  });

  it.each([
    [409, { error: "invalid_state" }, "booking.cancel.unavailable"],
    [500, { error: "x" }, "booking.cancel.failed"],
  ])("a %i answer shows its message", async (status, body, message) => {
    mockFetch.mockResolvedValueOnce(json(status, body));
    render(<CancellationConfirm capability={CAPABILITY} terms={fullRefund} />);

    fireEvent.click(screen.getByRole("button", { name: "booking.cancel.confirmRefund" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});
