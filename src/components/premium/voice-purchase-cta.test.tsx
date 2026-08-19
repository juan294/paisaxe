import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VoicePurchaseCTA } from "./voice-purchase-cta";
import { DEFAULT_TIER } from "@/lib/pricing";

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

    // UX-M7 (#900): "secure payment" copy sits directly under the purchase
    // button and is meant to reduce purchase anxiety — it computed to
    // roughly 2.8:1 contrast at text-white/50, well below the 4.5:1 AA
    // floor, undermining its own purpose if illegible in daylight.
    it("renders the secure payment copy at a contrast-safe opacity (not text-white/50 or lower)", () => {
      render(<VoicePurchaseCTA />);
      const secureText = screen.getByText("Secure payment via Stripe");
      expect(secureText.className).not.toMatch(/text-white\/(0|10|20|30|40|50)\b/);
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

    it("navigates to checkout with explicit tier=day_pass (UX-H2)", () => {
      // Regression guard: checkout URL must always carry ?tier= so the
      // checkout page never silently defaults to an unknown product.
      render(<VoicePurchaseCTA />);
      fireEvent.click(screen.getByRole("button", { name: /Get Day Pass/ }));
      expect(mockPush).toHaveBeenCalledWith("/pricing/checkout?tier=day_pass");
    });

    it("navigates to checkout with returnTo and explicit tier when slug is provided", () => {
      render(<VoicePurchaseCTA returnTo="oviedo-walking-tour" />);
      fireEvent.click(screen.getByRole("button", { name: /Get Day Pass/ }));
      expect(mockPush).toHaveBeenCalledWith(
        "/pricing/checkout?returnTo=oviedo-walking-tour&tier=day_pass"
      );
    });

    it("calls signInWithGoogle when clicking button without session", () => {
      mockUser = null;
      mockSession = null;
      render(<VoicePurchaseCTA />);
      fireEvent.click(screen.getByRole("button", { name: "Sign in to purchase" }));
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });

    it("preserves returnTo and tier when signing in before purchase", () => {
      mockUser = null;
      mockSession = null;
      render(<VoicePurchaseCTA returnTo="oviedo-walking-tour" />);

      fireEvent.click(screen.getByRole("button", { name: "Sign in to purchase" }));

      expect(mockSignInWithGoogle).toHaveBeenCalledWith(
        "/pricing/checkout?returnTo=oviedo-walking-tour&tier=day_pass"
      );
    });

    it("checkout URL always contains an explicit tier param (UX-H2 regression guard)", () => {
      render(<VoicePurchaseCTA />);
      fireEvent.click(screen.getByRole("button", { name: /Get Day Pass/ }));
      const url: string = mockPush.mock.calls[0]?.[0] ?? "";
      expect(url).toMatch(/[?&]tier=/);
    });

    it("focus-ring offset uses neutral-950 (UX-L1)", () => {
      render(<VoicePurchaseCTA />);
      const button = screen.getByRole("button", { name: /Get Day Pass/ });
      expect(button.className).toMatch(/focus-visible:ring-offset-neutral-950/);
      expect(button.className).not.toMatch(/focus-visible:ring-offset-black/);
    });
  });

  describe("compact view", () => {
    it("renders compact version with different layout", () => {
      render(<VoicePurchaseCTA compact />);
      expect(screen.getByText("Voice chat is locked")).toBeInTheDocument();
    });

    it("renders purchase button with DEFAULT_TIER price in compact mode", () => {
      render(<VoicePurchaseCTA compact />);
      // Price comes from DEFAULT_TIER.price (shared constant), not a hardcoded literal
      const regex = new RegExp(`Get Day Pass.*${DEFAULT_TIER.price.replace("€", "€")}`);
      expect(screen.getByRole("button", { name: regex })).toBeInTheDocument();
    });

    it("compact focus-ring offset uses neutral-950 (UX-L1)", () => {
      render(<VoicePurchaseCTA compact />);
      const button = screen.getByRole("button", { name: /Get Day Pass/ });
      expect(button.className).toMatch(/focus-visible:ring-offset-neutral-950/);
      expect(button.className).not.toMatch(/focus-visible:ring-offset-black/);
    });

    it("compact checkout URL always contains an explicit tier param (UX-H2)", () => {
      render(<VoicePurchaseCTA compact />);
      fireEvent.click(screen.getByRole("button", { name: /Get Day Pass/ }));
      const url: string = mockPush.mock.calls[0]?.[0] ?? "";
      expect(url).toMatch(/[?&]tier=/);
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

  describe("UX-H2: pricing constants (prices come from shared module)", () => {
    it("DEFAULT_TIER.price is €1.99 — single source of truth", () => {
      expect(DEFAULT_TIER.price).toBe("€1.99");
    });

    it("full view price display uses DEFAULT_TIER.price, not a hardcoded string", () => {
      render(<VoicePurchaseCTA />);
      // If pricing.ts changes, this test catches any leftover hardcoded values
      expect(screen.getByText(DEFAULT_TIER.price)).toBeInTheDocument();
    });
  });
});
