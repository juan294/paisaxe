import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import GlobalError from "./global-error";

// Mock resolveLocale to return 'es' (jsdom defaults to 'en-US')
vi.mock("@/lib/i18n/detect-language", () => ({
  resolveLocale: vi.fn(() => "es"),
}));

const mockCaptureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

describe("GlobalError", () => {
  const consoleSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  afterEach(() => {
    consoleSpy.mockClear();
    mockCaptureException.mockClear();
  });

  const defaultProps = {
    error: new Error("Global layout error"),
    reset: vi.fn(),
  };

  it("renders a friendly Spanish error message", () => {
    render(<GlobalError {...defaultProps} />);
    expect(screen.getByText("Algo salió mal")).toBeInTheDocument();
  });

  it("renders an error description in Spanish", () => {
    render(<GlobalError {...defaultProps} />);
    expect(
      screen.getByText(
        "Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo."
      )
    ).toBeInTheDocument();
  });

  it("renders a retry button", () => {
    render(<GlobalError {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Reintentar" })
    ).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("fail")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("logs the error to console.error", () => {
    const error = new Error("Global error for logging");
    render(<GlobalError error={error} reset={vi.fn()} />);
    expect(consoleSpy).toHaveBeenCalledWith(error);
  });

  it("includes html and body tags in rendered output", () => {
    // global-error.tsx must include its own <html> and <body> tags since it
    // replaces the root layout on error. In jsdom, these tags get absorbed into
    // the document so we verify via ReactDOMServer instead.
    const html = renderToStaticMarkup(
      <GlobalError {...defaultProps} />
    );
    expect(html).toContain("<html");
    expect(html).toContain("<body");
  });

  it("renders a home link", () => {
    render(<GlobalError {...defaultProps} />);
    const link = screen.getByRole("link", { name: "Volver al inicio" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  // DO-M3: Sentry.captureException must be called on mount with the error
  it("DO-M3: calls Sentry.captureException on mount with the error", () => {
    const error = new Error("Global layout error for Sentry");
    render(<GlobalError error={error} reset={vi.fn()} />);
    expect(mockCaptureException).toHaveBeenCalledOnce();
    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });

  it("DO-M3: calls Sentry.captureException again when error prop changes", () => {
    const error1 = new Error("First error");
    const error2 = new Error("Second error");
    const { rerender } = render(<GlobalError error={error1} reset={vi.fn()} />);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    rerender(<GlobalError error={error2} reset={vi.fn()} />);
    expect(mockCaptureException).toHaveBeenCalledTimes(2);
    expect(mockCaptureException).toHaveBeenLastCalledWith(error2);
  });
});
