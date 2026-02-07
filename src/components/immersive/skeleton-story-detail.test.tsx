import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n";
import { StoryDetailSkeleton } from "./skeleton-story-detail";

function renderWithI18n(ui: React.ReactElement, locale: "es" | "en" = "es") {
  return render(
    <LanguageProvider initialLocale={locale}>{ui}</LanguageProvider>
  );
}

describe("StoryDetailSkeleton", () => {
  it("renders with role='status' for accessibility", () => {
    renderWithI18n(<StoryDetailSkeleton />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("uses i18n translated loading label for screen readers", () => {
    renderWithI18n(<StoryDetailSkeleton />, "es");
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("aria-label", "Cargando...");
  });

  it("renders English loading label when locale is en", () => {
    renderWithI18n(<StoryDetailSkeleton />, "en");
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("aria-label", "Loading...");
  });

  it("renders skeleton for subtitle line", () => {
    renderWithI18n(<StoryDetailSkeleton />);
    const el = screen.getByRole("status");
    const subtitle = el.querySelector("[data-testid='skeleton-subtitle']");
    expect(subtitle).toBeInTheDocument();
    expect(subtitle?.className).toContain("animate-pulse");
  });

  it("renders skeleton for title line", () => {
    renderWithI18n(<StoryDetailSkeleton />);
    const el = screen.getByRole("status");
    const title = el.querySelector("[data-testid='skeleton-title']");
    expect(title).toBeInTheDocument();
    expect(title?.className).toContain("animate-pulse");
  });

  it("renders skeleton for description lines", () => {
    renderWithI18n(<StoryDetailSkeleton />);
    const el = screen.getByRole("status");
    const descLines = el.querySelectorAll("[data-testid='skeleton-description']");
    expect(descLines.length).toBeGreaterThanOrEqual(1);
  });

  it("renders skeleton for action button area", () => {
    renderWithI18n(<StoryDetailSkeleton />);
    const el = screen.getByRole("status");
    const actionSkeleton = el.querySelector("[data-testid='skeleton-action']");
    expect(actionSkeleton).toBeInTheDocument();
  });

  it("positions content at the bottom of the container", () => {
    renderWithI18n(<StoryDetailSkeleton />);
    const el = screen.getByRole("status");
    // The container should have bottom-0 positioning like the real overlay
    expect(el.className).toContain("bottom-0");
  });
});
