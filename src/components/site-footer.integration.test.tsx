import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n";
import { SiteFooter } from "./site-footer";

afterEach(cleanup);

describe("real translated SiteFooter positioning and legal focus", () => {
  it("preserves the existing fixed default for overlay consumers", () => {
    render(<LanguageProvider initialLocale="es"><SiteFooter /></LanguageProvider>);
    expect(screen.getByRole("contentinfo")).toHaveClass("fixed");
  });

  it("offers an ordinary-flow footer without viewport positioning or pointer suppression", () => {
    // The approved variant is deliberately exercised against the existing
    // component first: the meaningful RED is its actual fixed positioning.
    render(<LanguageProvider initialLocale="es"><SiteFooter variant="flow" /></LanguageProvider>);
    const footer = screen.getByRole("contentinfo");
    expect(footer).not.toHaveClass("fixed");
    expect(footer).not.toHaveClass("pointer-events-none");
    expect(footer.className).not.toMatch(/(?:^|\s)(?:absolute|sticky|bottom-0)(?:\s|$)/);
    expect(within(footer).getByRole("link", { name: "Condiciones de Uso" })).toHaveAttribute("href", "/terms");
    expect(within(footer).getByRole("link", { name: "Política de Privacidad" })).toHaveAttribute("href", "/privacy");
  });

  it("gives both native legal links explicit visible keyboard focus styling", () => {
    render(<LanguageProvider initialLocale="es"><SiteFooter /></LanguageProvider>);
    for (const link of within(screen.getByRole("contentinfo")).getAllByRole("link")) {
      expect(link.tagName).toBe("A");
      expect(link).not.toHaveAttribute("tabindex", "-1");
      expect(link.className).toMatch(/focus-visible:(?:ring|outline)/);
    }
  });
});
