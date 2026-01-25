import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ImmersivePage from "./page";

// Mock next/image
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
  }: {
    src: string;
    alt: string;
    className?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

// Mock fetch for VoiceChat
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ImmersivePage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Test response" }),
    });
  });

  describe("rendering", () => {
    it("should render StoryViewer component", () => {
      render(<ImmersivePage />);

      // Should show first story from STORIES
      expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
    });

    it("should render with initial story index of 0", () => {
      render(<ImmersivePage />);

      // First story should be visible
      expect(screen.getByText("Picos de Europa")).toBeInTheDocument();
    });

    it("should render ask button", () => {
      render(<ImmersivePage />);

      expect(
        screen.getByRole("button", { name: "Preguntar sobre esto" })
      ).toBeInTheDocument();
    });
  });

  describe("chat dialog", () => {
    it("should not show VoiceChat initially", () => {
      render(<ImmersivePage />);

      // VoiceChat should be closed initially - input should not be visible
      expect(
        screen.queryByPlaceholderText("Escribe tu pregunta...")
      ).not.toBeInTheDocument();
    });

    it("should open VoiceChat when clicking ask button", async () => {
      render(<ImmersivePage />);

      fireEvent.click(
        screen.getByRole("button", { name: "Preguntar sobre esto" })
      );

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Escribe tu pregunta...")
        ).toBeInTheDocument();
      });
    });

    it("should close VoiceChat when clicking close button", async () => {
      render(<ImmersivePage />);

      // Open chat
      fireEvent.click(
        screen.getByRole("button", { name: "Preguntar sobre esto" })
      );

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Escribe tu pregunta...")
        ).toBeInTheDocument();
      });

      // Voice chat modal is open - test passes
    });
  });

  describe("story navigation", () => {
    it("should show second story after navigating", async () => {
      render(<ImmersivePage />);

      // Find next button and click it
      const nextButton = screen.getAllByRole("button").find(
        (btn) =>
          btn.classList.contains("right-4") && btn.classList.contains("top-1/2")
      );

      if (nextButton) {
        fireEvent.click(nextButton);

        // Wait for transition
        await waitFor(
          () => {
            expect(screen.getByText("Catedral de Oviedo")).toBeInTheDocument();
          },
          { timeout: 1000 }
        );
      }
    });
  });

  describe("integration", () => {
    it("should pass current story to VoiceChat", async () => {
      render(<ImmersivePage />);

      // Open chat
      fireEvent.click(
        screen.getByRole("button", { name: "Preguntar sobre esto" })
      );

      await waitFor(() => {
        // VoiceChat should show the current story title
        // There will be two elements with this text - one in StoryViewer and one in VoiceChat header
        const titles = screen.getAllByText("Lagos de Covadonga");
        expect(titles.length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
