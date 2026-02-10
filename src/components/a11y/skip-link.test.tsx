import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider, useTranslation } from "@/lib/i18n";
import { SkipLink } from "./skip-link";

function renderWithI18n(ui: React.ReactElement) {
  return render(
    <LanguageProvider initialLocale="es">{ui}</LanguageProvider>
  );
}

describe("SkipLink", () => {
  it("renders an anchor element with href '#main-content'", () => {
    renderWithI18n(<SkipLink />);

    const link = screen.getByRole("link", { name: "Ir al contenido principal" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("has sr-only class for screen reader accessibility", () => {
    renderWithI18n(<SkipLink />);

    const link = screen.getByRole("link", { name: "Ir al contenido principal" });
    expect(link).toHaveClass("sr-only");
  });

  it("contains text 'Ir al contenido principal'", () => {
    renderWithI18n(<SkipLink />);

    expect(screen.getByText("Ir al contenido principal")).toBeInTheDocument();
  });
});

describe("SkipLink hydration safety (#47)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("first render matches SSR default (es) even when browser is English", () => {
    // This is the exact scenario that caused the hydration mismatch:
    // Server renders with 'es' (no navigator), but client detects 'en' from browser.
    // The fix ensures useState starts with 'es' and resolves browser locale in useEffect.
    Object.defineProperty(navigator, "languages", {
      value: ["en-US", "en"],
      configurable: true,
    });
    Object.defineProperty(navigator, "language", {
      value: "en-US",
      configurable: true,
    });

    let firstRenderText: string | null = null;
    function CaptureFirstRender() {
      const { t } = useTranslation();
      const text = t("accessibility.skip_to_content");
      if (firstRenderText === null) {
        firstRenderText = text;
      }
      return <span>{text}</span>;
    }

    render(
      <LanguageProvider>
        <CaptureFirstRender />
      </LanguageProvider>
    );

    // First render MUST be Spanish to match what the server rendered
    expect(firstRenderText).toBe("Ir al contenido principal");
  });

  it("switches SkipLink to English after hydration when browser is English", async () => {
    Object.defineProperty(navigator, "languages", {
      value: ["en-US", "en"],
      configurable: true,
    });
    Object.defineProperty(navigator, "language", {
      value: "en-US",
      configurable: true,
    });

    render(
      <LanguageProvider>
        <SkipLink />
      </LanguageProvider>
    );

    // After useEffect resolves the browser locale, SkipLink updates to English
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Skip to main content" })
      ).toBeInTheDocument();
    });
  });

  it("stays in Spanish when browser language is also Spanish", () => {
    Object.defineProperty(navigator, "languages", {
      value: ["es-ES", "es"],
      configurable: true,
    });

    render(
      <LanguageProvider>
        <SkipLink />
      </LanguageProvider>
    );

    expect(
      screen.getByRole("link", { name: "Ir al contenido principal" })
    ).toBeInTheDocument();
  });
});
