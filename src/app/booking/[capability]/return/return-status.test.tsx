import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CAPABILITY = "11111111-2222-4333-8444-555555555555.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";
const nav = vi.hoisted(() => ({ search: "token=5O190127TN364715T&PayerID=QYR5Z8XDVJNXQ" }));
const replace = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useParams: () => ({ capability: CAPABILITY }),
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace }),
}));
vi.mock("@/lib/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/csrf-client", () => ({ csrfHeaders: () => ({ "x-csrf-token": "csrf-1" }) }));

const { ReturnStatus } = await import("./return-status");

const mockFetch = vi.fn();
const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "token=5O190127TN364715T&PayerID=QYR5Z8XDVJNXQ";
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ReturnStatus (PayPal return page)", () => {
  it("captures PayPal's order once with CSRF, even under StrictMode, and hands over to the paid booking (D7)", async () => {
    mockFetch.mockResolvedValue(json(200, { outcome: "confirmed" }));
    render(
      <StrictMode>
        <ReturnStatus />
      </StrictMode>
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/booking/${CAPABILITY}?paid=1`));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/booking/payments/capture");
    expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": "csrf-1" } });
    expect(JSON.parse(init.body)).toEqual({ capability: CAPABILITY, orderId: "5O190127TN364715T" });
  });

  it.each(["pending", "awaiting_approval"])("a 202 %s hands over to the booking page, which keeps polling (D7)", async (outcome) => {
    mockFetch.mockResolvedValue(json(202, { outcome }));
    render(<ReturnStatus />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/booking/${CAPABILITY}`));
  });

  it.each([
    [409, "slot_gone", "booking.page.returnSlotGone"],
    [409, "mismatch", "booking.page.returnProblem"],
    [409, "compensating", "booking.page.returnProblem"],
    [409, "failed", "booking.page.returnFailed"],
    [500, undefined, "booking.page.returnError"],
    [404, undefined, "booking.page.returnError"],
  ])("a %i %s answer shows %s and the way to the booking", async (status, outcome, message) => {
    mockFetch.mockResolvedValue(json(status, outcome ? { outcome } : { error: "x" }));
    render(<ReturnStatus />);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "booking.cards.viewBooking" })).toHaveAttribute("href", `/booking/${CAPABILITY}`);
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows the in-progress message while the capture runs", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<ReturnStatus />);
    expect(screen.getByText("booking.page.returnConfirming")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "booking.cards.viewBooking" })).toBeNull();
  });

  it("a capture that never answers offers the booking after 20 s (stuck state ends with a way out)", async () => {
    vi.useFakeTimers();
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<ReturnStatus />);
    act(() => void vi.advanceTimersByTime(19_999));
    expect(screen.queryByText("booking.page.returnSlow")).toBeNull();
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.getByText("booking.page.returnSlow")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "booking.cards.viewBooking" })).toHaveAttribute("href", `/booking/${CAPABILITY}`);
  });

  it("without PayPal's token it does not call the API", async () => {
    nav.search = "";
    render(<ReturnStatus />);
    expect(await screen.findByText("booking.page.returnError")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("a network failure shows the error with the link to the booking", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<ReturnStatus />);
    expect(await screen.findByText("booking.page.returnError")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "booking.cards.viewBooking" })).toBeInTheDocument();
  });
});
