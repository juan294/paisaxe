import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StoryDetailSkeleton } from "./skeleton-story-detail";

describe("StoryDetailSkeleton", () => {
  it("renders with role='status' for accessibility", () => {
    render(<StoryDetailSkeleton />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has aria-label='Loading' for screen readers", () => {
    render(<StoryDetailSkeleton />);
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("aria-label", "Loading");
  });

  it("renders skeleton for subtitle line", () => {
    render(<StoryDetailSkeleton />);
    const el = screen.getByRole("status");
    const subtitle = el.querySelector("[data-testid='skeleton-subtitle']");
    expect(subtitle).toBeInTheDocument();
    expect(subtitle?.className).toContain("animate-pulse");
  });

  it("renders skeleton for title line", () => {
    render(<StoryDetailSkeleton />);
    const el = screen.getByRole("status");
    const title = el.querySelector("[data-testid='skeleton-title']");
    expect(title).toBeInTheDocument();
    expect(title?.className).toContain("animate-pulse");
  });

  it("renders skeleton for description lines", () => {
    render(<StoryDetailSkeleton />);
    const el = screen.getByRole("status");
    const descLines = el.querySelectorAll("[data-testid='skeleton-description']");
    expect(descLines.length).toBeGreaterThanOrEqual(1);
  });

  it("renders skeleton for action button area", () => {
    render(<StoryDetailSkeleton />);
    const el = screen.getByRole("status");
    const actionSkeleton = el.querySelector("[data-testid='skeleton-action']");
    expect(actionSkeleton).toBeInTheDocument();
  });

  it("positions content at the bottom of the container", () => {
    render(<StoryDetailSkeleton />);
    const el = screen.getByRole("status");
    // The container should have bottom-0 positioning like the real overlay
    expect(el.className).toContain("bottom-0");
  });
});
