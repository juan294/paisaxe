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

    it("shows confirmation when copied", async () => {
      const messages: Message[] = [
        { role: "assistant", content: "Hello!" },
      ];

      render(<ChatActions messages={messages} />);

      const copyButton = screen.getByRole("button", {
        name: /copiar conversación/i,
      });
      fireEvent.click(copyButton);

      await waitFor(() => {
        // Spanish translation for "Copied"
        expect(screen.getByText(/copiado/i)).toBeInTheDocument();
      });
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
});
