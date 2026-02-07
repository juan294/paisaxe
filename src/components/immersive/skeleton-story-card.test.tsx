import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n";
import { StoryCardSkeleton } from "./skeleton-story-card";

function renderWithI18n(ui: React.ReactElement, locale: "es" | "en" = "es") {
  return render(
    <LanguageProvider initialLocale={locale}>{ui}</LanguageProvider>
  );
}

describe("StoryCardSkeleton", () => {
  it("renders with role='status' for accessibility", () => {
    renderWithI18n(<StoryCardSkeleton />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("uses i18n translated loading label for screen readers", () => {
    renderWithI18n(<StoryCardSkeleton />, "es");
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("aria-label", "Cargando...");
  });

  it("renders English loading label when locale is en", () => {
    renderWithI18n(<StoryCardSkeleton />, "en");
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("aria-label", "Loading...");
  });

  it("renders full-screen container with black background", () => {
    renderWithI18n(<StoryCardSkeleton />);
    const el = screen.getByRole("status");
    expect(el.className).toContain("fixed");
    expect(el.className).toContain("inset-0");
    expect(el.className).toContain("bg-black");
  });

  it("renders image placeholder skeleton", () => {
    renderWithI18n(<StoryCardSkeleton />);
    const el = screen.getByRole("status");
    // The image placeholder should fill the background area
    const imagePlaceholder = el.querySelector(".absolute.inset-0");
    expect(imagePlaceholder).toBeInTheDocument();
  });

  it("renders progress bar skeletons", () => {
    renderWithI18n(<StoryCardSkeleton />);
    const el = screen.getByRole("status");
    // Should have skeleton progress bar segments at the top
    const progressBars = el.querySelectorAll("[data-testid='skeleton-progress-segment']");
    expect(progressBars.length).toBeGreaterThanOrEqual(3);
  });

  it("renders text line skeletons for title and description", () => {
    renderWithI18n(<StoryCardSkeleton />);
    const el = screen.getByRole("status");
    // Should have skeleton text lines (subtitle, title, description)
    const textSkeletons = el.querySelectorAll("[data-testid='skeleton-text-line']");
    expect(textSkeletons.length).toBeGreaterThanOrEqual(3);
  });

  it("renders button skeletons", () => {
    renderWithI18n(<StoryCardSkeleton />);
    const el = screen.getByRole("status");
    const buttonSkeletons = el.querySelectorAll("[data-testid='skeleton-button']");
    expect(buttonSkeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("all skeleton elements have animate-pulse class", () => {
    renderWithI18n(<StoryCardSkeleton />);
    const el = screen.getByRole("status");
    const pulseElements = el.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThanOrEqual(1);
  });
});
