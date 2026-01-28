import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "./not-found";

// Mock next/link to render a plain anchor
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("NotFound", () => {
  it("renders the 404 heading", () => {
    render(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("renders a friendly Spanish message", () => {
    render(<NotFound />);
    expect(
      screen.getByText("Página no encontrada")
    ).toBeInTheDocument();
  });

  it("renders a description in Spanish", () => {
    render(<NotFound />);
    expect(
      screen.getByText(
        "La página que buscas no existe o ha sido movida."
      )
    ).toBeInTheDocument();
  });

  it("renders a link back to home", () => {
    render(<NotFound />);
    const link = screen.getByRole("link", { name: "Volver al inicio" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  it("has a dark background", () => {
    const { container } = render(<NotFound />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("bg-black");
  });

  it("uses min-h-screen for full page coverage", () => {
    const { container } = render(<NotFound />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("min-h-screen");
  });
});
