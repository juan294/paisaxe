import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n";
import ImmersiveError from "./error";

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
    renderWithI18n(<ImmersiveError {...defaultProps} />);
    expect(
      screen.getByText("No se pudo cargar la experiencia")
    ).toBeInTheDocument();
  });

  it("renders the error description", () => {
    renderWithI18n(<ImmersiveError {...defaultProps} />);
    expect(
      screen.getByText(
        "Algo falló al cargar las historias. Inténtalo de nuevo."
      )
    ).toBeInTheDocument();
  });

  it("renders a retry button", () => {
    renderWithI18n(<ImmersiveError {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Reintentar" })
    ).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", () => {
    const reset = vi.fn();
    renderWithI18n(<ImmersiveError error={new Error("fail")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("logs the error to console.error", () => {
    const error = new Error("Immersive error for logging");
    renderWithI18n(<ImmersiveError error={error} reset={vi.fn()} />);
    expect(consoleSpy).toHaveBeenCalledWith(error);
  });

  it("has fixed full-screen dark background", () => {
    const { container } = renderWithI18n(<ImmersiveError {...defaultProps} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("fixed");
    expect(wrapper.className).toContain("inset-0");
    expect(wrapper.className).toContain("bg-neutral-950");
  });

  it("renders a home link", () => {
    renderWithI18n(<ImmersiveError {...defaultProps} />);
    const link = screen.getByRole("link", { name: "Volver al inicio" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });
});
