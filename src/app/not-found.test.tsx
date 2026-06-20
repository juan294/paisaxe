import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n";
import NotFound from "./not-found";

// Mock next/link to render a plain anchor
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function renderWithI18n(ui: React.ReactElement) {
  return render(
    <LanguageProvider initialLocale="es">{ui}</LanguageProvider>
  );
}

describe("NotFound", () => {
  it("renders the 404 heading", () => {
    renderWithI18n(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("renders a friendly Spanish message", () => {
    renderWithI18n(<NotFound />);
    expect(
      screen.getByText("Página no encontrada")
    ).toBeInTheDocument();
  });

  it("renders a description in Spanish", () => {
    renderWithI18n(<NotFound />);
    expect(
      screen.getByText(
        "La página que buscas no existe o ha sido movida."
      )
    ).toBeInTheDocument();
  });

  it("renders a link back to home", () => {
    renderWithI18n(<NotFound />);
    const link = screen.getByRole("link", { name: "Volver al inicio" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  it("has a dark background", () => {
    const { container } = renderWithI18n(<NotFound />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("bg-neutral-950");
  });

  it("uses min-h-screen for full page coverage", () => {
    const { container } = renderWithI18n(<NotFound />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("min-h-screen");
  });

  // UX-M4: branded logo and primary-accent button
  it("UX-M4: renders the Paisaxe logo", () => {
    renderWithI18n(<NotFound />);
    expect(screen.getByLabelText("Paisaxe logo")).toBeInTheDocument();
  });

  it("UX-M4: home link uses brand primary accent", () => {
    renderWithI18n(<NotFound />);
    const link = screen.getByRole("link", { name: "Volver al inicio" });
    expect(link.className).toMatch(/bg-primary|text-primary|border-primary/);
  });
});
