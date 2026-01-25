import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoiceChat } from "./voice-chat";
import { Story } from "@/types/immersive";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockStory: Story = {
  id: "story-1",
  title: "Lagos de Covadonga",
  subtitle: "Picos de Europa",
  description: "Beautiful glacial lakes in the mountains",
  image: "/images/lagos.jpg",
  category: "nature",
  sourcePdf: "nature-guide.pdf",
};

// Mock SpeechRecognition
const createMockSpeechRecognition = () => {
  const handlers: {
    onresult?: (event: { results: [[{ transcript: string }]] }) => void;
    onerror?: () => void;
    onend?: () => void;
  } = {};

  return {
    continuous: false,
    interimResults: false,
    lang: "",
    start: vi.fn(),
    stop: vi.fn(),
    set onresult(fn: typeof handlers.onresult) {
      handlers.onresult = fn;
    },
    set onerror(fn: typeof handlers.onerror) {
      handlers.onerror = fn;
    },
    set onend(fn: typeof handlers.onend) {
      handlers.onend = fn;
    },
    // Helper methods for testing
    _triggerResult: (transcript: string) => {
      handlers.onresult?.({ results: [[{ transcript }]] });
    },
    _triggerError: () => {
      handlers.onerror?.();
    },
    _triggerEnd: () => {
      handlers.onend?.();
    },
  };
};

describe("VoiceChat", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Reset speech recognition mock
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      writable: true,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should not render when closed", () => {
      const { container } = render(
        <VoiceChat story={mockStory} open={false} onClose={() => {}} />
      );

      expect(container.firstChild).toBeNull();
    });

    it("should render when open", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      expect(screen.getByText("Lagos de Covadonga")).toBeInTheDocument();
      expect(screen.getByText("Picos de Europa")).toBeInTheDocument();
    });

    it("should show placeholder text when no messages", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      expect(
        screen.getByText("Pregunta lo que quieras sobre este lugar")
      ).toBeInTheDocument();
    });

    it("should render close button", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      // Look for the X icon in the close button by finding button with X svg
      const buttons = screen.getAllByRole("button");
      const closeButton = buttons.find((btn) => {
        const svg = btn.querySelector("svg");
        return svg?.classList.contains("lucide-x");
      });
      expect(closeButton).toBeInTheDocument();
    });

    it("should render input field", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      expect(
        screen.getByPlaceholderText("Escribe tu pregunta...")
      ).toBeInTheDocument();
    });

    it("should render submit button", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const buttons = screen.getAllByRole("button");
      const submitButton = buttons.find((btn) =>
        btn.getAttribute("type") === "submit"
      );
      expect(submitButton).toBeInTheDocument();
    });
  });

  describe("close functionality", () => {
    it("should call onClose when close button is clicked", () => {
      const onClose = vi.fn();
      render(<VoiceChat story={mockStory} open={true} onClose={onClose} />);

      // Look for the X icon close button
      const buttons = screen.getAllByRole("button");
      const closeButton = buttons.find((btn) => {
        const svg = btn.querySelector("svg");
        return svg?.classList.contains("lucide-x");
      });

      if (closeButton) {
        fireEvent.click(closeButton);
        expect(onClose).toHaveBeenCalled();
      }
    });

    it("should call onClose when clicking backdrop", () => {
      const onClose = vi.fn();
      render(<VoiceChat story={mockStory} open={true} onClose={onClose} />);

      const backdrop = document.querySelector(".bg-black\\/60");
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalled();
      }
    });
  });

  describe("message sending", () => {
    it("should send message on form submit", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Response from AI" }),
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Tell me about the lakes");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("Tell me about the lakes"),
        });
      });
    });

    it("should display user message after sending", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Response from AI" }),
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "My question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(screen.getByText("My question")).toBeInTheDocument();
      });
    });

    it("should display assistant response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "This is the AI response" }),
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(screen.getByText("This is the AI response")).toBeInTheDocument();
      });
    });

    it("should show loading indicator while waiting for response", async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(pendingPromise);

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(screen.getByText("Pensando...")).toBeInTheDocument();
      });

      // Resolve to cleanup
      resolvePromise!({
        ok: true,
        json: async () => ({ message: "Done" }),
      });
    });

    it("should display error message on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(
          screen.getByText("Lo siento, hubo un error. Intenta de nuevo.")
        ).toBeInTheDocument();
      });
    });

    it("should display fallback message when response has no message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(
          screen.getByText("Lo siento, no pude procesar tu pregunta.")
        ).toBeInTheDocument();
      });
    });

    it("should not submit empty message", async () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      const form = input.closest("form");

      if (form) {
        fireEvent.submit(form);
      }

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should not submit whitespace-only message", async () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "   ");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should clear input after sending message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Response" }),
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...") as HTMLInputElement;
      await userEvent.type(input, "My question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(input.value).toBe("");
      });
    });

    it("should include story context in API request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Response" }),
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(callBody.context).toContain("Lagos de Covadonga");
        expect(callBody.context).toContain("Picos de Europa");
        expect(callBody.context).toContain("nature-guide.pdf");
      });
    });
  });

  describe("story change", () => {
    it("should reset messages when story changes", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "First response" }),
      });

      const { rerender } = render(
        <VoiceChat story={mockStory} open={true} onClose={() => {}} />
      );

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(screen.getByText("First response")).toBeInTheDocument();
      });

      // Change story
      const newStory: Story = {
        ...mockStory,
        id: "story-2",
        title: "Different Story",
      };

      rerender(<VoiceChat story={newStory} open={true} onClose={() => {}} />);

      // Messages should be cleared
      expect(screen.queryByText("First response")).not.toBeInTheDocument();
      expect(screen.queryByText("Question")).not.toBeInTheDocument();
    });
  });

  describe("submit button state", () => {
    it("should disable submit button when input is empty", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const submitButton = screen
        .getAllByRole("button")
        .find((btn) => btn.getAttribute("type") === "submit");

      expect(submitButton).toBeDisabled();
    });

    it("should enable submit button when input has text", async () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Some text");

      const submitButton = screen
        .getAllByRole("button")
        .find((btn) => btn.getAttribute("type") === "submit");

      expect(submitButton).not.toBeDisabled();
    });

    it("should disable submit button while loading", async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(pendingPromise);

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        const submitButton = screen
          .getAllByRole("button")
          .find((btn) => btn.getAttribute("type") === "submit");
        expect(submitButton).toBeDisabled();
      });

      // Cleanup
      resolvePromise!({
        ok: true,
        json: async () => ({ message: "Done" }),
      });
    });
  });

  describe("error handling", () => {
    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "Question");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(
          screen.getByText("Lo siento, hubo un error. Intenta de nuevo.")
        ).toBeInTheDocument();
      });
    });
  });

  describe("message styling", () => {
    it("should style user messages differently from assistant messages", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "AI response" }),
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const input = screen.getByPlaceholderText("Escribe tu pregunta...");
      await userEvent.type(input, "User message");

      const form = input.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        const userMsg = screen.getByText("User message");
        const aiMsg = screen.getByText("AI response");

        expect(userMsg.closest("div")).toHaveClass("ml-auto", "bg-white");
        expect(aiMsg.closest("div")).toHaveClass("bg-white/20");
      });
    });
  });

  describe("speech recognition", () => {
    it("should show speech support message when available", () => {
      const mockRecognition = createMockSpeechRecognition();
      Object.defineProperty(window, "SpeechRecognition", {
        value: vi.fn(() => mockRecognition),
        writable: true,
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      expect(
        screen.getByText("Puedes usar el micrófono para hablar")
      ).toBeInTheDocument();
    });

    it("should not show speech support message when not available", () => {
      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      expect(
        screen.queryByText("Puedes usar el micrófono para hablar")
      ).not.toBeInTheDocument();
    });

    it("should render mic button when speech recognition is supported", () => {
      const mockRecognition = createMockSpeechRecognition();
      Object.defineProperty(window, "SpeechRecognition", {
        value: vi.fn(() => mockRecognition),
        writable: true,
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const buttons = screen.getAllByRole("button");
      const micButton = buttons.find((btn) => {
        const svg = btn.querySelector("svg");
        return svg?.classList.contains("lucide-mic");
      });
      expect(micButton).toBeInTheDocument();
    });

    it("should start listening when mic button is clicked", () => {
      const mockRecognition = createMockSpeechRecognition();
      const MockConstructor = vi.fn(() => mockRecognition);
      Object.defineProperty(window, "SpeechRecognition", {
        value: MockConstructor,
        writable: true,
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const buttons = screen.getAllByRole("button");
      const micButton = buttons.find((btn) => {
        const svg = btn.querySelector("svg");
        return svg?.classList.contains("lucide-mic");
      });

      if (micButton) {
        fireEvent.click(micButton);
        expect(mockRecognition.start).toHaveBeenCalled();
      }
    });

    it("should stop listening when mic button is clicked while listening", () => {
      const mockRecognition = createMockSpeechRecognition();
      Object.defineProperty(window, "SpeechRecognition", {
        value: vi.fn(() => mockRecognition),
        writable: true,
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const buttons = screen.getAllByRole("button");
      const micButton = buttons.find((btn) => {
        const svg = btn.querySelector("svg");
        return svg?.classList.contains("lucide-mic");
      });

      if (micButton) {
        // Start listening
        fireEvent.click(micButton);

        // Now stop listening
        fireEvent.click(micButton);
        expect(mockRecognition.stop).toHaveBeenCalled();
      }
    });

    it("should show 'Escuchando...' placeholder when listening", () => {
      const mockRecognition = createMockSpeechRecognition();
      Object.defineProperty(window, "SpeechRecognition", {
        value: vi.fn(() => mockRecognition),
        writable: true,
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const buttons = screen.getAllByRole("button");
      const micButton = buttons.find((btn) => {
        const svg = btn.querySelector("svg");
        return svg?.classList.contains("lucide-mic");
      });

      if (micButton) {
        fireEvent.click(micButton);

        const input = screen.getByPlaceholderText("Escuchando...");
        expect(input).toBeInTheDocument();
        expect(input).toBeDisabled();
      }
    });

    it("should set input value from speech recognition result", async () => {
      const mockRecognition = createMockSpeechRecognition();
      Object.defineProperty(window, "SpeechRecognition", {
        value: vi.fn(() => mockRecognition),
        writable: true,
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const buttons = screen.getAllByRole("button");
      const micButton = buttons.find((btn) => {
        const svg = btn.querySelector("svg");
        return svg?.classList.contains("lucide-mic");
      });

      if (micButton) {
        fireEvent.click(micButton);

        // Simulate speech recognition result
        mockRecognition._triggerResult("Hello from speech");

        await waitFor(() => {
          const input = screen.getByPlaceholderText(
            "Escribe tu pregunta..."
          ) as HTMLInputElement;
          expect(input.value).toBe("Hello from speech");
        });
      }
    });

    it("should stop listening on speech recognition error", async () => {
      const mockRecognition = createMockSpeechRecognition();
      Object.defineProperty(window, "SpeechRecognition", {
        value: vi.fn(() => mockRecognition),
        writable: true,
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const buttons = screen.getAllByRole("button");
      const micButton = buttons.find((btn) => {
        const svg = btn.querySelector("svg");
        return svg?.classList.contains("lucide-mic");
      });

      if (micButton) {
        fireEvent.click(micButton);

        // Verify we're listening
        expect(screen.getByPlaceholderText("Escuchando...")).toBeInTheDocument();

        // Simulate error
        mockRecognition._triggerError();

        await waitFor(() => {
          expect(
            screen.getByPlaceholderText("Escribe tu pregunta...")
          ).toBeInTheDocument();
        });
      }
    });

    it("should stop listening on speech recognition end", async () => {
      const mockRecognition = createMockSpeechRecognition();
      Object.defineProperty(window, "SpeechRecognition", {
        value: vi.fn(() => mockRecognition),
        writable: true,
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const buttons = screen.getAllByRole("button");
      const micButton = buttons.find((btn) => {
        const svg = btn.querySelector("svg");
        return svg?.classList.contains("lucide-mic");
      });

      if (micButton) {
        fireEvent.click(micButton);

        // Simulate end
        mockRecognition._triggerEnd();

        await waitFor(() => {
          expect(
            screen.getByPlaceholderText("Escribe tu pregunta...")
          ).toBeInTheDocument();
        });
      }
    });

    it("should support webkitSpeechRecognition", () => {
      const mockRecognition = createMockSpeechRecognition();
      Object.defineProperty(window, "webkitSpeechRecognition", {
        value: vi.fn(() => mockRecognition),
        writable: true,
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      expect(
        screen.getByText("Puedes usar el micrófono para hablar")
      ).toBeInTheDocument();
    });

    it("should show MicOff icon when listening", () => {
      const mockRecognition = createMockSpeechRecognition();
      Object.defineProperty(window, "SpeechRecognition", {
        value: vi.fn(() => mockRecognition),
        writable: true,
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      const buttons = screen.getAllByRole("button");
      const micButton = buttons.find((btn) => {
        const svg = btn.querySelector("svg");
        return svg?.classList.contains("lucide-mic");
      });

      if (micButton) {
        fireEvent.click(micButton);

        // Should now show MicOff icon
        const micOffButton = screen.getAllByRole("button").find((btn) => {
          const svg = btn.querySelector("svg");
          return svg?.classList.contains("lucide-mic-off");
        });
        expect(micOffButton).toBeInTheDocument();
      }
    });

    it("should configure speech recognition with correct settings", () => {
      const mockRecognition = createMockSpeechRecognition();
      Object.defineProperty(window, "SpeechRecognition", {
        value: vi.fn(() => mockRecognition),
        writable: true,
      });

      render(<VoiceChat story={mockStory} open={true} onClose={() => {}} />);

      expect(mockRecognition.continuous).toBe(false);
      expect(mockRecognition.interimResults).toBe(false);
      expect(mockRecognition.lang).toBe("es-ES");
    });
  });
});
