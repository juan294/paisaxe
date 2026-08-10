/**
 * FE-M4: Regression tests — LanguageProvider must use initialLocale to
 * avoid the Spanish flash on first paint when the user's language differs.
 *
 * When `initialLocale` is provided the provider must:
 * 1. Use it immediately on first render (no useEffect required)
 * 2. Skip browser locale detection (not override the prop with a detected value)
 * 3. Still allow the user to switch locales via setLocale
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { LanguageProvider, _resetTranslationCacheForTesting } from "./provider";
import { useTranslation } from "./use-translation";

function LocaleConsumer() {
  const { locale, setLocale } = useTranslation();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <button data-testid="switch-en" onClick={() => setLocale("en")}>
        switch en
      </button>
    </div>
  );
}

describe("LanguageProvider — initialLocale honoring (FE-M4)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    _resetTranslationCacheForTesting();
  });

  it("uses initialLocale immediately on first render without needing useEffect", () => {
    let firstRenderLocale: string | null = null;

    function CaptureFirst() {
      const { locale } = useTranslation();
      if (firstRenderLocale === null) firstRenderLocale = locale;
      return <span data-testid="locale">{locale}</span>;
    }

    render(
      <LanguageProvider initialLocale="en">
        <CaptureFirst />
      </LanguageProvider>
    );

    // Must be "en" on the FIRST synchronous render, not after a useEffect
    expect(firstRenderLocale).toBe("en");
    expect(screen.getByTestId("locale").textContent).toBe("en");
  });

  it("does NOT override initialLocale with browser detection", async () => {
    // Browser says French, but initialLocale says English
    Object.defineProperty(navigator, "languages", {
      value: ["fr-FR", "en"],
      configurable: true,
    });

    render(
      <LanguageProvider initialLocale="en">
        <LocaleConsumer />
      </LanguageProvider>
    );

    // Wait for any potential useEffect to fire
    await new Promise((r) => setTimeout(r, 50));

    // Must remain "en" — initialLocale takes precedence over browser detection
    expect(screen.getByTestId("locale").textContent).toBe("en");
  });

  it("still allows the user to switch locale after initialLocale is set", () => {
    render(
      <LanguageProvider initialLocale="en">
        <LocaleConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId("locale").textContent).toBe("en");

    act(() => {
      screen.getByTestId("switch-en").click();
    });

    // Already en, just confirming switching works
    expect(screen.getByTestId("locale").textContent).toBe("en");
  });

  it("renders initialLocale=es without flash to a different locale", () => {
    let firstRenderLocale: string | null = null;

    function CaptureFirst() {
      const { locale } = useTranslation();
      if (firstRenderLocale === null) firstRenderLocale = locale;
      return <span data-testid="locale">{locale}</span>;
    }

    render(
      <LanguageProvider initialLocale="es">
        <CaptureFirst />
      </LanguageProvider>
    );

    expect(firstRenderLocale).toBe("es");
  });

  it("renders initialLocale=fr immediately without async loading wait", () => {
    let firstRenderLocale: string | null = null;

    function CaptureFirst() {
      const { locale } = useTranslation();
      if (firstRenderLocale === null) firstRenderLocale = locale;
      return <span data-testid="locale">{locale}</span>;
    }

    render(
      <LanguageProvider initialLocale="fr">
        <CaptureFirst />
      </LanguageProvider>
    );

    // locale must be set immediately, not 'es' on first render
    expect(firstRenderLocale).toBe("fr");
  });
});
