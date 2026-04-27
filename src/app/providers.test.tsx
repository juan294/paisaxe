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
  FeatureFlagsProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="feature-flags-provider">{children}</div>
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

  it("defers auth bootstrap on anonymous-first public routes", () => {
    mockUsePathname.mockReturnValue("/pricing");
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

  it.each(["/about", "/privacy", "/terms"])(
    "skips AuthProvider entirely on static route %s",
    (path) => {
      mockUsePathname.mockReturnValue(path);
      const { container } = render(
        <Providers>
          <p data-testid="page-content">Content</p>
        </Providers>
      );

      // AuthProvider must NOT be in the tree — no auth bootstrap occurs
      expect(container.querySelector("[data-testid='auth-provider']")).toBeNull();
      // But children must still render
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
});
