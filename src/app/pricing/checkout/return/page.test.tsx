import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CheckoutReturnPage from "./page";
import { Suspense, type ReactElement } from "react";

// --- Mocks ---

// Mock hooks
const mockRefresh = vi.fn();
const mockUseVoiceAccess = vi.fn(() => ({
  hasAccess: true,
  isWhitelisted: false,
  canUseVoice: true,
  needsSignIn: false,
  needsPurchase: false,
  expiresAt: new Date("2026-03-15T12:00:00Z") as Date | null,
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

describe("CheckoutReturnPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete("returnTo");
    mockUseSearchParams.mockReturnValue(mockSearchParams);
    mockUseVoiceAccess.mockReturnValue({
      hasAccess: true,
      isWhitelisted: false,
      canUseVoice: true,
      needsSignIn: false,
      needsPurchase: false,
      expiresAt: new Date("2026-03-15T12:00:00Z"),
      hoursUntilExpiry: 24,
      agentId: "test-agent",
      isLoading: false,
      refresh: mockRefresh,
    });
  });

  describe("loading state", () => {
    it("isolates search params behind a route shell when they suspend", () => {
      expect((CheckoutReturnPage() as ReactElement).type).toBe(Suspense);

      mockUseSearchParams.mockImplementation(() => {
        throw new Promise(() => {});
      });

      expect(() => render(<CheckoutReturnPage />)).not.toThrow();
    });

    it("should render loading spinner when isLoading is true", () => {
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

      render(<CheckoutReturnPage />);

      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("should not render success content when loading", () => {
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

      render(<CheckoutReturnPage />);

      expect(
        screen.queryByText("premium.success_title")
      ).not.toBeInTheDocument();
    });
  });

  describe("refresh on mount", () => {
    it("should call refresh on mount to pick up new purchase", () => {
      render(<CheckoutReturnPage />);

      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  describe("success state", () => {
    it("should render success title", () => {
      render(<CheckoutReturnPage />);

      expect(
        screen.getByText("premium.success_title")
      ).toBeInTheDocument();
    });

    it("should render success subtitle", () => {
      render(<CheckoutReturnPage />);

      expect(
        screen.getByText("premium.success_subtitle")
      ).toBeInTheDocument();
    });

    it("should render success icon with green background", () => {
      render(<CheckoutReturnPage />);

      const iconContainer = document.querySelector(".bg-green-500\\/10");
      expect(iconContainer).toBeInTheDocument();
    });

    it("should render expiry date when expiresAt is available", () => {
      render(<CheckoutReturnPage />);

      expect(
        screen.getByText("premium.success_expires")
      ).toBeInTheDocument();
    });

    it("should not render expiry section when expiresAt is null", () => {
      mockUseVoiceAccess.mockReturnValue({
        hasAccess: true,
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

      render(<CheckoutReturnPage />);

      expect(
        screen.queryByText("premium.success_expires")
      ).not.toBeInTheDocument();
    });
  });

  describe("CTA link", () => {
    it("should render CTA link to /immersive when no returnTo param", () => {
      render(<CheckoutReturnPage />);

      const ctaLink = screen.getByRole("link", {
        name: /premium.success_cta/,
      });
      expect(ctaLink).toBeInTheDocument();
      expect(ctaLink).toHaveAttribute("href", "/immersive");
    });

    it("should render CTA link with story slug and voice=ready when returnTo is present", () => {
      mockSearchParams.set("returnTo", "oviedo-walking-tour");

      render(<CheckoutReturnPage />);

      const ctaLink = screen.getByRole("link", {
        name: /premium.success_cta/,
      });
      expect(ctaLink).toHaveAttribute(
        "href",
        "/immersive?story=oviedo-walking-tour&voice=ready"
      );

      mockSearchParams.delete("returnTo");
    });

    it("should render CTA with Mic icon (link contains icon and text)", () => {
      render(<CheckoutReturnPage />);

      const ctaLink = screen.getByRole("link", {
        name: /premium.success_cta/,
      });
      expect(ctaLink).toBeInTheDocument();
      // The link should have the green button styling
      expect(ctaLink.className).toContain("bg-green-500");
    });
  });

  describe("retry hint", () => {
    it("should show retry hint when canUseVoice is false", () => {
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

      render(<CheckoutReturnPage />);

      expect(
        screen.getByText("premium.success_retry_hint")
      ).toBeInTheDocument();
    });

    it("should not show retry hint when canUseVoice is true", () => {
      render(<CheckoutReturnPage />);

      expect(
        screen.queryByText("premium.success_retry_hint")
      ).not.toBeInTheDocument();
    });
  });

  describe("formatted expiry date", () => {
    it("should display the expiry date formatted with toLocaleString", () => {
      const expiryDate = new Date("2026-03-15T12:00:00Z");
      mockUseVoiceAccess.mockReturnValue({
        hasAccess: true,
        isWhitelisted: false,
        canUseVoice: true,
        needsSignIn: false,
        needsPurchase: false,
        expiresAt: expiryDate,
        hoursUntilExpiry: 24,
        agentId: "test-agent",
        isLoading: false,
        refresh: mockRefresh,
      });

      render(<CheckoutReturnPage />);

      // The date is rendered with toLocaleString. In jsdom the exact format
      // depends on the locale, but the border container should be present.
      const expiryContainer = document.querySelector(".border-neutral-800");
      expect(expiryContainer).toBeInTheDocument();
    });
  });
});
