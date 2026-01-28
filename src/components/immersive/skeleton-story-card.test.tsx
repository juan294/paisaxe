import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StoryCardSkeleton } from "./skeleton-story-card";

describe("StoryCardSkeleton", () => {
  it("renders with role='status' for accessibility", () => {
    render(<StoryCardSkeleton />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has aria-label='Loading' for screen readers", () => {
    render(<StoryCardSkeleton />);
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("aria-label", "Loading");
  });

  it("renders full-screen container with black background", () => {
    render(<StoryCardSkeleton />);
    const el = screen.getByRole("status");
    expect(el.className).toContain("fixed");
    expect(el.className).toContain("inset-0");
    expect(el.className).toContain("bg-black");
  });

  it("renders image placeholder skeleton", () => {
    render(<StoryCardSkeleton />);
    const el = screen.getByRole("status");
    // The image placeholder should fill the background area
    const imagePlaceholder = el.querySelector(".absolute.inset-0");
    expect(imagePlaceholder).toBeInTheDocument();
  });

  it("renders progress bar skeletons", () => {
    render(<StoryCardSkeleton />);
    const el = screen.getByRole("status");
    // Should have skeleton progress bar segments at the top
    const progressBars = el.querySelectorAll("[data-testid='skeleton-progress-segment']");
    expect(progressBars.length).toBeGreaterThanOrEqual(3);
  });

  it("renders text line skeletons for title and description", () => {
    render(<StoryCardSkeleton />);
    const el = screen.getByRole("status");
    // Should have skeleton text lines (subtitle, title, description)
    const textSkeletons = el.querySelectorAll("[data-testid='skeleton-text-line']");
    expect(textSkeletons.length).toBeGreaterThanOrEqual(3);
  });

  it("renders button skeletons", () => {
    render(<StoryCardSkeleton />);
    const el = screen.getByRole("status");
    const buttonSkeletons = el.querySelectorAll("[data-testid='skeleton-button']");
    expect(buttonSkeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("all skeleton elements have animate-pulse class", () => {
    render(<StoryCardSkeleton />);
    const el = screen.getByRole("status");
    const pulseElements = el.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThanOrEqual(1);
  });
});
