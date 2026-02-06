import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n";
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
