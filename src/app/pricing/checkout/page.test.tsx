import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CheckoutPage from "./page";

// --- Mocks ---

// Mock Stripe
vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn(() => Promise.resolve({ /* mock Stripe instance */ })),
}));

vi.mock("@stripe/react-stripe-js", () => ({
  EmbeddedCheckoutProvider: ({
    children,
  }: {
    children: React.ReactNode;
    stripe: unknown;
    options: unknown;
  }) => <div data-testid="embedded-checkout-provider">{children}</div>,
  EmbeddedCheckout: () => (
    <div data-testid="embedded-checkout">Stripe Checkout Form</div>
  ),
}));

// Mock hooks
const mockSignInWithGoogle = vi.fn();
const mockUseAuth = vi.fn(() => ({
  user: null as { id: string; email: string } | null,
  session: null as { access_token: string } | null,
  signInWithGoogle: mockSignInWithGoogle,
  isLoading: false,
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock next/navigation
const mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

// Mock fetch for fetchClientSecret
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("CheckoutPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete("returnTo");
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ clientSecret: "cs_test_123" }),
    });
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      signInWithGoogle: mockSignInWithGoogle,
      isLoading: false,
    });
  });

  describe("unauthenticated state", () => {
    it("should show sign-in prompt when user is not authenticated", () => {
      render(<CheckoutPage />);

      expect(
        screen.getByText("premium.sign_in_to_purchase")
      ).toBeInTheDocument();
    });

    it("should render sign-in button with Google OAuth", () => {
      render(<CheckoutPage />);

      const button = screen.getByRole("button", {
        name: "auth.continue_with_google",
      });
      expect(button).toBeInTheDocument();
    });

    it("should trigger Google sign-in with checkout redirect when clicking sign in", () => {
      render(<CheckoutPage />);

      const button = screen.getByRole("button", {
        name: "auth.continue_with_google",
      });
      fireEvent.click(button);

      expect(mockSignInWithGoogle).toHaveBeenCalledWith("/pricing/checkout");
    });

    it("should not render Stripe checkout when unauthenticated", () => {
      render(<CheckoutPage />);

      expect(
        screen.queryByTestId("embedded-checkout-provider")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("embedded-checkout")
      ).not.toBeInTheDocument();
    });
  });

  describe("authenticated state", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-123", email: "test@example.com" },
        session: { access_token: "token-abc" },
        signInWithGoogle: mockSignInWithGoogle,
        isLoading: false,
      });
    });

    it("should render Stripe embedded checkout when authenticated", () => {
      render(<CheckoutPage />);

      expect(
        screen.getByTestId("embedded-checkout-provider")
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("embedded-checkout")
      ).toBeInTheDocument();
    });

    it("should render checkout header with back link", () => {
      render(<CheckoutPage />);

      const backLink = screen.getByRole("link", {
        name: "premium.checkout_back_to_pricing",
      });
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute("href", "/pricing");
    });

    it("should render checkout title", () => {
      render(<CheckoutPage />);

      expect(
        screen.getByText("premium.checkout_title")
      ).toBeInTheDocument();
    });

    it("should not show sign-in prompt when authenticated", () => {
      render(<CheckoutPage />);

      expect(
        screen.queryByText("premium.sign_in_to_purchase")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "auth.continue_with_google" })
      ).not.toBeInTheDocument();
    });
  });

  describe("fetchClientSecret", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-123", email: "test@example.com" },
        session: { access_token: "token-abc" },
        signInWithGoogle: mockSignInWithGoogle,
        isLoading: false,
      });
    });

    it("should render the checkout container with proper ID", () => {
      render(<CheckoutPage />);

      const checkoutContainer = document.querySelector("#checkout");
      expect(checkoutContainer).toBeInTheDocument();
    });
  });

  describe("returnTo parameter", () => {
    it("should not include returnTo in sign-in redirect (always goes to /pricing/checkout)", () => {
      mockSearchParams.set("returnTo", "oviedo-walking-tour");

      render(<CheckoutPage />);

      const button = screen.getByRole("button", {
        name: "auth.continue_with_google",
      });
      fireEvent.click(button);

      // signInWithGoogle is called with the checkout path, not with returnTo
      expect(mockSignInWithGoogle).toHaveBeenCalledWith("/pricing/checkout");

      mockSearchParams.delete("returnTo");
    });
  });

  describe("Stripe key trimming", () => {
    const originalKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    afterEach(() => {
      if (originalKey !== undefined) {
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = originalKey;
      } else {
        delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      }
    });

    it("should trim trailing whitespace/newlines from publishable key", async () => {
      // Simulate the Vercel invisible-character bug
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_abc123\n";

      vi.resetModules();

      const { loadStripe } = await import("@stripe/stripe-js");
      await import("./page");

      expect(loadStripe).toHaveBeenCalledWith("pk_test_abc123");
    });

    it("should handle empty key gracefully", async () => {
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "";

      vi.resetModules();

      const { loadStripe } = await import("@stripe/stripe-js");
      await import("./page");

      expect(loadStripe).toHaveBeenCalledWith("");
    });

    it("should handle whitespace-only key as empty", async () => {
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "  \n  ";

      vi.resetModules();

      const { loadStripe } = await import("@stripe/stripe-js");
      await import("./page");

      expect(loadStripe).toHaveBeenCalledWith("");
    });
  });

  describe("session edge cases", () => {
    it("should show sign-in when user exists but session is null", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-123", email: "test@example.com" },
        session: null,
        signInWithGoogle: mockSignInWithGoogle,
        isLoading: false,
      });

      render(<CheckoutPage />);

      expect(
        screen.getByText("premium.sign_in_to_purchase")
      ).toBeInTheDocument();
    });

    it("should show sign-in when session exists but user is null", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: { access_token: "token" },
        signInWithGoogle: mockSignInWithGoogle,
        isLoading: false,
      });

      render(<CheckoutPage />);

      expect(
        screen.getByText("premium.sign_in_to_purchase")
      ).toBeInTheDocument();
    });
  });
});
