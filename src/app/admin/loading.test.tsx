import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import AdminLoading from "./loading";

describe("AdminLoading", () => {
  it("renders skeleton structure with pulse elements", () => {
    const { container } = render(<AdminLoading />);
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("has admin-style background", () => {
    const { container } = render(<AdminLoading />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("min-h-screen");
    expect(wrapper.className).toContain("bg-neutral-50");
  });

  it("renders a skeleton header", () => {
    const { container } = render(<AdminLoading />);
    const header = container.querySelector(".h-14");
    expect(header).toBeInTheDocument();
  });

  it("renders content area placeholders", () => {
    const { container } = render(<AdminLoading />);
    const placeholders = container.querySelectorAll(".animate-pulse");
    expect(placeholders.length).toBeGreaterThanOrEqual(2);
  });
});
