import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivacyPage, { metadata } from "./page";

describe("PrivacyPage", () => {
  it("should export correct metadata", () => {
    expect(metadata.title).toBe("Política de Privacidad | Paisaxe");
    expect(metadata.description).toBe("Política de privacidad de Paisaxe");
  });

  it("should render the privacy policy heading", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Política de Privacidad" })).toBeInTheDocument();
  });

  it("should render all main sections", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("1. Información que recopilamos")).toBeInTheDocument();
    expect(screen.getByText("2. Cómo usamos tu información")).toBeInTheDocument();
    expect(screen.getByText("3. Servicios de terceros")).toBeInTheDocument();
    expect(screen.getByText("4. Cookies")).toBeInTheDocument();
    expect(screen.getByText("5. Retención de datos")).toBeInTheDocument();
    expect(screen.getByText("6. Tus derechos")).toBeInTheDocument();
    expect(screen.getByText("7. Seguridad")).toBeInTheDocument();
    expect(screen.getByText("8. Cambios a esta política")).toBeInTheDocument();
    expect(screen.getByText("9. Contacto")).toBeInTheDocument();
  });

  it("should list third-party services", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("Supabase")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("Stripe")).toBeInTheDocument();
    expect(screen.getByText("Anthropic (Claude)")).toBeInTheDocument();
    expect(screen.getByText("ElevenLabs")).toBeInTheDocument();
    expect(screen.getByText("Twilio")).toBeInTheDocument();
  });

  it("should have a contact email link", () => {
    render(<PrivacyPage />);
    const link = screen.getByRole("link", { name: "support@paisaxe.es" });
    expect(link).toHaveAttribute("href", "mailto:support@paisaxe.es");
  });

  it("should render in a semantic main/article structure", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("article")).toBeInTheDocument();
  });
});
