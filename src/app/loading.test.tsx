import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RootLoading from "./loading";

describe("RootLoading", () => {
  it("renders a spinner with animate-spin class", () => {
    const { container } = render(<RootLoading />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("has a dark background", () => {
    const { container } = render(<RootLoading />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("bg-neutral-950");
  });

  it("renders the spinner as a div element", () => {
    const { container } = render(<RootLoading />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner?.tagName).toBe("DIV");
  });

  it("exposes accessible status text", () => {
    render(<RootLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando...");
  });

  it("does not rely on motion alone", () => {
    const { container } = render(<RootLoading />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner?.className).toContain("motion-reduce:animate-none");
  });
});
