import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as Sentry from "@sentry/nextjs";
import { LanguageProvider } from "@/lib/i18n";
import {
  GLASS_RETRY_BUTTON_CLASS,
  GLASS_HOME_LINK_CLASS,
} from "@/lib/error-boundary-styles";
import ImmersiveError from "./error";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
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

describe("ImmersiveError", () => {
  const consoleSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  const captureSpy = vi.mocked(Sentry.captureException);

  afterEach(() => {
    consoleSpy.mockClear();
    captureSpy.mockClear();
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

  it("captures the error to Sentry", () => {
    const error = new Error("Immersive error for Sentry");
    renderWithI18n(<ImmersiveError error={error} reset={vi.fn()} />);
    expect(captureSpy).toHaveBeenCalledWith(error);
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

  // UX-M4: converged error-boundary treatment across all four boundaries
  it("UX-M4: wrapper has role=alert for screen reader announcement", () => {
    renderWithI18n(<ImmersiveError {...defaultProps} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("UX-M4: retry button has a visible focus ring", () => {
    renderWithI18n(<ImmersiveError {...defaultProps} />);
    const btn = screen.getByRole("button", { name: "Reintentar" });
    expect(btn.className).toMatch(/focus-visible:ring-2/);
  });

  it("UX-M4: retry button uses the shared glass treatment (matches favorites/global-error)", () => {
    renderWithI18n(<ImmersiveError {...defaultProps} />);
    const btn = screen.getByRole("button", { name: "Reintentar" });
    expect(btn.className).toBe(GLASS_RETRY_BUTTON_CLASS);
  });

  it("UX-M4: home link has a visible focus ring", () => {
    renderWithI18n(<ImmersiveError {...defaultProps} />);
    const link = screen.getByRole("link", { name: "Volver al inicio" });
    expect(link.className).toMatch(/focus-visible:ring-2/);
  });

  it("UX-M4: home link uses the shared glass treatment (matches favorites/global-error)", () => {
    renderWithI18n(<ImmersiveError {...defaultProps} />);
    const link = screen.getByRole("link", { name: "Volver al inicio" });
    expect(link.className).toBe(GLASS_HOME_LINK_CLASS);
  });
});
