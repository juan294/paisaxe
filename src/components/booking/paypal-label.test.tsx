import { existsSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PAYPAL_LOGO_SRC, PayPalLabel } from "./paypal-label";

describe("PayPalLabel", () => {
  it("renders the prefix and the PayPal logo with alt text for when the image fails", () => {
    render(<PayPalLabel prefix="Pagar con" />);
    expect(screen.getByText("Pagar con")).toBeInTheDocument();
    expect(screen.getByAltText("PayPal")).toHaveAttribute("src", PAYPAL_LOGO_SRC);
  });

  it("keeps the caller's accessible name (D5: 'Pagar con PayPal' stays the button name)", () => {
    render(
      <button type="button" aria-label="booking.cards.pay">
        <PayPalLabel prefix="booking.cards.payWith" />
      </button>
    );
    expect(screen.getByRole("button", { name: "booking.cards.pay" })).toBeInTheDocument();
  });

  it("ships the logo it points at", () => {
    expect(existsSync(join(process.cwd(), "public", PAYPAL_LOGO_SRC))).toBe(true);
  });
});
