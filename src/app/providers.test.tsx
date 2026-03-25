import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Providers } from "./providers";

// Mock all provider dependencies to isolate the Providers component
vi.mock("@/lib/i18n", () => ({
  LanguageProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="language-provider">{children}</div>
  ),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
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

describe("Providers", () => {
  it("renders a <main> landmark element with id='main-content'", () => {
    const { container } = render(
      <Providers>
        <p>Test content</p>
      </Providers>
    );

    const mainElement = container.querySelector("main#main-content");
    expect(mainElement).not.toBeNull();
    expect(mainElement?.tagName).toBe("MAIN");
  });

  it("wraps children inside the <main> landmark", () => {
    const { container } = render(
      <Providers>
        <p data-testid="child">Hello</p>
      </Providers>
    );

    const mainElement = container.querySelector("main#main-content");
    expect(mainElement).not.toBeNull();
    expect(mainElement?.querySelector("p[data-testid='child']")).not.toBeNull();
  });
});
