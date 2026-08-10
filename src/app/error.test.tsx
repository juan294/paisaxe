import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n";
import RootError from "./error";

const mockCaptureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

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

function renderWithI18n(ui: React.ReactElement) {
  return render(
    <LanguageProvider initialLocale="es">{ui}</LanguageProvider>
  );
}

describe("RootError", () => {
  const consoleSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  afterEach(() => {
    consoleSpy.mockClear();
    mockCaptureException.mockClear();
  });

  const defaultProps = {
    error: new Error("Test error"),
    reset: vi.fn(),
  };

  it("renders the error message", () => {
    renderWithI18n(<RootError {...defaultProps} />);
    expect(screen.getByText("Algo salió mal")).toBeInTheDocument();
  });

  it("renders the error description", () => {
    renderWithI18n(<RootError {...defaultProps} />);
    expect(
      screen.getByText(
        "Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo."
      )
    ).toBeInTheDocument();
  });

  it("renders a retry button", () => {
    renderWithI18n(<RootError {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Reintentar" })
    ).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", () => {
    const reset = vi.fn();
    renderWithI18n(<RootError error={new Error("fail")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("logs the error to console.error", () => {
    const error = new Error("Test error for logging");
    renderWithI18n(<RootError error={error} reset={vi.fn()} />);
    expect(consoleSpy).toHaveBeenCalledWith(error);
  });

  it("has a dark background", () => {
    const { container } = renderWithI18n(<RootError {...defaultProps} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("bg-neutral-950");
  });

  it("renders a home link", () => {
    renderWithI18n(<RootError {...defaultProps} />);
    const link = screen.getByRole("link", { name: "Volver al inicio" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  // UX-M4: branded logo and primary-accent button
  it("UX-M4: renders the Paisaxe logo", () => {
    renderWithI18n(<RootError {...defaultProps} />);
    expect(screen.getByLabelText("Paisaxe logo")).toBeInTheDocument();
  });

  it("UX-M4: retry button uses brand primary accent", () => {
    renderWithI18n(<RootError {...defaultProps} />);
    const btn = screen.getByRole("button", { name: "Reintentar" });
    expect(btn.className).toMatch(/bg-primary|text-primary|border-primary/);
  });

  // DO-M3: Sentry.captureException must be called on mount with the error
  it("DO-M3: calls Sentry.captureException on mount with the error", () => {
    const error = new Error("Test error for Sentry");
    renderWithI18n(<RootError error={error} reset={vi.fn()} />);
    expect(mockCaptureException).toHaveBeenCalledOnce();
    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });

  it("DO-M3: calls Sentry.captureException again when error prop changes", () => {
    const error1 = new Error("First error");
    const error2 = new Error("Second error");
    const { rerender } = renderWithI18n(<RootError error={error1} reset={vi.fn()} />);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    rerender(
      <LanguageProvider initialLocale="es">
        <RootError error={error2} reset={vi.fn()} />
      </LanguageProvider>
    );
    expect(mockCaptureException).toHaveBeenCalledTimes(2);
    expect(mockCaptureException).toHaveBeenLastCalledWith(error2);
  });
});
