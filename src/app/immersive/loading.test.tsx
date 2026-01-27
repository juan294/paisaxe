import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import ImmersiveLoading from "./loading";

describe("ImmersiveLoading", () => {
  it("renders a spinner with animate-spin class", () => {
    const { container } = render(<ImmersiveLoading />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("has fixed positioning", () => {
    const { container } = render(<ImmersiveLoading />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("fixed");
    expect(wrapper.className).toContain("inset-0");
  });

  it("has a dark background", () => {
    const { container } = render(<ImmersiveLoading />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("bg-black");
  });
});
