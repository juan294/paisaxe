import { describe, it, expect, vi, beforeEach } from "vitest";
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
        "premium.feature_realtime": "Real-time guidance",
        "premium.feature_booking": "Pelayo books restaurants and hotels for you",
        "premium.per_day": "per day",
        "premium.sign_in_to_purchase": "Sign in to purchase",
        "premium.secure_payment": "Secure payment via Stripe",
      };
      return translations[key] || key;
    },
    language: "en",
  }),
}));

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

beforeEach(() => {
  mockSignInWithGoogle.mockClear();
  mockPush.mockReset();
  mockUser = { id: "user-123", email: "test@example.com" };
  mockSession = { access_token: "test-token" };
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
      // Ensure no raw unicode escape sequences are rendered
      expect(screen.queryByText(/\\u[0-9a-f]{4}/i)).not.toBeInTheDocument();
    });

    it("renders feature list", () => {
      render(<VoicePurchaseCTA />);
      expect(screen.getByText("24-hour access")).toBeInTheDocument();
      expect(screen.getByText("Pelayo books restaurants and hotels for you")).toBeInTheDocument();
    });

    it("renders secure payment info", () => {
      render(<VoicePurchaseCTA />);
      expect(screen.getByText("Secure payment via Stripe")).toBeInTheDocument();
    });

    it("shows 'Get Day Pass' button when user is signed in", () => {
      render(<VoicePurchaseCTA />);
      expect(screen.getByRole("button", { name: /Get Day Pass/ })).toBeInTheDocument();
    });

    it("shows 'Sign in to purchase' button when user is not signed in", () => {
      mockUser = null;
      mockSession = null;
      render(<VoicePurchaseCTA />);
      expect(screen.getByRole("button", { name: "Sign in to purchase" })).toBeInTheDocument();
    });

    it("navigates to embedded checkout when clicking purchase button", () => {
      render(<VoicePurchaseCTA />);
      fireEvent.click(screen.getByRole("button", { name: /Get Day Pass/ }));
      expect(mockPush).toHaveBeenCalledWith("/pricing/checkout");
    });

    it("navigates to checkout with returnTo when slug is provided", () => {
      render(<VoicePurchaseCTA returnTo="oviedo-walking-tour" />);
      fireEvent.click(screen.getByRole("button", { name: /Get Day Pass/ }));
      expect(mockPush).toHaveBeenCalledWith("/pricing/checkout?returnTo=oviedo-walking-tour");
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
      expect(screen.getByRole("button", { name: /Get Day Pass.*€1\.99/ })).toBeInTheDocument();
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

  describe("UX-B3: visual identity (green, no amber/yellow)", () => {
    it("uses green palette on the full CTA button (not amber/yellow)", () => {
      render(<VoicePurchaseCTA />);
      const button = screen.getByRole("button", { name: /Get Day Pass/ });
      expect(button.className).toMatch(/from-green-/);
      expect(button.className).not.toMatch(/amber-|yellow-/);
    });

    it("uses green palette on the compact CTA button (not amber/yellow)", () => {
      render(<VoicePurchaseCTA compact />);
      const button = screen.getByRole("button", { name: /Get Day Pass/ });
      expect(button.className).toMatch(/from-green-/);
      expect(button.className).not.toMatch(/amber-|yellow-/);
    });

    it("does not use amber/yellow anywhere in the rendered DOM (full view)", () => {
      const { container } = render(<VoicePurchaseCTA />);
      // No element should reference amber/yellow Tailwind classes after the
      // visual-identity unification (UX-B3). Search the rendered HTML for any
      // class names containing 'amber-' or 'yellow-'.
      const html = container.innerHTML;
      expect(html).not.toMatch(/amber-\d{2,3}/);
      expect(html).not.toMatch(/yellow-\d{2,3}/);
    });
  });
});
