import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key, locale: "es" }) }));

const { PaymentReceipt } = await import("./payment-receipt");

const writeText = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("PaymentReceipt (U10)", () => {
  it("lists only the PayPal ids that exist, under the receipt title", () => {
    render(<PaymentReceipt payment={{ status: "captured", orderId: "ORDER-1", captureId: "CAP-1", refundId: null }} />);
    expect(screen.getByRole("heading", { name: "booking.page.receiptTitle" })).toBeInTheDocument();
    expect(screen.getByText("ORDER-1")).toBeInTheDocument();
    expect(screen.getByText("CAP-1")).toBeInTheDocument();
    expect(screen.queryByText("booking.cancel.refundId")).not.toBeInTheDocument();
  });

  it("renders nothing without any id", () => {
    const { container } = render(<PaymentReceipt payment={{ status: "created", orderId: null, captureId: null, refundId: null }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("copies an id and says so for two seconds", async () => {
    vi.useFakeTimers();
    writeText.mockResolvedValue(undefined);
    render(<PaymentReceipt payment={{ status: "refunded", orderId: "ORDER-1", captureId: "CAP-1", refundId: "RF-1" }} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "booking.page.copy booking.cancel.refundId" }));
    });
    expect(writeText).toHaveBeenCalledWith("RF-1");
    // Shown on the button and announced in the live region.
    expect(screen.getAllByText("booking.page.copied")).toHaveLength(2);
    act(() => void vi.advanceTimersByTime(2000));
    expect(screen.queryByText("booking.page.copied")).not.toBeInTheDocument();
  });

  it("tells the visitor to select the id when the browser refuses the clipboard (stuck-state disclosure)", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(<PaymentReceipt payment={{ status: "captured", orderId: "ORDER-1", captureId: null, refundId: null }} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "booking.page.copy booking.page.orderId" }));
    });
    expect(screen.getByText("booking.page.copyFailed")).toBeInTheDocument();
    expect(screen.getByText("ORDER-1")).toHaveClass("select-all");
  });

  it("explains the same way when there is no clipboard at all", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    render(<PaymentReceipt payment={{ status: "captured", orderId: "ORDER-1", captureId: null, refundId: null }} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "booking.page.copy booking.page.orderId" }));
    });
    expect(screen.getByText("booking.page.copyFailed")).toBeInTheDocument();
  });
});
