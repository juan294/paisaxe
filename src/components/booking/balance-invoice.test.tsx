import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key, locale: "es" }) }));

const { BalanceInvoiceStatusView } = await import("./balance-invoice");

describe("BalanceInvoiceStatusView", () => {
  it("offers the balance as a PayPal-gold button that opens PayPal in a new tab (U11)", () => {
    render(<BalanceInvoiceStatusView status="sent" url="https://www.sandbox.paypal.com/invoice/p/#INV2" />);
    const link = screen.getByRole("link", { name: "booking.invoice.pay" });
    expect(link).toHaveClass("bg-[#FFC439]");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("offers no link once nothing is due", () => {
    render(<BalanceInvoiceStatusView status="paid" url="https://www.sandbox.paypal.com/invoice/p/#INV2" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("booking.invoice.status.paid")).toBeInTheDocument();
  });
});
