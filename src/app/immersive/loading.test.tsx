import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n";
import ImmersiveLoading from "./loading";

function renderWithI18n(ui: React.ReactElement) {
  return render(
    <LanguageProvider initialLocale="es">{ui}</LanguageProvider>
  );
}

describe("ImmersiveLoading", () => {
  it("renders a skeleton loading state instead of a spinner", () => {
    renderWithI18n(<ImmersiveLoading />);
    // Should use skeleton UI with role='status' instead of a simple spinner
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has translated aria-label for accessibility", () => {
    renderWithI18n(<ImmersiveLoading />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Cargando...");
  });

  it("has fixed positioning with dark background", () => {
    renderWithI18n(<ImmersiveLoading />);
    const el = screen.getByRole("status");
    expect(el.className).toContain("fixed");
    expect(el.className).toContain("inset-0");
    expect(el.className).toContain("bg-black");
  });

  it("renders skeleton shimmer elements with animate-pulse", () => {
    renderWithI18n(<ImmersiveLoading />);
    const el = screen.getByRole("status");
    const pulseElements = el.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders progress bar skeleton segments", () => {
    renderWithI18n(<ImmersiveLoading />);
    const el = screen.getByRole("status");
    const progressSegments = el.querySelectorAll("[data-testid='skeleton-progress-segment']");
    expect(progressSegments.length).toBeGreaterThanOrEqual(3);
  });

  it("renders skeleton text placeholders", () => {
    renderWithI18n(<ImmersiveLoading />);
    const el = screen.getByRole("status");
    const textLines = el.querySelectorAll("[data-testid='skeleton-text-line']");
    expect(textLines.length).toBeGreaterThanOrEqual(3);
  });
});
