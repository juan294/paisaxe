import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FavoritesError from "./error";

describe("FavoritesError", () => {
  const consoleSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  afterEach(() => {
    consoleSpy.mockClear();
  });

  const defaultProps = {
    error: new Error("Favorites test error"),
    reset: vi.fn(),
  };

  it("renders the error message", () => {
    render(<FavoritesError {...defaultProps} />);
    expect(
      screen.getByText("No se pudieron cargar tus guardados")
    ).toBeInTheDocument();
  });

  it("renders the error description", () => {
    render(<FavoritesError {...defaultProps} />);
    expect(
      screen.getByText("Ha ocurrido un error. Inténtalo de nuevo.")
    ).toBeInTheDocument();
  });

  it("renders a retry button", () => {
    render(<FavoritesError {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Reintentar" })
    ).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", () => {
    const reset = vi.fn();
    render(<FavoritesError error={new Error("fail")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("logs the error to console.error", () => {
    const error = new Error("Favorites error for logging");
    render(<FavoritesError error={error} reset={vi.fn()} />);
    expect(consoleSpy).toHaveBeenCalledWith(error);
  });

  it("has neutral-950 background", () => {
    const { container } = render(<FavoritesError {...defaultProps} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("bg-neutral-950");
    expect(wrapper.className).toContain("min-h-screen");
  });
});
