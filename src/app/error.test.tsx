import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RootError from "./error";

describe("RootError", () => {
  const consoleSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  afterEach(() => {
    consoleSpy.mockClear();
  });

  const defaultProps = {
    error: new Error("Test error"),
    reset: vi.fn(),
  };

  it("renders the error message", () => {
    render(<RootError {...defaultProps} />);
    expect(screen.getByText("Algo salió mal")).toBeInTheDocument();
  });

  it("renders the error description", () => {
    render(<RootError {...defaultProps} />);
    expect(
      screen.getByText(
        "Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo."
      )
    ).toBeInTheDocument();
  });

  it("renders a retry button", () => {
    render(<RootError {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Reintentar" })
    ).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", () => {
    const reset = vi.fn();
    render(<RootError error={new Error("fail")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("logs the error to console.error", () => {
    const error = new Error("Test error for logging");
    render(<RootError error={error} reset={vi.fn()} />);
    expect(consoleSpy).toHaveBeenCalledWith(error);
  });

  it("has a dark background", () => {
    const { container } = render(<RootError {...defaultProps} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("bg-black");
  });
});
