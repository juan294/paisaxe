import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RootLayout, { metadata } from "./layout";

// Mock next/font/google
vi.mock("next/font/google", () => ({
  Inter: () => ({
    variable: "--font-inter",
    className: "inter-font",
  }),
}));

describe("RootLayout", () => {
  describe("metadata", () => {
    it("should have correct title", () => {
      expect(metadata.title).toBe("Paisaxe | Descubre Asturias");
    });

    it("should have correct description", () => {
      expect(metadata.description).toContain("Tu guía personal para explorar Asturias");
      expect(metadata.description).toContain("Your personal guide to explore Asturias");
    });

    it("should have relevant keywords", () => {
      expect(metadata.keywords).toContain("Paisaxe");
      expect(metadata.keywords).toContain("Asturias");
      expect(metadata.keywords).toContain("turismo");
      expect(metadata.keywords).toContain("tourism");
      expect(metadata.keywords).toContain("Spain");
      expect(metadata.keywords).toContain("travel");
      expect(metadata.keywords).toContain("sidra");
      expect(metadata.keywords).toContain("naturaleza");
    });
  });

  describe("rendering", () => {
    it("should render children", () => {
      render(
        <RootLayout>
          <div data-testid="child">Test Child</div>
        </RootLayout>
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByText("Test Child")).toBeInTheDocument();
    });

    it("should set html lang to es", () => {
      render(
        <RootLayout>
          <div>Content</div>
        </RootLayout>
      );

      const html = document.documentElement;
      expect(html.getAttribute("lang")).toBe("es");
    });

    it("should apply font classes to body", () => {
      render(
        <RootLayout>
          <div>Content</div>
        </RootLayout>
      );

      const body = document.body;
      expect(body.className).toContain("font-sans");
      expect(body.className).toContain("antialiased");
    });
  });
});
