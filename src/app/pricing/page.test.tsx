import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PricingPage from "./page";

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
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
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

  it("should render loading state", () => {
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

    // Should show loading spinner
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("should render pricing page with price", () => {
    render(<PricingPage />);

    expect(screen.getByText("premium.pricing_title")).toBeInTheDocument();
    expect(screen.getByText(/1\.99/)).toBeInTheDocument();
    expect(screen.getByText(/Voice Pass/)).toBeInTheDocument();
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

    expect(screen.getByText("Premium Access")).toBeInTheDocument();
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

    expect(screen.queryByText(/1\.99/)).not.toBeInTheDocument();
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
    expect(screen.getByText("Premium Access")).toBeInTheDocument();
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

    it("should have aria-label on the loading spinner", () => {
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

      const spinner = screen.getByRole("status", { name: "accessibility.loading" });
      expect(spinner).toBeInTheDocument();
    });
  });
});
