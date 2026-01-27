import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import FavoritesLoading from "./loading";

describe("FavoritesLoading", () => {
  it("renders pulse skeleton elements", () => {
    const { container } = render(<FavoritesLoading />);
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("has neutral-950 background", () => {
    const { container } = render(<FavoritesLoading />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("bg-neutral-950");
    expect(wrapper.className).toContain("min-h-screen");
  });

  it("renders a skeleton header bar", () => {
    const { container } = render(<FavoritesLoading />);
    const header = container.querySelector(".h-14");
    expect(header).toBeInTheDocument();
    expect(header?.className).toContain("bg-neutral-900");
  });

  it("renders 6 skeleton cards in a grid", () => {
    const { container } = render(<FavoritesLoading />);
    const cards = container.querySelectorAll(".aspect-\\[4\\/3\\]");
    expect(cards.length).toBe(6);
  });

  it("has responsive grid layout", () => {
    const { container } = render(<FavoritesLoading />);
    const grid = container.querySelector(".grid");
    expect(grid).toBeInTheDocument();
    expect(grid?.className).toContain("grid-cols-1");
    expect(grid?.className).toContain("gap-4");
  });
});
