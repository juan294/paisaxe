import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo } from "./logo";

describe("Logo", () => {
  it("should render an SVG with aria-label", () => {
    render(<Logo />);
    expect(screen.getByLabelText("Paisaxe logo")).toBeDefined();
  });

  it("should use currentColor as default primary color", () => {
    const { container } = render(<Logo />);
    const paths = container.querySelectorAll("path");
    expect(paths[0].getAttribute("stroke")).toBe("currentColor");
  });

  it("should use 0.5 opacity on inner mountain when no secondaryColor is provided", () => {
    const { container } = render(<Logo />);
    const innerMountain = container.querySelectorAll("path")[1];
    expect(innerMountain.getAttribute("opacity")).toBe("0.5");
  });

  it("should use opacity 1 on inner mountain when secondaryColor is provided", () => {
    const { container } = render(<Logo secondaryColor="#ff0000" />);
    const innerMountain = container.querySelectorAll("path")[1];
    expect(innerMountain.getAttribute("opacity")).toBe("1");
    expect(innerMountain.getAttribute("stroke")).toBe("#ff0000");
  });

  it("should apply custom className", () => {
    const { container } = render(<Logo className="custom-class" />);
    const svg = container.querySelector("svg");
    expect(svg?.className.baseVal).toContain("custom-class");
  });
});
