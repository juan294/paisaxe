import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatUpsellCTA } from "./chat-upsell-cta";
import { createMockT } from "@/test/i18n-mock";
import { MIN_PRICE } from "@/lib/pricing";

// Mock i18n
const mockT = createMockT();
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "es",
    setLocale: vi.fn(),
    t: (key: string) => mockT(key),
  }),
}));

// Mock useAuth
const mockSignInWithGoogle = vi.fn();
const mockAuthValues = {
  user: null as { id: string; email: string } | null,
  session: null as { access_token: string } | null,
  isLoading: false,
  signInWithGoogle: mockSignInWithGoogle,
  signOut: vi.fn(),
};

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockAuthValues,
}));

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe("ChatUpsellCTA", () => {
  const defaultProps = {
    reason: "weather" as const,
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockReset();
    mockAuthValues.user = null;
    mockAuthValues.session = null;
  });

  it("renders the upsell CTA with reason-specific messaging", () => {
    render(<ChatUpsellCTA {...defaultProps} />);

    expect(screen.getByText("upsell.weather_title")).toBeInTheDocument();
    expect(screen.getByText("upsell.weather_subtitle")).toBeInTheDocument();
  });

  it("renders the purchase button with MIN_PRICE from shared constant", () => {
    render(<ChatUpsellCTA {...defaultProps} />);

    // Button shows "desde €1.99" — price sourced from @/lib/pricing (UX-H2)
    const button = screen.getByRole("button", { name: /desde/ });
    expect(button).toBeInTheDocument();
    expect(button.textContent).toContain(MIN_PRICE);
    // Ensure no raw unicode escape sequences are rendered
    expect(screen.queryByText(/\\u[0-9a-f]{4}/i)).not.toBeInTheDocument();
  });

  it("calls onDismiss when dismiss button is clicked", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();

    render(<ChatUpsellCTA {...defaultProps} onDismiss={onDismiss} />);

    await user.click(screen.getByLabelText("Cerrar"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("triggers sign in with /pricing returnTo when user is not logged in", async () => {
    const user = userEvent.setup();
    render(<ChatUpsellCTA {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /desde/ }));

    expect(mockSignInWithGoogle).toHaveBeenCalledWith("/pricing");
  });

  it("navigates to /pricing (tier selector) when user is logged in", async () => {
    // UX-H2: CTA goes to /pricing so the user can select a tier.
    // The pricing page always carries an explicit ?tier= to checkout.
    mockAuthValues.user = { id: "user-1", email: "test@example.com" };
    mockAuthValues.session = { access_token: "token-123" };

    const user = userEvent.setup();
    render(<ChatUpsellCTA {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /desde/ }));

    expect(mockPush).toHaveBeenCalledWith("/pricing");
  });

  it("does NOT deep-link directly to /pricing/checkout without a tier", async () => {
    // Regression guard for UX-H2: the checkout URL must always carry ?tier=
    // but from the upsell CTA we go via /pricing (tier selector) instead.
    mockAuthValues.user = { id: "user-1", email: "test@example.com" };
    mockAuthValues.session = { access_token: "token-123" };

    const user = userEvent.setup();
    render(<ChatUpsellCTA {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /desde/ }));

    // Must NOT push a /pricing/checkout URL that lacks a tier param
    expect(mockPush).not.toHaveBeenCalledWith("/pricing/checkout");
    const pushArg: string = mockPush.mock.calls[0]?.[0] ?? "";
    if (pushArg.includes("/pricing/checkout")) {
      expect(pushArg).toMatch(/[?&]tier=/);
    }
  });

  it("renders with different upsell reasons", () => {
    const { rerender } = render(<ChatUpsellCTA reason="booking" onDismiss={vi.fn()} />);
    expect(screen.getByText("upsell.booking_title")).toBeInTheDocument();

    rerender(<ChatUpsellCTA reason="realtime" onDismiss={vi.fn()} />);
    expect(screen.getByText("upsell.realtime_title")).toBeInTheDocument();

    rerender(<ChatUpsellCTA reason="slow_typing" onDismiss={vi.fn()} />);
    expect(screen.getByText("upsell.slow_typing_title")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <ChatUpsellCTA {...defaultProps} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("purchase button has visible focus ring for keyboard accessibility (WCAG 2.1 SC 2.4.7)", () => {
    render(<ChatUpsellCTA {...defaultProps} />);

    const purchaseButton = screen.getByRole("button", { name: /desde/ });

    // Must have a visible focus ring
    expect(purchaseButton.className).toMatch(/focus-visible:ring-2/);
    expect(purchaseButton.className).toMatch(/focus-visible:ring-green-200/);
    expect(purchaseButton.className).toMatch(/focus-visible:ring-offset-2/);

    // outline-none is set: ring is the a11y affordance, that's correct
    expect(purchaseButton.className).toMatch(/focus-visible:outline-none/);
  });

  it("purchase button focus-ring offset uses neutral-950 (matches dark bg, UX-L1)", () => {
    render(<ChatUpsellCTA {...defaultProps} />);
    const button = screen.getByRole("button", { name: /desde/ });
    expect(button.className).toMatch(/focus-visible:ring-offset-neutral-950/);
    expect(button.className).not.toMatch(/focus-visible:ring-offset-black/);
  });

  describe("UX-B3: visual identity (green, no amber/yellow)", () => {
    it("uses green palette on the purchase button (not amber/yellow)", () => {
      render(<ChatUpsellCTA {...defaultProps} />);

      const purchaseButton = screen.getByRole("button", { name: /desde/ });
      expect(purchaseButton.className).toMatch(/from-green-/);
      expect(purchaseButton.className).not.toMatch(/amber-|yellow-/);
    });

    it("uses green palette on the container background (not amber/yellow)", () => {
      const { container } = render(<ChatUpsellCTA {...defaultProps} />);

      const root = container.firstChild as HTMLElement;
      expect(root.className).toMatch(/from-green-/);
      expect(root.className).not.toMatch(/amber-|yellow-/);
    });
  });

  describe("UX-H2: pricing constants (prices come from shared module)", () => {
    it("the MIN_PRICE shown in button matches PRICING_TIERS[0].price", () => {
      // Import is live — if pricing.ts changes, the button updates automatically
      expect(MIN_PRICE).toBe("€1.99");
      render(<ChatUpsellCTA {...defaultProps} />);
      const button = screen.getByRole("button", { name: /desde/ });
      expect(button.textContent).toContain("€1.99");
    });
  });
});
