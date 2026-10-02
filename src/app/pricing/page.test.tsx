import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PricingPage from "./page";
import PricingLoading from "./loading";
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
    expect(screen.getByText("premium.feature_duration")).toBeInTheDocument();
  });

  it("isolates search params behind a route shell when they suspend", () => {
    expect((PricingPage() as ReactElement).type).toBe(Suspense);

    mockUseSearchParams.mockImplementation(() => {
      throw new Promise(() => {});
    });

    expect(() => render(<PricingPage />)).not.toThrow();
  });

  it("uses the pricing loading skeleton as the Suspense fallback", () => {
    const routeShell = PricingPage() as ReactElement;

    expect(routeShell.type).toBe(Suspense);
    const fallback = (routeShell.props as { fallback: ReactElement }).fallback;
    expect(fallback.type).toBe(PricingLoading);
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

    expect(mockSignInWithGoogle).toHaveBeenCalledWith("/pricing?tier=day_pass");
  });

  it("preserves returnTo when starting sign-in from pricing", () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams([["returnTo", "oviedo-walking-tour"]])
    );

    render(<PricingPage />);

    fireEvent.click(screen.getByRole("button", {
      name: "premium.sign_in_to_purchase",
    }));

    expect(mockSignInWithGoogle).toHaveBeenCalledWith(
      "/pricing?returnTo=oviedo-walking-tour&tier=day_pass"
    );
  });

  describe("UX-H4 (#890): selected tier survives the sign-in round trip", () => {
    it("carries the selected (non-default) tier into the sign-in redirect URL", () => {
      render(<PricingPage />);

      // Select the monthly tier, then attempt to purchase while signed out.
      fireEvent.click(screen.getByRole("radio", { name: /9\.99/ }));
      fireEvent.click(
        screen.getByRole("button", { name: "premium.sign_in_to_purchase" })
      );

      expect(mockSignInWithGoogle).toHaveBeenCalledWith(
        "/pricing?tier=monthly_pass"
      );
    });

    it("re-selects the tier carried in the URL after the OAuth round trip", () => {
      // Simulates landing back on /pricing?tier=monthly_pass after Google
      // OAuth redirects the user back — the tier must not silently reset to
      // the (cheaper) Day Pass default.
      mockUseSearchParams.mockReturnValue(
        new URLSearchParams([["tier", "monthly_pass"]])
      );
      mockUseAuth.mockReturnValue({
        user: { id: "user-123", email: "test@example.com" },
        session: { access_token: "token" },
        signInWithGoogle: mockSignInWithGoogle,
        isLoading: false,
      });

      render(<PricingPage />);

      const monthlyRadio = screen.getByRole("radio", { name: /9\.99/ });
      expect(monthlyRadio).toHaveAttribute("aria-checked", "true");

      fireEvent.click(
        screen.getByRole("button", { name: "premium.pricing_cta" })
      );

      expect(mockPush).toHaveBeenCalledWith(
        "/pricing/checkout?tier=monthly_pass"
      );
    });

    it("ignores an invalid tier query param and falls back to the Day Pass", () => {
      mockUseSearchParams.mockReturnValue(
        new URLSearchParams([["tier", "not-a-real-tier"]])
      );

      render(<PricingPage />);

      const dayPassRadio = screen.getByRole("radio", { name: /1\.99/ });
      expect(dayPassRadio).toHaveAttribute("aria-checked", "true");
    });
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

  // UX-M11 (#904): the expiry timestamp is the single most consequential
  // piece of formatted data on this page (it's on a paid pass) and must
  // render in the app's active locale, not the browser's.
  it("formats the expiry date with the app's active locale, not the default browser locale", async () => {
    vi.doMock("@/lib/i18n", () => ({
      useTranslation: () => ({
        t: (key: string) => key,
        locale: "fr",
      }),
    }));
    vi.resetModules();
    const { default: FreshPricingPage } = await import("./page");

    const toLocaleStringSpy = vi.spyOn(Date.prototype, "toLocaleString");

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

    render(<FreshPricingPage />);

    expect(toLocaleStringSpy).toHaveBeenCalledWith("fr-FR");

    toLocaleStringSpy.mockRestore();
    vi.doUnmock("@/lib/i18n");
    vi.resetModules();
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

    expect(screen.getByText("premium.feature_duration")).toBeInTheDocument();
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

    expect(mockPush).toHaveBeenCalledWith("/pricing/checkout?tier=day_pass");
  });

  it("preserves returnTo when authenticated users continue to checkout", () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams([["returnTo", "oviedo-walking-tour"]])
    );
    mockUseAuth.mockReturnValue({
      user: { id: "user-123", email: "test@example.com" },
      session: { access_token: "token" },
      signInWithGoogle: mockSignInWithGoogle,
      isLoading: false,
    });

    render(<PricingPage />);

    fireEvent.click(screen.getByRole("button", { name: "premium.pricing_cta" }));

    expect(mockPush).toHaveBeenCalledWith(
      "/pricing/checkout?returnTo=oviedo-walking-tour&tier=day_pass"
    );
  });

  it("forwards the selected tier when continuing to checkout", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-123", email: "test@example.com" },
      session: { access_token: "token" },
      signInWithGoogle: mockSignInWithGoogle,
      isLoading: false,
    });

    render(<PricingPage />);

    // Select the weekly tier, then continue.
    fireEvent.click(screen.getByRole("radio", { name: /4\.99/ }));
    fireEvent.click(screen.getByRole("button", { name: "premium.pricing_cta" }));

    expect(mockPush).toHaveBeenCalledWith("/pricing/checkout?tier=weekly_pass");
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

    it("should have visible focus styles on the primary CTA", () => {
      render(<PricingPage />);

      const button = screen.getByRole("button", { name: "premium.sign_in_to_purchase" });
      expect(button.className).toContain("focus-visible:ring-2");
      expect(button.className).toContain("focus-visible:ring-green-300");
    });
  });

  // UX-M12 (#905): the tier selector declared role="radio"/"radiogroup" but
  // had no roving tabindex and no arrow-key handler — a screen reader user
  // is told "radio group, 1 of 3" and then finds arrow keys inert.
  describe("UX-M12 (#905): tier radiogroup keyboard behavior", () => {
    it("gives only the selected tier a tab stop; the other two are not tab stops", () => {
      render(<PricingPage />);

      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(3);
      // Day pass (index 0) is selected by default.
      expect(radios[0]).toHaveAttribute("tabindex", "0");
      expect(radios[1]).toHaveAttribute("tabindex", "-1");
      expect(radios[2]).toHaveAttribute("tabindex", "-1");
    });

    it("ArrowRight moves selection to the next tier and moves the tab stop with it", () => {
      render(<PricingPage />);

      const radios = screen.getAllByRole("radio");
      radios[0].focus();
      fireEvent.keyDown(radios[0], { key: "ArrowRight" });

      const radiosAfter = screen.getAllByRole("radio");
      expect(radiosAfter[1]).toHaveAttribute("aria-checked", "true");
      expect(radiosAfter[1]).toHaveAttribute("tabindex", "0");
      expect(radiosAfter[0]).toHaveAttribute("tabindex", "-1");
      expect(radiosAfter[1]).toHaveFocus();
    });

    it("ArrowLeft from the first tier wraps to the last tier", () => {
      render(<PricingPage />);

      const radios = screen.getAllByRole("radio");
      radios[0].focus();
      fireEvent.keyDown(radios[0], { key: "ArrowLeft" });

      const radiosAfter = screen.getAllByRole("radio");
      expect(radiosAfter[2]).toHaveAttribute("aria-checked", "true");
      expect(radiosAfter[2]).toHaveFocus();
    });

    it("ArrowRight from the last tier wraps to the first tier", () => {
      render(<PricingPage />);

      const radios = screen.getAllByRole("radio");
      radios[0].focus();
      fireEvent.keyDown(radios[0], { key: "ArrowRight" }); // -> weekly
      fireEvent.keyDown(screen.getAllByRole("radio")[1], { key: "ArrowRight" }); // -> monthly
      fireEvent.keyDown(screen.getAllByRole("radio")[2], { key: "ArrowRight" }); // wraps -> day

      const radiosAfter = screen.getAllByRole("radio");
      expect(radiosAfter[0]).toHaveAttribute("aria-checked", "true");
      expect(radiosAfter[0]).toHaveFocus();
    });

    it("Home moves selection and focus to the first tier", () => {
      render(<PricingPage />);

      const radios = screen.getAllByRole("radio");
      radios[2].focus();
      fireEvent.keyDown(radios[2], { key: "Home" });

      const radiosAfter = screen.getAllByRole("radio");
      expect(radiosAfter[0]).toHaveAttribute("aria-checked", "true");
      expect(radiosAfter[0]).toHaveFocus();
    });

    it("End moves selection and focus to the last tier", () => {
      render(<PricingPage />);

      const radios = screen.getAllByRole("radio");
      radios[0].focus();
      fireEvent.keyDown(radios[0], { key: "End" });

      const radiosAfter = screen.getAllByRole("radio");
      expect(radiosAfter[2]).toHaveAttribute("aria-checked", "true");
      expect(radiosAfter[2]).toHaveFocus();
    });

    it("one further Tab from the selected tier still reaches the purchase CTA (regression risk noted in #905)", () => {
      render(<PricingPage />);

      const radios = screen.getAllByRole("radio");
      // Only one radio is a tab stop (tabindex=0); the CTA button is the
      // very next element in source order with a positive/default tabindex.
      expect(radios[0]).toHaveAttribute("tabindex", "0");
      const button = screen.getByRole("button", { name: "premium.sign_in_to_purchase" });
      expect(button.getAttribute("tabindex")).not.toBe("-1");
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

  describe("UX-B1 (#886): section label, feature bullet, and FAQ answer track the selected tier", () => {
    it("renders the day-pass duration by default, then switches to the monthly duration when that tier is selected — never staying stuck on '24 horas'", async () => {
      // Simulate real (non-identity) translations so the derived copy is
      // exercised, not just the `t(key) => key` passthrough used elsewhere
      // in this file.
      vi.doMock("@/lib/i18n", () => ({
        useTranslation: () => ({
          t: (key: string) => {
            const translations: Record<string, string> = {
              "premium.tier_day": "24 horas",
              "premium.tier_week": "7 días",
              "premium.tier_month": "30 días",
              "premium.voice_pass_label": "Pase de Voz · {duration}",
              "premium.feature_duration": "{duration} de conversaciones ilimitadas",
              "premium.faq_how_long_answer": "{duration} desde la compra. Perfecto para explorar.",
            };
            return translations[key] ?? key;
          },
        }),
      }));
      vi.resetModules();
      const { default: FreshPricingPage } = await import("./page");

      render(<FreshPricingPage />);

      // Day pass is selected by default — copy describes 24 hours.
      expect(screen.getByText("Pase de Voz · 24 horas")).toBeInTheDocument();
      expect(screen.getByText("24 horas de conversaciones ilimitadas")).toBeInTheDocument();
      expect(screen.getByText("24 horas desde la compra. Perfecto para explorar.")).toBeInTheDocument();

      // Selecting the monthly tier (€9.99) must update all three surfaces —
      // this is the exact material misdescription UX-B1 flags: a user
      // buying the monthly pass must not keep reading "24 horas".
      fireEvent.click(screen.getByRole("radio", { name: /9\.99/ }));

      expect(screen.getByText("Pase de Voz · 30 días")).toBeInTheDocument();
      expect(screen.getByText("30 días de conversaciones ilimitadas")).toBeInTheDocument();
      expect(screen.getByText("30 días desde la compra. Perfecto para explorar.")).toBeInTheDocument();
      // The label, feature bullet, and FAQ answer must no longer describe
      // "24 horas" (the Day Pass's own tier pill legitimately still shows
      // "24 horas" — that pill always describes itself, tier-independent).
      expect(screen.queryByText("Pase de Voz · 24 horas")).not.toBeInTheDocument();
      expect(screen.queryByText("24 horas de conversaciones ilimitadas")).not.toBeInTheDocument();
      expect(screen.queryByText("24 horas desde la compra. Perfecto para explorar.")).not.toBeInTheDocument();

      vi.doUnmock("@/lib/i18n");
      vi.resetModules();
    });
  });

  describe("tier duration label translation fallback (line 151)", () => {
    it("uses the real translation when t(tier.durationKey) differs from the key itself", async () => {
      // The default mock `t: (key) => key` always makes
      // `t(tier.durationKey) === tier.durationKey` true, so the fallbackLabel
      // branch is the only one exercised elsewhere in this file. Override the
      // i18n mock so `t()` returns an actual translated string, exercising the
      // `: t(tier.durationKey)` branch instead.
      vi.doMock("@/lib/i18n", () => ({
        useTranslation: () => ({
          t: (key: string) =>
            key === "premium.tier_day" ? "24 hours (translated)" : key,
        }),
      }));
      vi.resetModules();
      const { default: FreshPricingPage } = await import("./page");

      render(<FreshPricingPage />);

      expect(screen.getByText("24 hours (translated)")).toBeInTheDocument();
      expect(screen.queryByText("24 horas")).not.toBeInTheDocument();

      vi.doUnmock("@/lib/i18n");
      vi.resetModules();
    });
  });
});
