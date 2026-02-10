import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n";
import FavoritesError from "./error";

function renderWithI18n(ui: React.ReactElement, locale: "es" | "en" = "es") {
  return render(
    <LanguageProvider initialLocale={locale}>{ui}</LanguageProvider>
  );
}

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

  it("renders the error title using i18n", () => {
    renderWithI18n(<FavoritesError {...defaultProps} />);
    expect(
      screen.getByText("No se pudieron cargar tus guardados")
    ).toBeInTheDocument();
  });

  it("renders the error description using i18n", () => {
    renderWithI18n(<FavoritesError {...defaultProps} />);
    expect(
      screen.getByText("Ha ocurrido un error. Inténtalo de nuevo.")
    ).toBeInTheDocument();
  });

  it("renders a retry button using i18n", () => {
    renderWithI18n(<FavoritesError {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Reintentar" })
    ).toBeInTheDocument();
  });

  it("renders English translations when locale is en", () => {
    renderWithI18n(<FavoritesError {...defaultProps} />, "en");
    expect(
      screen.getByText("Could not load your saved items")
    ).toBeInTheDocument();
    expect(
      screen.getByText("An error occurred. Please try again.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry" })
    ).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", () => {
    const reset = vi.fn();
    renderWithI18n(
      <FavoritesError error={new Error("fail")} reset={reset} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("logs the error to console.error", () => {
    const error = new Error("Favorites error for logging");
    renderWithI18n(<FavoritesError error={error} reset={vi.fn()} />);
    expect(consoleSpy).toHaveBeenCalledWith(error);
  });

  it("has neutral-950 background", () => {
    const { container } = renderWithI18n(
      <FavoritesError {...defaultProps} />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("bg-neutral-950");
    expect(wrapper.className).toContain("min-h-screen");
  });
});
