import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlaceholderBadge } from "./placeholder-badge";

describe("PlaceholderBadge", () => {
  it("should render the text 'Placeholder'", () => {
    render(<PlaceholderBadge />);
    expect(screen.getByText("Placeholder")).toBeInTheDocument();
  });

  it("should have blue styling for visibility", () => {
    const { container } = render(<PlaceholderBadge />);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass("bg-blue-500");
  });

  it("should be positioned absolute for overlay placement", () => {
    const { container } = render(<PlaceholderBadge />);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass("absolute");
  });

  it("should be in the bottom-left corner", () => {
    const { container } = render(<PlaceholderBadge />);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass("bottom-3");
    expect(badge).toHaveClass("left-3");
  });

  it("should have rounded-full for pill shape", () => {
    const { container } = render(<PlaceholderBadge />);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass("rounded-full");
  });

  it("should accept additional className", () => {
    const { container } = render(<PlaceholderBadge className="z-50" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass("z-50");
  });

  it("should always be visible (not hover-only)", () => {
    const { container } = render(<PlaceholderBadge />);
    const badge = container.firstChild as HTMLElement;
    // Should NOT have opacity-0 or group-hover classes
    expect(badge.className).not.toContain("opacity-0");
    expect(badge.className).not.toContain("group-hover");
  });
});
