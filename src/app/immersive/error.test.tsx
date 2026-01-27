import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ImmersiveError from "./error";

describe("ImmersiveError", () => {
  const consoleSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  afterEach(() => {
    consoleSpy.mockClear();
  });

  const defaultProps = {
    error: new Error("Immersive test error"),
    reset: vi.fn(),
  };

  it("renders the error message", () => {
    render(<ImmersiveError {...defaultProps} />);
    expect(
      screen.getByText("No se pudo cargar la experiencia")
    ).toBeInTheDocument();
  });

  it("renders the error description", () => {
    render(<ImmersiveError {...defaultProps} />);
    expect(
      screen.getByText(
        "Algo falló al cargar las historias. Inténtalo de nuevo."
      )
    ).toBeInTheDocument();
  });

  it("renders a retry button", () => {
    render(<ImmersiveError {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Reintentar" })
    ).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", () => {
    const reset = vi.fn();
    render(<ImmersiveError error={new Error("fail")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("logs the error to console.error", () => {
    const error = new Error("Immersive error for logging");
    render(<ImmersiveError error={error} reset={vi.fn()} />);
    expect(consoleSpy).toHaveBeenCalledWith(error);
  });

  it("has fixed full-screen dark background", () => {
    const { container } = render(<ImmersiveError {...defaultProps} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("fixed");
    expect(wrapper.className).toContain("inset-0");
    expect(wrapper.className).toContain("bg-black");
  });
});
