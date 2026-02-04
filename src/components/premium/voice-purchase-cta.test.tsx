import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VoicePurchaseCTA } from "./voice-purchase-cta";

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "premium.voice_locked": "Voice chat is locked",
        "premium.get_day_pass": "Get Day Pass",
        "premium.voice_title": "Unlock Voice Chat",
        "premium.voice_description": "Talk naturally with our AI guides",
        "premium.feature_24h": "24-hour access",
        "premium.feature_unlimited": "Unlimited conversations",
        "premium.feature_realtime": "Real-time guidance",
        "premium.per_day": "per day",
        "premium.sign_in_to_purchase": "Sign in to purchase",
        "premium.secure_payment": "Secure payment via Stripe",
      };
      return translations[key] || key;
    },
    language: "en",
  }),
}));

// Mock fetch for checkout API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create mocks
const mockSignInWithGoogle = vi.fn();
let mockUser: { id: string; email: string } | null = { id: "user-123", email: "test@example.com" };
let mockSession: { access_token: string } | null = { access_token: "test-token" };

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: mockUser,
    session: mockSession,
    signInWithGoogle: mockSignInWithGoogle,
  }),
}));

// Mock window.location
const originalLocation = window.location;

beforeEach(() => {
  mockSignInWithGoogle.mockClear();
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ url: "https://checkout.stripe.com/test" }),
  });
  mockUser = { id: "user-123", email: "test@example.com" };
  mockSession = { access_token: "test-token" };

  // Mock window.location
  Object.defineProperty(window, "location", {
    value: {
      ...originalLocation,
      origin: "https://paisaxe.com",
      href: "",
    },
    writable: true,
  });
});

afterAll(() => {
  Object.defineProperty(window, "location", {
    value: originalLocation,
    writable: true,
  });
});

describe("VoicePurchaseCTA", () => {
  describe("full (non-compact) view", () => {
    it("renders the title", () => {
      render(<VoicePurchaseCTA />);
      expect(screen.getByText("Unlock Voice Chat")).toBeInTheDocument();
    });

    it("renders the description", () => {
      render(<VoicePurchaseCTA />);
      expect(screen.getByText("Talk naturally with our AI guides")).toBeInTheDocument();
    });

    it("renders the price", () => {
      render(<VoicePurchaseCTA />);
      expect(screen.getByText("€1.99")).toBeInTheDocument();
      expect(screen.getByText("per day")).toBeInTheDocument();
    });

    it("renders feature list", () => {
      render(<VoicePurchaseCTA />);
      expect(screen.getByText("24-hour access")).toBeInTheDocument();
      expect(screen.getByText("Unlimited conversations")).toBeInTheDocument();
    });

    it("renders secure payment info", () => {
      render(<VoicePurchaseCTA />);
      expect(screen.getByText("Secure payment via Stripe")).toBeInTheDocument();
    });

    it("shows 'Get Day Pass' button when user is signed in", () => {
      render(<VoicePurchaseCTA />);
      expect(screen.getByRole("button", { name: "Get Day Pass" })).toBeInTheDocument();
    });

    it("shows 'Sign in to purchase' button when user is not signed in", () => {
      mockUser = null;
      mockSession = null;
      render(<VoicePurchaseCTA />);
      expect(screen.getByRole("button", { name: "Sign in to purchase" })).toBeInTheDocument();
    });

    it("redirects to checkout when clicking purchase button", async () => {
      render(<VoicePurchaseCTA />);
      fireEvent.click(screen.getByRole("button", { name: "Get Day Pass" }));

      // Wait for fetch to resolve and redirect to happen
      await vi.waitFor(() => {
        expect(window.location.href).toBe("https://checkout.stripe.com/test");
      });
    });

    it("calls signInWithGoogle when clicking button without session", () => {
      mockUser = null;
      mockSession = null;
      render(<VoicePurchaseCTA />);
      fireEvent.click(screen.getByRole("button", { name: "Sign in to purchase" }));
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });
  });

  describe("compact view", () => {
    it("renders compact version with different layout", () => {
      render(<VoicePurchaseCTA compact />);
      expect(screen.getByText("Voice chat is locked")).toBeInTheDocument();
    });

    it("renders purchase button with price in compact mode", () => {
      render(<VoicePurchaseCTA compact />);
      expect(screen.getByRole("button", { name: /Get Day Pass.*€1.99/ })).toBeInTheDocument();
    });

    it("does not render title in compact mode", () => {
      render(<VoicePurchaseCTA compact />);
      expect(screen.queryByText("Unlock Voice Chat")).not.toBeInTheDocument();
    });

    it("does not render feature list in compact mode", () => {
      render(<VoicePurchaseCTA compact />);
      expect(screen.queryByText("24-hour access")).not.toBeInTheDocument();
    });
  });

  describe("custom className", () => {
    it("applies custom className in full view", () => {
      const { container } = render(<VoicePurchaseCTA className="custom-class" />);
      expect(container.firstChild).toHaveClass("custom-class");
    });

    it("applies custom className in compact view", () => {
      const { container } = render(<VoicePurchaseCTA compact className="custom-class" />);
      expect(container.firstChild).toHaveClass("custom-class");
    });
  });

  // Note: Testing the "Lemon Squeezy not configured" case would require module isolation
  // which is complex with vi.mock. The path is covered by manual inspection as it simply
  // logs an error and returns early. The other tests cover the happy path adequately.
});
