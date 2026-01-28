import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("renders a div element", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.tagName).toBe("DIV");
  });

  it("has animate-pulse class for shimmer animation", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("animate-pulse");
  });

  it("has rounded-md class", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("rounded-md");
  });

  it("has bg-white/10 class for dark-themed background", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("bg-white/10");
  });

  it("accepts additional className", () => {
    const { container } = render(<Skeleton className="h-8 w-32" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("h-8");
    expect(el.className).toContain("w-32");
    expect(el.className).toContain("animate-pulse");
  });

  it("passes through additional HTML attributes", () => {
    const { container } = render(
      <Skeleton data-testid="skeleton-test" aria-label="Loading" />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute("data-testid")).toBe("skeleton-test");
    expect(el.getAttribute("aria-label")).toBe("Loading");
  });
});
