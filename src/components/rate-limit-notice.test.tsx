import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RateLimitNotice } from "./rate-limit-notice";
import { LanguageProvider } from "@/lib/i18n";
import { loadDictionary } from "@/lib/i18n/dictionaries";
import { interpolate } from "@/lib/i18n/interpolate";
import { resolveTranslation } from "@/lib/i18n/resolve";
import type { Locale } from "@/lib/i18n/types";
describe("rate denial recovery", () => {
  it.each<Locale>(["es", "en", "fr", "de", "pt", "ast"])("announces timing and executable retry in %s", async (locale) => {
    const dictionary = await loadDictionary(locale);
    const retry = vi.fn();
    render(<LanguageProvider initialLocale={locale} initialDictionary={dictionary}><RateLimitNotice retryAfter={13} onRetry={retry} /></LanguageProvider>);
    expect(screen.getByRole("alert")).toHaveTextContent(interpolate(resolveTranslation("common.rateLimited", dictionary), {seconds:13}));
    fireEvent.click(screen.getByRole("button", {name:resolveTranslation("common.retry", dictionary)}));
    expect(retry).toHaveBeenCalledOnce();
  });
  it("renders no warning without a rate denial", () => {
    render(<LanguageProvider><RateLimitNotice onRetry={vi.fn()} /></LanguageProvider>);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
