import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatActions } from "./chat-actions";
import { createMockT } from "@/test/i18n-mock";

// Mock the clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.assign(navigator, { clipboard: mockClipboard });

// Mock i18n
const mockT = createMockT();
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "es",
    setLocale: vi.fn(),
    t: (key: string) => mockT(key),
  }),
}));

interface Message {
  role: "user" | "assistant";
  content: string;
}

describe("ChatActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("copy button", () => {
    it("renders copy button when messages exist", () => {
      const messages: Message[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ];

      render(<ChatActions messages={messages} />);

      // Test uses Spanish translations from mock
      expect(
        screen.getByRole("button", { name: /copiar conversación/i })
      ).toBeInTheDocument();
    });

    it("does not render when no messages", () => {
      render(<ChatActions messages={[]} />);

      expect(
        screen.queryByRole("button", { name: /copiar conversación/i })
      ).not.toBeInTheDocument();
    });

    it("copies conversation to clipboard when clicked", async () => {
      const messages: Message[] = [
        { role: "user", content: "What is the phone number?" },
        { role: "assistant", content: "The number is 985 123 456." },
      ];

      render(<ChatActions messages={messages} />);

      const copyButton = screen.getByRole("button", {
        name: /copiar conversación/i,
      });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
      });

      // Should include both user and assistant messages
      const clipboardContent = mockClipboard.writeText.mock.calls[0][0];
      expect(clipboardContent).toContain("What is the phone number?");
      expect(clipboardContent).toContain("The number is 985 123 456.");
    });

    it("shows check icon when copied", async () => {
      const messages: Message[] = [
        { role: "assistant", content: "Hello!" },
      ];

      const { container } = render(<ChatActions messages={messages} />);

      const copyButton = screen.getByRole("button", {
        name: /copiar conversación/i,
      });
      fireEvent.click(copyButton);

      await waitFor(() => {
        // After copying, the check icon should appear (lucide-check class)
        const checkIcon = container.querySelector(".lucide-check");
        expect(checkIcon).toBeInTheDocument();
      });
    });

    it("resets check icon back to copy icon after 2s timeout", async () => {
      const messages: Message[] = [
        { role: "assistant", content: "Hello!" },
      ];

      const { container } = render(<ChatActions messages={messages} />);

      const copyButton = screen.getByRole("button", {
        name: /copiar conversación/i,
      });

      // Click copy
      fireEvent.click(copyButton);

      // Check icon should be shown after clipboard write resolves
      await waitFor(() => {
        expect(container.querySelector(".lucide-check")).toBeInTheDocument();
      });

      // Wait for the 2s timeout at line 66 to reset copied state
      await waitFor(
        () => {
          expect(container.querySelector(".lucide-copy")).toBeInTheDocument();
          expect(container.querySelector(".lucide-check")).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it("does not render when isLoading is true", () => {
      const messages: Message[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ];

      render(<ChatActions messages={messages} isLoading={true} />);

      expect(
        screen.queryByRole("button", { name: /copiar conversación/i })
      ).not.toBeInTheDocument();
    });

    it("renders after loading completes", () => {
      const messages: Message[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ];

      render(<ChatActions messages={messages} isLoading={false} />);

      expect(
        screen.getByRole("button", { name: /copiar conversación/i })
      ).toBeInTheDocument();
    });
  });

  describe("call button", () => {
    it("renders call button when phone number detected in last assistant message", () => {
      const messages: Message[] = [
        { role: "user", content: "What is the phone number?" },
        { role: "assistant", content: "You can call them at 985 123 456." },
      ];

      render(<ChatActions messages={messages} />);

      // Spanish translation for "Call"
      const callButton = screen.getByRole("link", { name: /llamar/i });
      expect(callButton).toBeInTheDocument();
      expect(callButton).toHaveAttribute("href", "tel:+34985123456");
    });

    it("renders call button for international format phone", () => {
      const messages: Message[] = [
        { role: "assistant", content: "Call +34 985 887 797 for reservations." },
      ];

      render(<ChatActions messages={messages} />);

      const callButton = screen.getByRole("link", { name: /llamar/i });
      expect(callButton).toHaveAttribute("href", "tel:+34985887797");
    });

    it("does not render call button when no phone detected", () => {
      const messages: Message[] = [
        { role: "assistant", content: "This is a beautiful place to visit." },
      ];

      render(<ChatActions messages={messages} />);

      expect(screen.queryByRole("link", { name: /llamar/i })).not.toBeInTheDocument();
    });

    it("only analyzes last assistant message for phone numbers", () => {
      const messages: Message[] = [
        { role: "assistant", content: "The old number was 985 111 111." },
        { role: "user", content: "What about the new number?" },
        { role: "assistant", content: "They don't have a phone anymore." },
      ];

      render(<ChatActions messages={messages} />);

      // Should not show call button because last assistant message has no phone
      expect(screen.queryByRole("link", { name: /llamar/i })).not.toBeInTheDocument();
    });

    it("renders multiple call buttons for multiple phones", () => {
      const messages: Message[] = [
        {
          role: "assistant",
          content: "Reception: 985 123 456. Mobile: 612 345 678.",
        },
      ];

      render(<ChatActions messages={messages} />);

      const callButtons = screen.getAllByRole("link", { name: /llamar/i });
      expect(callButtons).toHaveLength(2);
    });
  });

  describe("directions button", () => {
    it("renders directions button when address detected", () => {
      const messages: Message[] = [
        { role: "assistant", content: "Located at Calle San Francisco, 12, Oviedo." },
      ];

      render(<ChatActions messages={messages} />);

      // Spanish translation for "Directions"
      const directionsButton = screen.getByRole("link", { name: /cómo llegar/i });
      expect(directionsButton).toBeInTheDocument();
      expect(directionsButton).toHaveAttribute(
        "href",
        expect.stringContaining("google.com/maps")
      );
    });

    it("does not render directions button when no address detected", () => {
      const messages: Message[] = [
        { role: "assistant", content: "Asturias is a beautiful region." },
      ];

      render(<ChatActions messages={messages} />);

      expect(
        screen.queryByRole("link", { name: /cómo llegar/i })
      ).not.toBeInTheDocument();
    });

    it("renders directions button for Plaza addresses", () => {
      const messages: Message[] = [
        { role: "assistant", content: "Visit Plaza del Ayuntamiento, 1, Oviedo." },
      ];

      render(<ChatActions messages={messages} />);

      expect(screen.getByRole("link", { name: /cómo llegar/i })).toBeInTheDocument();
    });

    it("opens in new tab", () => {
      const messages: Message[] = [
        { role: "assistant", content: "Located at Calle Uría, 58, Oviedo." },
      ];

      render(<ChatActions messages={messages} />);

      const directionsButton = screen.getByRole("link", { name: /cómo llegar/i });
      expect(directionsButton).toHaveAttribute("target", "_blank");
      expect(directionsButton).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("shows only one directions button even when multiple addresses detected", () => {
      const messages: Message[] = [
        {
          role: "assistant",
          content:
            "Desde allí tienes rutas de senderismo preciosas, como la subida a Calle Mayor, 5, Oviedo o simplemente dar un paseo por Plaza del Fontán, Oviedo.",
        },
      ];

      render(<ChatActions messages={messages} />);

      // Should only show ONE directions button
      const directionsButtons = screen.getAllByRole("link", { name: /cómo llegar/i });
      expect(directionsButtons).toHaveLength(1);
    });
  });

  describe("combined scenarios", () => {
    it("renders both call and directions when both detected", () => {
      const messages: Message[] = [
        {
          role: "assistant",
          content:
            "Casa Gerardo is at Calle Prendes, 1, Prendes. Call 985 887 797 to book.",
        },
      ];

      render(<ChatActions messages={messages} />);

      expect(screen.getByRole("link", { name: /llamar/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /cómo llegar/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /copiar conversación/i })
      ).toBeInTheDocument();
    });

    it("renders nothing when no messages and no actions", () => {
      const { container } = render(<ChatActions messages={[]} />);

      // Component should render nothing
      expect(container.firstChild).toBeNull();
    });
  });

  describe("accessibility", () => {
    it("has accessible labels for all buttons", () => {
      const messages: Message[] = [
        {
          role: "assistant",
          content: "Call 985 123 456 at Calle Uría, 58, Oviedo.",
        },
      ];

      render(<ChatActions messages={messages} />);

      // All interactive elements should be accessible (Spanish labels)
      expect(screen.getByRole("link", { name: /llamar/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /cómo llegar/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /copiar conversación/i })
      ).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("shows copy button but no actions when messages contain only user messages", () => {
      const messages: Message[] = [
        { role: "user", content: "Hello" },
        { role: "user", content: "Anyone there?" },
      ];

      render(<ChatActions messages={messages} />);

      // Copy button should still render (messages exist, not loading)
      expect(
        screen.getByRole("button", { name: /copiar conversación/i })
      ).toBeInTheDocument();

      // No call or directions buttons (no assistant message to analyze)
      expect(screen.queryByRole("link", { name: /llamar/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /cómo llegar/i })).not.toBeInTheDocument();
    });

    it("clears existing timer when copy is clicked twice quickly", async () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      const messages: Message[] = [
        { role: "assistant", content: "Hello!" },
      ];

      render(<ChatActions messages={messages} />);

      const copyButton = screen.getByRole("button", {
        name: /copiar conversación/i,
      });

      // Click copy first time
      fireEvent.click(copyButton);
      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
      });

      // Click copy again immediately (before the 2s reset timer fires)
      // This should trigger clearTimeout on the existing timer
      fireEvent.click(copyButton);
      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledTimes(2);
      });

      // clearTimeout should have been called to cancel the first timer
      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });

    it("handles clipboard writeText failure gracefully", async () => {
      const originalWriteText = mockClipboard.writeText;
      mockClipboard.writeText = vi.fn().mockRejectedValue(new Error("Clipboard API not available"));

      const messages: Message[] = [
        { role: "assistant", content: "Hello!" },
      ];

      const { container } = render(<ChatActions messages={messages} />);

      const copyButton = screen.getByRole("button", {
        name: /copiar conversación/i,
      });

      // Should not throw even though clipboard fails
      fireEvent.click(copyButton);

      // Wait for the rejection to be handled
      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
      });

      // The copy icon should still be shown (not the check icon, since copy failed)
      // Wait a tick to allow the catch block to execute
      await waitFor(() => {
        const copyIcon = container.querySelector(".lucide-copy");
        expect(copyIcon).toBeInTheDocument();
      });

      // Restore
      mockClipboard.writeText = originalWriteText;
    });
  });
});
