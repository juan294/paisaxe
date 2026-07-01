import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import CheckoutPage from "./page";
import { Suspense, type ReactElement } from "react";

// --- Mocks ---

// Mock Stripe
vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn(() => Promise.resolve({ /* mock Stripe instance */ })),
}));

// Capture fetchClientSecret from options so we can invoke it in tests
let capturedFetchClientSecret: (() => Promise<string>) | null = null;
let capturedStripePromise: unknown = null;

vi.mock("@stripe/react-stripe-js", () => ({
  EmbeddedCheckoutProvider: ({
    children,
    stripe,
    options,
  }: {
    children: React.ReactNode;
    stripe: unknown;
    options: { fetchClientSecret: () => Promise<string> };
  }) => {
    capturedFetchClientSecret = options.fetchClientSecret;
    capturedStripePromise = stripe;
    return <div data-testid="embedded-checkout-provider">{children}</div>;
  },
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
const mockUseSearchParams = vi.fn(() => mockSearchParams);
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

// Mock fetch for fetchClientSecret
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("CheckoutPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedFetchClientSecret = null;
    capturedStripePromise = null;
    mockSearchParams.delete("returnTo");
    mockUseSearchParams.mockReturnValue(mockSearchParams);
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
    it("isolates search params behind a route shell when they suspend", () => {
      expect((CheckoutPage() as ReactElement).type).toBe(Suspense);

      mockUseSearchParams.mockImplementation(() => {
        throw new Promise(() => {});
      });

      expect(() => render(<CheckoutPage />)).not.toThrow();
    });

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

    it("should preserve returnTo in Google sign-in redirect", () => {
      mockSearchParams.set("returnTo", "oviedo-walking-tour");
      render(<CheckoutPage />);

      fireEvent.click(screen.getByRole("button", {
        name: "auth.continue_with_google",
      }));

      expect(mockSignInWithGoogle).toHaveBeenCalledWith(
        "/pricing/checkout?returnTo=oviedo-walking-tour"
      );
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

    it("should call /api/checkout/embedded and return client secret on success", async () => {
      render(<CheckoutPage />);

      expect(capturedFetchClientSecret).toBeDefined();
      const secret = await capturedFetchClientSecret!();

      expect(mockFetch).toHaveBeenCalledWith("/api/checkout/embedded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseType: "day_pass" }),
      });
      expect(secret).toBe("cs_test_123");
    });

    it("should include returnTo in request body when search param is set", async () => {
      mockSearchParams.set("returnTo", "oviedo-walking-tour");

      render(<CheckoutPage />);

      expect(capturedFetchClientSecret).toBeDefined();
      await capturedFetchClientSecret!();

      expect(mockFetch).toHaveBeenCalledWith("/api/checkout/embedded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnTo: "oviedo-walking-tour", purchaseType: "day_pass" }),
      });

      mockSearchParams.delete("returnTo");
    });

    it("should forward the selected tier as purchaseType", async () => {
      mockSearchParams.set("tier", "weekly_pass");

      render(<CheckoutPage />);

      expect(capturedFetchClientSecret).toBeDefined();
      await capturedFetchClientSecret!();

      expect(mockFetch).toHaveBeenCalledWith("/api/checkout/embedded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseType: "weekly_pass" }),
      });

      mockSearchParams.delete("tier");
    });

    it("should show error state when fetch returns non-ok response with error body", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Stripe not configured" }),
      });

      render(<CheckoutPage />);

      expect(capturedFetchClientSecret).toBeDefined();

      await act(async () => {
        try {
          await capturedFetchClientSecret!();
        } catch {
          // Expected — the function re-throws after calling setError
        }
      });

      await waitFor(() => {
        expect(screen.getByText("errors.generic_title")).toBeInTheDocument();
      });
      expect(screen.getByText("errors.generic_description")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "errors.retry" })).toBeInTheDocument();
    });

    it("should show error state with HTTP status when response JSON is invalid", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => { throw new Error("invalid json"); },
      });

      render(<CheckoutPage />);

      await act(async () => {
        try {
          await capturedFetchClientSecret!();
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(screen.getByText("errors.generic_title")).toBeInTheDocument();
      });
    });

    it("should show error state when fetch throws a network error", async () => {
      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

      render(<CheckoutPage />);

      await act(async () => {
        try {
          await capturedFetchClientSecret!();
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(screen.getByText("errors.generic_title")).toBeInTheDocument();
      });
    });

    it("falls back to the errors.unknown translation when a non-Error value is thrown (line 69)", async () => {
      // err instanceof Error ? err.message : t("errors.unknown") -- exercise the
      // else branch by rejecting with a plain string instead of an Error instance.
      mockFetch.mockRejectedValue("network down");

      render(<CheckoutPage />);

      let caught: unknown;
      await act(async () => {
        try {
          await capturedFetchClientSecret!();
        } catch (err) {
          caught = err;
        }
      });

      expect(caught).toBe("network down");
      await waitFor(() => {
        expect(screen.getByText("errors.generic_title")).toBeInTheDocument();
      });
    });
  });

  describe("error state and retry", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-123", email: "test@example.com" },
        session: { access_token: "token-abc" },
        signInWithGoogle: mockSignInWithGoogle,
        isLoading: false,
      });
    });

    it("should hide checkout and show error UI with AlertCircle icon", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Server error" }),
      });

      render(<CheckoutPage />);

      await act(async () => {
        try {
          await capturedFetchClientSecret!();
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(screen.queryByTestId("embedded-checkout")).not.toBeInTheDocument();
        expect(screen.getByText("errors.generic_title")).toBeInTheDocument();
      });
    });

    it("should reset error and show checkout again when retry button is clicked", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Temporary error" }),
      });

      render(<CheckoutPage />);

      // Trigger the error
      await act(async () => {
        try {
          await capturedFetchClientSecret!();
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(screen.getByText("errors.generic_title")).toBeInTheDocument();
      });

      // Reset fetch mock for success
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ clientSecret: "cs_test_456" }),
      });

      // Click retry button
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "errors.retry" }));
      });

      // Should show checkout again, not error
      await waitFor(() => {
        expect(screen.queryByText("errors.generic_title")).not.toBeInTheDocument();
        expect(screen.getByTestId("embedded-checkout-provider")).toBeInTheDocument();
        expect(screen.getByTestId("embedded-checkout")).toBeInTheDocument();
      });
    });
  });

  describe("returnTo parameter", () => {
    it("should include returnTo in sign-in redirect", () => {
      mockSearchParams.set("returnTo", "oviedo-walking-tour");

      render(<CheckoutPage />);

      const button = screen.getByRole("button", {
        name: "auth.continue_with_google",
      });
      fireEvent.click(button);

      expect(mockSignInWithGoogle).toHaveBeenCalledWith(
        "/pricing/checkout?returnTo=oviedo-walking-tour"
      );

      mockSearchParams.delete("returnTo");
    });
  });

  describe("lazy Stripe.js loading", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-123", email: "test@example.com" },
        session: { access_token: "token-abc" },
        signInWithGoogle: mockSignInWithGoogle,
        isLoading: false,
      });
    });

    it("should NOT call loadStripe at module import time", async () => {
      vi.resetModules();

      const { loadStripe } = await import("@stripe/stripe-js");
      await import("./page");

      // loadStripe should not be called eagerly at module scope
      expect(loadStripe).not.toHaveBeenCalled();
    });

    it("should call loadStripe lazily when the component renders", async () => {
      vi.resetModules();

      const { loadStripe } = await import("@stripe/stripe-js");
      const mod = await import("./page");
      const Page = mod.default;

      // loadStripe not called yet — only the module was imported
      expect(loadStripe).not.toHaveBeenCalled();

      // Render triggers getStripe() in the authenticated branch
      render(<Page />);

      // After rendering the authenticated checkout, loadStripe should have been called
      expect(loadStripe).toHaveBeenCalledTimes(1);
    });

    it("should pass the lazy stripe promise to EmbeddedCheckoutProvider", () => {
      render(<CheckoutPage />);

      // The captured stripe promise should be a promise (from loadStripe)
      expect(capturedStripePromise).toBeDefined();
      expect(capturedStripePromise).not.toBeNull();
    });

    it("should reuse the same stripe instance on re-render (singleton)", () => {
      const { rerender } = render(<CheckoutPage />);
      const first = capturedStripePromise;

      rerender(<CheckoutPage />);
      const second = capturedStripePromise;

      expect(first).toBe(second);
    });
  });

  describe("Stripe key trimming", () => {
    const originalKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    beforeEach(() => {
      // Ensure authenticated state so getStripe() is called during render
      mockUseAuth.mockReturnValue({
        user: { id: "user-123", email: "test@example.com" },
        session: { access_token: "token-abc" },
        signInWithGoogle: mockSignInWithGoogle,
        isLoading: false,
      });
    });

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
      const mod = await import("./page");

      // Render to trigger lazy loading
      const Page = mod.default;
      render(<Page />);

      expect(loadStripe).toHaveBeenCalledWith("pk_test_abc123");
    });

    it("should handle empty key gracefully", async () => {
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "";

      vi.resetModules();

      const { loadStripe } = await import("@stripe/stripe-js");
      const mod = await import("./page");

      const Page = mod.default;
      render(<Page />);

      expect(loadStripe).toHaveBeenCalledWith("");
    });

    it("should handle whitespace-only key as empty", async () => {
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "  \n  ";

      vi.resetModules();

      const { loadStripe } = await import("@stripe/stripe-js");
      const mod = await import("./page");

      const Page = mod.default;
      render(<Page />);

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
