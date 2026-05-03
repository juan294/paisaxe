import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PricingPage from "./page";
import { Suspense, type ReactElement } from "react";

// Mock hooks
const mockSignInWithGoogle = vi.fn();
const mockRefresh = vi.fn();
const mockUseAuth = vi.fn(() => ({
  user: null as { id: string; email: string } | null,
  session: null as { access_token: string } | null,
  signInWithGoogle: mockSignInWithGoogle,
  isLoading: false,
}));

const mockUseVoiceAccess = vi.fn(() => ({
  hasAccess: false,
  isWhitelisted: false,
  canUseVoice: false,
  needsSignIn: false,
  needsPurchase: true,
  expiresAt: null as Date | null,
  hoursUntilExpiry: null as number | null,
  agentId: "test-agent",
  isLoading: false,
  refresh: mockRefresh,
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/hooks/use-voice-access", () => ({
  useVoiceAccess: () => mockUseVoiceAccess(),
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
  }) => <a href={href} {...rest}>{children}</a>,
}));

// Mock next/navigation
const mockPush = vi.fn();
const mockUseSearchParams = vi.fn(() => new URLSearchParams());
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockUseSearchParams(),
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe("PricingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockReset();
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      signInWithGoogle: mockSignInWithGoogle,
      isLoading: false,
    });
    mockUseVoiceAccess.mockReturnValue({
      hasAccess: false,
      isWhitelisted: false,
      canUseVoice: false,
      needsSignIn: false,
      needsPurchase: true,
      expiresAt: null,
      hoursUntilExpiry: null,
      agentId: "test-agent",
      isLoading: false,
      refresh: mockRefresh,
    });
  });

  it("should render static content even during loading", () => {
    mockUseVoiceAccess.mockReturnValue({
      hasAccess: false,
      isWhitelisted: false,
      canUseVoice: false,
      needsSignIn: false,
      needsPurchase: true,
      expiresAt: null,
      hoursUntilExpiry: null,
      agentId: "test-agent",
      isLoading: true,
      refresh: mockRefresh,
    });

    render(<PricingPage />);

    // Static content should render immediately
    expect(screen.getByText("premium.pricing_title")).toBeInTheDocument();
    expect(screen.getByText("€1.99")).toBeInTheDocument();
    expect(screen.getByText("premium.faq_title")).toBeInTheDocument();
    expect(screen.getByText("premium.feature_24h")).toBeInTheDocument();
  });

  it("isolates search params behind a route shell when they suspend", () => {
    expect((PricingPage() as ReactElement).type).toBe(Suspense);

    mockUseSearchParams.mockImplementation(() => {
      throw new Promise(() => {});
    });

    expect(() => render(<PricingPage />)).not.toThrow();
  });

  it("should show disabled button with spinner during loading", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-123", email: "test@example.com" },
      session: { access_token: "token" },
      signInWithGoogle: mockSignInWithGoogle,
      isLoading: false,
    });
    mockUseVoiceAccess.mockReturnValue({
      hasAccess: false,
      isWhitelisted: false,
      canUseVoice: false,
      needsSignIn: false,
      needsPurchase: true,
      expiresAt: null,
      hoursUntilExpiry: null,
      agentId: "test-agent",
      isLoading: true,
      refresh: mockRefresh,
    });

    render(<PricingPage />);

    // CTA button should be disabled with spinner
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    const spinner = button.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("keeps the anonymous sign-in CTA usable while access checks are still resolving", () => {
    mockUseVoiceAccess.mockReturnValue({
      hasAccess: false,
      isWhitelisted: false,
      canUseVoice: false,
      needsSignIn: true,
      needsPurchase: false,
      expiresAt: null,
      hoursUntilExpiry: null,
      agentId: "",
      isLoading: true,
      refresh: mockRefresh,
    });

    render(<PricingPage />);

    const button = screen.getByRole("button", { name: "premium.sign_in_to_purchase" });
    expect(button).not.toBeDisabled();
    expect(button.querySelector(".animate-spin")).not.toBeInTheDocument();
  });

  it("should not show access banner during loading", () => {
    mockUseVoiceAccess.mockReturnValue({
      hasAccess: false,
      isWhitelisted: false,
      canUseVoice: false,
      needsSignIn: false,
      needsPurchase: true,
      expiresAt: null,
      hoursUntilExpiry: null,
      agentId: "test-agent",
      isLoading: true,
      refresh: mockRefresh,
    });

    render(<PricingPage />);

    expect(screen.queryByText("premium.success_subtitle")).not.toBeInTheDocument();
  });

  it("should render pricing page with price", () => {
    render(<PricingPage />);

    expect(screen.getByText("premium.pricing_title")).toBeInTheDocument();
    expect(screen.getByText("€1.99")).toBeInTheDocument();
    expect(screen.getByText("premium.voice_pass_label")).toBeInTheDocument();
    // Ensure no raw unicode escape sequences are rendered
    expect(screen.queryByText(/\\u[0-9a-f]{4}/i)).not.toBeInTheDocument();
  });

  it("should show sign in button when user not authenticated", () => {
    render(<PricingPage />);

    expect(
      screen.getByRole("button", { name: "premium.sign_in_to_purchase" })
    ).toBeInTheDocument();
  });

  it("should trigger sign in when clicking purchase without auth", () => {
    render(<PricingPage />);

    const button = screen.getByRole("button", {
      name: "premium.sign_in_to_purchase",
    });
    fireEvent.click(button);

    expect(mockSignInWithGoogle).toHaveBeenCalledWith("/pricing");
  });

  it("should show purchase button when user is authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-123", email: "test@example.com" },
      session: { access_token: "token" },
      signInWithGoogle: mockSignInWithGoogle,
      isLoading: false,
    });

    render(<PricingPage />);

    expect(
      screen.getByRole("button", { name: "premium.pricing_cta" })
    ).toBeInTheDocument();
  });

  it("should show already has access message when canUseVoice is true", () => {
    mockUseVoiceAccess.mockReturnValue({
      hasAccess: true,
      isWhitelisted: false,
      canUseVoice: true,
      needsSignIn: false,
      needsPurchase: false,
      expiresAt: new Date("2024-12-31T23:59:59Z"),
      hoursUntilExpiry: 24,
      agentId: "test-agent",
      isLoading: false,
      refresh: mockRefresh,
    });

    render(<PricingPage />);

    expect(screen.getByText("premium.success_subtitle")).toBeInTheDocument();
    expect(screen.getByText(/premium.success_expires/)).toBeInTheDocument();
  });

  it("should show Premium Access for whitelisted users", () => {
    mockUseVoiceAccess.mockReturnValue({
      hasAccess: false,
      isWhitelisted: true,
      canUseVoice: true,
      needsSignIn: false,
      needsPurchase: false,
      expiresAt: null,
      hoursUntilExpiry: null,
      agentId: "test-agent",
      isLoading: false,
      refresh: mockRefresh,
    });

    render(<PricingPage />);

    expect(screen.getByText("premium.premium_access")).toBeInTheDocument();
  });

  it("should render back link to immersive page", () => {
    render(<PricingPage />);

    const backLink = screen.getByRole("link", { name: "accessibility.go_back" });
    expect(backLink).toHaveAttribute("href", "/immersive");
  });

  it("should render features list", () => {
    render(<PricingPage />);

    expect(screen.getByText("premium.feature_24h")).toBeInTheDocument();
    expect(screen.getByText("premium.feature_booking")).toBeInTheDocument();
  });

  it("should render FAQ section", () => {
    render(<PricingPage />);

    expect(screen.getByText("premium.faq_title")).toBeInTheDocument();
    expect(screen.getByText("premium.faq_what_included")).toBeInTheDocument();
    expect(screen.getByText("premium.faq_how_long")).toBeInTheDocument();
  });

  it("should render start exploring link when user has access", () => {
    mockUseVoiceAccess.mockReturnValue({
      hasAccess: true,
      isWhitelisted: false,
      canUseVoice: true,
      needsSignIn: false,
      needsPurchase: false,
      expiresAt: new Date(),
      hoursUntilExpiry: 24,
      agentId: "test-agent",
      isLoading: false,
      refresh: mockRefresh,
    });

    render(<PricingPage />);

    const ctaLink = screen.getByRole("link", { name: "premium.success_cta" });
    expect(ctaLink).toHaveAttribute("href", "/immersive");
  });

  it("should not show pricing card when user already has access", () => {
    mockUseVoiceAccess.mockReturnValue({
      hasAccess: true,
      isWhitelisted: false,
      canUseVoice: true,
      needsSignIn: false,
      needsPurchase: false,
      expiresAt: new Date(),
      hoursUntilExpiry: 24,
      agentId: "test-agent",
      isLoading: false,
      refresh: mockRefresh,
    });

    render(<PricingPage />);

    expect(screen.queryByText("€1.99")).not.toBeInTheDocument();
  });

  it("should navigate to embedded checkout when authenticated user clicks purchase", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-123", email: "test@example.com" },
      session: { access_token: "token" },
      signInWithGoogle: mockSignInWithGoogle,
      isLoading: false,
    });

    render(<PricingPage />);

    const button = screen.getByRole("button", { name: "premium.pricing_cta" });
    fireEvent.click(button);

    expect(mockPush).toHaveBeenCalledWith("/pricing/checkout");
  });

  it("should show Premium Access text when isWhitelisted is true with no expiresAt", () => {
    mockUseVoiceAccess.mockReturnValue({
      hasAccess: false,
      isWhitelisted: true,
      canUseVoice: true,
      needsSignIn: false,
      needsPurchase: false,
      expiresAt: null,
      hoursUntilExpiry: null,
      agentId: "test-agent",
      isLoading: false,
      refresh: mockRefresh,
    });

    render(<PricingPage />);

    // Should show "Premium Access" instead of success_subtitle
    expect(screen.getByText("premium.premium_access")).toBeInTheDocument();
    // Should NOT show expiration date
    expect(screen.queryByText(/premium.success_expires/)).not.toBeInTheDocument();
  });

  describe("accessibility", () => {
    it("should have aria-label on the back button", () => {
      render(<PricingPage />);

      const backLink = screen.getByRole("link", { name: "accessibility.go_back" });
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute("href", "/immersive");
    });

    it("should have accessible loading state in CTA button during loading", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-123", email: "test@example.com" },
        session: { access_token: "token" },
        signInWithGoogle: mockSignInWithGoogle,
        isLoading: false,
      });
      mockUseVoiceAccess.mockReturnValue({
        hasAccess: false,
        isWhitelisted: false,
        canUseVoice: false,
        needsSignIn: false,
        needsPurchase: true,
        expiresAt: null,
        hoursUntilExpiry: null,
        agentId: "test-agent",
        isLoading: true,
        refresh: mockRefresh,
      });

      render(<PricingPage />);

      // Button should be disabled during loading
      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      // Spinner should be inside the button
      const spinner = button.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });
  });

  describe("UX-M4: responsive heading type scale", () => {
    it("should apply responsive text scale classes to the h1 heading", () => {
      render(<PricingPage />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading.className).toContain("md:text-3xl");
      expect(heading.className).toContain("lg:text-4xl");
    });
  });

  describe("UX-B2: Spanish localisation (no hardcoded English)", () => {
    it("does not render the hardcoded English 'Premium Access' string for whitelisted users", () => {
      mockUseVoiceAccess.mockReturnValue({
        hasAccess: false,
        isWhitelisted: true,
        canUseVoice: true,
        needsSignIn: false,
        needsPurchase: false,
        expiresAt: null,
        hoursUntilExpiry: null,
        agentId: "test-agent",
        isLoading: false,
        refresh: mockRefresh,
      });

      render(<PricingPage />);

      // Hardcoded English must not appear; the i18n key must be used
      expect(screen.queryByText("Premium Access")).not.toBeInTheDocument();
      expect(screen.getByText("premium.premium_access")).toBeInTheDocument();
    });

    it("does not render the hardcoded English 'Voice Pass · 24h' label", () => {
      render(<PricingPage />);

      // Raw English label must not appear; the translation key must be used
      expect(screen.queryByText("Voice Pass · 24h")).not.toBeInTheDocument();
      expect(screen.getByText("premium.voice_pass_label")).toBeInTheDocument();
    });
  });

  describe("UX-B3: green palette (no amber/yellow)", () => {
    it("uses green (not amber/yellow) gradient on the primary CTA when authenticated", () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-123", email: "test@example.com" },
        session: { access_token: "token" },
        signInWithGoogle: mockSignInWithGoogle,
        isLoading: false,
      });

      render(<PricingPage />);

      const button = screen.getByRole("button", { name: "premium.pricing_cta" });
      expect(button.className).toMatch(/from-green-/);
      expect(button.className).not.toMatch(/amber-|yellow-/);
    });
  });

  describe("UX-L4: accessible disabled button state", () => {
    it("should apply gray gradient classes to the checkout button when disabled", () => {
      mockUseVoiceAccess.mockReturnValue({
        hasAccess: false,
        isWhitelisted: false,
        canUseVoice: false,
        needsSignIn: false,
        needsPurchase: true,
        expiresAt: null,
        hoursUntilExpiry: null,
        agentId: "test-agent",
        isLoading: true,
        refresh: mockRefresh,
      });

      render(<PricingPage />);

      const button = screen.getByRole("button");
      // disabled:from-gray-500 desaturates the gradient, disabled:to-gray-600 and
      // disabled:opacity-75 ensure WCAG AA contrast even under glare on mobile
      expect(button.className).toContain("disabled:from-gray-500");
      expect(button.className).toContain("disabled:to-gray-600");
      expect(button.className).toContain("disabled:opacity-75");
    });

    it("should not use only opacity-50 as the sole disabled visual cue", () => {
      render(<PricingPage />);

      const button = screen.getByRole("button");
      // opacity-50 alone is insufficient for WCAG AA; the button must use
      // the gray gradient instead of (or in addition to replacing) opacity-50
      expect(button.className).not.toContain("disabled:opacity-50");
    });
  });
});
