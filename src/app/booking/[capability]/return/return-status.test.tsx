import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const CAPABILITY = "11111111-2222-4333-8444-555555555555.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";
const nav = vi.hoisted(() => ({ search: "token=5O190127TN364715T&PayerID=QYR5Z8XDVJNXQ" }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ capability: CAPABILITY }),
  useSearchParams: () => new URLSearchParams(nav.search),
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

describe("ReturnStatus (PayPal return page)", () => {
  it("captures PayPal's order once with CSRF, even under StrictMode, and links to the booking", async () => {
    mockFetch.mockResolvedValue(json(200, { outcome: "confirmed" }));
    render(
      <StrictMode>
        <ReturnStatus />
      </StrictMode>
    );

    expect(await screen.findByText("booking.page.returnConfirmed")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/booking/payments/capture");
    expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": "csrf-1" } });
    expect(JSON.parse(init.body)).toEqual({ capability: CAPABILITY, orderId: "5O190127TN364715T" });
    expect(screen.getByRole("link", { name: "booking.cards.viewBooking" })).toHaveAttribute("href", `/booking/${CAPABILITY}`);
  });

  it.each([
    [202, "pending", "booking.page.returnPending"],
    [202, "awaiting_approval", "booking.page.returnPending"],
    [409, "slot_gone", "booking.page.returnSlotGone"],
    [409, "mismatch", "booking.page.returnProblem"],
    [409, "compensating", "booking.page.returnProblem"],
    [409, "failed", "booking.page.returnFailed"],
    [500, undefined, "booking.page.returnError"],
    [404, undefined, "booking.page.returnError"],
  ])("a %i %s answer shows %s", async (status, outcome, message) => {
    mockFetch.mockResolvedValue(json(status, outcome ? { outcome } : { error: "x" }));
    render(<ReturnStatus />);
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("shows the in-progress message while the capture runs", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<ReturnStatus />);
    expect(screen.getByText("booking.page.returnConfirming")).toBeInTheDocument();
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
