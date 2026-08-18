import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Providers } from "./providers";

const mockUsePathname = vi.fn(() => "/");

// Mock all provider dependencies to isolate the Providers component
vi.mock("@/lib/i18n", () => ({
  LanguageProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="language-provider">{children}</div>
  ),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  AuthProvider: ({ children, deferInitialAuth }: { children: React.ReactNode; deferInitialAuth?: boolean }) => (
    <div data-testid="auth-provider" data-defer-initial-auth={String(!!deferInitialAuth)}>
      {children}
    </div>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("@/components/a11y/skip-link", () => ({
  SkipLink: () => <a href="#main-content">Skip</a>,
}));

vi.mock("@/components/a11y/lang-sync", () => ({
  LangSync: () => null,
}));

vi.mock("@/components/posthog-provider", () => ({
  PostHogProviderWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="posthog-provider">{children}</div>
  ),
}));

vi.mock("@/hooks/use-feature-flags", () => ({
  FeatureFlagsProvider: ({ children, enabled }: { children: React.ReactNode; enabled?: boolean }) => (
    <div data-testid="feature-flags-provider" data-enabled={String(enabled ?? true)}>{children}</div>
  ),
  useFeatureFlags: vi.fn(() => ({
    flags: [],
    isReady: true,
    isEnabled: () => false,
    isEnabledWithDefault: () => false,
  })),
}));

describe("Providers", () => {
  it("renders children correctly", () => {
    const { container } = render(
      <Providers>
        <p data-testid="child">Hello</p>
      </Providers>
    );

    expect(container.querySelector("p[data-testid='child']")).not.toBeNull();
  });

  it("does NOT render a <main> element — layout.tsx owns the main landmark", () => {
    const { container } = render(
      <Providers>
        <p>Test content</p>
      </Providers>
    );

    // The client boundary should NOT include <main id="main-content">.
    // That element lives in the server-rendered layout.tsx.
    const mainElement = container.querySelector("main");
    expect(mainElement).toBeNull();
  });

  it("renders the SkipLink so the skip-navigation link is accessible", () => {
    const { container } = render(
      <Providers>
        <p>Content</p>
      </Providers>
    );

    const skipLink = container.querySelector("a[href='#main-content']");
    expect(skipLink).not.toBeNull();
  });

  it("wraps children inside provider hierarchy (PostHog > Language > Auth)", () => {
    const { container } = render(
      <Providers>
        <p data-testid="nested-child">Nested</p>
      </Providers>
    );

    // Providers are in the tree (verified by data-testid attributes)
    expect(container.querySelector("[data-testid='posthog-provider']")).not.toBeNull();
    expect(container.querySelector("[data-testid='language-provider']")).not.toBeNull();
    expect(container.querySelector("[data-testid='auth-provider']")).not.toBeNull();
    // Child should be reachable through the provider tree
    expect(container.querySelector("p[data-testid='nested-child']")).not.toBeNull();
  });

  // FE-B1 (#757): /immersive, /favorites, and /pricing are the authenticated
  // revenue path (favorites, paid voice access, purchase CTA) — auth must
  // NOT be deferred there, or getSession()/getUser() never runs and every
  // signed-in feature on those routes is silently dead.
  it.each(["/immersive", "/favorites", "/pricing"])(
    "does NOT defer auth bootstrap on the authenticated route %s (FE-B1 #757)",
    (path) => {
      mockUsePathname.mockReturnValue(path);
      const { container } = render(
        <Providers>
          <p data-testid="page-content">Content</p>
        </Providers>
      );

      expect(container.querySelector("[data-testid='auth-provider']")).toHaveAttribute(
        "data-defer-initial-auth",
        "false"
      );
      // Children must still render regardless of the auth-defer decision —
      // guards against the FE-M4/#338 hydration regression this deferral
      // was originally meant to prevent.
      expect(container.querySelector("p[data-testid='page-content']")).not.toBeNull();
    }
  );

  it("still defers auth bootstrap on genuinely static, anonymous-only routes", () => {
    mockUsePathname.mockReturnValue("/about");
    const { container } = render(
      <Providers>
        <p>Content</p>
      </Providers>
    );

    expect(container.querySelector("[data-testid='auth-provider']")).toHaveAttribute(
      "data-defer-initial-auth",
      "true"
    );
  });

  it("disables the root feature flag fetch on immersive routes with server-seeded flags", () => {
    mockUsePathname.mockReturnValue("/immersive");
    const { container } = render(
      <Providers>
        <p>Content</p>
      </Providers>
    );

    expect(container.querySelector("[data-testid='feature-flags-provider']")).toHaveAttribute(
      "data-enabled",
      "false"
    );
  });

  it("keeps the root feature flag fetch enabled outside immersive", () => {
    mockUsePathname.mockReturnValue("/pricing");
    const { container } = render(
      <Providers>
        <p>Content</p>
      </Providers>
    );

    expect(container.querySelector("[data-testid='feature-flags-provider']")).toHaveAttribute(
      "data-enabled",
      "true"
    );
  });

  it.each(["/about", "/privacy", "/terms"])(
    "defers auth (but still mounts AuthProvider) on static route %s",
    (path) => {
      mockUsePathname.mockReturnValue(path);
      const { container } = render(
        <Providers>
          <p data-testid="page-content">Content</p>
        </Providers>
      );

      // FE-M4: AuthProvider MUST be in the tree — always mounted for stable tree.
      // On static routes it defers init (deferInitialAuth=true) to avoid auth round-trips.
      expect(container.querySelector("[data-testid='auth-provider']")).not.toBeNull();
      // Children must still render
      expect(container.querySelector("p[data-testid='page-content']")).not.toBeNull();
    }
  );

  it("renders AuthProvider on non-static routes", () => {
    mockUsePathname.mockReturnValue("/immersive");
    const { container } = render(
      <Providers>
        <p>Content</p>
      </Providers>
    );

    expect(container.querySelector("[data-testid='auth-provider']")).not.toBeNull();
  });

  // FE-M4 (#496): AuthProvider must always be mounted — never conditionally removed —
  // so that navigating between pathnames does NOT remount it (which resets auth state).
  it("FE-M4: AuthProvider is always in the tree regardless of pathname", () => {
    // Static path — AuthProvider must still be rendered (just with deferInitialAuth=true)
    // so the provider tree is stable across navigations.
    mockUsePathname.mockReturnValue("/about");
    const { container } = render(
      <Providers>
        <p>Content</p>
      </Providers>
    );
    expect(container.querySelector("[data-testid='auth-provider']")).not.toBeNull();
  });

  it("FE-M4: AuthProvider is always in the tree on /privacy", () => {
    mockUsePathname.mockReturnValue("/privacy");
    const { container } = render(
      <Providers>
        <p>Content</p>
      </Providers>
    );
    expect(container.querySelector("[data-testid='auth-provider']")).not.toBeNull();
  });

  it("FE-M4: AuthProvider is always in the tree on /terms", () => {
    mockUsePathname.mockReturnValue("/terms");
    const { container } = render(
      <Providers>
        <p>Content</p>
      </Providers>
    );
    expect(container.querySelector("[data-testid='auth-provider']")).not.toBeNull();
  });

  it("FE-M4: on static routes AuthProvider receives deferInitialAuth=true to avoid auth round-trip", () => {
    mockUsePathname.mockReturnValue("/about");
    const { container } = render(
      <Providers>
        <p>Content</p>
      </Providers>
    );
    // Provider must exist…
    const authProvider = container.querySelector("[data-testid='auth-provider']");
    expect(authProvider).not.toBeNull();
    // …and defers auth bootstrap (no Supabase round-trip on static pages)
    expect(authProvider).toHaveAttribute("data-defer-initial-auth", "true");
  });
});
