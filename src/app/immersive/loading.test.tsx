import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ImmersiveLoading from "./loading";

describe("ImmersiveLoading", () => {
  it("renders a skeleton loading state instead of a spinner", () => {
    render(<ImmersiveLoading />);
    // Should use skeleton UI with role='status' instead of a simple spinner
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has aria-label='Loading' for accessibility", () => {
    render(<ImmersiveLoading />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Loading");
  });

  it("has fixed positioning with dark background", () => {
    render(<ImmersiveLoading />);
    const el = screen.getByRole("status");
    expect(el.className).toContain("fixed");
    expect(el.className).toContain("inset-0");
    expect(el.className).toContain("bg-black");
  });

  it("renders skeleton shimmer elements with animate-pulse", () => {
    render(<ImmersiveLoading />);
    const el = screen.getByRole("status");
    const pulseElements = el.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders progress bar skeleton segments", () => {
    render(<ImmersiveLoading />);
    const el = screen.getByRole("status");
    const progressSegments = el.querySelectorAll("[data-testid='skeleton-progress-segment']");
    expect(progressSegments.length).toBeGreaterThanOrEqual(3);
  });

  it("renders skeleton text placeholders", () => {
    render(<ImmersiveLoading />);
    const el = screen.getByRole("status");
    const textLines = el.querySelectorAll("[data-testid='skeleton-text-line']");
    expect(textLines.length).toBeGreaterThanOrEqual(3);
  });
});
