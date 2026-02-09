import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PricingSuccessPage from "./page";

// Mock hooks
const mockRefresh = vi.fn();
const mockUseVoiceAccess = vi.fn(() => ({
  hasAccess: true,
  isWhitelisted: false,
  canUseVoice: true,
  needsSignIn: false,
  needsPurchase: false,
  expiresAt: new Date("2024-12-31T23:59:59Z") as Date | null,
  hoursUntilExpiry: 24 as number | null,
  agentId: "test-agent",
  isLoading: false,
  refresh: mockRefresh,
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
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Mock next/navigation
const mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

describe("PricingSuccessPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete("returnTo");
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
  });

  it("should call refresh on mount", () => {
    render(<PricingSuccessPage />);

    expect(mockRefresh).toHaveBeenCalled();
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

    render(<PricingSuccessPage />);

    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("should render success page with title", () => {
    render(<PricingSuccessPage />);

    expect(screen.getByText("premium.success_title")).toBeInTheDocument();
    expect(screen.getByText("premium.success_subtitle")).toBeInTheDocument();
  });

  it("should render expiry date when available", () => {
    render(<PricingSuccessPage />);

    expect(screen.getByText("premium.success_expires")).toBeInTheDocument();
  });

  it("should not render expiry date when not available", () => {
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

    render(<PricingSuccessPage />);

    expect(screen.queryByText("premium.success_expires")).not.toBeInTheDocument();
  });

  it("should render CTA link to immersive page when no returnTo", () => {
    mockSearchParams.delete("returnTo");
    render(<PricingSuccessPage />);

    const ctaLink = screen.getByRole("link", { name: /premium.success_cta/i });
    expect(ctaLink).toHaveAttribute("href", "/immersive");
  });

  it("should render CTA link with story slug and voice=ready when returnTo is present", () => {
    mockSearchParams.set("returnTo", "oviedo-walking-tour");
    render(<PricingSuccessPage />);

    const ctaLink = screen.getByRole("link", { name: /premium.success_cta/i });
    expect(ctaLink).toHaveAttribute(
      "href",
      "/immersive?story=oviedo-walking-tour&voice=ready"
    );
    mockSearchParams.delete("returnTo");
  });

  it("should show retry hint when access is not showing", () => {
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

    render(<PricingSuccessPage />);

    expect(
      screen.getByText(/premium\.success_retry_hint/i)
    ).toBeInTheDocument();
  });

  it("should not show retry hint when access is available", () => {
    render(<PricingSuccessPage />);

    expect(
      screen.queryByText(/premium\.success_retry_hint/i)
    ).not.toBeInTheDocument();
  });

  it("should render success icon", () => {
    render(<PricingSuccessPage />);

    // The success page should have a check icon in a green circle
    const container = document.querySelector(".bg-green-500\\/10");
    expect(container).toBeInTheDocument();
  });
});
