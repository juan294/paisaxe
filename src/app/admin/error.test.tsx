import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n";
import AdminError from "./error";

function renderWithI18n(ui: React.ReactElement, locale: "es" | "en" = "es") {
  return render(
    <LanguageProvider initialLocale={locale}>{ui}</LanguageProvider>
  );
}

describe("AdminError", () => {
  const consoleSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  afterEach(() => {
    consoleSpy.mockClear();
  });

  const defaultProps = {
    error: new Error("Admin test error"),
    reset: vi.fn(),
  };

  it("renders the error title using i18n", () => {
    renderWithI18n(<AdminError {...defaultProps} />);
    expect(
      screen.getByText("Error en el panel de administración")
    ).toBeInTheDocument();
  });

  it("renders the error description using i18n", () => {
    renderWithI18n(<AdminError {...defaultProps} />);
    expect(
      screen.getByText(
        "Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo."
      )
    ).toBeInTheDocument();
  });

  it("renders a retry button using i18n", () => {
    renderWithI18n(<AdminError {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Reintentar" })
    ).toBeInTheDocument();
  });

  it("renders English translations when locale is en", () => {
    renderWithI18n(<AdminError {...defaultProps} />, "en");
    expect(
      screen.getByText("Admin panel error")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "An unexpected error occurred. Please try again."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry" })
    ).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", () => {
    const reset = vi.fn();
    renderWithI18n(
      <AdminError error={new Error("fail")} reset={reset} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("logs the error to console.error", () => {
    const error = new Error("Admin error for logging");
    renderWithI18n(<AdminError error={error} reset={vi.fn()} />);
    expect(consoleSpy).toHaveBeenCalledWith(error);
  });

  it("has admin-style background", () => {
    const { container } = renderWithI18n(
      <AdminError {...defaultProps} />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("min-h-screen");
    expect(wrapper.className).toContain("bg-neutral-50");
  });
});
