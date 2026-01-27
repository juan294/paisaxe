import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkipLink } from "./skip-link";

describe("SkipLink", () => {
  it("renders an anchor element with href '#main-content'", () => {
    render(<SkipLink />);

    const link = screen.getByRole("link", { name: "Ir al contenido principal" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("has sr-only class for screen reader accessibility", () => {
    render(<SkipLink />);

    const link = screen.getByRole("link", { name: "Ir al contenido principal" });
    expect(link).toHaveClass("sr-only");
  });

  it("contains text 'Ir al contenido principal'", () => {
    render(<SkipLink />);

    expect(screen.getByText("Ir al contenido principal")).toBeInTheDocument();
  });
});
