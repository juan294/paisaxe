import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PayPalLabel } from "./paypal-label";

describe("PayPalLabel", () => {
  it("renders the prefix and PayPal's logo inline, named for assistive technology", () => {
    const { container } = render(<PayPalLabel prefix="Pagar con" />);
    expect(screen.getByText("Pagar con")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "PayPal" })).toBeInTheDocument();
    // Inline: nothing to fetch, so nothing that can fail to load (e.g. in Claude Design).
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelectorAll("svg path")).toHaveLength(7);
    // Overrides the Button's [&_svg]:size-4, which would shrink the logo to 16px.
    expect(screen.getByRole("img", { name: "PayPal" })).toHaveClass("h-[18px]!", "w-16!");
  });

  it("keeps the caller's accessible name (D5: 'Pagar con PayPal' stays the button name)", () => {
    render(
      <button type="button" aria-label="booking.cards.pay">
        <PayPalLabel prefix="booking.cards.payWith" />
      </button>
    );
    expect(screen.getByRole("button", { name: "booking.cards.pay" })).toBeInTheDocument();
  });
});
