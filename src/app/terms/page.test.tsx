import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TermsPage, { metadata } from "./page";

describe("TermsPage", () => {
  it("should export correct metadata", () => {
    expect(metadata.title).toBe("Términos de Servicio | Paisaxe");
    expect(metadata.description).toBe("Términos y condiciones de uso de Paisaxe");
  });

  it("should render the terms heading", () => {
    render(<TermsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Términos de Servicio" })).toBeInTheDocument();
  });

  it("should render all main sections", () => {
    render(<TermsPage />);
    expect(screen.getByText("1. Descripción del servicio")).toBeInTheDocument();
    expect(screen.getByText("2. Uso del servicio")).toBeInTheDocument();
    expect(screen.getByText("3. VoicePass y pagos")).toBeInTheDocument();
    expect(screen.getByText("4. Contenido generado por IA")).toBeInTheDocument();
    expect(screen.getByText("5. Reservas")).toBeInTheDocument();
    expect(screen.getByText("6. Propiedad intelectual")).toBeInTheDocument();
    expect(screen.getByText("7. Limitación de responsabilidad")).toBeInTheDocument();
    expect(screen.getByText("8. Modificaciones")).toBeInTheDocument();
    expect(screen.getByText("9. Legislación aplicable")).toBeInTheDocument();
    expect(screen.getByText("10. Contacto")).toBeInTheDocument();
  });

  it("should mention VoicePass pricing", () => {
    render(<TermsPage />);
    expect(screen.getByText(/1,99 €/)).toBeInTheDocument();
  });

  it("should have a contact email link", () => {
    render(<TermsPage />);
    const link = screen.getByRole("link", { name: "support@paisaxe.es" });
    expect(link).toHaveAttribute("href", "mailto:support@paisaxe.es");
  });

  it("should render in a semantic main/article structure", () => {
    render(<TermsPage />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("article")).toBeInTheDocument();
  });
});
