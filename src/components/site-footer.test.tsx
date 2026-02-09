import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "./site-footer";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "footer.terms": "Terms of Service",
        "footer.privacy": "Privacy Policy",
        "footer.content_attribution": "Content based on materials from Turismo de Asturias",
        "footer.ai_disclaimer": "Responses are AI-generated and should be verified",
      };
      return translations[key] || key;
    },
    locale: "es",
  }),
}));

describe("SiteFooter", () => {
  it("renders terms of service link", () => {
    render(<SiteFooter />);
    const link = screen.getByRole("link", { name: /Terms of Service/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/terms");
  });

  it("renders privacy policy link", () => {
    render(<SiteFooter />);
    const link = screen.getByRole("link", { name: /Privacy Policy/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/privacy");
  });

  it("renders content attribution", () => {
    render(<SiteFooter />);
    expect(
      screen.getByText("Content based on materials from Turismo de Asturias")
    ).toBeInTheDocument();
  });

  it("renders AI disclaimer", () => {
    render(<SiteFooter />);
    expect(
      screen.getByText("Responses are AI-generated and should be verified")
    ).toBeInTheDocument();
  });

  it("renders as a footer element with proper role", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});
